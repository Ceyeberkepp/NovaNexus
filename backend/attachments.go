package main

import (
 "fmt"
 "io"
 "mime"
 "net/http"
 "path/filepath"
 "strconv"
 "strings"
 "time"
 "unicode"
 "unicode/utf8"
)

const maxMessageAttachmentBytes = 10 << 20

func safeAttachmentName(s string) string {
 s=strings.TrimSpace(filepath.Base(strings.ReplaceAll(s,"\\","/")))
 s=strings.Map(func(r rune) rune {if unicode.IsControl(r)||r=='/'||r=='\\'{return -1};return r},s)
 if s==""||s=="."||s==".."{return "attachment"}
 if len(s)>180 {
  for len(s)>180 {_,sz:=utf8.DecodeLastRuneInString(s);s=s[:len(s)-sz]}
 }
 return s
}

// A stored attachment is accessible ONLY to its direct-message sender or
// recipient; URLs are not unauthenticated public links.
func (s *Server) messageAttachmentAPI(w http.ResponseWriter,r *http.Request) {
 u,err:=s.who(r);if err!=nil{fail(w,401,"Sign in required");return}
 if u.MustChange{fail(w,403,"Password change required");return}
 if r.Method=="GET" {
  id,err:=strconv.ParseInt(r.URL.Query().Get("id"),10,64)
  if err!=nil||id<=0{fail(w,400,"Invalid attachment ID");return}
  var name,kind string;var data []byte
  err=s.db.QueryRow(r.Context(),`SELECT a.filename,a.content_type,a.content FROM message_attachments a
 JOIN direct_messages m ON m.id=a.message_id WHERE a.message_id=$1 AND (m.sender_id=$2 OR m.recipient_id=$2)`,id,u.ID).Scan(&name,&kind,&data)
  if err!=nil{fail(w,404,"Attachment not found");return}
  disposition:="attachment"
  if kind=="image/jpeg"||kind=="image/png"||kind=="image/gif"||kind=="image/webp"{disposition="inline"}
  w.Header().Set("Content-Type",kind)
  w.Header().Set("Content-Disposition",mime.FormatMediaType(disposition,map[string]string{"filename":name}))
  w.Header().Set("Cache-Control","private, no-store")
  w.Header().Set("X-Content-Type-Options","nosniff")
  w.Header().Set("Content-Length",strconv.Itoa(len(data)))
  _,_=w.Write(data)
  return
 }
 if r.Method!="POST"{fail(w,405,"Method not allowed");return}
 peer,err:=strconv.ParseInt(r.URL.Query().Get("peer"),10,64)
 if err!=nil||peer<=0||peer==u.ID{fail(w,400,"Select another user");return}
 var active bool
 if err=s.db.QueryRow(r.Context(),"SELECT EXISTS(SELECT 1 FROM users WHERE id=$1 AND active=TRUE)",peer).Scan(&active);err!=nil||!active {
  fail(w,404,"Recipient not found");return
 }
 r.Body=http.MaxBytesReader(w,r.Body,maxMessageAttachmentBytes+1<<20)
 if err=r.ParseMultipartForm(1<<20);err!=nil{fail(w,413,"File must be no larger than 10 MB");return}
 file,header,err:=r.FormFile("file")
 if err!=nil{fail(w,400,"Select a file to send");return}
 defer file.Close()
 if header.Size<=0||header.Size>maxMessageAttachmentBytes{fail(w,413,"File must be 1 byte–10 MB");return}
 data,err:=io.ReadAll(io.LimitReader(file,maxMessageAttachmentBytes+1))
 if err!=nil||len(data)==0||len(data)>maxMessageAttachmentBytes{fail(w,413,"File must be 1 byte–10 MB");return}
 name:=safeAttachmentName(header.Filename)
 kind:=http.DetectContentType(data)
 // Unknown formats remain downloadable, never rendered as active HTML/SVG.
 if kind!="image/jpeg"&&kind!="image/png"&&kind!="image/gif"&&kind!="image/webp" {
  kind="application/octet-stream"
 }
 tx,err:=s.db.Begin(r.Context())
 if err!=nil{fail(w,503,"Upload unavailable");return}
 defer tx.Rollback(r.Context())
 var id int64;var created time.Time
 if err=tx.QueryRow(r.Context(),"INSERT INTO direct_messages(sender_id,recipient_id,body) VALUES($1,$2,$3) RETURNING id,created_at",u.ID,peer,"Attachment: "+name).Scan(&id,&created);err!=nil {
  fail(w,503,"Unable to save message");return
 }
 _,err=tx.Exec(r.Context(),"INSERT INTO message_attachments(message_id,filename,content_type,content,size_bytes) VALUES($1,$2,$3,$4,$5)",id,name,kind,data,len(data))
 if err!=nil{fail(w,503,"Unable to store attachment");return}
 if err=tx.Commit(r.Context());err!=nil{fail(w,503,"Unable to complete upload");return}
 respond(w,201,map[string]any{"message":map[string]any{
  "id":id,"sender":u.ID,"text":fmt.Sprintf("Attachment: %s",name),"created_at":created,
  "attachment":map[string]any{"name":name,"type":kind,"size":len(data),"url":"/api/messages/attachment?id="+strconv.FormatInt(id,10)},
 }})
}

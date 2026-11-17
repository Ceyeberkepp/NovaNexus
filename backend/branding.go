package main

import (
 "encoding/base64"
 "encoding/json"
 "net/http"
 "strings"
)

func publicBrandingAPI(s *Server,w http.ResponseWriter,r *http.Request){
 if r.Method!="GET"{fail(w,405,"Method not allowed");return}
 values:=map[string]string{"workspace_name":"NovaNexus Workspace"}
 rows,e:=s.db.Query(r.Context(),"SELECT name,value FROM app_settings WHERE name IN ('workspace_name','site_logo','login_logo','favicon','waiting_logo')")
 if e!=nil{fail(w,500,"Branding unavailable");return}
 defer rows.Close()
 for rows.Next(){var key,val string;if rows.Scan(&key,&val)==nil{values[key]=val}}
 if rows.Err()!=nil{fail(w,500,"Branding unavailable");return}
 respond(w,200,map[string]any{"branding":values})
}
func (s *Server) adminBrandingAPI(w http.ResponseWriter,r *http.Request){
 actor,ok:=s.administrator(w,r);if !ok{return}
 if r.Method!="PUT"{fail(w,405,"Method not allowed");return}
 var c struct{Key,Data string}
 if json.NewDecoder(http.MaxBytesReader(w,r.Body,240000)).Decode(&c)!=nil{fail(w,400,"Invalid image upload");return}
 if c.Key!="site_logo"&&c.Key!="login_logo"&&c.Key!="favicon"&&c.Key!="waiting_logo"{fail(w,400,"Unknown branding asset");return}
 if c.Data!=""{
  split:=strings.SplitN(c.Data,",",2)
  if len(split)!=2||!strings.HasPrefix(split[0],"data:image/")||!strings.HasSuffix(split[0],";base64"){fail(w,400,"Use a PNG, JPEG or WebP image");return}
  raw,e:=base64.StdEncoding.DecodeString(split[1])
  if e!=nil||len(raw)==0||len(raw)>128*1024{fail(w,400,"Image must be no larger than 128 KB");return}
  kind:=http.DetectContentType(raw)
  declared:=strings.TrimSuffix(strings.TrimPrefix(split[0],"data:"),";base64")
  if (kind!="image/png"&&kind!="image/jpeg"&&kind!="image/webp")||kind!=declared{fail(w,400,"Unsupported or mismatched image format");return}
 }
 if _,e:=s.db.Exec(r.Context(),"INSERT INTO app_settings(name,value) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET value=EXCLUDED.value",c.Key,c.Data);e!=nil{fail(w,500,"Unable to save branding");return}
 s.audit(r,actor.ID,"branding.updated",c.Key)
 respond(w,200,map[string]any{"ok":true})
}

package main

import (
 "encoding/json"
 "net/http"
 "strconv"
 "strings"
 "time"
)

// Messages are server-persisted direct messages. Group delivery requires a separate
// authorization and membership model and is intentionally not simulated.
func (s *Server) messagesAPI(w http.ResponseWriter, r *http.Request) {
 u,e:=s.who(r);if e!=nil{fail(w,401,"Sign in required");return}
 if u.MustChange {fail(w,403,"Password change required");return}
 peer,e:=strconv.ParseInt(r.URL.Query().Get("peer"),10,64)
 if e!=nil||peer<=0||peer==u.ID {fail(w,400,"Select another user");return}
 var exists bool
 if e=s.db.QueryRow(r.Context(),"SELECT EXISTS(SELECT 1 FROM users WHERE id=$1 AND active=TRUE)",peer).Scan(&exists);e!=nil||!exists {fail(w,404,"User not found");return}
 if r.Method=="GET" {
  rows,e:=s.db.Query(r.Context(),`SELECT id,sender_id,body,created_at FROM (SELECT id,sender_id,body,created_at FROM direct_messages WHERE (sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1) ORDER BY id DESC LIMIT 200) AS recent ORDER BY id ASC`,u.ID,peer)
  if e!=nil{fail(w,500,"Messages unavailable");return}
  defer rows.Close()
  messages:=make([]map[string]any,0)
  for rows.Next(){var id,from int64;var body string;var when time.Time;if e=rows.Scan(&id,&from,&body,&when);e!=nil{fail(w,500,"Messages unavailable");return};messages=append(messages,map[string]any{"id":id,"sender":from,"text":body,"created_at":when})}
  if rows.Err()!=nil{fail(w,500,"Messages unavailable");return}
  respond(w,200,map[string]any{"messages":messages});return
 }
 if r.Method!="POST"{fail(w,405,"Method not allowed");return}
 var c struct{Text string}
 if asJSON(r,&c)!=nil||len(strings.TrimSpace(c.Text))==0||len(c.Text)>4000 {fail(w,400,"Message must be between 1 and 4000 characters");return}
 var id int64;var when time.Time
 if e=s.db.QueryRow(r.Context(),"INSERT INTO direct_messages(sender_id,recipient_id,body) VALUES($1,$2,$3) RETURNING id,created_at",u.ID,peer,strings.TrimSpace(c.Text)).Scan(&id,&when);e!=nil{fail(w,500,"Unable to send message");return}
 respond(w,201,map[string]any{"message":map[string]any{"id":id,"sender":u.ID,"text":strings.TrimSpace(c.Text),"created_at":when}})
}

func (s *Server) calendarAPI(w http.ResponseWriter,r *http.Request){
 u,e:=s.who(r);if e!=nil{fail(w,401,"Sign in required");return}
 if u.MustChange{fail(w,403,"Password change required");return}
 if r.Method=="GET"{
  rows,e:=s.db.Query(r.Context(),"SELECT id,title,event_date,event_time,duration_minutes FROM calendar_events WHERE owner_id=$1 ORDER BY event_date,event_time LIMIT 1000",u.ID)
  if e!=nil{fail(w,500,"Calendar unavailable");return}
  defer rows.Close()
  items:=make([]map[string]any,0)
  for rows.Next(){var id int64;var title string;var date,timeText string;var duration int
   if e=rows.Scan(&id,&title,&date,&timeText,&duration);e!=nil{fail(w,500,"Calendar unavailable");return}
   items=append(items,map[string]any{"id":id,"title":title,"date":date,"time":timeText,"duration":duration,"attendees":[]string{},"link":"","type":"work"})
  }
  if rows.Err()!=nil{fail(w,500,"Calendar unavailable");return}
  respond(w,200,map[string]any{"events":items});return
 }
 if r.Method!="POST"{fail(w,405,"Method not allowed");return}
 var c struct{Title,Date,Time string;Duration int}
 if e=json.NewDecoder(http.MaxBytesReader(w,r.Body,16384)).Decode(&c);e!=nil{fail(w,400,"Invalid event");return}
 c.Title=strings.TrimSpace(c.Title)
 if len(c.Title)==0||len(c.Title)>160{fail(w,400,"Title required (160 characters max)");return}
 if _,e=time.Parse("2006-01-02",c.Date);e!=nil{fail(w,400,"Invalid date");return}
 if _,e=time.Parse("15:04",c.Time);e!=nil{fail(w,400,"Invalid time");return}
 if c.Duration==0{c.Duration=60}
 if c.Duration<15||c.Duration>1440{fail(w,400,"Invalid duration");return}
 var id int64
 e=s.db.QueryRow(r.Context(),"INSERT INTO calendar_events(owner_id,title,event_date,event_time,duration_minutes) VALUES($1,$2,$3,$4,$5) RETURNING id",u.ID,c.Title,c.Date,c.Time,c.Duration).Scan(&id)
 if e!=nil{fail(w,500,"Unable to save event");return}
 respond(w,201,map[string]any{"event":map[string]any{"id":id,"title":c.Title,"date":c.Date,"time":c.Time,"duration":c.Duration,"attendees":[]string{},"link":"","type":"work"}})
}

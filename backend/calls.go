package main

import (
 "net/http"
 "time"
)
// Call signaling is stored in PostgreSQL so calls can be answered across devices.
// Polling is an initial implementation; a WebSocket notification transport can follow.
func (s *Server) callsAPI(w http.ResponseWriter,r *http.Request){
 u,e:=s.who(r);if e!=nil{fail(w,401,"Sign in required");return}
 if u.MustChange{fail(w,403,"Password change required");return}
 if r.Method=="GET"{
  // Automatically expire calls that nobody answered.
  _,_=s.db.Exec(r.Context(),"UPDATE direct_calls SET status='missed',updated_at=NOW() WHERE status='ringing' AND expires_at<NOW()")
  rows,e:=s.db.Query(r.Context(),"SELECT c.id,c.caller_id,c.recipient_id,c.room,c.status,c.audio_only,c.created_at,caller.name,recipient.name FROM direct_calls c JOIN users caller ON caller.id=c.caller_id JOIN users recipient ON recipient.id=c.recipient_id WHERE c.caller_id=$1 OR c.recipient_id=$1 ORDER BY c.id DESC LIMIT 30",u.ID)
  if e!=nil{fail(w,500,"Call status unavailable");return};defer rows.Close()
  items:=make([]map[string]any,0)
  for rows.Next(){var id,from,to int64;var room,status,fromName,toName string;var audioOnly bool;var at time.Time
   if e=rows.Scan(&id,&from,&to,&room,&status,&audioOnly,&at,&fromName,&toName);e!=nil{fail(w,500,"Call status unavailable");return}
   items=append(items,map[string]any{"id":id,"callerId":from,"recipientId":to,"room":room,"status":status,"audioOnly":audioOnly,"callerName":fromName,"recipientName":toName,"createdAt":at})
  }
  if rows.Err()!=nil{fail(w,500,"Call status unavailable");return}
  respond(w,200,map[string]any{"calls":items});return
 }
 if r.Method!="POST"{fail(w,405,"Method not allowed");return}
 var c struct{RecipientID,CallID int64;Action string;AudioOnly bool}
 if asJSON(r,&c)!=nil{fail(w,400,"Invalid call request");return}
 switch c.Action{
 case "start":
  if c.RecipientID<=0||c.RecipientID==u.ID{fail(w,400,"Select another user");return}
  var active bool
  if e=s.db.QueryRow(r.Context(),"SELECT active FROM users WHERE id=$1",c.RecipientID).Scan(&active);e!=nil||!active{fail(w,404,"User unavailable");return}
  var pending int
  if e=s.db.QueryRow(r.Context(),"SELECT count(*) FROM direct_calls WHERE caller_id=$1 AND recipient_id=$2 AND status='ringing' AND expires_at>NOW()",u.ID,c.RecipientID).Scan(&pending);e!=nil||pending>0{fail(w,409,"You already have a ringing call to this user");return}
  room,e:=createRoom(r.Context(),s.db,u.ID,"call");if e!=nil{fail(w,503,"Unable to reserve call");return}
  var id int64
  e=s.db.QueryRow(r.Context(),"INSERT INTO direct_calls(caller_id,recipient_id,room,audio_only,expires_at) VALUES($1,$2,$3,$4,NOW()+INTERVAL '90 seconds') RETURNING id",u.ID,c.RecipientID,room,c.AudioOnly).Scan(&id)
  if e!=nil{fail(w,500,"Unable to place call");return}
  respond(w,201,map[string]any{"id":id,"room":room,"status":"ringing"})
 case "accept","decline","cancel":
  if c.CallID<=0{fail(w,400,"Call ID required");return}
  status:="declined";allowed:="recipient_id"
  if c.Action=="accept"{status="accepted"} else if c.Action=="cancel"{status="canceled";allowed="caller_id"}
  query:="UPDATE direct_calls SET status=$1,updated_at=NOW() WHERE id=$2 AND "+allowed+"=$3 AND status='ringing' AND expires_at>NOW() RETURNING room"
  var room string
  if e=s.db.QueryRow(r.Context(),query,status,c.CallID,u.ID).Scan(&room);e!=nil{fail(w,409,"Call no longer ringing or you cannot answer it");return}
  respond(w,200,map[string]any{"room":room,"status":status})
 default:fail(w,400,"Invalid call action")
 }
}

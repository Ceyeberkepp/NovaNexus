package main

import (
 "net/http"
 "strconv"
 "strings"
 "time"
)

// All administrative endpoints require a signed-in, fully initialized Admin.
// Mutations are server-side; no local-only mock state grants privileges.
func (s *Server) administrator(w http.ResponseWriter,r *http.Request)(User,bool){
 u,e:=s.who(r)
 if e!=nil{fail(w,401,"Sign in required");return User{},false}
 if u.MustChange||u.Role!="Admin"{fail(w,403,"Administrator required");return User{},false}
 return u,true
}
func (s *Server) audit(r *http.Request,actor int64,event,target string){
 _,_ =s.db.Exec(r.Context(),"INSERT INTO audit_events(actor_id,event,target) VALUES($1,$2,$3)",actor,event,target)
}
func (s *Server) adminDirectoryAPI(w http.ResponseWriter,r *http.Request){
 _,ok:=s.administrator(w,r);if !ok{return}
 if r.Method!="GET"{fail(w,405,"Method not allowed");return}
 rows,e:=s.db.Query(r.Context(),"SELECT id,name,email,role,active,must_change_password FROM users ORDER BY name LIMIT 1000")
 if e!=nil{fail(w,500,"Directory unavailable");return}
 defer rows.Close()
 users:=make([]map[string]any,0)
 for rows.Next(){var id int64;var name,email,role string;var active,change bool
   if rows.Scan(&id,&name,&email,&role,&active,&change)!=nil{fail(w,500,"Directory unavailable");return}
   users=append(users,map[string]any{"id":id,"name":name,"email":email,"role":role,"active":active,"must_change_password":change})
 }
 if rows.Err()!=nil{fail(w,500,"Directory unavailable");return}
 respond(w,200,map[string]any{"users":users})
}
func (s *Server) adminUsersAPI(w http.ResponseWriter,r *http.Request){
 actor,ok:=s.administrator(w,r);if !ok{return}
 id,e:=strconv.ParseInt(r.URL.Query().Get("id"),10,64)
 if e!=nil||id<=0{fail(w,400,"Valid user ID required");return}
 var c struct{Name,Role string;Active *bool}
 if r.Method!="PATCH"||asJSON(r,&c)!=nil{fail(w,400,"Expected PATCH JSON");return}
 if c.Name!=""&&(len(strings.TrimSpace(c.Name))<2||len(c.Name)>120){fail(w,400,"Name must be 2–120 characters");return}
 if c.Role!=""&&c.Role!="Admin"&&c.Role!="Regular"{fail(w,400,"Invalid role");return}
 if id==actor.ID&&(c.Role=="Regular"||(c.Active!=nil&&!*c.Active)){fail(w,400,"Cannot remove your own administrator access");return}
 tx,e:=s.db.Begin(r.Context());if e!=nil{fail(w,500,"Database unavailable");return}
 defer tx.Rollback(r.Context())
 var existingRole string;var active bool
 if e=tx.QueryRow(r.Context(),"SELECT role,active FROM users WHERE id=$1 FOR UPDATE",id).Scan(&existingRole,&active);e!=nil{fail(w,404,"User not found");return}
 if (existingRole=="Admin"&&(c.Role=="Regular"||(c.Active!=nil&&!*c.Active))) {
  var count int
  if e=tx.QueryRow(r.Context(),"SELECT count(*) FROM users WHERE role='Admin' AND active=TRUE").Scan(&count);e!=nil||count<2{fail(w,400,"Cannot remove the last active administrator");return}
 }
 if _,e=tx.Exec(r.Context(),"UPDATE users SET name=CASE WHEN $2='' THEN name ELSE $2 END,role=CASE WHEN $3='' THEN role ELSE $3 END,active=COALESCE($4,active) WHERE id=$1",id,strings.TrimSpace(c.Name),c.Role,c.Active);e!=nil{fail(w,500,"Update failed");return}
 // Invalidate sessions after role or active-status changes.
 if c.Role!=""||c.Active!=nil{if _,e=tx.Exec(r.Context(),"DELETE FROM sessions WHERE user_id=$1",id);e!=nil{fail(w,500,"Could not revoke sessions");return}}
 if e=tx.Commit(r.Context());e!=nil{fail(w,500,"Update failed");return}
 s.audit(r,actor.ID,"user.updated",strconv.FormatInt(id,10))
 respond(w,200,map[string]any{"ok":true})
}
func (s *Server) adminSettingsAPI(w http.ResponseWriter,r *http.Request){
 actor,ok:=s.administrator(w,r);if !ok{return}
 if r.Method=="GET" {
  settings:=map[string]any{}
  rows,e:=s.db.Query(r.Context(),"SELECT name,value FROM app_settings")
  if e!=nil{fail(w,500,"Settings unavailable");return};defer rows.Close()
  for rows.Next(){var k,v string;if rows.Scan(&k,&v)==nil{settings[k]=v}}
  if rows.Err()!=nil{fail(w,500,"Settings unavailable");return}
  respond(w,200,map[string]any{"settings":settings});return
 }
 if r.Method!="PUT"{fail(w,405,"Method not allowed");return}
 var c struct{WorkspaceName string;DefaultMeetingLimit int}
 if asJSON(r,&c)!=nil||len(strings.TrimSpace(c.WorkspaceName))<2||len(c.WorkspaceName)>80||c.DefaultMeetingLimit<1||c.DefaultMeetingLimit>1000 {fail(w,400,"Workspace name (2–80 characters) and meeting limit (1–1000) required");return}
 tx,e:=s.db.Begin(r.Context());if e!=nil{fail(w,500,"Database unavailable");return};defer tx.Rollback(r.Context())
 for k,v:=range map[string]string{"workspace_name":strings.TrimSpace(c.WorkspaceName),"default_meeting_limit":strconv.Itoa(c.DefaultMeetingLimit)}{
  if _,e=tx.Exec(r.Context(),"INSERT INTO app_settings(name,value) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET value=EXCLUDED.value",k,v);e!=nil{fail(w,500,"Settings update failed");return}
 }
 if e=tx.Commit(r.Context());e!=nil{fail(w,500,"Settings update failed");return}
 s.audit(r,actor.ID,"settings.updated","workspace")
 respond(w,200,map[string]any{"ok":true})
}
func (s *Server) adminLogsAPI(w http.ResponseWriter,r *http.Request){
 _,ok:=s.administrator(w,r);if !ok{return}
 if r.Method!="GET"{fail(w,405,"Method not allowed");return}
 rows,e:=s.db.Query(r.Context(),"SELECT a.id,COALESCE(u.email,'system'),a.event,a.target,a.created_at FROM audit_events a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 250")
 if e!=nil{fail(w,500,"Logs unavailable");return};defer rows.Close()
 events:=make([]map[string]any,0)
 for rows.Next(){var id int64;var actor,event,target string;var when time.Time
  if rows.Scan(&id,&actor,&event,&target,&when)!=nil{fail(w,500,"Logs unavailable");return}
  events=append(events,map[string]any{"id":id,"actor":actor,"event":event,"target":target,"created_at":when})
 }
 if rows.Err()!=nil{fail(w,500,"Logs unavailable");return}
 respond(w,200,map[string]any{"events":events})
}

func (s *Server) workspaceSettingsAPI(w http.ResponseWriter,r *http.Request){
 u,e:=s.who(r);if e!=nil{fail(w,401,"Sign in required");return}
 if u.MustChange{fail(w,403,"Password change required");return}
 if r.Method!="GET"{fail(w,405,"Method not allowed");return}
 settings:=map[string]string{"workspace_name":"NovaNexus Workspace","default_meeting_limit":"1000"}
 rows,e:=s.db.Query(r.Context(),"SELECT name,value FROM app_settings WHERE name IN ('workspace_name','default_meeting_limit')")
 if e!=nil{fail(w,500,"Settings unavailable");return}
 defer rows.Close()
 for rows.Next(){var name,value string;if rows.Scan(&name,&value)==nil{settings[name]=value}}
 if rows.Err()!=nil{fail(w,500,"Settings unavailable");return}
 respond(w,200,map[string]any{"settings":settings})
}

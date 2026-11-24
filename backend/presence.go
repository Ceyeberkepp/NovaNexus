package main

import (
 "net/http"
 "strconv"
 "strings"
 "time"
)

// Presence is server-owned; unauthenticated visitors never appear online.
// A fresh heartbeat expires after 90 seconds. Idle clients are shown Away.
// Busy and explicit Away/Offline are user-controlled overrides.
const presenceTimeout = 90 * time.Second

func resolvedPresence(mode string, idle bool, seen time.Time, now time.Time) string {
 if seen.IsZero() || now.Sub(seen) > presenceTimeout { return "offline" }
 switch mode {
 case "offline": return "offline"
 case "busy": return "busy"
 case "away": return "away"
 }
 if idle { return "away" }
 return "available"
}

func validPresenceMode(mode string) bool {
 switch mode {
 case "available","busy","away","offline":return true
 default:return false
 }
}

func (s *Server) presenceAPI(w http.ResponseWriter,r *http.Request) {
 u,e:=s.who(r);if e!=nil{fail(w,401,"Sign in required");return}
 if u.MustChange{fail(w,403,"Password change required");return}
 switch r.Method {
 case http.MethodGet:
  rows,e:=s.db.Query(r.Context(),`
   SELECT u.id,COALESCE(p.mode,'available'),COALESCE(p.idle,true),p.last_seen
   FROM users u LEFT JOIN user_presence p ON p.user_id=u.id
   WHERE u.active=TRUE ORDER BY u.id LIMIT 500`)
  if e!=nil{fail(w,500,"Presence unavailable");return}
  defer rows.Close()
  now:=time.Now()
  result:=map[string]string{}
  for rows.Next(){
   var id int64;var mode string;var idle bool;var seen *time.Time
   if e=rows.Scan(&id,&mode,&idle,&seen);e!=nil{fail(w,500,"Presence unavailable");return}
   last:=time.Time{};if seen!=nil{last=*seen}
   result[strconv.FormatInt(id,10)]=resolvedPresence(mode,idle,last,now)
  }
  if rows.Err()!=nil{fail(w,500,"Presence unavailable");return}
  respond(w,200,map[string]any{"presence":result})
 case http.MethodPost:
  var body struct {Idle bool `json:"idle"`;Mode *string `json:"mode"`}
  if asJSON(r,&body)!=nil{fail(w,400,"Invalid presence update");return}
  mode:=""
  if body.Mode!=nil{
   mode=strings.TrimSpace(*body.Mode)
   if !validPresenceMode(mode){fail(w,400,"Invalid presence mode");return}
  }
  // No arbitrary user ID: clients can update only their authenticated user.
  // Mode is retained between heartbeats, but idle reflects the newest poll.
  _,e=s.db.Exec(r.Context(),`
   INSERT INTO user_presence(user_id,mode,idle,last_seen)
   VALUES($1,COALESCE(NULLIF($2,''),'available'),$3,NOW())
   ON CONFLICT(user_id) DO UPDATE
   SET mode=COALESCE(NULLIF($2,''),user_presence.mode),
       idle=EXCLUDED.idle,last_seen=NOW()`,u.ID,mode,body.Idle)
  if e!=nil{fail(w,500,"Presence update failed");return}
  respond(w,200,map[string]any{"ok":true})
 default:fail(w,405,"Method not allowed")
 }
}

package main

import (
 "crypto/hmac"
 "crypto/sha256"
 "encoding/base64"
 "net"
 "net/http"
 "os"
 "strconv"
 "strings"
 "time"
 "unicode/utf8"
)

// Limit guest token requests separately per client and per actual origin.
// Cloudflare's forwarded IP distinguishes clients when supplied. A separate,
// non-bypassable per-origin cap prevents a forged header bypass.
func (s *Server) guestMeetingRateLimited(r *http.Request,room string) bool {
 peer,_,err:=net.SplitHostPort(r.RemoteAddr);if err!=nil{peer=r.RemoteAddr}
 client:=peer
 if forwarded:=net.ParseIP(strings.TrimSpace(r.Header.Get("CF-Connecting-IP")));forwarded!=nil{client=forwarded.String()}
 now:=time.Now()
 s.visitMu.Lock()
 defer s.visitMu.Unlock()
 if s.visitors==nil{s.visitors=make(map[string]visitorWindow)}
 denied:=false
 for _,b:=range []struct{key string;max int}{
  {"meeting-guest:"+room+":client:"+client,60},
  {"meeting-guest:"+room+":origin:"+peer,3000},
 } {
  v:=s.visitors[b.key]
  if now.Sub(v.Start)>time.Minute||v.Start.IsZero(){v=visitorWindow{Start:now}}
  v.Count++
  s.visitors[b.key]=v
  if v.Count>b.max{denied=true}
 }
 if len(s.visitors)>15000 {
  for k,v:=range s.visitors {if now.Sub(v.Start)>time.Minute{delete(s.visitors,k)}}
 }
 return denied
}

// guestMeetingTokenAPI mints a short-lived, meeting-only LiveKit token.
// Guests do not exist in the workspace users or sessions tables. A token\n// may create ONLY the pre-reserved authorized meeting room if the host is not\n// yet connected. The token never grants access to other rooms.
func (s *Server) guestMeetingTokenAPI(w http.ResponseWriter,r *http.Request) {
 if r.Method!="POST"{fail(w,405,"Method not allowed");return}
 var req struct{Room string;Name string;Password string}
 if asJSON(r,&req)!=nil{fail(w,400,"Invalid guest meeting request");return}
 req.Room=strings.TrimSpace(req.Room)
 req.Name=strings.TrimSpace(req.Name)
 if !eightDigitRoom.MatchString(req.Room)||utf8.RuneCountInString(req.Name)<2||utf8.RuneCountInString(req.Name)>80||len(req.Password)>128 {
  fail(w,400,"A valid meeting ID and guest name (2–80 characters) are required");return
 }
 // Apply account/IP throttling BEFORE querying a stored password.
 if s.guestMeetingRateLimited(r,req.Room) {fail(w,429,"Too many guest join attempts; try again later");return}
 var kind,stored string
 err:=s.db.QueryRow(r.Context(),"SELECT kind,guest_password_hash FROM meeting_rooms WHERE room=$1 AND closed=FALSE",req.Room).Scan(&kind,&stored)
 if err!=nil||kind!="normal"{fail(w,404,"Meeting unavailable");return}
 if stored!=""&&!verifyPassword(req.Password,stored){fail(w,403,"Meeting password is incorrect");return}
 key,secret:=os.Getenv("LIVEKIT_API_KEY"),os.Getenv("LIVEKIT_API_SECRET")
 if key==""||len(secret)<32{fail(w,503,"Video service not configured");return}
 var setting string
 if s.db.QueryRow(r.Context(),"SELECT value FROM app_settings WHERE name='default_meeting_limit'").Scan(&setting)!=nil{fail(w,503,"Meeting settings unavailable");return}
 ceiling,err:=strconv.Atoi(setting)
 if err!=nil||ceiling<1||ceiling>1000{fail(w,503,"Meeting settings unavailable");return}
 now:=time.Now()
 header,err:=jwtPart(map[string]string{"alg":"HS256","typ":"JWT"})
 if err!=nil{fail(w,500,"Cannot create guest token");return}
 payload,err:=jwtPart(map[string]any{
  "iss":key,"sub":"guest_"+randomHex(16),"name":req.Name,
  "iat":now.Unix(),"nbf":now.Add(-5*time.Second).Unix(),"exp":now.Add(10*time.Minute).Unix(),
  "video":map[string]any{"room":req.Room,"roomJoin":true,"roomCreate":true,"canPublish":true,"canSubscribe":true},
 })
 if err!=nil{fail(w,500,"Cannot create guest token");return}
 signed:=header+"."+payload
 mac:=hmac.New(sha256.New,[]byte(secret));_,_=mac.Write([]byte(signed))
 token:=signed+"."+base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
 respond(w,200,map[string]any{"token":token,"serverUrl":"wss://"+r.Host,"maxParticipants":ceiling,"isHost":false,"guest":true,"name":req.Name})
}

// meetingPasswordAPI allows only the meeting owner to change or clear the
// password. A password is never returned to the browser or stored in plaintext.
func (s *Server) meetingPasswordAPI(w http.ResponseWriter,r *http.Request) {
 if r.Method!="POST"{fail(w,405,"Method not allowed");return}
 u,err:=s.who(r);if err!=nil{fail(w,401,"Sign in required");return}
 if u.MustChange{fail(w,403,"Password change required");return}
 var req struct{Room string;Password string}
 if asJSON(r,&req)!=nil||!eightDigitRoom.MatchString(req.Room)||len(req.Password)>128||(len(req.Password)>0&&len(req.Password)<6){
  fail(w,400,"Meeting password must be empty or 6–128 characters");return
 }
 var kind string
 if s.db.QueryRow(r.Context(),"SELECT kind FROM meeting_rooms WHERE room=$1 AND owner_id=$2 AND closed=FALSE",req.Room,u.ID).Scan(&kind)!=nil||kind!="normal" {
  fail(w,403,"Only the meeting host can change this password");return
 }
 stored:=""
 if req.Password!=""{stored=passwordHash(req.Password)}
 _,err=s.db.Exec(r.Context(),"UPDATE meeting_rooms SET guest_password_hash=$1 WHERE room=$2 AND owner_id=$3",stored,req.Room,u.ID)
 if err!=nil{fail(w,503,"Unable to update meeting password");return}
 respond(w,200,map[string]any{"ok":true,"passwordProtected":stored!=""})
}

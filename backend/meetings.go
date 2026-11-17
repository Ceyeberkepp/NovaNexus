package main

import (
  "crypto/hmac"
  "crypto/sha256"
  "encoding/base64"
  "encoding/json"
  "net/http"
  "os"
   "strconv"
  "strings"
  "time"
)

// Meeting credentials are never exposed to the browser. Every meeting token
// is scoped to an authenticated NovaNexus user and expires after 10 minutes.
// Public meeting numbers are reserved on the server before a token is issued.

func jwtPart(v any) (string,error) {
 b,e:=json.Marshal(v);if e!=nil{return "",e}
 return base64.RawURLEncoding.EncodeToString(b),nil
}
func meetingToken(secret,key,room string,user User,maxParticipants int)(string,error){
 header,e:=jwtPart(map[string]string{"alg":"HS256","typ":"JWT"});if e!=nil{return "",e}
 now:=time.Now()
 claims:=map[string]any{
  "iss":key, "sub":strconv.FormatInt(user.ID,10),
  "name":user.Name, "iat":now.Unix(), "nbf":now.Add(-5*time.Second).Unix(),
  "exp":now.Add(10*time.Minute).Unix(),
  "video":map[string]any{"room":room,"roomJoin":true,"roomCreate":true,"canPublish":true,"canSubscribe":true},
  "roomConfig":map[string]any{"maxParticipants":maxParticipants},
 }
 payload,e:=jwtPart(claims);if e!=nil{return "",e}
 signing:=header+"."+payload
 mac:=hmac.New(sha256.New,[]byte(secret));_,_ =mac.Write([]byte(signing))
 return signing+"."+base64.RawURLEncoding.EncodeToString(mac.Sum(nil)),nil
}

func (s *Server) meetingTokenAPI(w http.ResponseWriter,r *http.Request){
 if r.Method!="POST"{fail(w,405,"Method not allowed");return}
 u,e:=s.who(r);if e!=nil{fail(w,401,"Sign in required");return}
 if u.MustChange{fail(w,403,"Password change required");return}
 key,secret:=os.Getenv("LIVEKIT_API_KEY"),os.Getenv("LIVEKIT_API_SECRET")
 if key==""||len(secret)<32{fail(w,503,"Video service not configured");return}
 var request struct{Room string;MaxParticipants int;BreakoutID int64}
 if asJSON(r,&request)!=nil{fail(w,400,"Invalid meeting request");return}
 request.Room=strings.TrimSpace(request.Room)
 if !eightDigitRoom.MatchString(request.Room){fail(w,400,"Meeting ID must be exactly eight digits");return}
 var host int64;var kind string
 if e=s.db.QueryRow(r.Context(),"SELECT owner_id,kind FROM meeting_rooms WHERE room=$1 AND closed=FALSE",request.Room).Scan(&host,&kind);e!=nil{fail(w,404,"Meeting number not found");return}
 if kind=="call"&&u.ID!=host{
  var allowed bool
  e=s.db.QueryRow(r.Context(),"SELECT EXISTS(SELECT 1 FROM direct_calls WHERE room=$1 AND recipient_id=$2 AND status='accepted')",request.Room,u.ID).Scan(&allowed)
  if e!=nil||!allowed{fail(w,403,"Call has not been accepted");return}
 }
 liveRoom:=request.Room
 if request.BreakoutID>0{
  var exists bool
  e=s.db.QueryRow(r.Context(),"SELECT EXISTS(SELECT 1 FROM meeting_breakouts b WHERE b.parent=$1 AND b.id=$2 AND ($3=(SELECT owner_id FROM meeting_rooms WHERE room=$1) OR EXISTS(SELECT 1 FROM breakout_members m WHERE m.breakout_id=b.id AND m.user_id=$3)))",request.Room,request.BreakoutID,u.ID).Scan(&exists)
  if e!=nil||!exists{fail(w,403,"Not assigned to this breakout room");return}
  liveRoom="br_"+request.Room+"_"+strconv.FormatInt(request.BreakoutID,10)
 }
 var setting string
 if e=s.db.QueryRow(r.Context(),"SELECT value FROM app_settings WHERE name='default_meeting_limit'").Scan(&setting);e!=nil{fail(w,503,"Meeting settings unavailable");return}
 ceiling,e:=strconv.Atoi(setting);if e!=nil||ceiling<1||ceiling>1000{fail(w,503,"Invalid meeting capacity configuration");return}
 if request.MaxParticipants==0{request.MaxParticipants=ceiling}
 if request.MaxParticipants<1||request.MaxParticipants>1000||request.MaxParticipants>ceiling{fail(w,400,"Meeting capacity must be between 1 and the configured workspace limit");return}
 token,e:=meetingToken(secret,key,liveRoom,u,request.MaxParticipants)
 if e!=nil{fail(w,500,"Unable to start meeting");return}
 // LiveKit signaling is proxied by Caddy at the same HTTPS origin.
 scheme:="wss"
 if r.Header.Get("X-Forwarded-Proto")=="http" && os.Getenv("NODE_ENV")!="production"{scheme="ws"}
 respond(w,200,map[string]any{"token":token,"serverUrl":scheme+"://"+r.Host,"maxParticipants":request.MaxParticipants,"isHost":host==u.ID,"breakoutId":request.BreakoutID})
}

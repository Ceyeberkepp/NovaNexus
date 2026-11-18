package main
import (
 "context"
 "crypto/rand"
 "errors"
 "fmt"
 "math/big"
 "net/http"
 "regexp"
 "strings"

 "github.com/jackc/pgx/v5"
 "github.com/jackc/pgx/v5/pgxpool"
)
var eightDigitRoom=regexp.MustCompile("^[0-9]{8}$")
func createRoom(ctx context.Context,db *pgxpool.Pool,owner int64,kind string)(string,error){
 for tries:=0;tries<16;tries++{
  n,e:=rand.Int(rand.Reader,big.NewInt(90000000));if e!=nil{return "",e}
  room:=fmt.Sprintf("%08d",n.Int64()+10000000)
  var saved string
  e=db.QueryRow(ctx,"INSERT INTO meeting_rooms(room,owner_id,kind) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING room",room,owner,kind).Scan(&saved)
  if e==nil{return saved,nil}
  if !errors.Is(e,pgx.ErrNoRows){return "",e}
 }
 return "",errors.New("unable to reserve unique meeting number")
}
func (s *Server) createMeetingAPI(w http.ResponseWriter,r *http.Request){
 if r.Method!="POST"{fail(w,405,"Method not allowed");return}
 u,e:=s.who(r);if e!=nil{fail(w,401,"Sign in required");return}
 if u.MustChange{fail(w,403,"Password change required");return}
 var c struct{Kind string; Password string}
 if asJSON(r,&c)!=nil||c.Kind!=""&&c.Kind!="normal"{fail(w,400,"Invalid meeting request");return}
 if len(c.Password)>0 && (len(c.Password)<6 || len(c.Password)>128){fail(w,400,"Meeting password must be 6–128 characters");return}
 room,e:=createRoom(r.Context(),s.db,u.ID,"normal");if e!=nil{fail(w,503,"Unable to reserve meeting");return}
 if c.Password!="" {
  _,e=s.db.Exec(r.Context(),"UPDATE meeting_rooms SET guest_password_hash=$1 WHERE room=$2 AND owner_id=$3",passwordHash(c.Password),room,u.ID)
  if e!=nil{_,_=s.db.Exec(r.Context(),"DELETE FROM meeting_rooms WHERE room=$1 AND owner_id=$2",room,u.ID);fail(w,503,"Unable to protect meeting");return}
 }
 respond(w,201,map[string]any{"room":room,"urlPath":"/"+room})
}
func (s *Server) breakoutAPI(w http.ResponseWriter,r *http.Request){
 u,e:=s.who(r);if e!=nil{fail(w,401,"Sign in required");return}
 if u.MustChange{fail(w,403,"Password change required");return}
 var c struct{Parent string;Name string;BreakoutID int64;UserID int64;Action string}
 if r.Method=="GET"{c.Parent=r.URL.Query().Get("parent")}else if r.Method=="POST"{
  if asJSON(r,&c)!=nil{fail(w,400,"Invalid breakout request");return}
 }else{fail(w,405,"Method not allowed");return}
 if !eightDigitRoom.MatchString(c.Parent){fail(w,400,"Invalid parent meeting number");return}
 var host int64
 if e=s.db.QueryRow(r.Context(),"SELECT owner_id FROM meeting_rooms WHERE room=$1 AND closed=FALSE",c.Parent).Scan(&host);e!=nil{fail(w,404,"Meeting not found");return}
 if r.Method=="POST"&&host!=u.ID{fail(w,403,"Only the host can manage breakouts");return}
 if r.Method=="GET"{
  rows,e:=s.db.Query(r.Context(),"SELECT b.id,b.name,EXISTS(SELECT 1 FROM breakout_members m WHERE m.breakout_id=b.id AND m.user_id=$2),COALESCE((SELECT array_agg(user_id) FROM breakout_members WHERE breakout_id=b.id),'{}'::bigint[]) FROM meeting_breakouts b WHERE b.parent=$1 ORDER BY b.id",c.Parent,u.ID)
  if e!=nil{fail(w,500,"Breakouts unavailable");return}
  defer rows.Close()
  items:=make([]map[string]any,0)
  for rows.Next(){var id int64;var name string;var assigned bool;var members []int64
   if e=rows.Scan(&id,&name,&assigned,&members);e!=nil{fail(w,500,"Breakouts unavailable");return}
   item:=map[string]any{"id":id,"name":name,"assigned":assigned}
   if host==u.ID{item["members"]=members}
   items=append(items,item)
  }
  if rows.Err()!=nil{fail(w,500,"Breakouts unavailable");return}
  respond(w,200,map[string]any{"breakouts":items,"isHost":host==u.ID});return
 }
 switch c.Action{
 case "create":
  c.Name=strings.TrimSpace(c.Name)
  if len(c.Name)==0||len(c.Name)>80{fail(w,400,"Name must be 1–80 characters");return}
  var id int64
  if e=s.db.QueryRow(r.Context(),"INSERT INTO meeting_breakouts(parent,name) VALUES($1,$2) RETURNING id",c.Parent,c.Name).Scan(&id);e!=nil{fail(w,500,"Unable to create breakout");return}
  respond(w,201,map[string]any{"id":id})
 case "assign","unassign":
  if c.BreakoutID<=0||c.UserID<=0{fail(w,400,"Breakout and user required");return}
  var active bool
  if e=s.db.QueryRow(r.Context(),"SELECT active FROM users WHERE id=$1",c.UserID).Scan(&active);e!=nil||!active{fail(w,404,"Member not found");return}
  if c.Action=="assign"{
   _,e=s.db.Exec(r.Context(),"INSERT INTO breakout_members(breakout_id,user_id) SELECT id,$3 FROM meeting_breakouts WHERE id=$1 AND parent=$2 ON CONFLICT DO NOTHING",c.BreakoutID,c.Parent,c.UserID)
  }else{_,e=s.db.Exec(r.Context(),"DELETE FROM breakout_members WHERE breakout_id=$1 AND user_id=$2 AND breakout_id IN (SELECT id FROM meeting_breakouts WHERE parent=$3)",c.BreakoutID,c.UserID,c.Parent)}
  if e!=nil{fail(w,500,"Unable to change assignment");return}
  respond(w,200,map[string]any{"ok":true})
 case "delete":
  result,e:=s.db.Exec(r.Context(),"DELETE FROM meeting_breakouts WHERE parent=$1 AND id=$2",c.Parent,c.BreakoutID)
  if e!=nil{fail(w,500,"Unable to delete breakout");return}
  if result.RowsAffected()==0{fail(w,404,"Breakout not found");return}
  respond(w,200,map[string]any{"ok":true})
 default:fail(w,400,"Unknown breakout action")
 }
}

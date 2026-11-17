package main

import (
 "context"
 "crypto/rand"
 "crypto/sha256"
 "crypto/subtle"
 "encoding/hex"
 "encoding/json"
 "errors"
 "fmt"
 "log"
 "net"
 "net/http"
 "net/url"
 "os"
 "path/filepath"
 "strings"
 "sync"
 "time"

 "github.com/jackc/pgx/v5"
 "github.com/jackc/pgx/v5/pgxpool"
 "golang.org/x/crypto/argon2"
)

const cookieName = "novanexus_session"
const sessionLifetime = 8*time.Hour

type Server struct { db *pgxpool.Pool; secure bool; limitMu sync.Mutex; attempts map[string][]time.Time }
type User struct { ID int64; Name, Email, Role string; MustChange bool }
type credentials struct { Email, Password string }

func randomHex(n int) string { b:=make([]byte,n); if _,err:=rand.Read(b);err!=nil {panic(err)};return hex.EncodeToString(b) }
func tokenHash(s string) string { sum:=sha256.Sum256([]byte(s)); return hex.EncodeToString(sum[:]) }
func passwordHash(p string) string {
 salt:=make([]byte,16);if _,e:=rand.Read(salt);e!=nil {panic(e)}
 return fmt.Sprintf("%s:%s",hex.EncodeToString(salt),hex.EncodeToString(argon2.IDKey([]byte(p),salt,3,64*1024,4,32)))
}
func verifyPassword(p,stored string) bool {
 parts:=strings.Split(stored,":");if len(parts)!=2{return false}
 salt,e:=hex.DecodeString(parts[0]);if e!=nil||len(salt)!=16{return false}
 expected,e:=hex.DecodeString(parts[1]);if e!=nil||len(expected)!=32{return false}
 actual:=argon2.IDKey([]byte(p),salt,3,64*1024,4,32)
 return subtle.ConstantTimeCompare(actual,expected)==1
}
func respond(w http.ResponseWriter,status int,body any) {w.Header().Set("Content-Type","application/json");w.Header().Set("Cache-Control","no-store");w.WriteHeader(status);_ =json.NewEncoder(w).Encode(body)}
func fail(w http.ResponseWriter,code int,message string) {respond(w,code,map[string]any{"error":message})}
func asJSON(r *http.Request,out any) error {r.Body=http.MaxBytesReader(nil,r.Body,16*1024);defer r.Body.Close();return json.NewDecoder(r.Body).Decode(out)}
func (u User) data() map[string]any {return map[string]any{"id":u.ID,"name":u.Name,"email":u.Email,"role":u.Role,"must_change_password":u.MustChange}}
func cookie(token string,secure bool,maxAge int) *http.Cookie {return &http.Cookie{Name:cookieName,Value:token,Path:"/",HttpOnly:true,Secure:secure,SameSite:http.SameSiteStrictMode,MaxAge:maxAge}}
func (s *Server) who(r *http.Request) (User,error) {
 c,err:=r.Cookie(cookieName);if err!=nil||len(c.Value)!=64{return User{},errors.New("not authenticated")}
 var u User
 err=s.db.QueryRow(r.Context(),`SELECT u.id,u.name,u.email,u.role,u.must_change_password FROM sessions ss JOIN users u ON ss.user_id=u.id WHERE ss.token_hash=$1 AND ss.expires_at>NOW() AND u.active=TRUE`,tokenHash(c.Value)).Scan(&u.ID,&u.Name,&u.Email,&u.Role,&u.MustChange)
 return u,err
}
func (s *Server) limited(r *http.Request, account string) bool {
 host,_,e:=net.SplitHostPort(r.RemoteAddr);if e!=nil {host=r.RemoteAddr}
 host = host + "|" + strings.ToLower(strings.TrimSpace(account))
 now:=time.Now();s.limitMu.Lock();defer s.limitMu.Unlock()
 recent:=s.attempts[host][:0];for _,t:=range s.attempts[host] {if now.Sub(t)<15*time.Minute {recent=append(recent,t)}}
 if len(recent)>=10{s.attempts[host]=recent;return true}
 s.attempts[host]=append(recent,now)
 if len(s.attempts)>10000 {for k,v:=range s.attempts {if len(v)==0||now.Sub(v[len(v)-1])>15*time.Minute {delete(s.attempts,k)}}}
 return false
}
func (s *Server) login(w http.ResponseWriter,r *http.Request) {
 var c credentials;if asJSON(r,&c)!=nil||len(c.Email)>254||len(c.Password)>1024 {fail(w,400,"Invalid credentials");return}
 if s.limited(r,c.Email){fail(w,429,"Too many attempts");return}
 var u User;var stored string
 err:=s.db.QueryRow(r.Context(),`SELECT id,name,email,role,must_change_password,password_hash FROM users WHERE (lower(email)=lower($1) OR (lower($1)='admin' AND lower(email)='admin@local.invalid')) AND active=TRUE`,strings.TrimSpace(c.Email)).Scan(&u.ID,&u.Name,&u.Email,&u.Role,&u.MustChange,&stored)
 if err!=nil||!verifyPassword(c.Password,stored){fail(w,401,"Invalid credentials");return}
 token:=randomHex(32)
 if _,e:=s.db.Exec(r.Context(),`INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '8 hours')`,tokenHash(token),u.ID);e!=nil {fail(w,500,"Unable to create session");return}
 http.SetCookie(w,cookie(token,s.secure,int(sessionLifetime.Seconds())))
 respond(w,200,map[string]any{"user":u.data()})
}
func (s *Server) me(w http.ResponseWriter,r *http.Request) {
 u,e:=s.who(r);if e!=nil{fail(w,401,"Sign in required");return}
 respond(w,200,map[string]any{"user":u.data()})
}
func (s *Server) changePassword(w http.ResponseWriter,r *http.Request) {
 u,e:=s.who(r);if e!=nil{fail(w,401,"Sign in required");return}
 if s.limited(r,u.Email){fail(w,429,"Too many attempts");return}
 var c struct {CurrentPassword,NewPassword string}
 if asJSON(r,&c)!=nil||len(c.NewPassword)<8||len(c.NewPassword)>1024||c.NewPassword==c.CurrentPassword||c.NewPassword=="admin" {fail(w,400,"Choose a different password with at least 8 characters");return}
 var stored string
 if e:=s.db.QueryRow(r.Context(),"SELECT password_hash FROM users WHERE id=$1",u.ID).Scan(&stored);e!=nil||!verifyPassword(c.CurrentPassword,stored) {fail(w,401,"Current password incorrect");return}
 tx,e:=s.db.Begin(r.Context());if e!=nil{fail(w,500,"Database unavailable");return};defer tx.Rollback(r.Context())
 if _,e=tx.Exec(r.Context(),"UPDATE users SET password_hash=$1,must_change_password=FALSE WHERE id=$2",passwordHash(c.NewPassword),u.ID);e!=nil{fail(w,500,"Password update failed");return}
 if _,e=tx.Exec(r.Context(),"DELETE FROM sessions WHERE user_id=$1",u.ID);e!=nil{fail(w,500,"Session revocation failed");return}
 if tx.Commit(r.Context())!=nil{fail(w,500,"Password update failed");return}
 http.SetCookie(w,cookie("",s.secure,-1));respond(w,200,map[string]any{"ok":true,"reauthenticate":true})
}
func (s *Server) logout(w http.ResponseWriter,r *http.Request) {
 if c,e:=r.Cookie(cookieName);e==nil {_ ,_=s.db.Exec(r.Context(),"DELETE FROM sessions WHERE token_hash=$1",tokenHash(c.Value))}
 http.SetCookie(w,cookie("",s.secure,-1));respond(w,200,map[string]any{"ok":true})
}
func (s *Server) users(w http.ResponseWriter,r *http.Request) {
 u,e:=s.who(r);if e!=nil{fail(w,401,"Sign in required");return};if u.MustChange{fail(w,403,"Password change required");return}
 if r.Method=="GET" {
 rows,e:=s.db.Query(r.Context(),"SELECT id,name,email,role,must_change_password FROM users WHERE active=TRUE ORDER BY name LIMIT 500")
 if e!=nil{fail(w,500,"Directory unavailable");return};defer rows.Close()
 list:=[]any{}
 for rows.Next(){var x User;if rows.Scan(&x.ID,&x.Name,&x.Email,&x.Role,&x.MustChange)==nil{list=append(list,x.data())}}
 respond(w,200,map[string]any{"users":list});return
 }
 if u.Role!="Admin"{fail(w,403,"Administrator required");return}
 var c struct {Name,Email,Password string}
 if asJSON(r,&c)!=nil||len(strings.TrimSpace(c.Name))<2||len(c.Name)>120||len(c.Email)>254||!strings.Contains(c.Email,"@")||len(c.Password)<8||len(c.Password)>1024 {fail(w,400,"Valid name, email and password (8+ characters) required");return}
 var id int64
 e=s.db.QueryRow(r.Context(),"INSERT INTO users(name,email,password_hash,role) VALUES($1,lower($2),$3,'Regular') RETURNING id",strings.TrimSpace(c.Name),strings.TrimSpace(c.Email),passwordHash(c.Password)).Scan(&id)
 if e!=nil{fail(w,409,"Unable to create user or email already in use");return}
 respond(w,201,map[string]any{"user":(User{ID:id,Name:strings.TrimSpace(c.Name),Email:strings.ToLower(strings.TrimSpace(c.Email)),Role:"Regular"}).data()})
}
func (s *Server) api(w http.ResponseWriter,r *http.Request) {
 w.Header().Set("X-Content-Type-Options","nosniff")
 if r.Method!="GET"&&r.Method!="HEAD" {
  if ct:=strings.Split(r.Header.Get("Content-Type"),";")[0];ct!="application/json"{fail(w,415,"JSON required");return}
  if origin:=r.Header.Get("Origin");origin!="" {u,e:=url.Parse(origin);if e!=nil||u.Host!=r.Host||u.Scheme!="https"&&s.secure{fail(w,403,"Origin rejected");return}}
  if site:=r.Header.Get("Sec-Fetch-Site");site!=""&&site!="same-origin"&&site!="none"{fail(w,403,"Cross-site request rejected");return}
 }
 switch r.URL.Path {
 case "/api/admin/directory":s.adminDirectoryAPI(w,r)
 case "/api/admin/users":s.adminUsersAPI(w,r)
 case "/api/admin/settings":s.adminSettingsAPI(w,r)
 case "/api/admin/logs":s.adminLogsAPI(w,r)
 case "/api/health":if e:=s.db.Ping(r.Context());e!=nil{fail(w,503,"Database unavailable")}else{respond(w,200,map[string]any{"status":"ok"})}
 case "/api/meetings/token":s.meetingTokenAPI(w,r)
 case "/api/messages":s.messagesAPI(w,r)
 case "/api/calendar":s.calendarAPI(w,r)
 case "/api/auth/login":if r.Method=="POST"{s.login(w,r)}else{fail(w,405,"Method not allowed")}
 case "/api/auth/me":if r.Method=="GET"{s.me(w,r)}else{fail(w,405,"Method not allowed")}
 case "/api/auth/logout":if r.Method=="POST"{s.logout(w,r)}else{fail(w,405,"Method not allowed")}
 case "/api/auth/change-password":if r.Method=="POST"{s.changePassword(w,r)}else{fail(w,405,"Method not allowed")}
 case "/api/users":if r.Method=="GET"||r.Method=="POST"{s.users(w,r)}else{fail(w,405,"Method not allowed")}
 default:fail(w,404,"API endpoint not available")
 }
}
func migrate(ctx context.Context,db *pgxpool.Pool) error {
 statements:=[]string{
  "CREATE TABLE IF NOT EXISTS users (id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('Admin','Regular')),active BOOLEAN NOT NULL DEFAULT TRUE,must_change_password BOOLEAN NOT NULL DEFAULT FALSE)",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE",
  "CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at TIMESTAMPTZ NOT NULL)",
  "CREATE TABLE IF NOT EXISTS app_settings (name TEXT PRIMARY KEY,value TEXT NOT NULL)",
  "INSERT INTO app_settings(name,value) VALUES (\'workspace_name\',\'NovaNexus Workspace\'),(\'default_meeting_limit\',\'1000\') ON CONFLICT(name) DO NOTHING",
  "CREATE TABLE IF NOT EXISTS audit_events (id BIGSERIAL PRIMARY KEY,actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,event TEXT NOT NULL,target TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
  "CREATE TABLE IF NOT EXISTS direct_messages (id BIGSERIAL PRIMARY KEY,sender_id BIGINT NOT NULL REFERENCES users(id),recipient_id BIGINT NOT NULL REFERENCES users(id),body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 4000),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
  "CREATE INDEX IF NOT EXISTS direct_messages_pair_idx ON direct_messages(sender_id,recipient_id,id DESC)",
  "CREATE TABLE IF NOT EXISTS calendar_events (id BIGSERIAL PRIMARY KEY,owner_id BIGINT NOT NULL REFERENCES users(id),title TEXT NOT NULL,event_date DATE NOT NULL,event_time TIME NOT NULL,duration_minutes INT NOT NULL DEFAULT 60)",
  "CREATE INDEX IF NOT EXISTS calendar_events_owner_date_idx ON calendar_events(owner_id,event_date,event_time)",
 }
 for _,query:=range statements {if _,e:=db.Exec(ctx,query);e!=nil{return e}}
 return nil
}
func main() {
 ctx,cancel:=context.WithTimeout(context.Background(),30*time.Second);defer cancel()
 db,err:=pgxpool.New(ctx,os.Getenv("DATABASE_URL"));if err!=nil{log.Fatal(err)}
 if err=db.Ping(ctx);err!=nil{log.Fatal(err)}
 if err=migrate(ctx,db);err!=nil{log.Fatal(err)}
 adminPassword:=os.Getenv("BOOTSTRAP_ADMIN_PASSWORD")
 if len(adminPassword)<24 {log.Fatal("BOOTSTRAP_ADMIN_PASSWORD must be a unique randomly generated password of at least 24 characters")}
 s:=&Server{db:db,secure:os.Getenv("NODE_ENV")=="production",attempts:make(map[string][]time.Time)}
 var count int
 if e:=db.QueryRow(ctx,"SELECT count(*) FROM users WHERE role='Admin'").Scan(&count);e!=nil{log.Fatal(e)}
 if count==0 {
  _,err=db.Exec(ctx,"INSERT INTO users(name,email,password_hash,role,must_change_password) VALUES('Administrator','admin@local.invalid',$1,'Admin',TRUE)",passwordHash(adminPassword))
  if err!=nil{log.Fatal(err)}
 } else {
  // Upgrade a pending legacy admin/admin + setup-code installation without exposing a default password.
  // Once the password is changed, must_change_password is FALSE and this migration no longer applies.
  var adminID int64
  var stored string
  e:=db.QueryRow(ctx,"SELECT id,password_hash FROM users WHERE email='admin@local.invalid' AND role='Admin' AND must_change_password=TRUE AND active=TRUE").Scan(&adminID,&stored)
  if e==nil && !verifyPassword(adminPassword,stored) {
   tx,te:=db.Begin(ctx);if te!=nil{log.Fatal(te)}
   if _,te=tx.Exec(ctx,"UPDATE users SET password_hash=$1 WHERE id=$2 AND must_change_password=TRUE",passwordHash(adminPassword),adminID);te!=nil{_ =tx.Rollback(ctx);log.Fatal(te)}
   if _,te=tx.Exec(ctx,"DELETE FROM sessions WHERE user_id=$1",adminID);te!=nil{_ =tx.Rollback(ctx);log.Fatal(te)}
   if te=tx.Commit(ctx);te!=nil{log.Fatal(te)}
   log.Println("Legacy pending administrator credentials upgraded to the installation password")
  } else if e!=nil && !errors.Is(e,pgx.ErrNoRows) {log.Fatal(e)}
 }
 mux:=http.NewServeMux();mux.HandleFunc("/api/",s.api)
 dist:="dist"
 mux.HandleFunc("/",func(w http.ResponseWriter,r *http.Request){
  if r.URL.Path=="/" {w.Header().Set("Cache-Control","no-store");http.ServeFile(w,r,filepath.Join(dist,"index.html"));return}
  p:=filepath.Clean(strings.TrimPrefix(r.URL.Path,"/"))
  full:=filepath.Join(dist,p);if !strings.HasPrefix(full,dist+string(os.PathSeparator)){http.NotFound(w,r);return}
  if st,e:=os.Stat(full);e==nil&&!st.IsDir(){http.ServeFile(w,r,full);return}
  w.Header().Set("Cache-Control","no-store");http.ServeFile(w,r,filepath.Join(dist,"index.html"))
 })
 handler:=http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  w.Header().Set("X-Content-Type-Options","nosniff")
  w.Header().Set("X-Frame-Options","DENY")
  w.Header().Set("Referrer-Policy","strict-origin-when-cross-origin")
  mux.ServeHTTP(w,r)
 })
 srv:=&http.Server{Addr:":"+fallback(os.Getenv("PORT"),"3000"),Handler:handler,ReadHeaderTimeout:5*time.Second,ReadTimeout:15*time.Second,WriteTimeout:30*time.Second,IdleTimeout:60*time.Second}
 log.Println("NovaNexus Go API starting");log.Fatal(srv.ListenAndServe())
}
func fallback(v,otherwise string) string {if v==""{return otherwise};return v}

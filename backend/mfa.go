package main

import (
 "crypto/hmac"
 "crypto/rand"
 "crypto/sha1"
 "encoding/base32"
 "encoding/binary"
 "encoding/hex"
 "fmt"
 "net/http"
 "net/url"
 "strings"
 "time"
)

// RFC 6238 TOTP, 30-second step, six-digit codes; allow one adjacent step for clock skew.
func totp(secret string,step int64) string {
 raw,e:=base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(secret);if e!=nil{return ""}
 var msg [8]byte;binary.BigEndian.PutUint64(msg[:],uint64(step))
 mac:=hmac.New(sha1.New,raw);mac.Write(msg[:]);digest:=mac.Sum(nil)
 offset:=int(digest[len(digest)-1]&15)
 value:=(binary.BigEndian.Uint32(digest[offset:offset+4])&0x7fffffff)%1000000
 return fmt.Sprintf("%06d",value)
}
func totpStep(secret,code string)(int64,bool){
 if len(code)!=6{return 0,false}
 now:=time.Now().Unix()/30
 for _,n:=range []int64{-1,0,1}{
  step:=now+n
  if hmac.Equal([]byte(totp(secret,step)),[]byte(code)){return step,true}
 }
 return 0,false
}
func recoveryHash(code string) string {return tokenHash(strings.ToUpper(strings.TrimSpace(code)))}
func (s *Server) verifySecondFactor(w http.ResponseWriter,r *http.Request,id int64,code string)bool{
 if strings.TrimSpace(code)==""{fail(w,403,"MFA_REQUIRED");return false}
 var secret string;var last int64
 if e:=s.db.QueryRow(r.Context(),"SELECT mfa_secret,mfa_last_step FROM users WHERE id=$1 AND mfa_enabled=TRUE",id).Scan(&secret,&last);e!=nil{fail(w,403,"MFA required");return false}
 if step,ok:=totpStep(secret,code);ok{
  result,e:=s.db.Exec(r.Context(),"UPDATE users SET mfa_last_step=$2 WHERE id=$1 AND mfa_enabled=TRUE AND mfa_last_step<$2",id,step)
  if e==nil&&result.RowsAffected()==1{return true}
  fail(w,401,"MFA code already used or expired");return false
 }
 result,e:=s.db.Exec(r.Context(),"DELETE FROM mfa_recovery_codes WHERE user_id=$1 AND code_hash=$2",id,recoveryHash(code))
 if e==nil&&result.RowsAffected()==1{return true}
 fail(w,401,"Invalid MFA or recovery code");return false
}
func (s *Server) mfaAPI(w http.ResponseWriter,r *http.Request){
 u,e:=s.who(r);if e!=nil{fail(w,401,"Sign in required");return}
 if r.Method=="GET"{
  var enabled bool
  if e=s.db.QueryRow(r.Context(),"SELECT mfa_enabled FROM users WHERE id=$1",u.ID).Scan(&enabled);e!=nil{fail(w,503,"MFA unavailable");return}
  respond(w,200,map[string]any{"enabled":enabled});return
 }
 if r.Method!="POST"{fail(w,405,"Method not allowed");return}
 if s.limited(r,u.Email+"|mfa"){fail(w,429,"Too many MFA attempts");return}
 var c struct{Action,Password,Code string}
 if asJSON(r,&c)!=nil{fail(w,400,"Invalid MFA request");return}
 var passwordHashStored,secret string;var enabled bool
 if e=s.db.QueryRow(r.Context(),"SELECT password_hash,mfa_enabled,COALESCE(mfa_secret,'') FROM users WHERE id=$1",u.ID).Scan(&passwordHashStored,&enabled,&secret);e!=nil{fail(w,503,"MFA unavailable");return}
 if !verifyPassword(c.Password,passwordHashStored){fail(w,401,"Incorrect account password");return}
 switch c.Action{
 case "begin":
  if enabled{fail(w,409,"MFA is already enabled");return}
  key:=make([]byte,20);if _,e=rand.Read(key);e!=nil{fail(w,500,"Could not generate MFA secret");return}
  secret=base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(key)
  if _,e=s.db.Exec(r.Context(),"UPDATE users SET mfa_pending_secret=$2 WHERE id=$1",u.ID,secret);e!=nil{fail(w,503,"Unable to start MFA");return}
  uri:="otpauth://totp/"+url.PathEscape("NovaNexus:"+u.Email)+"?secret="+secret+"&issuer="+url.QueryEscape("NovaNexus")+"&algorithm=SHA1&digits=6&period=30"
  respond(w,200,map[string]any{"secret":secret,"uri":uri});return
 case "confirm":
  if enabled{fail(w,409,"MFA already enabled");return}
  if e=s.db.QueryRow(r.Context(),"SELECT COALESCE(mfa_pending_secret,'') FROM users WHERE id=$1",u.ID).Scan(&secret);e!=nil||secret==""{fail(w,409,"Start MFA enrollment first");return}
  step,ok:=totpStep(secret,c.Code);if !ok{fail(w,401,"Authenticator code incorrect");return}
  codes:=make([]string,10)
  tx,e:=s.db.Begin(r.Context());if e!=nil{fail(w,503,"MFA unavailable");return};defer tx.Rollback(r.Context())
  result,e:=tx.Exec(r.Context(),"UPDATE users SET mfa_enabled=TRUE,mfa_secret=$2,mfa_pending_secret=NULL,mfa_last_step=$3 WHERE id=$1 AND mfa_enabled=FALSE AND mfa_pending_secret=$2",u.ID,secret,step)
  if e!=nil||result.RowsAffected()!=1{fail(w,409,"Enrollment expired or already completed");return}
  if _,e=tx.Exec(r.Context(),"DELETE FROM mfa_recovery_codes WHERE user_id=$1",u.ID);e!=nil{fail(w,503,"MFA recovery setup failed");return}
  for i:=range codes{
   codes[i]=strings.ToUpper(randomHex(6))
   if _,e=tx.Exec(r.Context(),"INSERT INTO mfa_recovery_codes(user_id,code_hash) VALUES($1,$2)",u.ID,recoveryHash(codes[i]));e!=nil{fail(w,503,"MFA recovery setup failed");return}
  }
  if e=tx.Commit(r.Context());e!=nil{fail(w,503,"MFA setup failed");return}
  s.audit(r,u.ID,"mfa.enabled",u.Email)
  respond(w,200,map[string]any{"enabled":true,"recoveryCodes":codes});return
 case "disable":
  if !enabled{fail(w,409,"MFA not enabled");return}
  if !s.verifySecondFactor(w,r,u.ID,c.Code){return}
  tx,e:=s.db.Begin(r.Context());if e!=nil{fail(w,503,"MFA unavailable");return};defer tx.Rollback(r.Context())
  if _,e=tx.Exec(r.Context(),"UPDATE users SET mfa_enabled=FALSE,mfa_secret=NULL,mfa_pending_secret=NULL,mfa_last_step=0 WHERE id=$1",u.ID);e!=nil{fail(w,503,"MFA reset failed");return}
  if _,e=tx.Exec(r.Context(),"DELETE FROM mfa_recovery_codes WHERE user_id=$1",u.ID);e!=nil{fail(w,503,"MFA reset failed");return}
  if e=tx.Commit(r.Context());e!=nil{fail(w,503,"MFA reset failed");return}
  s.audit(r,u.ID,"mfa.disabled",u.Email)
  respond(w,200,map[string]any{"enabled":false});return
 default:fail(w,400,"Unknown MFA action")
 }
}

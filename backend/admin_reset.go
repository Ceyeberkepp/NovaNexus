package main

import (
 "net/http"
 "strconv"
)

// Admin password resets generate an unpredictable one-time temporary password.
// It is returned only in the admin's response, stored only as Argon2id hash,
// invalidates sessions, and requires rotation on the next login.
func (s *Server) adminResetPasswordAPI(w http.ResponseWriter,r *http.Request){
 actor,ok:=s.administrator(w,r);if !ok{return}
 if r.Method!="POST"{fail(w,405,"Method not allowed");return}
 var c struct{UserID int64}
 if asJSON(r,&c)!=nil||c.UserID<=0{fail(w,400,"Valid user ID required");return}
 if c.UserID==actor.ID{fail(w,400,"Use the password change flow to update your own account");return}
 password:=randomHex(16)
 tx,e:=s.db.Begin(r.Context());if e!=nil{fail(w,500,"Database unavailable");return}
 defer tx.Rollback(r.Context())
 count,e:=tx.Exec(r.Context(),"UPDATE users SET password_hash=$1,must_change_password=TRUE WHERE id=$2 AND active=TRUE",passwordHash(password),c.UserID)
 if e!=nil{fail(w,500,"Password reset failed");return}
 if count.RowsAffected()==0{fail(w,404,"Active user not found");return}
 if _,e=tx.Exec(r.Context(),"DELETE FROM sessions WHERE user_id=$1",c.UserID);e!=nil{fail(w,500,"Could not revoke sessions");return}
 if e=tx.Commit(r.Context());e!=nil{fail(w,500,"Password reset failed");return}
 s.audit(r,actor.ID,"password.admin_reset",strconv.FormatInt(c.UserID,10))
 respond(w,200,map[string]any{"temporaryPassword":password,"mustChange":true})
}

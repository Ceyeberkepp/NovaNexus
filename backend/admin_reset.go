package main

import (
 "net/http"
 "strconv"
)

// Administrators choose the new password explicitly in the Admin Users dialog.
// Its hash is stored using Argon2id; sessions are revoked, and first-login
// rotation remains mandatory. Never return a generated secret from this API.
func (s *Server) adminResetPasswordAPI(w http.ResponseWriter,r *http.Request){
 actor,ok:=s.administrator(w,r);if !ok{return}
 if r.Method!="POST"{fail(w,405,"Method not allowed");return}
 if s.limited(r,actor.Email+"|admin-reset"){fail(w,429,"Too many password-reset attempts");return}
 var c struct{UserID int64; NewPassword string; AdminPassword string}
 if asJSON(r,&c)!=nil||c.UserID<=0||len(c.NewPassword)<8||len(c.NewPassword)>1024||c.NewPassword=="admin"||len(c.AdminPassword)==0{
  fail(w,400,"Choose a password with 8–1024 characters and confirm your administrator password");return
 }
 if c.UserID==actor.ID{fail(w,400,"Use Change Password to update your own account");return}
 var currentHash string
 if e:=s.db.QueryRow(r.Context(),"SELECT password_hash FROM users WHERE id=$1",actor.ID).Scan(&currentHash);e!=nil||!verifyPassword(c.AdminPassword,currentHash){
  fail(w,401,"Administrator password incorrect");return
 }
 tx,e:=s.db.Begin(r.Context());if e!=nil{fail(w,500,"Database unavailable");return}
 defer tx.Rollback(r.Context())
 count,e:=tx.Exec(r.Context(),"UPDATE users SET password_hash=$1,must_change_password=TRUE WHERE id=$2 AND active=TRUE",passwordHash(c.NewPassword),c.UserID)
 if e!=nil{fail(w,500,"Password reset failed");return}
 if count.RowsAffected()==0{fail(w,404,"Active user not found");return}
 if _,e=tx.Exec(r.Context(),"DELETE FROM sessions WHERE user_id=$1",c.UserID);e!=nil{fail(w,500,"Could not revoke sessions");return}
 if e=tx.Commit(r.Context());e!=nil{fail(w,500,"Password reset failed");return}
 s.audit(r,actor.ID,"password.admin_reset",strconv.FormatInt(c.UserID,10))
 respond(w,200,map[string]any{"ok":true,"mustChange":true})
}

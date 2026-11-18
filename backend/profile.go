package main

import (
 "net/http"
 "strings"
 "time"
)

// Profile changes are made only by the signed-in user and saved in PostgreSQL.
// Password changes use the separate verified-password flow.
func (s *Server) profileAPI(w http.ResponseWriter,r *http.Request){
 u,e:=s.who(r);if e!=nil{fail(w,401,"Sign in required");return}
 if u.MustChange{fail(w,403,"Password change required");return}
 if r.Method!="POST"{fail(w,405,"Method not allowed");return}
 var c struct{ Name,JobTitle,Birthday,Avatar string }
 if asJSON(r,&c)!=nil{fail(w,400,"Invalid profile update");return}
 c.Name=strings.TrimSpace(c.Name)
 c.JobTitle=strings.TrimSpace(c.JobTitle)
 if len(c.Name)<2||len(c.Name)>120||len(c.JobTitle)>120{fail(w,400,"Name must be 2–120 characters; job title up to 120");return}
 if c.Birthday!=""{if _,err:=time.Parse("2006-01-02",c.Birthday);err!=nil{fail(w,400,"Invalid birthday");return}}
 // Only locally encoded small PNG/JPEG/WebP pictures are accepted. Do not fetch remote URLs.
 if len(c.Avatar)>60000 || (c.Avatar!="" && !(strings.HasPrefix(c.Avatar,"data:image/png;base64,")||strings.HasPrefix(c.Avatar,"data:image/jpeg;base64,")||strings.HasPrefix(c.Avatar,"data:image/webp;base64,"))){fail(w,400,"Profile image must be a small PNG, JPEG or WebP image");return}
 var updated User
 e=s.db.QueryRow(r.Context(),`UPDATE users SET name=$2,job_title=$3,birthday=$4,avatar=$5 WHERE id=$1 AND active=TRUE RETURNING id,name,email,username,role,must_change_password,mfa_enabled,job_title,birthday,avatar,COALESCE(terms_version,'')`,u.ID,c.Name,c.JobTitle,c.Birthday,c.Avatar).Scan(&updated.ID,&updated.Name,&updated.Email,&updated.Username,&updated.Role,&updated.MustChange,&updated.MFAEnabled,&updated.JobTitle,&updated.Birthday,&updated.Avatar,&updated.TermsVersion)
 if e!=nil{fail(w,500,"Profile update failed");return}
 s.audit(r,u.ID,"account.profile_updated",u.Email)
 respond(w,200,map[string]any{"user":updated.data()})
}

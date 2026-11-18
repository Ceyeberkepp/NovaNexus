package main

import (
 "net/http"
 "time"
)

const termsVersion = "2026-11-17-v1"

// The canonical agreement is served from the backend so the text and version
// acknowledged by users cannot drift from the UI.
const termsText = `NEXUS WORKSPACE — TERMS OF USE
Version: 2026-11-17-v1

1. ACCESS AND ACCOUNTS
Nexus Workspace is a private collaboration system. Access is provided only to accounts authorized by the workspace administrator. Keep your credentials and authenticator codes secure. Do not share someone else's account or try to bypass access controls.

2. ACCEPTABLE USE
Use chat, calls, files, and meetings lawfully and respectfully. Do not harass people, upload malicious material, impersonate another person, disrupt services, or access information without authorization. The administrator may suspend access for security or policy violations.

3. CONTENT AND RECORDINGS
You are responsible for material you upload, messages you send, and meetings you organize. You must have permission to share confidential or copyrighted material. Notify participants and obtain any legally required consent before recording a meeting, capturing a call, or distributing recordings.

4. PRIVACY AND SECURITY
Nexus Workspace does not intentionally install advertising pixels, behavioral analytics trackers, or cross-site advertising identifiers. The service still processes information needed for accounts, meetings, communications, authentication, and security. Necessary session cookies and temporary security-related request information may be used to operate and protect the service. The workspace administrator is responsible for applicable organizational privacy policies, retention, and authorized access to stored content.

5. AVAILABILITY AND CHANGES
The service may be interrupted for maintenance or security reasons. Features and these Terms may change. When a new version requires acknowledgment, access may be paused until you review and accept it. Contact your workspace administrator for questions or to request an account closure.

By selecting "I agree", you acknowledge that you have read and accept these Terms of Use. Your account, accepted version, and acceptance time are recorded for accountability.`

func (s *Server) termsAPI(w http.ResponseWriter,r *http.Request){
 if r.Method=="GET"{
  respond(w,200,map[string]any{"version":termsVersion,"text":termsText})
  return
 }
 if r.Method!="POST"{fail(w,405,"Method not allowed");return}
 u,e:=s.who(r)
 if e!=nil {fail(w,401,"Sign in required");return}
 if u.TermsVersion==termsVersion {
  respond(w,200,map[string]any{"ok":true,"user":u.data()});return
 }
 var request struct{Version string `json:"version"`;Accept bool `json:"accept"`}
 if asJSON(r,&request)!=nil||!request.Accept||request.Version!=termsVersion {
  fail(w,400,"Review and accept the current Terms of Use");return
 }
 if _,e=s.db.Exec(r.Context(),"UPDATE users SET terms_version=$1,terms_accepted_at=$2 WHERE id=$3",termsVersion,time.Now().UTC(),u.ID);e!=nil{
  fail(w,503,"Unable to record terms acceptance");return
 }
 s.audit(r,u.ID,"terms.accepted",termsVersion)
 u.TermsVersion=termsVersion
 respond(w,200,map[string]any{"ok":true,"user":u.data()})
}

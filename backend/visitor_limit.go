package main

import (
 "net"
 "net/http"
 "strconv"
 "strings"
 "time"
)

type visitorWindow struct { Start time.Time; Count int }
const visitorPerMinute = 180
const visitorOriginPerMinute = 6000

// Guest requests are limited in RAM only. No advertising identifiers,
// persistent visitor profiles or analytics events are stored.
func (s *Server) guestLimited(w http.ResponseWriter,r *http.Request) bool {
 if r.Method!="GET"&&r.Method!="HEAD" {return false}
 // Only public frontend and metadata routes, not the health probe.
 path:=r.URL.Path
 public:=path=="/"||path=="/api/branding"||path=="/api/terms"||strings.HasPrefix(path,"/assets/")||path=="/boot-health.js"
 if !public {return false}
 // Never trust a client-supplied session cookie as proof of authentication.
 // Apply the inexpensive limit to all public assets and endpoints.
 peer,_,e:=net.SplitHostPort(r.RemoteAddr);if e!=nil{peer=r.RemoteAddr}
 if peer==""{peer="unknown"}
 client:=peer
 // CF-Connecting-IP is useful for distinguishing visitors behind a tunnel,
 // but can be spoofed on a direct LAN request. A separate non-bypassable
 // per-origin limit still applies regardless of the forwarded header.
 if value:=r.Header.Get("CF-Connecting-IP");value!="" {
  if address:=net.ParseIP(value);address!=nil {client=address.String()}
 }
 now:=time.Now()
 s.visitMu.Lock()
 if s.visitors==nil{s.visitors=make(map[string]visitorWindow)}
 if len(s.visitors)>10000 {
  for k,v:=range s.visitors {if now.Sub(v.Start)>time.Minute{delete(s.visitors,k)}}
  // A rotating set of forged client addresses must not grow this map
  // without bound. Use one shared overflow bucket until windows expire.
  if len(s.visitors)>10000 {
   if _,known:=s.visitors["client:"+client];!known {client="overflow"}
  }
 }
 allowed:=true
 for _,entry:=range []struct{key string;limit int}{{"client:"+client,visitorPerMinute},{"origin:"+peer,visitorOriginPerMinute}} {
  v:=s.visitors[entry.key]
  if now.Sub(v.Start)>=time.Minute||v.Start.IsZero(){v=visitorWindow{Start:now}}
  v.Count++
  s.visitors[entry.key]=v
  if v.Count>entry.limit {allowed=false}
 }
 s.visitMu.Unlock()
 if !allowed {
  w.Header().Set("Retry-After",strconv.Itoa(60))
  w.Header().Set("Cache-Control","no-store")
  fail(w,http.StatusTooManyRequests,"Too many requests; try again shortly")
  return true
 }
 return false
}

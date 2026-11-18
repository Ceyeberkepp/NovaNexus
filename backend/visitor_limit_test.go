package main

import (
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
)

func TestGuestRateLimitingAndNoCookieBypass(t *testing.T) {
 s:=&Server{}
 for i:=0;i<visitorPerMinute;i++{
  r:=httptest.NewRequest(http.MethodGet,"https://192.168.0.52/",nil)
  r.RemoteAddr="192.168.0.52:45000"
  if i==visitorPerMinute-1{r.AddCookie(&http.Cookie{Name:cookieName,Value:strings.Repeat("f",64)})}
  if s.guestLimited(httptest.NewRecorder(),r){t.Fatalf("rate limit triggered early on request %d",i)}
 }
 r:=httptest.NewRequest(http.MethodGet,"https://192.168.0.52/",nil)
 r.RemoteAddr="192.168.0.52:45000"
 r.AddCookie(&http.Cookie{Name:cookieName,Value:strings.Repeat("f",64)})
 w:=httptest.NewRecorder()
 if !s.guestLimited(w,r)||w.Code!=http.StatusTooManyRequests {t.Fatalf("expected 429 after limit, got %d",w.Code)}
 if w.Header().Get("Retry-After")!="60"{t.Fatal("missing Retry-After")}
}

func TestGuestLimiterDoesNotBlockHealthChecksOrLogin(t *testing.T){
 s:=&Server{}
 for _,path:=range []string{"/api/health","/api/auth/login","/api/messages"}{
  r:=httptest.NewRequest(http.MethodGet,"https://192.168.0.52"+path,nil)
  if s.guestLimited(httptest.NewRecorder(),r){t.Fatalf("unexpected limit for %s",path)}
 }
}

func TestGuestLimiterSeparatesCloudflareVisitors(t *testing.T){
 s:=&Server{}
 for i:=0;i<visitorPerMinute+1;i++{
  r:=httptest.NewRequest(http.MethodGet,"https://192.168.0.52/",nil)
  r.RemoteAddr="172.20.0.2:1234"
  r.Header.Set("CF-Connecting-IP","203.0.113.10")
  w:=httptest.NewRecorder()
  blocked:=s.guestLimited(w,r)
  if blocked!=(i>=visitorPerMinute){t.Fatalf("unexpected result at %d",i)}
 }
 other:=httptest.NewRequest(http.MethodGet,"https://192.168.0.52/",nil)
 other.RemoteAddr="172.20.0.2:1234"
 other.Header.Set("CF-Connecting-IP","203.0.113.11")
 if s.guestLimited(httptest.NewRecorder(),other){t.Fatal("second visitor should have own request budget")}
}

func TestTermsDocumentVersionIsPublished(t *testing.T){
 if termsVersion==""||!strings.Contains(termsText,"Version: "+termsVersion){t.Fatal("terms version and text differ")}
 if !strings.Contains(termsText,"PRIVACY AND SECURITY"){t.Fatal("privacy terms absent")}
}

package main

import (
 "net/http/httptest"
 "testing"
)
func TestGuestMeetingRateLimit(t *testing.T) {
 s:=&Server{}
 for i:=0;i<60;i++ {
  r:=httptest.NewRequest("POST","/api/meetings/guest-token",nil)
  r.RemoteAddr="127.0.0.1:12345"
  r.Header.Set("CF-Connecting-IP","198.51.100.100")
  if s.guestMeetingRateLimited(r,"12345678"){t.Fatalf("blocked before client limit on request %d",i)}
 }
 r:=httptest.NewRequest("POST","/api/meetings/guest-token",nil)
 r.RemoteAddr="127.0.0.1:12345"
 r.Header.Set("CF-Connecting-IP","198.51.100.100")
 if !s.guestMeetingRateLimited(r,"12345678"){t.Fatal("expected block after 60 requests")}
 r2:=httptest.NewRequest("POST","/api/meetings/guest-token",nil)
 r2.RemoteAddr="127.0.0.1:12345"
 r2.Header.Set("CF-Connecting-IP","198.51.100.101")
 if s.guestMeetingRateLimited(r2,"12345678"){t.Fatal("one client must not block a separate guest on the same proxy")}
}

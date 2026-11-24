package main

import (
 "testing"
 "time"
)

func TestResolvedPresence(t *testing.T) {
 now:=time.Date(2026,11,24,12,0,0,0,time.UTC)
 cases:=[]struct{name,mode string;idle bool;seen time.Time;want string}{
  {"online","available",false,now,"available"},
  {"idle","available",true,now,"away"},
  {"manually away","away",false,now,"away"},
  {"busy overrides idle","busy",true,now,"busy"},
  {"invisible","offline",false,now,"offline"},
  {"expired","busy",false,now.Add(-91*time.Second),"offline"},
  {"not yet signed in","available",false,time.Time{},"offline"},
 }
 for _,tc:=range cases{
  t.Run(tc.name,func(t *testing.T){
   got:=resolvedPresence(tc.mode,tc.idle,tc.seen,now)
   if got!=tc.want{t.Fatalf("want %q, got %q",tc.want,got)}
  })
 }
}
func TestValidPresenceMode(t *testing.T) {
 for _,mode:=range []string{"available","away","busy","offline"}{
  if !validPresenceMode(mode){t.Fatalf("rejected %q",mode)}
 }
 for _,mode:=range []string{"","online","active","dnd","invisible","AVAILABLE"}{
  if validPresenceMode(mode){t.Fatalf("accepted invalid %q",mode)}
 }
}

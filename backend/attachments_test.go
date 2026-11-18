package main

import (
 "strings"
 "testing"
)
func TestSafeAttachmentName(t *testing.T) {
 tests:=[]struct{in,want string}{
  {"photo.png","photo.png"},
  {"../../etc/passwd","passwd"},
  {"..\\..\\secrets.txt","secrets.txt"},
  {"", "attachment"},
  {"\n\r", "attachment"},
 }
 for _,tc:=range tests {
  got:=safeAttachmentName(tc.in)
  if got!=tc.want{t.Errorf("safeAttachmentName(%q)=%q, want %q",tc.in,got,tc.want)}
 }
 got:=safeAttachmentName(strings.Repeat("ü",200))
 if len(got)>180 {t.Fatalf("name length %d exceeds limit",len(got))}
}

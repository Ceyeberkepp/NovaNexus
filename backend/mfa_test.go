package main

import (
 "encoding/base32"
 "testing"
)

func TestTOTPStandardSixDigit(t *testing.T) {
 secret:=base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString([]byte("12345678901234567890"))
 tests:=[]struct{step int64;want string}{
  {59/30,"287082"},
  {1111111109/30,"081804"},
  {1234567890/30,"005924"},
  {2000000000/30,"279037"},
 }
 for _,test:=range tests{
  if got:=totp(secret,test.step);got!=test.want{t.Errorf("TOTP at step %d: got %s want %s",test.step,got,test.want)}
 }
}
func TestUsernameValidation(t *testing.T){
 for _,v:=range []string{"alice","a_b","j-smith","member123"}{if !validUsername(v){t.Errorf("valid username rejected: %s",v)}}
 for _,v:=range []string{"ab","a.b","UPPER","hello space","", "name@domain"}{if validUsername(v){t.Errorf("invalid username accepted: %s",v)}}
}

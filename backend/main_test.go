package main

import (
 "crypto/subtle"
 "strings"
 "testing"
)

func TestPasswordHashAndVerification(t *testing.T) {
 secret := "a-long-unique-secret-for-testing"
 hashed := passwordHash(secret)
 if strings.Contains(hashed,secret) {t.Fatal("password stored in clear text")}
 if !verifyPassword(secret,hashed) {t.Fatal("correct password rejected")}
 if verifyPassword("incorrect",hashed) {t.Fatal("incorrect password accepted")}
 if verifyPassword(secret,"") {t.Fatal("empty hash accepted")}
 if verifyPassword(secret,"not:a:valid:hash") {t.Fatal("invalid hash accepted")}
 if hashed == passwordHash(secret) {t.Fatal("missing random password salt")}
}

func TestRandomToken(t *testing.T) {
 first,second := randomHex(32),randomHex(32)
 if len(first)!=64 || len(second)!=64 {t.Fatal("token must have 256 bits")}
 if subtle.ConstantTimeCompare([]byte(first),[]byte(second)) == 1 {t.Fatal("tokens must differ")}
 if tokenHash(first)==tokenHash(second) {t.Fatal("token hash collision")}
}

func TestBootstrapUserRepresentation(t *testing.T) {
 u:=User{ID:1,Name:"Administrator",Email:"admin@local.invalid",Role:"Admin",MustChange:true}
 v:=u.data()
 if v["must_change_password"]!=true || v["role"]!="Admin" {t.Fatal("first-login password flag must be exposed")}
}

package main

import (
 "crypto/rand"
 "crypto/rsa"
 "crypto/x509"
 "crypto/x509/pkix"
 "encoding/pem"
 "math/big"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "time"
)

func testSigningCertificate(t *testing.T) string {
 t.Helper()
 key,e:=rsa.GenerateKey(rand.Reader,2048);if e!=nil{t.Fatal(e)}
 now:=time.Now()
 template:=&x509.Certificate{SerialNumber:big.NewInt(100),Subject:pkix.Name{CommonName:"Example IdP"},NotBefore:now.Add(-time.Hour),NotAfter:now.Add(24*time.Hour),KeyUsage:x509.KeyUsageDigitalSignature}
 der,e:=x509.CreateCertificate(rand.Reader,template,template,&key.PublicKey,key);if e!=nil{t.Fatal(e)}
 return string(pem.EncodeToMemory(&pem.Block{Type:"CERTIFICATE",Bytes:der}))
}

func TestSAMLProviderValidation(t *testing.T) {
 cert:=testSigningCertificate(t)
 if !validSAMLProvider("https://idp.example.com/realm","https://idp.example.com/saml",cert){t.Fatal("valid IdP config rejected")}
 for _,tc:=range []struct{name,entity,url,cert string}{
  {"http endpoint","https://idp.example.com","http://idp.example.com/saml",cert},
  {"embedded credentials","https://idp.example.com","https://user:secret@idp.example.com/saml",cert},
  {"invalid certificate","https://idp.example.com","https://idp.example.com/saml","not PEM"},
  {"empty entity","","https://idp.example.com/saml",cert},
 } {
  t.Run(tc.name,func(t *testing.T){if validSAMLProvider(tc.entity,tc.url,tc.cert){t.Fatal("invalid IdP config accepted")}})
 }
}

func TestSAMLSignInFailsClosed(t *testing.T) {
 s:=&Server{}
 req:=httptest.NewRequest(http.MethodGet,"/api/auth/saml/start",nil)
 rec:=httptest.NewRecorder()
 s.samlStartAPI(rec,req)
 if rec.Code!=http.StatusServiceUnavailable {t.Fatalf("status %d; expected 503",rec.Code)}
 if !strings.Contains(rec.Body.String(),"not available"){t.Fatal("missing explicit unavailable message")}
 req=httptest.NewRequest(http.MethodGet,"/api/auth/saml/status",nil)
 rec=httptest.NewRecorder()
 s.samlStatusAPI(rec,req)
 if rec.Code!=http.StatusOK || !strings.Contains(rec.Body.String(),"\"enabled\":false"){t.Fatal("SAML status must not advertise enabled login")}
}

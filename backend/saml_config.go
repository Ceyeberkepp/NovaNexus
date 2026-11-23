package main

import (
 "crypto/x509"
 "crypto/rsa"
 "crypto/ecdsa"
 "crypto/ed25519"
 "encoding/pem"
 "net/http"
 "net/url"
 "strings"
 "time"
)

// SAML configuration is deliberately separate from the login flow.
// Do not accept assertions or mark SSO enabled until a vetted SAML SP
// verifies signatures, issuer, audience, recipient, timestamps, InResponseTo,
// and replay resistance with a tested identity-to-account mapping.
func validSAMLProvider(entityID, loginURL, certificate string) bool {
 entityID=strings.TrimSpace(entityID)
 loginURL=strings.TrimSpace(loginURL)
 certificate=strings.TrimSpace(certificate)
 if len(entityID)<3||len(entityID)>1024||len(loginURL)>2048||len(certificate)>8192{return false}
 u,e:=url.Parse(loginURL)
 if e!=nil||u.Scheme!="https"||u.Hostname()==""||u.User!=nil||u.Fragment!="" {return false}
 block,rest:=pem.Decode([]byte(certificate))
 // Accept exactly one signing certificate: silently ignoring a second PEM block
 // or trailing data makes the saved IdP trust anchor ambiguous.
 if !strings.HasPrefix(certificate,"-----BEGIN CERTIFICATE-----") || block==nil || block.Type!="CERTIFICATE" || len(block.Headers)!=0 || len(strings.TrimSpace(string(rest)))!=0 {return false}
 cert,e:=x509.ParseCertificate(block.Bytes)
 if e!=nil||cert.PublicKey==nil{return false}
 // Do not allow obsolete IdP assertion-signing keys. This is only
 // configuration validation, NOT a SAML assertion verifier.
 switch key:=cert.PublicKey.(type) {
 case *rsa.PublicKey:
  if key.N.BitLen()<2048{return false}
 case *ecdsa.PublicKey:
  if key.Curve.Params().BitSize<256{return false}
 case ed25519.PublicKey:
  if len(key)!=ed25519.PublicKeySize{return false}
 default:
  return false
 }
 now:=time.Now()
 // An IdP signing certificate must be usable now. Certificate rotation
 // should be performed before expiry, not accepted silently afterward.
 if now.Before(cert.NotBefore)||!now.Before(cert.NotAfter){return false}
 // A certificate explicitly limited to other uses cannot sign assertions.
 if cert.KeyUsage!=0 && cert.KeyUsage&x509.KeyUsageDigitalSignature==0{return false}
 return true
}

func (s *Server) samlConfigurationAPI(w http.ResponseWriter,r *http.Request) {
 actor,ok:=s.administrator(w,r);if !ok{return}
 if r.Method=="GET" {
  cfg:=map[string]string{"entityID":"","loginURL":"","certificate":""}
  rows,e:=s.db.Query(r.Context(),"SELECT name,value FROM app_settings WHERE name IN ('saml_idp_entity_id','saml_idp_sso_url','saml_idp_certificate')")
  if e!=nil{fail(w,500,"SAML settings unavailable");return};defer rows.Close()
  for rows.Next() {var key,value string;if rows.Scan(&key,&value)==nil{switch key{case "saml_idp_entity_id":cfg["entityID"]=value;case "saml_idp_sso_url":cfg["loginURL"]=value;case "saml_idp_certificate":cfg["certificate"]=value}}}
  if rows.Err()!=nil{fail(w,500,"SAML settings unavailable");return}
  respond(w,200,map[string]any{"configuration":cfg,"enabled":false,"status":"pending-verifier"});return
 }
 if r.Method!="PUT"{fail(w,405,"Method not allowed");return}
 var input struct { EntityID,LoginURL,Certificate string }
 if asJSON(r,&input)!=nil {fail(w,400,"Invalid SAML configuration");return}
 if !validSAMLProvider(input.EntityID,input.LoginURL,input.Certificate){fail(w,400,"Valid IdP entity ID, HTTPS SSO URL and PEM X.509 signing certificate required");return}
 tx,e:=s.db.Begin(r.Context());if e!=nil{fail(w,500,"Database unavailable");return};defer tx.Rollback(r.Context())
 for key,value:=range map[string]string{"saml_idp_entity_id":strings.TrimSpace(input.EntityID),"saml_idp_sso_url":strings.TrimSpace(input.LoginURL),"saml_idp_certificate":strings.TrimSpace(input.Certificate)} {
  if _,e=tx.Exec(r.Context(),"INSERT INTO app_settings(name,value) VALUES ($1,$2) ON CONFLICT(name) DO UPDATE SET value=EXCLUDED.value",key,value);e!=nil{fail(w,500,"Unable to save SAML configuration");return}
 }
 if e=tx.Commit(r.Context());e!=nil{fail(w,500,"Unable to save SAML configuration");return}
 s.audit(r,actor.ID,"security.saml_config_updated","identity_provider")
 respond(w,200,map[string]any{"ok":true,"enabled":false,"status":"pending-verifier"})
}

func (s *Server) samlStatusAPI(w http.ResponseWriter,r *http.Request) {
 if r.Method!="GET"{fail(w,405,"Method not allowed");return}
 // Explicitly fail closed until the authentication backend is complete.
 respond(w,200,map[string]any{"enabled":false,"status":"not-available"})
}

func (s *Server) samlStartAPI(w http.ResponseWriter,r *http.Request) {
 fail(w,503,"SAML sign-in is not available until signed assertion validation is deployed")
}

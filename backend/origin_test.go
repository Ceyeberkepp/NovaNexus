package main

import (
 "net/http"
 "net/http/httptest"
 "testing"
)

func TestAcceptedBrowserOriginThroughCloudflareTunnel(t *testing.T) {
 t.Setenv("NOVANEXUS_TUNNEL_DOMAIN","")
 t.Setenv("NOVANEXUS_PUBLIC_DOMAIN","")
 tests:=[]struct{
  name,origin,fetchSite string
  secure,want bool
 }{
  {"local secure login","https://192.168.0.52","same-origin",true,true},
  {"cloudflare same-origin login","https://nexus.cyverax.com","same-origin",true,true},
  {"cloudflare API request with no Origin","","same-origin",true,true},
  {"cross-site attempt","https://evil.example","cross-site",true,false},
  {"same-site different origin","https://other.cyverax.com","same-site",true,false},
  {"cross-domain without fetch metadata","https://evil.example","",true,false},
  {"origin mismatch when fetch-site none","https://evil.example","none",true,false},
  {"insecure public origin","http://nexus.cyverax.com","same-origin",true,false},
  {"bad origin path","https://nexus.cyverax.com/extra","same-origin",true,false},
  {"local development","http://localhost:3000","same-origin",false,true},
  {"nonsecure proxied mismatch","https://nexus.cyverax.com","same-origin",false,false},
 }
 for _,tc:=range tests {
  t.Run(tc.name,func(t *testing.T){
   r:=httptest.NewRequest(http.MethodPost,"http://192.168.0.52/api/auth/login",nil)
   r.Host="192.168.0.52"
   if tc.origin!="" {r.Header.Set("Origin",tc.origin)}
   if tc.fetchSite!="" {r.Header.Set("Sec-Fetch-Site",tc.fetchSite)}
   if got:=acceptedBrowserOrigin(r,tc.secure);got!=tc.want {
    t.Fatalf("acceptedBrowserOrigin=%v, want %v",got,tc.want)
   }
  })
 }
}

func TestExplicitConfiguredPublicTunnelOrigin(t *testing.T) {
 t.Setenv("NOVANEXUS_TUNNEL_DOMAIN","nexus.cyverax.com")
 r:=httptest.NewRequest(http.MethodPost,"http://192.168.0.52/api/auth/login",nil)
 r.Header.Set("Origin","https://nexus.cyverax.com")
 if !acceptedBrowserOrigin(r,true){t.Fatal("explicitly configured public tunnel origin rejected")}
 r.Header.Set("Origin","https://untrusted.example")
 if acceptedBrowserOrigin(r,true){t.Fatal("untrusted origin accepted without same-origin metadata")}
}

package main

import (
 "bytes"
 "context"
 "encoding/json"
 "io"
 "net/http"
 "os"
 "strings"
 "time"
)

type assistantTurn struct{Role string `json:"role"`;Content string `json:"content"`}
func (s *Server) aiAssistantAPI(w http.ResponseWriter,r *http.Request){
 if r.Method!="POST"{fail(w,405,"Method not allowed");return}
 u,e:=s.who(r);if e!=nil{fail(w,401,"Sign in required");return}
 if u.MustChange{fail(w,403,"Password change required");return}
 var input struct{Messages []assistantTurn `json:"messages"`}
 if asJSON(r,&input)!=nil||len(input.Messages)==0||len(input.Messages)>16{fail(w,400,"Send 1–16 conversation messages");return}
 msgs:=[]assistantTurn{{Role:"system",Content:"You are the NovaNexus Workspace assistant. Give useful concise answers, help users use chat, meetings, calendar and workspace tools. Do not claim to have performed tasks, changed accounts, read private messages or accessed documents; you cannot do that through this chat. If an action needs a tool, explain the steps."}}
 total:=0
 for _,m:=range input.Messages{
  if m.Role!="user"&&m.Role!="assistant"{fail(w,400,"Only user and assistant messages allowed");return}
  m.Content=strings.TrimSpace(m.Content)
  if m.Content==""||len(m.Content)>2500{fail(w,400,"Each message must contain 1–2500 characters");return}
  total+=len(m.Content);msgs=append(msgs,m)
 }
 if total>14000||msgs[len(msgs)-1].Role!="user"{fail(w,400,"Conversation too long or last turn is not a user message");return}
 payload,_:=json.Marshal(map[string]any{"model":os.Getenv("OLLAMA_MODEL"),"messages":msgs,"stream":false,"options":map[string]any{"num_predict":512}})
 ctx,cancel:=context.WithTimeout(r.Context(),120*time.Second);defer cancel()
 request,e:=http.NewRequestWithContext(ctx,"POST",os.Getenv("OLLAMA_URL")+"/api/chat",bytes.NewReader(payload))
 if e!=nil{fail(w,503,"AI service configuration unavailable");return}
 request.Header.Set("Content-Type","application/json")
 client:=&http.Client{Timeout:120*time.Second}
 res,e:=client.Do(request)
 if e!=nil{fail(w,503,"Local AI assistant is unavailable or model is still loading");return}
 defer res.Body.Close()
 if res.StatusCode!=200{fail(w,503,"Local AI service is not ready");return}
 var output struct{Message assistantTurn `json:"message"`}
 if json.NewDecoder(io.LimitReader(res.Body,2*1024*1024)).Decode(&output)!=nil||strings.TrimSpace(output.Message.Content)==""{fail(w,502,"Invalid AI response");return}
 respond(w,200,map[string]any{"reply":output.Message.Content,"model":os.Getenv("OLLAMA_MODEL")})
}

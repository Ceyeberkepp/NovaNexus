package main

import (
 "net/http"
 "strconv"
 "strings"
)

func (s *Server) adminGroupsAPI(w http.ResponseWriter,r *http.Request){
 actor,ok:=s.administrator(w,r);if !ok{return}
 if r.Method=="GET"{
  rows,e:=s.db.Query(r.Context(),`SELECT g.id,g.name,g.description,COALESCE(array_agg(m.user_id) FILTER(WHERE m.user_id IS NOT NULL),'{}'::bigint[]) FROM workspace_groups g LEFT JOIN group_members m ON m.group_id=g.id GROUP BY g.id ORDER BY g.name LIMIT 250`)
  if e!=nil{fail(w,500,"Groups unavailable");return}
  defer rows.Close()
  groups:=make([]map[string]any,0)
  for rows.Next(){var id int64;var name,description string;var members []int64
   if rows.Scan(&id,&name,&description,&members)!=nil{fail(w,500,"Groups unavailable");return}
   groups=append(groups,map[string]any{"id":id,"name":name,"description":description,"members":members})
  }
  if rows.Err()!=nil{fail(w,500,"Groups unavailable");return}
  respond(w,200,map[string]any{"groups":groups});return
 }
 var c struct{Name,Description string;GroupID,UserID int64;Action string}
 if r.Method!="POST"&&r.Method!="PATCH"&&r.Method!="DELETE"{fail(w,405,"Method not allowed");return}
 if asJSON(r,&c)!=nil{fail(w,400,"Invalid group request");return}
 c.Name=strings.TrimSpace(c.Name);c.Description=strings.TrimSpace(c.Description)
 if len(c.Description)>500{fail(w,400,"Description must not exceed 500 characters");return}
 if c.Action=="add_member"||c.Action=="remove_member" {
  if r.Method!="PATCH"||c.GroupID<=0||c.UserID<=0{fail(w,400,"Group and user required");return}
  var e error
  if c.Action=="add_member" {
   _,e=s.db.Exec(r.Context(),"INSERT INTO group_members(group_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",c.GroupID,c.UserID)
  }else{
   _,e=s.db.Exec(r.Context(),"DELETE FROM group_members WHERE group_id=$1 AND user_id=$2",c.GroupID,c.UserID)
  }
  if e!=nil{fail(w,400,"Group member update failed");return}
  s.audit(r,actor.ID,"group."+c.Action,strconv.FormatInt(c.GroupID,10))
  respond(w,200,map[string]any{"ok":true});return
 }
 if r.Method=="POST"{
  if len(c.Name)<2||len(c.Name)>100{fail(w,400,"Group name must be 2–100 characters");return}
  var id int64
  if e:=s.db.QueryRow(r.Context(),"INSERT INTO workspace_groups(name,description) VALUES($1,$2) RETURNING id",c.Name,c.Description).Scan(&id);e!=nil{fail(w,409,"Group name already exists");return}
  s.audit(r,actor.ID,"group.created",strconv.FormatInt(id,10))
  respond(w,201,map[string]any{"id":id});return
 }
 if c.GroupID<=0{fail(w,400,"Valid group ID required");return}
 if r.Method=="DELETE"{
  count,e:=s.db.Exec(r.Context(),"DELETE FROM workspace_groups WHERE id=$1",c.GroupID)
  if e!=nil{fail(w,500,"Unable to remove group");return}
  if count.RowsAffected()==0{fail(w,404,"Group not found");return}
  s.audit(r,actor.ID,"group.deleted",strconv.FormatInt(c.GroupID,10))
  respond(w,200,map[string]any{"ok":true});return
 }
 if len(c.Name)<2||len(c.Name)>100{fail(w,400,"Group name must be 2–100 characters");return}
 count,e:=s.db.Exec(r.Context(),"UPDATE workspace_groups SET name=$2,description=$3 WHERE id=$1",c.GroupID,c.Name,c.Description)
 if e!=nil{fail(w,409,"Group name already exists");return}
 if count.RowsAffected()==0{fail(w,404,"Group not found");return}
 s.audit(r,actor.ID,"group.updated",strconv.FormatInt(c.GroupID,10))
 respond(w,200,map[string]any{"ok":true})
}

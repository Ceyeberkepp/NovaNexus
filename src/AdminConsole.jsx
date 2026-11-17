import React,{useEffect,useState} from 'react';
import {Users,Shield,Calendar,Image as ImageIcon,ScrollText,Settings,Save,RefreshCw} from 'lucide-react';
import {fetchUsers,provisionUser} from './auth-client';

async function adminRequest(path,options={}){
 const res=await fetch('/api/admin/'+path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
 const json=await res.json();
 if(!res.ok)throw Error(json.error||'Request failed');
 return json;
}
const input='w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500';
const btn='rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50';
const tabs=[['users','Users',Users],['groups','Groups',Users],['security','Security',Shield],['meetings','Meetings',Calendar],['branding','Branding',ImageIcon],['logs','Logs',ScrollText]];
export default function AdminConsole({users,setUsers}){
 const [tab,setTab]=useState('users');
 const [notice,setNotice]=useState('');
 const [loading,setLoading]=useState(false);
 const [form,setForm]=useState({name:'',email:'',password:''});
 const [settings,setSettings]=useState({workspace_name:'NovaNexus Workspace',default_meeting_limit:'1000',session_minutes:'480'});
 const [logs,setLogs]=useState([]);
 const [groups,setGroups]=useState([]);
 const [groupForm,setGroupForm]=useState({name:'',description:''});
 useEffect(()=>{refresh();},[]);
 async function refresh(){
  try{
   const [directory,config,audit,groupData]=await Promise.all([adminRequest('directory'),adminRequest('settings'),adminRequest('logs'),adminRequest('groups')]);
   setUsers(directory.users);setSettings({...settings,...config.settings});setLogs(audit.events);setGroups(groupData.groups);
  }catch(e){setNotice(e.message);}
 }
 async function execute(fn){
  setLoading(true);setNotice('');
  try{await fn();await refresh();setNotice('Changes saved successfully.');window.dispatchEvent(new Event('novanexus:branding-changed'));}
  catch(e){setNotice(e.message);}
  finally{setLoading(false);}
 }
 async function createAccount(e){
  e.preventDefault();
  await execute(async()=>{await provisionUser(form.name,form.email,form.password);setForm({name:'',email:'',password:''});});
 }
 async function updateAccount(user,changes){
  await execute(()=>adminRequest('users?id='+encodeURIComponent(user.id),{method:'PATCH',body:JSON.stringify(changes)}));
 }
 async function saveSettings(e){
  e.preventDefault();
  await execute(()=>adminRequest('settings',{method:'PUT',body:JSON.stringify({workspaceName:settings.workspace_name,defaultMeetingLimit:Number(settings.default_meeting_limit),sessionMinutes:Number(settings.session_minutes)})}));
 }
 async function uploadBranding(e,key){
  const file=e.target.files?.[0];if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>128*1024){
   setNotice('Choose a PNG, JPEG or WebP image no larger than 128 KB.');return;
  }
  const reader=new FileReader();
  reader.onload=()=>execute(()=>adminRequest('branding',{method:'PUT',body:JSON.stringify({key,data:String(reader.result||'')})}));
  reader.onerror=()=>setNotice('Could not read image file.');
  reader.readAsDataURL(file);
 }
 async function clearBranding(key){await execute(()=>adminRequest('branding',{method:'PUT',body:JSON.stringify({key,data:''})}));}

 function exportLogs(){
  const rows=[['Time','Event','Actor','Target'],...logs.map(l=>[l.created_at,l.event,l.actor,l.target])];
  const csv=rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='novanexus-audit.csv';a.click();URL.revokeObjectURL(url);
 }
 return <section className="h-full overflow-auto bg-slate-50 px-5 py-8 md:px-10">
   <div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap justify-between gap-3 items-center mb-7">
     <div><h1 className="text-2xl font-black text-slate-900">ADMIN CONSOLE</h1><p className="text-xs uppercase tracking-widest text-slate-500">Workspace configuration and security</p></div>
     <button className="rounded-xl border bg-white px-4 py-2 flex items-center gap-2 text-sm" onClick={refresh}><RefreshCw size={16}/> Refresh</button>
    </div>
    <nav className="flex gap-1 overflow-x-auto border-b mb-6" aria-label="Administration sections">{tabs.map(([key,label,Icon])=><button key={key} onClick={()=>setTab(key)} className={'flex shrink-0 items-center gap-2 px-4 py-3 text-xs font-bold uppercase '+(tab===key?'text-indigo-600 border-b-2 border-indigo-600':'text-slate-500')}><Icon size={14}/>{label}</button>)}</nav>
    {notice&&<div role="status" className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm">{notice}</div>}
    {tab==='users'&&<div className="grid gap-6 lg:grid-cols-[310px_1fr]">
      <form onSubmit={createAccount} className="bg-white rounded-2xl p-6 border shadow-sm space-y-4 h-fit">
       <h2 className="font-bold">Provision Identity</h2>
       <label className="block text-sm">Full name<input className={input} minLength={2} maxLength={120} required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
       <label className="block text-sm">Email<input className={input} type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
       <label className="block text-sm">Temporary password (8+ characters)<input className={input} type="password" minLength={8} required value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>
       <button className={btn} disabled={loading}>Create member</button>
      </form>
      <div className="bg-white rounded-2xl border shadow-sm overflow-x-auto">
       <table className="w-full text-left text-sm"><thead><tr className="border-b bg-slate-50"><th className="p-4">Name / email</th><th className="p-4">Role</th><th className="p-4">Account</th><th className="p-4">Actions</th></tr></thead><tbody>
        {users.map(u=><UserRow key={u.id} user={u} busy={loading} update={updateAccount}/>)}
       </tbody></table>
      </div>
    </div>}
    {tab==='groups'&&<div className="grid lg:grid-cols-[300px_1fr] gap-6">
     <form className="rounded-2xl bg-white border p-6 space-y-4 h-fit" onSubmit={async e=>{e.preventDefault();await execute(()=>adminRequest('groups',{method:'POST',body:JSON.stringify(groupForm)}));setGroupForm({name:'',description:''});}}>
       <h2 className="font-bold">Create Group</h2>
       <label className="block text-sm">Group name<input className={input} value={groupForm.name} minLength={2} maxLength={100} required onChange={e=>setGroupForm({...groupForm,name:e.target.value})}/></label>
       <label className="block text-sm">Description<textarea className={input} maxLength={500} value={groupForm.description} onChange={e=>setGroupForm({...groupForm,description:e.target.value})}/></label>
       <button disabled={loading} className={btn}>Create group</button>
       <p className="text-xs text-slate-500">Group membership is stored in PostgreSQL. Custom permissions and group messaging require separate authorization before they can be enabled.</p>
     </form>
     <div className="space-y-4">{groups.map(g=><GroupEditor key={g.id} group={g} users={users} busy={loading} execute={execute}/>)}
      {groups.length===0&&<div className="rounded-2xl bg-white p-7 border text-sm text-slate-500">No groups have been created yet.</div>}
     </div>
   </div>}
    {tab==='security'&&<div className="grid md:grid-cols-2 gap-6">
       <form onSubmit={saveSettings} className="rounded-2xl bg-white border p-7 space-y-4"><h2 className="font-bold">Access policies</h2><p className="text-sm">Password minimum: <strong>8 characters</strong></p><label className="block text-sm">Session timeout (5–480 minutes)<input className={input} type="number" min="5" max="480" required value={settings.session_minutes} onChange={e=>setSettings({...settings,session_minutes:e.target.value})}/></label><p className="text-xs text-slate-500">Applies to new sign-ins. Active sessions retain their existing expiration. Role or account-status changes revoke affected sessions.</p><p className="text-sm">Administrator session revocation on role change: <strong>Enabled</strong></p><p className="text-sm text-slate-500">MFA enforcement requires enrollment and recovery flows; it is not currently available.</p><button className={btn} disabled={loading}>Save security settings</button></form>
       <div className="rounded-2xl bg-white border p-7"><h2 className="font-bold mb-4">Security activity</h2><p className="text-sm">{logs.length} recent administrative events.</p><button className={btn+' mt-4'} onClick={()=>setTab('logs')}>View audit log</button></div>
    </div>}
    {(tab==='meetings'||tab==='branding')&&<form className="max-w-xl rounded-2xl bg-white border p-7 space-y-5" onSubmit={saveSettings}>
      <h2 className="font-bold">{tab==='meetings'?'Meeting defaults':'Workspace branding'}</h2>
      {tab==='meetings'?<><label className="block text-sm">Default maximum participants (1–1000)<input className={input} type="number" min="1" max="1000" required value={settings.default_meeting_limit} onChange={e=>setSettings({...settings,default_meeting_limit:e.target.value})}/></label><p className="text-sm text-slate-500">This is the server-configured room limit. It does not certify 1000 simultaneous video connections. Guest waiting-room enforcement, recording and host moderation require additional service integration.</p></>:
        <><label className="block text-sm">Workspace name<input className={input} minLength={2} maxLength={80} required value={settings.workspace_name} onChange={e=>setSettings({...settings,workspace_name:e.target.value})}/></label><div className="grid gap-4">{[['site_logo','Site Logo'],['login_logo','Login Screen Logo'],['favicon','Favicon']].map(([key,label])=><div key={key} className="rounded-xl border p-4 space-y-3"><div className="font-semibold text-sm">{label}</div>{settings[key]&&<img src={settings[key]} alt={label} className="max-h-20 max-w-40 object-contain"/>}<label className="block text-xs font-semibold text-indigo-700 cursor-pointer">Upload image (PNG, JPEG, WebP, max 128 KB)<input className="block mt-2 text-xs" accept="image/png,image/jpeg,image/webp" type="file" onChange={e=>uploadBranding(e,key)}/></label>{settings[key]&&<button type="button" className="text-xs text-rose-700 font-semibold" onClick={()=>clearBranding(key)}>Remove image</button>}</div>)}</div><p className="text-xs text-slate-500">The uploaded assets are validated and saved on the server. Login and browser branding update after refresh.</p></>}
      <button className={btn+' flex items-center gap-2'} disabled={loading}><Save size={16}/> Save changes</button>
    </form>}
    {tab==='logs'&&<div className="rounded-2xl bg-white border overflow-hidden">
      <div className="p-5 border-b flex justify-between gap-3"><h2 className="font-bold">Administrative audit events</h2><button onClick={exportLogs} className="text-sm font-semibold text-indigo-600">Export CSV</button></div>
      <table className="w-full text-left text-sm"><thead><tr className="bg-slate-50"><th className="p-3">When</th><th className="p-3">Event</th><th className="p-3">Actor</th><th className="p-3">Target</th></tr></thead><tbody>{logs.map(l=><tr className="border-t" key={l.id}><td className="p-3">{new Date(l.created_at).toLocaleString()}</td><td className="p-3">{l.event}</td><td className="p-3">{l.actor}</td><td className="p-3">{l.target}</td></tr>)}</tbody></table>
      {logs.length===0&&<p className="p-5 text-sm text-slate-500">No administrative events recorded yet.</p>}
    </div>}
   </div>
 </section>;
}
function UserRow({user,busy,update}){
 const [name,setName]=useState(user.name);
 const [role,setRole]=useState(user.role);
 useEffect(()=>{setName(user.name);setRole(user.role)},[user.name,user.role]);
 return <tr className="border-b align-middle">
  <td className="p-3"><input aria-label={'Name '+user.email} className={input} value={name} onChange={e=>setName(e.target.value)}/><div className="text-xs text-slate-500 mt-1">{user.email}</div></td>
  <td className="p-3"><select aria-label={'Role '+user.email} className={input} value={role} onChange={e=>setRole(e.target.value)}><option>Regular</option><option>Admin</option></select></td>
  <td className="p-3">{user.active===false?'Disabled':'Enabled'}</td>
  <td className="p-3 flex gap-2 flex-wrap"><button disabled={busy} className="text-indigo-700 font-semibold" onClick={()=>update(user,{name,role})}>Save</button><button disabled={busy} className={user.active===false?'text-green-700 font-semibold':'text-rose-700 font-semibold'} onClick={()=>{if(window.confirm((user.active===false?'Enable ':'Disable ')+user.email+'?'))update(user,{active:user.active===false})}}>{user.active===false?'Enable':'Disable'}</button></td>
 </tr>;
}

function GroupEditor({group,users,busy,execute}){
 const [name,setName]=useState(group.name);
 const [description,setDescription]=useState(group.description);
 const [userId,setUserId]=useState('');
 useEffect(()=>{setName(group.name);setDescription(group.description)},[group.name,group.description]);
 async function mutate(body,method='PATCH'){await execute(()=>adminRequest('groups',{method,body:JSON.stringify({...body,groupID:group.id})}));}
 return <div className="rounded-2xl bg-white border p-6 space-y-4">
   <div className="flex justify-between gap-4"><h3 className="font-bold">{group.name}</h3><button disabled={busy} className="text-sm font-semibold text-rose-700" onClick={()=>{if(window.confirm('Delete group '+group.name+'?'))mutate({},'DELETE')}}>Delete</button></div>
   <div className="grid md:grid-cols-2 gap-3">
     <label className="text-sm">Name<input className={input} minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
     <label className="text-sm">Description<input className={input} maxLength={500} value={description} onChange={e=>setDescription(e.target.value)}/></label>
   </div>
   <button disabled={busy} className="text-indigo-700 font-semibold text-sm" onClick={()=>mutate({name,description})}>Save group details</button>
   <div className="border-t pt-4"><h4 className="font-semibold text-sm mb-3">Members ({group.members.length})</h4>
     <div className="flex flex-wrap gap-2 mb-4">{group.members.map(id=>{const u=users.find(x=>x.id===id);return <div key={id} className="flex items-center rounded-full bg-slate-100 px-3 py-2 text-xs">{u?.name||('User '+id)}<button className="ml-2 text-rose-700 font-bold" aria-label={'Remove '+(u?.name||id)} disabled={busy} onClick={()=>mutate({userID:id,action:'remove_member'})}>×</button></div>})}</div>
     <div className="flex flex-wrap gap-2"><select className={input+' max-w-xs'} aria-label="Select member" value={userId} onChange={e=>setUserId(e.target.value)}><option value="">Select a user</option>{users.filter(u=>u.active!==false&&!group.members.includes(u.id)).map(u=><option value={u.id} key={u.id}>{u.name} ({u.email})</option>)}</select><button className={btn} disabled={busy||!userId} onClick={async()=>{await mutate({userID:Number(userId),action:'add_member'});setUserId('')}}>Add member</button></div>
   </div>
 </div>;
}

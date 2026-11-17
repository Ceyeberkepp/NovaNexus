import React,{useEffect,useState} from 'react';
import {Users,Shield,Calendar,Image as ImageIcon,ScrollText,Settings,Save,RefreshCw,Sparkles,Clock,UserPlus} from 'lucide-react';
import {fetchUsers,provisionUser} from './auth-client';

async function adminRequest(path,options={}){
 const res=await fetch('/api/admin/'+path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
 const json=await res.json();
 if(!res.ok)throw Error(json.error||'Request failed');
 return json;
}
const input='w-full rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none';
const btn='rounded-xl bg-indigo-600 px-5 py-3 text-[11px] font-black uppercase tracking-widest text-white hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-100';
const tabs=[['users','Users',Users],['groups','Groups',Users],['security','Security',Shield],['meetings','Meetings',Calendar],['branding','Branding',ImageIcon],['logs','Logs',ScrollText],['ai','AI Assistant',Sparkles]];
export default function AdminConsole({users,setUsers}){
 const [tab,setTab]=useState('users');
 const [notice,setNotice]=useState('');
 const [loading,setLoading]=useState(false);
 const [form,setForm]=useState({name:'',email:'',password:''});
 const [settings,setSettings]=useState({workspace_name:'NovaNexus Workspace',default_meeting_limit:'1000',session_minutes:'480',waiting_room_enabled:'false',waiting_room_message:'Please wait for your host to admit you.',ai_enabled:'true'});
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
  await execute(()=>adminRequest('settings',{method:'PUT',body:JSON.stringify({workspaceName:settings.workspace_name,defaultMeetingLimit:Number(settings.default_meeting_limit),sessionMinutes:Number(settings.session_minutes),waitingRoomEnabled:settings.waiting_room_enabled==='true',waitingRoomMessage:settings.waiting_room_message,aiEnabled:settings.ai_enabled==='true'})}));
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
 return <section className="h-full overflow-auto bg-[#fafbff] px-5 py-8 md:px-12">
   <div className="mx-auto max-w-7xl">
    <div className="flex flex-wrap justify-between gap-3 items-center mb-10">
     <div><h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">Admin Console</h1><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Global Configuration &amp; Security</p></div>
     <button className="rounded-xl border bg-white px-4 py-2 flex items-center gap-2 text-sm" onClick={refresh}><RefreshCw size={16}/> Refresh</button>
    </div>
    <nav className="flex gap-6 overflow-x-auto border-b border-slate-100 mb-9 no-scrollbar" aria-label="Administration sections">{tabs.map(([key,label,Icon])=><button key={key} onClick={()=>setTab(key)} className={'flex shrink-0 items-center gap-2 px-1 pb-4 pt-2 text-[10px] font-black uppercase tracking-widest '+(tab===key?'text-indigo-600 border-b-2 border-indigo-600':'text-slate-500')}><Icon size={14}/>{label}</button>)}</nav>
    {notice&&<div role="status" className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm">{notice}</div>}
    {tab==='users'&&<div className="grid gap-8 lg:grid-cols-[300px_1fr]">
      <form onSubmit={createAccount} className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm space-y-5 h-fit">
       <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-3"><UserPlus size={17} className="text-indigo-600"/>Provision Identity</h2>
       <label className="block text-sm">Full name<input className={input} minLength={2} maxLength={120} required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
       <label className="block text-sm">Email<input className={input} type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
       <label className="block text-sm">Temporary password (8+ characters)<input className={input} type="password" minLength={8} required value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>
       <button className={btn} disabled={loading}>Create member</button>
      </form>
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-x-auto">
       <table className="w-full text-left text-sm"><thead><tr className="border-b bg-slate-50"><th className="p-4">Name / email</th><th className="p-4">Role</th><th className="p-4">Account</th><th className="p-4">Actions</th></tr></thead><tbody>
        {users.map(u=><UserRow key={u.id} user={u} busy={loading} update={updateAccount}/>)}
       </tbody></table>
      </div>
    </div>}
    {tab==='groups'&&<div className="grid lg:grid-cols-[280px_1fr] gap-8">
     <form className="rounded-[2.5rem] bg-white border border-slate-100 p-8 space-y-4 h-fit" onSubmit={async e=>{e.preventDefault();await execute(()=>adminRequest('groups',{method:'POST',body:JSON.stringify(groupForm)}));setGroupForm({name:'',description:''});}}>
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
    {tab==='security'&&<div className="grid md:grid-cols-2 gap-8">
       <form onSubmit={saveSettings} className="rounded-[2.5rem] bg-white border border-slate-100 shadow-sm p-9 space-y-5"><h2 className="font-bold">Access policies</h2><p className="text-sm">Password minimum: <strong>8 characters</strong></p><label className="block text-sm">Session timeout (5–480 minutes)<input className={input} type="number" min="5" max="480" required value={settings.session_minutes} onChange={e=>setSettings({...settings,session_minutes:e.target.value})}/></label><p className="text-xs text-slate-500">Applies to new sign-ins. Active sessions retain their existing expiration. Role or account-status changes revoke affected sessions.</p><p className="text-sm">Administrator session revocation on role change: <strong>Enabled</strong></p><p className="text-sm text-slate-500">MFA enforcement requires enrollment and recovery flows; it is not currently available.</p><button className={btn} disabled={loading}>Save security settings</button></form>
       <div className="rounded-[2.5rem] bg-white border border-slate-100 shadow-sm p-9"><h2 className="font-bold mb-4">Security activity</h2><p className="text-sm">{logs.length} recent administrative events.</p><button className={btn+' mt-4'} onClick={()=>setTab('logs')}>View audit log</button></div>
    </div>}
    {(tab==='meetings'||tab==='branding')&&<form className="max-w-5xl rounded-[2.5rem] bg-white border border-slate-100 shadow-sm p-8 space-y-6" onSubmit={saveSettings}>
      <h2 className="font-bold">{tab==='meetings'?'Meeting defaults':'Workspace branding'}</h2>
      {tab==='meetings'?<div className="grid gap-7 lg:grid-cols-2">
         <div className="space-y-6">
          <div className="flex items-center gap-3"><div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600"><Clock size={23}/></div><div><h3 className="font-black text-slate-800">Waiting Room</h3><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Guest access controls</p></div></div>
          <label className="flex items-center justify-between gap-3 text-sm font-semibold">Enable Waiting Room <input type="checkbox" className="accent-indigo-600 h-5 w-5" checked={settings.waiting_room_enabled==='true'} onChange={e=>setSettings({...settings,waiting_room_enabled:String(e.target.checked)})}/></label>
          <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500">Custom Welcome Message<textarea className={input+' mt-3 min-h-[100px]'} maxLength={500} value={settings.waiting_room_message} onChange={e=>setSettings({...settings,waiting_room_message:e.target.value})}/></label>
          <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500">Waiting Room Logo <input type="file" accept="image/png,image/jpeg,image/webp" className="mt-3 block text-xs" onChange={e=>uploadBranding(e,'waiting_logo')}/></label>
          {settings.waiting_logo&&<img alt="Waiting room logo" src={settings.waiting_logo} className="max-h-16 object-contain"/>}
          <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500">Maximum Participants (1–1000)<input className={input+' mt-3'} type="number" min="1" max="1000" required value={settings.default_meeting_limit} onChange={e=>setSettings({...settings,default_meeting_limit:e.target.value})}/></label>
          <p className="text-[11px] leading-relaxed text-amber-700">Waiting-room preferences are saved, but guest admission is not yet enabled. The setting is a preview until host approval is implemented. Meeting size is enforced by the backend.</p>
         </div>
         <div className="flex min-h-[420px] items-center justify-center overflow-hidden rounded-[2.5rem] bg-zinc-900 p-8">
          <div className="w-full max-w-[270px] rounded-2xl border border-white/10 bg-white/10 p-8 text-center text-white shadow-xl">
           <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-600">{settings.waiting_logo?<img src={settings.waiting_logo} className="h-full w-full object-contain" alt="Meeting logo"/>:<Calendar size={24}/>}</div>
           <div className="mb-2 text-base font-black">{settings.workspace_name||'NovaNexus Workspace'}</div>
           {settings.waiting_room_enabled==='true'?<><p className="mb-5 text-[10px] font-black uppercase tracking-widest text-indigo-200">Waiting for host</p><p className="text-xs text-zinc-300">{settings.waiting_room_message}</p></>:<div className="py-7 text-xs font-black uppercase text-zinc-500">Waiting room disabled</div>}
           <div className="mt-6 text-[9px] uppercase tracking-widest text-zinc-400">Preview only</div>
          </div>
         </div>
        </div>:
        <><label className="block text-sm">Workspace name<input className={input} minLength={2} maxLength={80} required value={settings.workspace_name} onChange={e=>setSettings({...settings,workspace_name:e.target.value})}/></label><div className="grid gap-4">{[['site_logo','Site Logo'],['login_logo','Login Screen Logo'],['favicon','Favicon'],['waiting_logo','Waiting Room Logo']].map(([key,label])=><div key={key} className="rounded-xl border p-4 space-y-3"><div className="font-semibold text-sm">{label}</div>{settings[key]&&<img src={settings[key]} alt={label} className="max-h-20 max-w-40 object-contain"/>}<label className="block text-xs font-semibold text-indigo-700 cursor-pointer">Upload image (PNG, JPEG, WebP, max 128 KB)<input className="block mt-2 text-xs" accept="image/png,image/jpeg,image/webp" type="file" onChange={e=>uploadBranding(e,key)}/></label>{settings[key]&&<button type="button" className="text-xs text-rose-700 font-semibold" onClick={()=>clearBranding(key)}>Remove image</button>}</div>)}</div><p className="text-xs text-slate-500">The uploaded assets are validated and saved on the server. Login and browser branding update after refresh.</p></>}
      <button className={btn+' flex items-center gap-2'} disabled={loading}><Save size={16}/> Save changes</button>
    </form>}
    {tab==='ai'&&<form onSubmit={saveSettings} className="max-w-3xl space-y-6 rounded-[2.5rem] border border-slate-100 bg-white p-9 shadow-sm"><div className="flex items-center gap-4"><div className="rounded-2xl bg-indigo-50 p-4 text-indigo-600"><Sparkles size={25}/></div><div><h2 className="text-xl font-black">AI Assistant</h2><p className="text-[11px] uppercase tracking-widest text-slate-400">Private and self-hosted</p></div></div><label className="flex items-center justify-between gap-4 text-sm font-semibold">Enable Nexus AI for members <input type="checkbox" checked={settings.ai_enabled==='true'} onChange={e=>setSettings({...settings,ai_enabled:String(e.target.checked)})} className="h-5 w-5 accent-indigo-600"/></label><p className="text-xs leading-relaxed text-slate-500">Uses a small local model. No external API key required. AI cannot edit accounts or read private messages and its answers may be inaccurate.</p><button className={btn} disabled={loading}>Save AI settings</button></form>}
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
 const [editing,setEditing]=useState(false);
 useEffect(()=>{setName(user.name);setRole(user.role)},[user.name,user.role]);
 async function save(){await update(user,{name,role});setEditing(false);}
 const initials=String(user.name||'U').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
 return <tr className="border-b border-slate-50 align-middle hover:bg-indigo-50/20">
  <td className="p-5"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-xs font-black text-white">{initials}</span><div>{editing?<input aria-label={'Name '+user.email} className={input} minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)}/>:<div className="text-xs font-bold text-slate-800">{user.name}</div>}<div className="mt-1 text-[10px] text-slate-400">{user.email}</div></div></div></td>
  <td className="p-5">{editing?<select aria-label={'Role '+user.email} className={input} value={role} onChange={e=>setRole(e.target.value)}><option>Regular</option><option>Admin</option></select>:<span className={'rounded-lg px-3 py-1.5 text-[9px] font-black uppercase '+(user.role==='Admin'?'bg-purple-50 text-purple-600':'bg-slate-100 text-slate-500')}>{user.role}</span>}</td>
  <td className="p-5"><span className={'text-[10px] font-bold '+(user.active===false?'text-rose-600':'text-green-600')}>{user.active===false?'Disabled':'Enabled'}</span></td>
  <td className="p-5"><div className="flex flex-wrap gap-3">
   {editing?<><button disabled={busy||name.trim().length<2} className="text-xs font-black text-indigo-600" onClick={save}>Save</button><button className="text-xs text-slate-500" onClick={()=>{setEditing(false);setName(user.name);setRole(user.role)}}>Cancel</button></>:<button className="text-xs font-black text-indigo-600" disabled={busy} onClick={()=>setEditing(true)} aria-label={'Edit '+user.name}><Edit2 size={16}/></button>}
   <button disabled={busy} className={'text-xs font-bold '+(user.active===false?'text-green-700':'text-rose-600')} onClick={()=>{if(window.confirm((user.active===false?'Enable ':'Disable ')+user.email+'?'))update(user,{active:user.active===false})}}>{user.active===false?'Enable':'Disable'}</button>
  </div></td>
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

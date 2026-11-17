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
 const [settings,setSettings]=useState({workspace_name:'NovaNexus Workspace',default_meeting_limit:'1000'});
 const [logs,setLogs]=useState([]);
 useEffect(()=>{refresh();},[]);
 async function refresh(){
  setNotice('');
  try{
   const [directory,config,audit]=await Promise.all([fetchUsers(),adminRequest('settings'),adminRequest('logs')]);
   setUsers(directory.users);setSettings({...settings,...config.settings});setLogs(audit.events);
  }catch(e){setNotice(e.message);}
 }
 async function execute(fn){
  setLoading(true);setNotice('');
  try{await fn();setNotice('Changes saved successfully.');await refresh();}
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
  await execute(()=>adminRequest('settings',{method:'PUT',body:JSON.stringify({workspaceName:settings.workspace_name,defaultMeetingLimit:Number(settings.default_meeting_limit)})}));
 }
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
    {tab==='groups'&&<div className="rounded-2xl bg-white border p-7"><h2 className="font-bold mb-2">Groups and policy management</h2><p className="text-sm text-slate-600">Group membership and custom permission policies are not enabled yet. No demo policies are displayed or saved as if they were active. User roles can be managed under Users.</p></div>}
    {tab==='security'&&<div className="grid md:grid-cols-2 gap-6">
       <div className="rounded-2xl bg-white border p-7"><h2 className="font-bold mb-4">Access policies</h2><p className="text-sm">Password minimum: <strong>8 characters</strong></p><p className="text-sm mt-3">Session lifetime: <strong>8 hours</strong></p><p className="text-sm mt-3">Administrator session revocation on role change: <strong>Enabled</strong></p><p className="text-sm text-slate-500 mt-5">MFA enforcement and configurable session timeout aren't implemented. Those controls are intentionally disabled, not falsely shown as enabled.</p></div>
       <div className="rounded-2xl bg-white border p-7"><h2 className="font-bold mb-4">Security activity</h2><p className="text-sm">{logs.length} recent administrative events.</p><button className={btn+' mt-4'} onClick={()=>setTab('logs')}>View audit log</button></div>
    </div>}
    {(tab==='meetings'||tab==='branding')&&<form className="max-w-xl rounded-2xl bg-white border p-7 space-y-5" onSubmit={saveSettings}>
      <h2 className="font-bold">{tab==='meetings'?'Meeting defaults':'Workspace branding'}</h2>
      {tab==='meetings'?<><label className="block text-sm">Default maximum participants (1–1000)<input className={input} type="number" min="1" max="1000" required value={settings.default_meeting_limit} onChange={e=>setSettings({...settings,default_meeting_limit:e.target.value})}/></label><p className="text-sm text-slate-500">This is the server-configured room limit. It does not certify 1000 simultaneous video connections. Guest waiting-room enforcement, recording and host moderation require additional service integration.</p></>:
        <><label className="block text-sm">Workspace name<input className={input} minLength={2} maxLength={80} required value={settings.workspace_name} onChange={e=>setSettings({...settings,workspace_name:e.target.value})}/></label><p className="text-sm text-slate-500">Workspace name is saved in PostgreSQL. Logo uploads and global theme assets are not yet served from persistent storage and are not presented as active controls.</p></>}
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
  <td className="p-3 flex gap-2 flex-wrap"><button disabled={busy} className="text-indigo-700 font-semibold" onClick={()=>update(user,{name,role})}>Save</button><button disabled={busy} className="text-rose-700 font-semibold" onClick={()=>{if(window.confirm('Disable '+user.email+'?'))update(user,{active:false})}}>Disable</button></td>
 </tr>;
}

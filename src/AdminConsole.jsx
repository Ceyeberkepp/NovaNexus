import React,{useEffect,useState} from 'react';
import {Users,Shield,Calendar,Image as ImageIcon,ScrollText,Settings,Save,RefreshCw,Sparkles,Clock,UserPlus,Edit2,Search,Download} from 'lucide-react';
import {fetchUsers,provisionUser} from './auth-client';
import AccountSecurity from './AccountSecurity';

async function adminRequest(path,options={}){
 const res=await fetch('/api/admin/'+path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
 const json=await res.json();
 if(!res.ok)throw Error(json.error||'Request failed');
 return json;
}
const input='w-full rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none';
const btn='rounded-xl bg-indigo-600 px-5 py-3 text-[11px] font-black uppercase tracking-widest text-white hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-100';
const tabs=[['users','Users',Users],['groups','Groups',Users],['security','Security',Shield],['meetings','Meetings',Calendar],['branding','Branding',ImageIcon],['logs','Logs',ScrollText],['ai','AI Assistant',Sparkles]];
export default function AdminConsole({users,setUsers,initialTab='users',user}){
 const [tab,setTab]=useState(initialTab);
 const [notice,setNotice]=useState('');
 const [loading,setLoading]=useState(false);
 const [resetTarget,setResetTarget]=useState(null);
 const [resetForm,setResetForm]=useState({newPassword:'',confirmPassword:'',adminPassword:'',requireChange:true});
 const [form,setForm]=useState({name:'',username:'',email:'',password:''});
 const [settings,setSettings]=useState({workspace_name:'NovaNexus Workspace',default_meeting_limit:'1000',meeting_public_url:'',session_minutes:'480',waiting_room_enabled:'false',waiting_room_message:'Please wait for your host to admit you.',ai_enabled:'true'});
 const [logs,setLogs]=useState([]);
 const [auditSearch,setAuditSearch]=useState('');
 const [auditFilter,setAuditFilter]=useState('all');
 const [groups,setGroups]=useState([]);
 const [groupForm,setGroupForm]=useState({name:'',description:''});
 useEffect(()=>{refresh();},[]);
 async function refresh(){
  try{
   const [directory,config,audit,groupData,brandResponse]=await Promise.all([adminRequest('directory'),adminRequest('settings'),adminRequest('logs'),adminRequest('groups'),fetch('/api/branding',{credentials:'same-origin'}).then(async r=>{if(!r.ok)throw Error('Unable to load branding');return r.json()})]);
   setUsers(directory.users);setSettings(previous=>({...previous,...config.settings,...brandResponse.branding}));setLogs(audit.events);setGroups(groupData.groups);
  }catch(e){setNotice(e.message);}
 }
 async function execute(fn){
  setLoading(true);setNotice('');
  try{await fn();await refresh();setNotice('Changes saved successfully.');window.dispatchEvent(new Event('novanexus:branding-changed'));}
  catch(e){setNotice(e.message);}
  finally{setLoading(false);}
 }
 async function resetPassword(e){
  e.preventDefault();
  if(!resetTarget)return;
  if(resetForm.newPassword.length<8||resetForm.newPassword.length>1024){setNotice('New password must contain at least 8 characters.');return;}
  if(resetForm.newPassword!==resetForm.confirmPassword){setNotice('New passwords do not match.');return;}
  setLoading(true);setNotice('');
  try{
   await adminRequest('reset-password',{method:'POST',body:JSON.stringify({userID:resetTarget.id,newPassword:resetForm.newPassword,adminPassword:resetForm.adminPassword})});
   setResetTarget(null);setResetForm({newPassword:'',confirmPassword:'',adminPassword:'',requireChange:true});
   await refresh();setNotice('Password changed; all prior sessions revoked. The member must choose a new password on first sign-in.');
  }catch(error){setNotice(error.message)}finally{setLoading(false)}
 }
 async function createAccount(e){
  e.preventDefault();
  await execute(async()=>{await provisionUser(form.name,form.email,form.password,form.username);setForm({name:'',username:'',email:'',password:''});});
 }
 async function updateAccount(user,changes){
  await execute(()=>adminRequest('users?id='+encodeURIComponent(user.id),{method:'PATCH',body:JSON.stringify(changes)}));
 }
 async function saveSettings(e){
  e.preventDefault();
  await execute(()=>adminRequest('settings',{method:'PUT',body:JSON.stringify({workspaceName:settings.workspace_name,defaultMeetingLimit:Number(settings.default_meeting_limit),meetingPublicURL:settings.meeting_public_url||'',sessionMinutes:Number(settings.session_minutes),waitingRoomEnabled:settings.waiting_room_enabled==='true',waitingRoomMessage:settings.waiting_room_message,aiEnabled:settings.ai_enabled==='true'})}));
 }
 async function uploadBranding(e,key){
  const file=e.target.files?.[0];if(!file)return;
  const targets={site_logo:[256,256],login_logo:[640,320],favicon:[64,64],waiting_logo:[320,320]};
  if(!targets[key])return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)){setNotice('Choose a PNG, JPEG or WebP image.');return}
  setLoading(true);setNotice('Processing image...');
  try{
   const bitmap=await createImageBitmap(file);
   const [w,h]=targets[key];
   const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
   const context=canvas.getContext('2d');if(!context)throw Error('Browser image resizing unavailable');
   const scale=Math.min(w/bitmap.width,h/bitmap.height);
   const outputWidth=Math.max(1,Math.round(bitmap.width*scale)),outputHeight=Math.max(1,Math.round(bitmap.height*scale));
   context.clearRect(0,0,w,h);
   context.drawImage(bitmap,Math.round((w-outputWidth)/2),Math.round((h-outputHeight)/2),outputWidth,outputHeight);
   bitmap.close();
   let encoded=canvas.toDataURL('image/png');
   if(encoded.length>130000)encoded=canvas.toDataURL('image/webp',0.84);
   if(encoded.length>170000)encoded=canvas.toDataURL('image/webp',0.64);
   if(encoded.length>170000)throw Error('Image remains too large after conversion. Try a simpler logo.');
   await adminRequest('branding',{method:'PUT',body:JSON.stringify({key,data:encoded})});
   await refresh();
   window.dispatchEvent(new Event('novanexus:branding-changed'));
   setNotice('Image converted, uploaded and saved successfully.');
  }catch(error){setNotice(error.message||'Could not process image')}
  finally{setLoading(false);e.target.value=''}
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
    {resetTarget&&<div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Set member password">
     <form className="w-full max-w-lg space-y-4 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-2xl" onSubmit={resetPassword}>
      <h2 className="text-xl font-black text-slate-900">Set a new password</h2>
      <p className="text-sm text-slate-500">Member: <strong>{resetTarget.name}</strong> ({resetTarget.email})</p>
      <p className="text-xs text-indigo-700">You choose the password here. No random password will be generated. Existing sign-in sessions will be revoked.</p>
      <label className="block text-sm font-semibold">New password (at least 8 characters)<input autoFocus className={input+' mt-2'} type="password" autoComplete="new-password" minLength={8} maxLength={1024} required value={resetForm.newPassword} onChange={e=>setResetForm(x=>({...x,newPassword:e.target.value}))}/></label>
      <label className="block text-sm font-semibold">Confirm new password<input className={input+' mt-2'} type="password" autoComplete="new-password" minLength={8} maxLength={1024} required value={resetForm.confirmPassword} onChange={e=>setResetForm(x=>({...x,confirmPassword:e.target.value}))}/></label>
      <label className="block text-sm font-semibold">Your administrator password (authorize change)<input className={input+' mt-2'} type="password" autoComplete="current-password" required value={resetForm.adminPassword} onChange={e=>setResetForm(x=>({...x,adminPassword:e.target.value}))}/></label>
      <p className="text-xs text-slate-500">For security, the member will be required to change the password after signing in. This cannot be disabled in the admin reset flow.</p>
      <div className="flex flex-wrap justify-end gap-3"><button type="button" disabled={loading} onClick={()=>{setResetTarget(null);setResetForm({newPassword:'',confirmPassword:'',adminPassword:'',requireChange:true});}} className="rounded-xl border p-3 text-sm font-bold">Cancel</button><button disabled={loading||resetForm.newPassword.length<8||resetForm.newPassword!==resetForm.confirmPassword||!resetForm.adminPassword} className={btn}>Save password</button></div>
     </form>
    </div>}
    {tab==='users'&&<div className="grid gap-8 lg:grid-cols-[300px_1fr]">
      <form onSubmit={createAccount} className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm space-y-5 h-fit">
       <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-3"><UserPlus size={17} className="text-indigo-600"/>Provision Identity</h2>
       <label className="block text-sm">Full name<input className={input} minLength={2} maxLength={120} required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
       <label className="block text-sm">Username (optional)<input className={input} autoComplete="off" minLength={3} maxLength={32} pattern="[A-Za-z0-9_-]{3,32}" placeholder="example: jsmith" value={form.username} onChange={e=>setForm({...form,username:e.target.value.toLowerCase()})}/><span className="text-xs text-slate-500">3–32 characters. If blank, a unique username is assigned.</span></label>
       <label className="block text-sm">Email<input className={input} type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
       <label className="block text-sm">Temporary password (8+ characters)<input className={input} type="password" minLength={8} required value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>
       <button className={btn} disabled={loading}>Create member</button>
      </form>
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-x-auto">
       <table className="w-full text-left text-sm"><thead><tr className="border-b bg-slate-50"><th className="p-4">Name / email</th><th className="p-4">Role</th><th className="p-4">Account</th><th className="p-4">Actions</th></tr></thead><tbody>
        {users.map(u=><UserRow key={u.id} user={u} busy={loading} update={updateAccount} onReset={setResetTarget}/>)}
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
       <form onSubmit={saveSettings} className="rounded-[2.5rem] bg-white border border-slate-100 shadow-sm p-9 space-y-5"><h2 className="font-bold">Access policies</h2><p className="text-sm">Password minimum: <strong>8 characters</strong></p><label className="block text-sm">Session timeout (5–480 minutes)<input className={input} type="number" min="5" max="480" required value={settings.session_minutes} onChange={e=>setSettings({...settings,session_minutes:e.target.value})}/></label><p className="text-xs text-slate-500">Applies to new sign-ins. Active sessions retain their existing expiration. Role or account-status changes revoke affected sessions.</p><p className="text-sm">Administrator session revocation on role change: <strong>Enabled</strong></p><p className="text-sm text-slate-500">Configure your own authenticator below. Organization-wide MFA enforcement is not yet enabled.</p><button className={btn} disabled={loading}>Save security settings</button></form>
       <div className="rounded-[2.5rem] bg-white border border-slate-100 shadow-sm p-9"><h2 className="font-bold mb-4">Security activity</h2><p className="text-sm">{logs.length} recent administrative events.</p><button className={btn+' mt-4'} onClick={()=>setTab('logs')}>View audit log</button></div>
       <div className="md:col-span-2"><AccountSecurity user={user} embedded /></div>
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
          <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500">Public meeting link domain (optional)<input className={input+' mt-3'} type="url" placeholder="https://nexu.cyverax.com" value={settings.meeting_public_url||''} onChange={e=>setSettings({...settings,meeting_public_url:e.target.value})}/></label>
          <p className="text-xs text-slate-500">Links use this hostname followed by the eight-digit meeting ID, for example https://nexu.cyverax.com/12345678. Leave empty for the current server URL. Your DNS or tunnel must already route HTTPS and WebSockets to NovaNexus. Saving the URL does not create a tunnel or configure networking.</p>
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

        <div className="space-y-7">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-5">
            <div><h3 className="text-xl font-black text-slate-900">Identity &amp; Assets</h3><p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Customize your conference appearance</p></div>
            <span className="rounded-xl bg-indigo-50 p-3 text-indigo-600"><ImageIcon size={21}/></span>
          </div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Workspace Name<input className={input+' mt-3'} minLength={2} maxLength={80} required value={settings.workspace_name} onChange={e=>setSettings({...settings,workspace_name:e.target.value})}/></label>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[['site_logo','Site Logo','Workspace navigation'],['login_logo','Login Screen','Sign-in screen logo'],['favicon','Favicon','Browser tab icon'],['waiting_logo','Waiting Room','Meeting entry logo']].map(([key,label,description])=>
              <div key={key} className="flex min-h-[220px] flex-col items-center rounded-[1.7rem] border border-slate-100 bg-slate-50/80 p-5 text-center hover:border-indigo-200">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-indigo-500 shadow-sm">
                  {settings[key]?<img src={settings[key]} alt={label} className="max-h-16 max-w-16 object-contain"/>:<ImageIcon size={26}/>}
                </div>
                <h4 className="text-xs font-black text-slate-800">{label}</h4>
                <p className="mt-1 text-[10px] text-slate-400">{description}</p>
                <label className="mt-auto cursor-pointer rounded-lg bg-white px-4 py-2 text-[10px] font-bold text-indigo-700 shadow-sm hover:bg-indigo-50">
                  {settings[key]?'Replace image':'Upload image'}
                  <input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" onChange={e=>uploadBranding(e,key)}/>
                </label>
                {settings[key]&&<button type="button" className="mt-2 text-[10px] font-bold text-rose-600" onClick={()=>clearBranding(key)}>Remove</button>}
              </div>)}
          </div>
          <p className="text-xs text-slate-500">Upload PNG, JPEG or WebP at any resolution. Nexus automatically resizes the image to fit its destination, preserving proportions, and saves the converted asset.</p>
        </div>}
      <button className={btn+' flex items-center gap-2'} disabled={loading}><Save size={16}/> Save changes</button>
    </form>}
    {tab==='ai'&&<form onSubmit={saveSettings} className="max-w-3xl space-y-6 rounded-[2.5rem] border border-slate-100 bg-white p-9 shadow-sm"><div className="flex items-center gap-4"><div className="rounded-2xl bg-indigo-50 p-4 text-indigo-600"><Sparkles size={25}/></div><div><h2 className="text-xl font-black">AI Assistant</h2><p className="text-[11px] uppercase tracking-widest text-slate-400">Private and self-hosted</p></div></div><label className="flex items-center justify-between gap-4 text-sm font-semibold">Enable Nexus AI for members <input type="checkbox" checked={settings.ai_enabled==='true'} onChange={e=>setSettings({...settings,ai_enabled:String(e.target.checked)})} className="h-5 w-5 accent-indigo-600"/></label><p className="text-xs leading-relaxed text-slate-500">Uses a small local model. No external API key required. AI cannot edit accounts or read private messages and its answers may be inaccurate.</p><button className={btn} disabled={loading}>Save AI settings</button></form>}
     
{tab==='logs'&&<section className="overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white shadow-sm">
  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-7 py-7">
    <div><h2 className="flex items-center gap-3 text-xl font-black text-slate-900"><ScrollText className="text-indigo-600" size={23}/> Audit Logs</h2><p className="mt-2 text-xs text-slate-500">Recorded administrative events · last {logs.length} entries</p></div>
    <button onClick={exportLogs} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold text-white"><Download size={16}/> Export CSV</button>
  </div>
  <div className="flex flex-wrap gap-3 border-b border-slate-100 bg-slate-50/50 px-7 py-5">
    <label className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-3 text-slate-400" size={17}/><input className={input+' pl-10'} placeholder="Search event, actor, or target" aria-label="Search audit log" value={auditSearch} onChange={e=>setAuditSearch(e.target.value)}/></label>
    <select aria-label="Audit event category" className={input+' max-w-[190px]'} value={auditFilter} onChange={e=>setAuditFilter(e.target.value)}>
      <option value="all">All activity</option><option value="auth.">Authentication</option><option value="user.">Users</option><option value="group.">Groups</option><option value="settings.">Settings</option><option value="branding.">Branding</option><option value="mfa.">MFA security</option>
    </select>
    <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold" onClick={refresh}><RefreshCw size={15}/> Refresh</button>
  </div>
  <div className="max-h-[580px] overflow-auto">
    <table className="w-full min-w-[610px] text-left text-xs">
      <thead className="sticky top-0 z-10 bg-white"><tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400"><th className="px-7 py-4">Event</th><th className="px-4 py-4">Actor</th><th className="px-4 py-4">Target</th><th className="px-4 py-4">Date / Time</th></tr></thead>
      <tbody>{logs.filter(l=>(auditFilter==='all'||String(l.event).startsWith(auditFilter))&&[l.event,l.actor,l.target].some(v=>String(v||'').toLowerCase().includes(auditSearch.toLowerCase()))).map(l=>
        <tr key={l.id} className="border-b border-slate-50 hover:bg-indigo-50/30">
          <td className="px-7 py-4"><div className="flex items-center gap-3"><span className={'h-2 w-2 rounded-full '+(String(l.event).includes('password')||String(l.event).startsWith('mfa.')?'bg-amber-500':String(l.event).includes('login')?'bg-emerald-500':'bg-indigo-500')}/><span className="font-semibold text-slate-800">{String(l.event).replaceAll('.',' · ')}</span></div></td>
          <td className="px-4 py-4 text-slate-700">{l.actor}</td><td className="px-4 py-4 text-slate-500">{l.target}</td><td className="px-4 py-4 text-slate-500">{new Date(l.created_at).toLocaleString()}</td>
        </tr>)}</tbody>
    </table>
    {!logs.some(l=>(auditFilter==='all'||String(l.event).startsWith(auditFilter))&&[l.event,l.actor,l.target].some(v=>String(v||'').toLowerCase().includes(auditSearch.toLowerCase())))&&<div className="p-14 text-center"><ScrollText className="mx-auto mb-3 text-slate-300" size={34}/><p className="font-bold text-slate-600">No matching audit records</p><p className="mt-2 text-xs text-slate-400">Only real events from the database are displayed.</p></div>}
  </div>
</section>}
   </div>
 </section>;
}
function UserRow({user,busy,update,onReset}){
 const [name,setName]=useState(user.name);
 const [role,setRole]=useState(user.role);
 const [username,setUsername]=useState(user.username||'');
 const [editing,setEditing]=useState(false);
 useEffect(()=>{setName(user.name);setRole(user.role);setUsername(user.username||'')},[user.name,user.role]);
 async function save(){await update(user,{name,role,username});setEditing(false);}
 const initials=String(user.name||'U').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
 return <tr className="border-b border-slate-50 align-middle hover:bg-indigo-50/20">
  <td className="p-5"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-xs font-black text-white">{initials}</span><div>{editing?<input aria-label={'Name '+user.email} className={input} minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)}/>:<div className="text-xs font-bold text-slate-800">{user.name}</div>}<div className="mt-1 text-[10px] text-slate-400">{user.email}{user.username?` · @${user.username}`:""}</div>{editing&&<input aria-label={"Username "+user.email} className={input+" mt-2"} minLength={3} maxLength={32} pattern="[a-z0-9_-]{3,32}" value={username} onChange={e=>setUsername(e.target.value.toLowerCase())}/>}</div></div></td>
  <td className="p-5">{editing?<select aria-label={'Role '+user.email} className={input} value={role} onChange={e=>setRole(e.target.value)}><option>Regular</option><option>Admin</option></select>:<span className={'rounded-lg px-3 py-1.5 text-[9px] font-black uppercase '+(user.role==='Admin'?'bg-purple-50 text-purple-600':'bg-slate-100 text-slate-500')}>{user.role}</span>}</td>
  <td className="p-5"><span className={'text-[10px] font-bold '+(user.active===false?'text-rose-600':'text-green-600')}>{user.active===false?'Disabled':'Enabled'}</span></td>
  <td className="p-5"><div className="flex flex-wrap gap-3">
   {editing?<><button disabled={busy||name.trim().length<2} className="text-xs font-black text-indigo-600" onClick={save}>Save</button><button className="text-xs text-slate-500" onClick={()=>{setEditing(false);setName(user.name);setRole(user.role);setUsername(user.username||'')}}>Cancel</button></>:<button className="text-xs font-black text-indigo-600" disabled={busy} onClick={()=>setEditing(true)} aria-label={'Edit '+user.name}><Edit2 size={16}/></button>}
   <button disabled={busy||user.active===false} title="Reset password" className="text-indigo-700 text-xs font-bold" onClick={()=>onReset(user)}>Reset password</button><button disabled={busy} className={'text-xs font-bold '+(user.active===false?'text-green-700':'text-rose-600')} onClick={()=>{if(window.confirm((user.active===false?'Enable ':'Disable ')+user.email+'?'))update(user,{active:user.active===false})}}>{user.active===false?'Enable':'Disable'}</button>
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

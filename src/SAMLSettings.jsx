import React,{useEffect,useState} from 'react';
import {ShieldCheck,LockKeyhole,KeyRound} from 'lucide-react';

const initial={entityID:'',loginURL:'',certificate:''};
export default function SAMLSettings(){
 const [form,setForm]=useState(initial);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [notice,setNotice]=useState('');
 useEffect(()=>{
  let active=true;
  fetch('/api/admin/security/saml',{credentials:'same-origin'})
   .then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||'Cannot load SAML settings');return data})
   .then(data=>{if(active)setForm({...initial,...data.configuration})})
   .catch(e=>{if(active)setNotice(e.message)})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[]);
 async function save(e){
  e.preventDefault();setSaving(true);setNotice('');
  try{
   const r=await fetch('/api/admin/security/saml',{
    method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(form)
   });
   const d=await r.json();
   if(!r.ok)throw Error(d.error||'Unable to save SAML settings');
   setNotice('Identity provider settings saved. SAML login remains disabled until secure assertion verification and account mapping are available.');
  }catch(e){setNotice(e.message)}finally{setSaving(false)}
 }
 const input='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-500';
 return <section className="rounded-[2rem] border border-slate-100 bg-white p-8 shadow-sm" aria-label="SAML single sign-on configuration">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div className="flex items-center gap-3"><div className="rounded-2xl bg-indigo-50 p-4 text-indigo-600"><KeyRound size={24}/></div>
    <div><h2 className="text-xl font-black text-slate-900">SAML 2.0 Single Sign-On</h2><p className="text-sm text-slate-500">Configure an organization identity provider.</p></div></div>
   <span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Setup only · Not active</span>
  </div>
  <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">
   This stage saves administrator configuration only. SAML login will not be offered to members until signed assertion verification, replay prevention, account mapping, and end-to-end sign-in tests are complete. Existing password + MFA login stays available.
  </div>
  {notice&&<p role="status" className="mt-4 rounded-xl bg-indigo-50 p-4 text-sm text-indigo-900">{notice}</p>}
  <form onSubmit={save} className="mt-6 space-y-4">
   <label className="block text-sm font-semibold text-slate-700">Identity provider entity ID
    <input className={input} required maxLength={1024} placeholder="https://idp.example.com/realms/workspace" value={form.entityID} onChange={e=>setForm({...form,entityID:e.target.value})}/>
   </label>
   <label className="block text-sm font-semibold text-slate-700">Identity provider SSO URL (HTTPS)
    <input className={input} type="url" required maxLength={2048} pattern="https://.*" placeholder="https://idp.example.com/realms/workspace/protocol/saml" value={form.loginURL} onChange={e=>setForm({...form,loginURL:e.target.value})}/>
   </label>
   <label className="block text-sm font-semibold text-slate-700">Identity provider signing certificate (PEM)
    <textarea className={input+' min-h-36 font-mono'} spellCheck={false} required maxLength={8192} placeholder="-----BEGIN CERTIFICATE-----" value={form.certificate} onChange={e=>setForm({...form,certificate:e.target.value})}/>
   </label>
   <p className="flex items-start gap-2 text-xs leading-5 text-slate-500"><LockKeyhole size={15} className="shrink-0"/> Only administrators can view or change these settings. Do not paste a private key; supply the IdP public signing certificate only.</p>
   <button type="submit" disabled={loading||saving} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{saving?'Saving…':loading?'Loading…':'Save SAML configuration'}</button>
  </form>
 </section>;
}

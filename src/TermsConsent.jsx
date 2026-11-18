import React,{useEffect,useState} from 'react';
import {ShieldCheck,CheckCircle,Loader2} from 'lucide-react';

// Acceptance is tied to the exact published server-side version and user ID.
// The server prevents unaccepted sessions from accessing workspace APIs.
export default function TermsConsent({onAccepted,onSignOut}){
 const [document,setDocument]=useState(null);
 const [agreed,setAgreed]=useState(false);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  fetch('/api/terms',{credentials:'same-origin',cache:'no-store'}).then(async r=>{
   const data=await r.json();if(!r.ok)throw Error(data.error||'Unable to retrieve terms');
   return data;
  }).then(data=>{if(active)setDocument(data)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[]);
 const accept=async()=>{
  if(!document||!agreed)return;
  setSaving(true);setError('');
  try{
   const response=await fetch('/api/terms',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:document.version,accept:true})});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Could not save agreement');
   onAccepted(data.user);
  }catch(e){setError(e.message)}finally{setSaving(false)}
 };
 return <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-violet-100 px-4 py-10 text-slate-900">
  <section className="w-full max-w-[680px] rounded-3xl bg-white p-6 shadow-xl sm:p-10" aria-labelledby="terms-heading">
   <div className="mb-5 flex items-center gap-3"><span className="rounded-2xl bg-indigo-100 p-3 text-indigo-700"><ShieldCheck size={26}/></span><div><h1 id="terms-heading" className="text-2xl font-extrabold">Terms &amp; Conditions</h1><p className="text-sm text-slate-500">Please review this agreement before accessing Nexus Workspace.</p></div></div>
   {loading?<p role="status">Loading current terms…</p>:document&&<><p className="mb-3 text-xs font-semibold text-indigo-700">Agreement version: {document.version}</p>
    <div tabIndex={0} className="max-h-[320px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-700" aria-label="Full terms and conditions">{document.text}</div>
    <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm font-medium text-slate-800">
     <input type="checkbox" className="mt-1 h-5 w-5 accent-indigo-600" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/>
     <span>I have read and agree to these Terms &amp; Conditions, including the privacy and recording provisions. I understand my acceptance and its date will be saved to my account.</span>
    </label>
   </>}
   {error&&<p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
   <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
    <button type="button" onClick={onSignOut} className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Decline and sign out</button>
    <button type="button" disabled={!document||!agreed||saving} onClick={accept} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-7 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{saving?<Loader2 className="animate-spin" size={17}/>:<CheckCircle size={17}/>} Accept and continue</button>
   </div>
  </section>
 </main>
}

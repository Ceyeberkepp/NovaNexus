import React,{useEffect,useState} from 'react';
import QRCode from 'qrcode';
import {ShieldCheck,KeyRound,Copy,CheckCircle2,AlertTriangle,LockKeyhole} from 'lucide-react';

async function mfaRequest(body){
 const r=await fetch('/api/auth/mfa',{credentials:'same-origin',method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
 const data=await r.json();
 if(!r.ok)throw Error(data.error||'MFA request failed');
 return data;
}
export default function AccountSecurity({user}){
 const [enabled,setEnabled]=useState(!!user?.mfa_enabled);
 const [password,setPassword]=useState('');
 const [code,setCode]=useState('');
 const [setup,setSetup]=useState(null);
 const [qrImage,setQrImage]=useState('');
 useEffect(()=>{
  let cancelled=false;
  setQrImage('');
  if(setup?.uri){
   QRCode.toDataURL(setup.uri,{errorCorrectionLevel:'M',width:256,margin:2,color:{dark:'#171429',light:'#FFFFFF'}})
    .then(value=>{if(!cancelled)setQrImage(value)})
    .catch(()=>{if(!cancelled)setNotice('Could not render QR code. Use the manual setup key below.')});
  }
  return()=>{cancelled=true};
 },[setup?.uri]);
 const [recovery,setRecovery]=useState([]);
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{mfaRequest().then(data=>setEnabled(data.enabled)).catch(e=>setNotice(e.message))},[user?.id]);
 async function perform(action){
  setBusy(true);setNotice('');
  try{
   const data=await mfaRequest({action,password,code});
   if(action==='begin'){setSetup(data);setNotice('Scan the QR code using your authenticator app, then confirm with its current six-digit code.')}
   if(action==='confirm'){setSetup(null);setEnabled(true);setRecovery(data.recoveryCodes||[]);setNotice('MFA is active. Save all recovery codes in a password manager; they will not be displayed again.')}
   if(action==='disable'){setEnabled(false);setRecovery([]);setSetup(null);setNotice('MFA disabled for your account.')}
   setCode('');setPassword('');
  }catch(e){setNotice(e.message)}
  finally{setBusy(false)}
 }
 const input='w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-500';
 return <section className="h-full overflow-y-auto bg-[#fafbff] px-5 py-8 md:px-12">
  <div className="mx-auto max-w-4xl">
   <div className="mb-8"><h1 className="text-3xl font-black tracking-tight text-slate-900">Account Security</h1><p className="mt-2 text-xs font-bold uppercase tracking-[.2em] text-slate-400">Your sign-in and authentication</p></div>
   <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-8 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-4">
     <div className="flex gap-4"><div className="rounded-2xl bg-indigo-50 p-4 text-indigo-600"><ShieldCheck size={26}/></div><div><h2 className="text-xl font-black text-slate-900">Two-factor authentication</h2><p className="mt-1 text-sm text-slate-500">Use a six-digit TOTP code from an authenticator app.</p></div></div>
     <span className={'rounded-full px-4 py-2 text-xs font-bold '+(enabled?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-500')}>{enabled?'Enabled':'Not enabled'}</span>
    </div>
    <div className="mt-8 border-t border-slate-100 pt-6 space-y-5">
     {notice&&<p role="status" className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">{notice}</p>}
     {recovery.length>0?<div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-5"><h3 className="font-bold text-amber-900">Save your recovery codes now</h3><p className="text-xs text-amber-800">Each code works once if you lose access to your authenticator. These codes cannot be displayed again.</p><div className="grid grid-cols-2 gap-2">{recovery.map(c=><code className="rounded-lg bg-white p-3 text-center text-sm font-bold" key={c}>{c}</code>)}</div><button onClick={()=>navigator.clipboard.writeText(recovery.join('\n'))} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold text-white"><Copy size={15}/> Copy recovery codes</button><button className="ml-3 text-sm font-semibold text-amber-800 underline" onClick={()=>setRecovery([])}>I've saved the codes</button></div>:
     <>
      {setup&&<div className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-5"><h3 className="font-bold text-indigo-900">Add NovaNexus to your authenticator</h3><p className="text-xs text-slate-600">Scan this QR code with Microsoft Authenticator, Google Authenticator, 1Password or another TOTP app. Generated locally in your browser; no third-party QR service.</p>{qrImage&&<img alt="Scan this authenticator enrollment QR code" className="w-56 h-56 rounded-xl border border-indigo-100 bg-white p-2" src={qrImage}/>}<p className="text-xs text-slate-600">Can't scan? Enter this time-based setup key manually:</p><div className="flex flex-wrap items-center gap-3"><code className="max-w-full break-all rounded-lg bg-white p-3 font-mono text-sm">{setup.secret}</code><button aria-label="Copy authenticator setup secret" onClick={()=>navigator.clipboard.writeText(setup.secret)} className="rounded-lg border p-3"><Copy size={16}/></button></div><a className="block break-words text-xs text-indigo-700 underline" href={setup.uri}>Open authenticator setup link (supported apps)</a></div>}
      <label className="block text-sm font-semibold text-slate-700">Your current account password<input className={input+' mt-2'} autoComplete="current-password" type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
      {(enabled||setup)&&<label className="block text-sm font-semibold text-slate-700">{enabled?'6-digit authenticator code or recovery code':'Enter a six-digit code to complete setup'}<input className={input+' mt-2'} value={code} autoComplete="one-time-code" inputMode="numeric" maxLength={30} placeholder="123456" onChange={e=>setCode(e.target.value.trim())}/></label>}
      <div className="flex flex-wrap gap-3">{!enabled&&!setup&&<button disabled={busy||!password} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-40" onClick={()=>perform('begin')}>Set up MFA</button>}
       {!enabled&&setup&&<button disabled={busy||!password||code.length!==6} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-40" onClick={()=>perform('confirm')}>Verify and enable MFA</button>}
       {enabled&&<button disabled={busy||!password||!code} className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-bold text-rose-700 disabled:opacity-40" onClick={()=>perform('disable')}>Disable MFA</button>}
      </div>
     </>}
     <p className="text-xs leading-relaxed text-slate-500">MFA protects your sign-in after your password. It uses locally verified authenticator codes, and recovery codes are single-use. Keep recovery codes offline or in a password manager. MFA verification is required again when creating a new session.</p>
    </div>
   </div>
  </div>
 </section>;
}

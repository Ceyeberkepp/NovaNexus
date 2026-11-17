import React,{useState} from 'react';
import {Bot,Send,Trash2,Sparkles,Loader2,ShieldCheck} from 'lucide-react';

export default function WorkspaceAssistant(){
 const [messages,setMessages]=useState([]);
 const [draft,setDraft]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 async function send(e){
  e?.preventDefault();
  const content=draft.trim();
  if(!content||busy)return;
  setError('');
  const history=[...messages,{role:'user',content}];
  setMessages(history);
  setDraft('');
  setBusy(true);
  try{
   const res=await fetch('/api/assistant/chat',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:history.slice(-16)})});
   const data=await res.json();
   if(!res.ok)throw Error(data.error||'Assistant unavailable');
   setMessages([...history,{role:'assistant',content:data.reply}]);
  }catch(e){setError(e.message||'Assistant unavailable.');}
  finally{setBusy(false);}
 }
 return <section className="h-full flex flex-col bg-[#f7f8fc] px-4 py-5 md:px-10">
   <header className="border-b border-slate-200 pb-5 flex items-center justify-between gap-3">
    <div className="flex items-center gap-3"><div className="p-3 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-100"><Sparkles size={23}/></div><div><h1 className="text-2xl font-black text-slate-900">Nexus AI Assistant</h1><p className="text-xs font-semibold text-slate-500">Private, self-hosted workspace assistance</p></div></div>
    <button type="button" className="text-slate-500 hover:text-rose-600 flex items-center gap-2 text-xs font-bold" onClick={()=>{setMessages([]);setError('')}}><Trash2 size={15}/> Clear chat</button>
   </header>
   <div className="flex-1 overflow-y-auto py-7 mx-auto w-full max-w-3xl space-y-4" aria-live="polite">
     {messages.length===0&&<div className="max-w-lg mx-auto text-center pt-12 space-y-4"><Bot className="mx-auto text-indigo-500" size={45}/><h2 className="font-bold text-xl text-slate-800">How can I help?</h2><p className="text-slate-500 text-sm">Ask for meeting agendas, message drafts, technical explanations, action plans, or help using NovaNexus.</p><div className="flex justify-center gap-2 flex-wrap">{['Write a meeting agenda','Explain meeting settings','Draft a project update'].map(x=><button key={x} className="border rounded-full px-4 py-2 text-xs text-indigo-600 bg-white hover:bg-indigo-50" onClick={()=>setDraft(x)}>{x}</button>)}</div></div>}
     {messages.map((m,i)=><div key={i} className={'flex '+(m.role==='user'?'justify-end':'justify-start')}><div className={'max-w-[92%] rounded-2xl p-4 whitespace-pre-wrap break-words text-sm leading-relaxed '+(m.role==='user'?'bg-indigo-600 text-white':'bg-white shadow-sm border border-slate-100 text-slate-800')}><strong className="text-[10px] uppercase block mb-2 opacity-70">{m.role==='user'?'You':'Nexus AI'}</strong>{m.content}</div></div>)}
     {busy&&<div className="text-sm flex items-center gap-2 text-slate-500"><Loader2 size={16} className="animate-spin"/> Generating response locally…</div>}
     {error&&<div role="alert" className="rounded-xl p-4 border border-amber-200 bg-amber-50 text-sm text-amber-900">{error}</div>}
   </div>
   <form onSubmit={send} className="mx-auto w-full max-w-3xl flex gap-3 border border-slate-200 shadow-sm rounded-2xl bg-white p-2 items-end">
    <textarea aria-label="Message to AI assistant" maxLength={2500} rows={2} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Ask Nexus AI…" className="flex-1 resize-none p-3 outline-none text-sm text-slate-800"/>
    <button disabled={busy||!draft.trim()} className="bg-indigo-600 text-white rounded-xl p-4 disabled:opacity-40" aria-label="Send AI message"><Send size={18}/></button>
   </form>
   <p className="mx-auto text-xs text-slate-500 mt-3 flex gap-2 items-center"><ShieldCheck size={14}/> Runs on this NovaNexus server; does not access private messages or make administrative changes.</p>
 </section>;
}

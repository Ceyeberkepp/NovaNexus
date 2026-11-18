import React, { useState, useEffect, useRef } from 'react';
import MeetingRoom from './MeetingRoom';
import CallNotifications from './CallNotifications';
import CallsPanel from './CallsPanel';
import AdminConsole from './AdminConsole';
import AccountSecurity from './AccountSecurity';
import WorkspaceAssistant from './WorkspaceAssistant';
import ChatPreferences,{readChatPreferences,chatThemes,chatBackgrounds} from './ChatPreferences';
import { signIn, getSession, rotateInitialPassword, fetchUsers, provisionUser, signOut, getMessages, postMessage, getCalendarEvents, postCalendarEvent } from './auth-client';
import { 
  Sparkles, ShieldCheck, Video, Users, Calendar, LogOut, Shield, Activity, LayoutGrid, Plus, 
  Link as LinkIcon, Monitor, Lock, AlertTriangle, Mic, MicOff, Camera, 
  CameraOff, PhoneOff, RefreshCw, Eye, Disc, 
  Square, MonitorUp, X, Settings, Sliders, 
  ImageIcon, UploadCloud, MessageSquare, Send, Clock, 
  Trash2, Copy, Layers, ArrowRight, UserPlus, MessageCircle, Hash, Star,
  ChevronRight, Phone, Mail, Loader2, MoreVertical, User as UserIcon,
  RotateCcw, CheckSquare, Search, Play, Pause, Square as Stop, Command, Share2, Pin,
  Bell, Layout, Cpu, PhoneCall, Edit2, Globe, Cake, Key, Briefcase, FileText,
  FileImage, Globe as GlobeIcon, AlertCircle, CheckCircle, Filter, Download, ArrowLeft, Menu,
  BellOff, EyeOff, FolderPlus, UserPlus as UserPlusIcon, Bot, ChevronLeft, UserMinus, Maximize, Grid,
  ChevronDown, Megaphone, Radio, Tv, MapPin, AlignLeft, Type, Repeat, List, CornerUpLeft, CornerUpRight, Bold, Italic, Underline
} from 'lucide-react';

// Legacy prototype components retain empty collections for compatibility.
// Live account directories, policy groups, meetings and audit records load from APIs.
const MOCK_POLICIES = [];
const MOCK_LOGS = [];

// --- ERROR BOUNDARY ---
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-6 text-center font-sans text-slate-800">
        <AlertTriangle size={48} className="text-red-500 mb-4"/>
        <h1 className="text-xl font-bold text-slate-800">System Resync Required</h1>
        <button onClick={() => window.location.reload()} className="mt-4 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg">Refresh Application</button>
      </div>
    );
    return this.props.children;
  }
}

// --- HELPERS & COMPONENTS ---
const getDevices = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return { 
        audioInput: devices.filter(d => d.kind === 'audioinput'), 
        videoInput: devices.filter(d => d.kind === 'videoinput') 
    };
  } catch (e) { 
      return { audioInput: [], videoInput: [] }; 
  }
};

const UserAvatar = ({ name, src, className, onClick }) => {
  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
  return (
    <div onClick={onClick} className={`flex items-center justify-center bg-indigo-600 text-white font-bold rounded-full cursor-pointer hover:scale-105 transition-all shadow-sm overflow-hidden ${className}`}>
        {src ? <img src={src} className="w-full h-full object-cover" alt={name} /> : <span className="tracking-tighter">{initials}</span>}
    </div>
  );
};

const NavItem = ({ icon, label, active, onClick, collapsed }) => (
  <button onClick={onClick} className={`w-full flex items-center ${collapsed ? 'justify-center' : 'px-4'} py-3 rounded-xl transition-all mb-1 ${active ? 'bg-indigo-50 text-indigo-600 shadow-sm font-bold' : 'text-slate-400 hover:bg-slate-50'}`}>
    {React.cloneElement(icon, { size: 18 })}
    {!collapsed && <span className="ml-3 text-[11px] font-black uppercase tracking-wider">{label}</span>}
  </button>
);

// --- AUTH SCREEN ---
const AuthScreen = ({ setUser, setView, prefilledRoom }) => {
  const [email, setEmail] = useState(''); 
  const [password, setPassword] = useState('');
  const [mfaPending,setMfaPending]=useState(false);
  const [mfaCode,setMfaCode]=useState('');
  const [branding,setBranding] = useState({workspace_name:'Nexus Workspace'});
  useEffect(()=>{let live=true;fetch('/api/branding').then(r=>r.json()).then(d=>{if(live&&d.branding){setBranding(d.branding);document.title=d.branding.workspace_name||'NovaNexus';if(d.branding.favicon){let link=document.querySelector('link[rel="icon"]');if(!link){link=document.createElement('link');link.rel='icon';document.head.appendChild(link);}link.href=d.branding.favicon;}}}).catch(()=>{});return()=>{live=false;};},[]);
  const [activeTab, setActiveTab] = useState('login'); 
  const [guestName, setGuestName] = useState('');
  const [meetingId, setMeetingId] = useState(prefilledRoom || '');
  const [loading, setLoading] = useState(false);

  // Update state when props change (for deep linking)
  useEffect(() => {
    if (prefilledRoom) {
      setActiveTab('login');
      setMeetingId(prefilledRoom);
    }
  }, [prefilledRoom]);

  const [authError, setAuthError] = useState('');
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (activeTab === 'join') {
      if(!/^[0-9]{8}$/.test(meetingId)){setAuthError('Enter an 8-digit meeting number.');return;}
      window.location.assign('/'+meetingId);
      return;
    }
    setLoading(true);
    try {
      const result = await signIn(email, password,mfaCode);
      setUser(result.user);
      setMfaCode('');setMfaPending(false);setPassword('');
      setView(result.user.must_change_password ? 'change-password' : (prefilledRoom&&/^[0-9]{8}$/.test(prefilledRoom)?'meeting':'dashboard'));
    } catch (error) {
      if(error.message==='MFA_REQUIRED'){setMfaPending(true);setAuthError('Authenticator code required to finish signing in.');}
      else {setAuthError(error.message || 'Sign-in failed');if(error.message==='Invalid credentials'){setMfaPending(false);setMfaCode('');}}
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-[#f0f4f8] flex items-center justify-center p-4 font-sans text-slate-800 bg-[url('https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-white/40 backdrop-blur-3xl"></div>

      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-[400px] overflow-hidden relative z-10 animate-in fade-in zoom-in duration-300">
        
        {/* Branding Header */}
        <div className="pt-10 pb-6 text-center">
            {branding.login_logo
              ? <img src={branding.login_logo} alt={branding.workspace_name||'Nexus Workspace'} className="mx-auto mb-5 block h-24 w-full max-w-[280px] object-contain"/>
              : <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-5">{branding.workspace_name||"Nexus Workspace"}</h1>}
            <p className="text-slate-500 text-sm font-medium">Connect, Collaborate, Create.</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
            <button onClick={() => setActiveTab('join')} className={`flex-1 py-4 text-sm font-bold transition-all border-b-2 ${activeTab === 'join' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Join Meeting</button>
            <button onClick={() => setActiveTab('login')} className={`flex-1 py-4 text-sm font-bold transition-all border-b-2 ${activeTab === 'login' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Member Login</button>
        </div>

        {prefilledRoom && <div className="mx-7 mt-4 rounded-xl bg-indigo-50 p-3 text-xs text-indigo-800">Sign in to join meeting <strong>{prefilledRoom}</strong>. Guest access is not yet enabled.</div>}
        {authError && <p role="alert" className="mx-8 mt-4 text-sm text-red-700">{authError}</p>}
              {/* Form Section */}
        <div className="p-8 pt-8">
            <form onSubmit={handleLogin} className="space-y-6">
            {activeTab === 'join' ? (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div>
                        <div className="text-xs text-slate-500 mb-2">Enter the meeting ID, then sign in with your member account. Anonymous guest access is not enabled.</div>

                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Meeting ID</label>
                        <input type="text" placeholder="123-456-789" value={meetingId} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-200 transition-all placeholder:text-slate-300" onChange={e => setMeetingId(e.target.value)} />
                    </div>
                    <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all text-sm flex items-center justify-center mt-2">Continue to Member Sign In</button>
                </div>
            ) : (
                <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Username or Email</label>
                        <input type="text" placeholder="admin or user@email.com" value={email} required className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-200 transition-all placeholder:text-slate-300" onChange={e => setEmail(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Password</label>
                        <input type="password" placeholder="••••••••" value={password} required className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-sm text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-200 transition-all placeholder:text-slate-300" onChange={e => setPassword(e.target.value)} />
                    </div>
{mfaPending&&<div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 space-y-2"><label className="block text-[10px] font-black uppercase tracking-widest text-indigo-800">Authenticator or recovery code</label><input aria-label="Authenticator code" type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={30} required value={mfaCode} onChange={e=>setMfaCode(e.target.value.trim())} placeholder="6-digit code" className="w-full rounded-lg border border-indigo-200 p-3 text-sm outline-none focus:border-indigo-600"/><p className="text-xs text-indigo-700">Use the current six-digit code, or one unused recovery code.</p></div>}
<button type="submit" disabled={loading||(mfaPending&&!mfaCode)} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all text-sm flex items-center justify-center mt-2">{loading ? <Loader2 className="animate-spin" size={20}/> : 'Sign In'}</button>
                </div>
            )}
            </form>
            {activeTab === 'login' && (
                <div className="mt-8 pt-6 border-t border-slate-100">
                    <button disabled title="Google SSO has not been configured" className="w-full bg-white border border-slate-200 text-slate-400 py-3.5 rounded-xl font-bold cursor-not-allowed text-sm flex items-center justify-center gap-3">
                        <span className="w-5 h-5 flex items-center justify-center bg-white rounded-full"><GlobeIcon size={16} className="text-indigo-600"/></span> Google SSO Not Configured
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

// --- MEETING DETAILS MODAL ---
const MeetingDetailsModal = ({ onClose, onSave }) => {
    const [title, setTitle] = useState('');
    const [onlineMeeting, setOnlineMeeting] = useState(true);

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-5xl h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-white">
                    <div className="flex items-center gap-6">
                        <h2 className="text-lg font-black text-slate-800 tracking-tight">New meeting</h2>
                        <div className="flex gap-6 text-sm font-bold text-slate-500">
                            <button className="text-indigo-600 border-b-2 border-indigo-600 pb-4 -mb-4.5 px-2">Details</button>
                            <button className="hover:text-slate-700 pb-4 -mb-4.5 px-2 transition-colors">Scheduling Assistant</button>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">Close</button>
                        <button onClick={onSave} className="px-6 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">Save</button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Main Form */}
                    <div className="flex-1 overflow-y-auto p-8 space-y-8">
                        {/* Title */}
                        <div className="flex items-center gap-4">
                            <Type size={18} className="text-slate-400 shrink-0"/>
                            <input 
                                className="w-full bg-transparent border-b border-slate-200 py-2 text-xl font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-600 transition-colors"
                                placeholder="Add title"
                                value={title}
                                autoFocus
                                onChange={e => setTitle(e.target.value)}
                            />
                        </div>

                        {/* Attendees */}
                        <div className="flex items-center gap-4">
                            <UserPlusIcon size={18} className="text-slate-400 shrink-0"/>
                            <div className="flex-1 border-b border-slate-200 py-2 flex justify-between items-center">
                                <input 
                                    className="bg-transparent outline-none text-sm font-medium text-slate-700 placeholder:text-slate-400 w-full"
                                    placeholder="Add required attendees"
                                />
                                <span className="text-xs text-slate-400 font-bold cursor-pointer hover:text-indigo-600">+ Optional</span>
                            </div>
                        </div>

                        {/* Date Time Row */}
                        <div className="flex items-center gap-4">
                            <Clock size={18} className="text-slate-400 shrink-0"/>
                            <div className="flex items-center gap-3 flex-1 flex-wrap">
                                <input type="date" className="bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500" defaultValue="2026-01-27" />
                                <input type="time" className="bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500" defaultValue="10:00" />
                                <ArrowRight size={14} className="text-slate-400"/>
                                <input type="date" className="bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500" defaultValue="2026-01-27" />
                                <input type="time" className="bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500" defaultValue="10:30" />
                                <span className="text-xs text-slate-500 font-medium ml-2">30m</span>
                                <div className="flex items-center gap-2 ml-auto">
                                    <div className="w-8 h-4 bg-slate-200 rounded-full relative cursor-pointer"><div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full"></div></div>
                                    <span className="text-xs text-slate-600 font-medium">All day</span>
                                </div>
                            </div>
                        </div>

                        {/* Repeat */}
                        <div className="flex items-center gap-4">
                            <Repeat size={18} className="text-slate-400 shrink-0"/>
                            <div className="flex-1 border-b border-slate-200 py-2">
                                <select className="bg-transparent outline-none text-sm font-medium text-slate-700 w-full cursor-pointer appearance-none">
                                    <option>Does not repeat</option>
                                    <option>Daily</option>
                                    <option>Weekly</option>
                                </select>
                            </div>
                        </div>

                        {/* Channel */}
                        <div className="flex items-center gap-4">
                            <Layout size={18} className="text-slate-400 shrink-0"/>
                            <div className="flex-1 border-b border-slate-200 py-2">
                                <input 
                                    className="w-full bg-transparent outline-none text-sm font-medium text-slate-700 placeholder:text-slate-400"
                                    placeholder="Add channel"
                                />
                            </div>
                        </div>

                        {/* Location */}
                        <div className="flex items-center gap-4">
                            <MapPin size={18} className="text-slate-400 shrink-0"/>
                            <div className="flex-1 border-b border-slate-200 py-2 flex justify-between items-center">
                                <input 
                                    className="bg-transparent outline-none text-sm font-medium text-slate-700 placeholder:text-slate-400 w-full"
                                    placeholder="Add location"
                                />
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-slate-600 font-medium">Online meeting</span>
                                    <div 
                                        className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors ${onlineMeeting ? 'bg-indigo-600' : 'bg-slate-200'}`}
                                        onClick={() => setOnlineMeeting(!onlineMeeting)}
                                    >
                                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${onlineMeeting ? 'left-4.5' : 'left-0.5'}`}></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="flex gap-4 pt-2 h-full">
                            <AlignLeft size={18} className="text-slate-400 shrink-0 mt-2"/>
                            <div className="flex-1 border border-slate-200 rounded-xl overflow-hidden min-h-[200px] flex flex-col bg-slate-50/30">
                                <div className="bg-slate-50 border-b border-slate-200 p-2 flex items-center gap-1">
                                    <button className="p-1.5 hover:bg-slate-200 rounded text-slate-600"><Bold size={14}/></button>
                                    <button className="p-1.5 hover:bg-slate-200 rounded text-slate-600"><Italic size={14}/></button>
                                    <button className="p-1.5 hover:bg-slate-200 rounded text-slate-600"><Underline size={14}/></button>
                                    <div className="w-px h-4 bg-slate-300 mx-2"></div>
                                    <button className="p-1.5 hover:bg-slate-200 rounded text-slate-600"><List size={14}/></button>
                                    <button className="p-1.5 hover:bg-slate-200 rounded text-slate-600"><LinkIcon size={14}/></button>
                                    <div className="w-px h-4 bg-slate-300 mx-2"></div>
                                    <button className="p-1.5 hover:bg-slate-200 rounded text-slate-600"><CornerUpLeft size={14}/></button>
                                    <button className="p-1.5 hover:bg-slate-200 rounded text-slate-600"><CornerUpRight size={14}/></button>
                                </div>
                                <textarea 
                                    className="flex-1 p-4 outline-none text-sm text-slate-700 resize-none bg-transparent"
                                    placeholder="Type details for this new meeting"
                                />
                            </div>
                        </div>

                         <div className="flex items-center gap-4">
                             <List size={18} className="text-slate-400 shrink-0"/>
                             <button className="text-sm font-medium text-slate-500 hover:text-indigo-600">Add an agenda</button>
                         </div>
                    </div>

                    {/* Sidebar Options */}
                    <div className="w-80 border-l border-slate-200 p-6 bg-slate-50 flex flex-col gap-6">
                        <div>
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-4">Options</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2 flex items-center gap-1">
                                        Who can bypass the lobby? <AlertCircle size={10}/>
                                    </label>
                                    <select className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 shadow-sm">
                                        <option>People in my org and guests</option>
                                        <option>Everyone</option>
                                        <option>People in my org</option>
                                        <option>Only me</option>
                                    </select>
                                </div>
                                 <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                                     <p className="text-[10px] text-slate-500 leading-relaxed">
                                         People who can bypass the lobby will get into the meeting directly. Everyone else will wait in the lobby until admitted.
                                     </p>
                                 </div>
                            </div>
                        </div>
                        <div className="mt-auto border-t border-slate-200 pt-6">
                             <div className="flex items-center gap-3 text-sm font-bold text-slate-600 hover:text-indigo-600 cursor-pointer transition-colors">
                                 <Settings size={16}/> Response options
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- SCHEDULE PANEL ---
const SchedulePanel = ({ startMeeting }) => {
    const [meetings, setMeetings] = useState([]);
    const [calendarError, setCalendarError] = useState("");
    useEffect(() => { let live=true; getCalendarEvents().then(data=>{if(live)setMeetings(data.events);}).catch(e=>{if(live)setCalendarError(e.message);}); return ()=>{live=false;}; }, []);
    const [showModal, setShowModal] = useState(false);
    const [showNewMenu, setShowNewMenu] = useState(false); 
    const [showMeetingDetails, setShowMeetingDetails] = useState(false); // State for Channel Meeting Modal
    const [newMeeting, setNewMeeting] = useState({ title: '', date: '', time: '', description: '' });
    const [viewDate, setViewDate] = useState(() => new Date()); 
    const [viewMode, setViewMode] = useState('week'); 

    const startHour = 8; 
    const endHour = 18; 
    const totalHours = endHour - startHour;
    const hourHeight = 80;
    const weekStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate());
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const visibleDates = Array.from({length: 5}, (_, i) => {
      const date = new Date(weekStart); date.setDate(weekStart.getDate() + i);
      return { day: date.toLocaleDateString(undefined, {weekday:'short'}), date:date.getDate(), dateStr:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`, index:i };
    }); 

    const handleSchedule = async (e) => {
        e.preventDefault();
        setCalendarError("");
        try {
          const saved = await postCalendarEvent({title:newMeeting.title,date:newMeeting.date,time:newMeeting.time,duration:60});
          setMeetings(previous => [...previous, saved.event]);
          const [year,month,day] = saved.event.date.split("-").map(Number);
          setViewDate(new Date(year,month-1,day));
          setShowModal(false);
          setNewMeeting({title:"",date:"",time:"",description:""});
        } catch(err) {setCalendarError(err.message || "Could not save event");}
    };
    
    const handleChannelMeetingSave = () => {
        setShowMeetingDetails(false);
        alert("Channel meeting scheduled!");
    }

    const getEventStyle = (m) => {
        const [h, min] = m.time.split(':').map(Number);
        const top = ((h - startHour) * hourHeight) + ((min / 60) * hourHeight);
        const height = (m.duration / 60) * hourHeight;
        
        let colorClass = 'bg-indigo-50 border-indigo-200 text-indigo-700';
        if (m.type === 'work') colorClass = 'bg-blue-50 border-blue-200 text-blue-700';
        if (m.type === 'personal') colorClass = 'bg-emerald-50 border-emerald-200 text-emerald-700';
        if (m.type === 'external') colorClass = 'bg-amber-50 border-amber-200 text-amber-700';

        return { top: `${top}px`, height: `${height}px`, position: 'absolute', width: '90%', left: '5%', zIndex: 10, className: colorClass };
    };

    const getVisibleDays = () => {
        if (viewMode === 'day') {
            return visibleDates.filter(d => d.dateStr === `${viewDate.getFullYear()}-${String(viewDate.getMonth()+1).padStart(2,'0')}-${String(viewDate.getDate()).padStart(2,'0')}`);
        }
        return visibleDates;
    };
    
    const visibleDays = getVisibleDays();

    return (
        <div className="flex flex-col h-full bg-white text-slate-600">
             {calendarError && <div role="alert" className="p-3 bg-red-50 text-red-700 text-sm">{calendarError}</div>}
             {/* Meeting Details Modal */}
             {showMeetingDetails && <MeetingDetailsModal onClose={() => setShowMeetingDetails(false)} onSave={handleChannelMeetingSave} />}

             <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 bg-white sticky top-0 z-20">
                <div className="flex items-center gap-6">
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Calendar</h1>
                    <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                        <button onClick={() => setViewDate(d => new Date(d.getFullYear(),d.getMonth(),d.getDate()-(viewMode==='day'?1:7)))} className="p-1 hover:text-indigo-600 transition-colors"><ChevronLeft size={20}/></button>
                        <span className="text-xs font-bold px-4 text-slate-700">{visibleDates[0].dateStr} – {visibleDates[4].dateStr}</span>
                        <button onClick={() => setViewDate(d => new Date(d.getFullYear(),d.getMonth(),d.getDate()+(viewMode==='day'?1:7)))} className="p-1 hover:text-indigo-600 transition-colors"><ChevronRight size={20}/></button>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                     <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
                         <button onClick={() => setViewMode('day')} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold ${viewMode === 'day' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}>Day</button>
                         <button onClick={() => setViewMode('week')} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold ${viewMode === 'week' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}>Week</button>
                         <button onClick={() => setViewMode('month')} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold ${viewMode === 'month' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}>Month</button>
                     </div>
                     <div className="relative">
                        <button 
                            onClick={() => setShowNewMenu(!showNewMenu)}
                            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
                        >
                            <Plus size={14}/> New <ChevronDown size={12}/>
                        </button>
                        
                        {/* New Event Dropdown Menu */}
                        {showNewMenu && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="py-1">
                                    <button onClick={() => { setShowModal(true); setShowNewMenu(false); }} className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                                        <Calendar size={14}/> Event
                                    </button>
                                    <button onClick={() => { setShowMeetingDetails(true); setShowNewMenu(false); }} className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                                        <Users size={14}/> Channel meeting
                                    </button>
                                    
                                    <div className="h-px bg-slate-100 my-1"></div>
                                    <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Organization templates</div>
                                    
                                    <button className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                                        <Tv size={14}/> Webinar
                                    </button>
                                    <button className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                                        <Megaphone size={14}/> Town hall
                                    </button>
                                    <button className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                                        <Monitor size={14}/> Virtual appointment
                                    </button>
                                    <button className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                                        <Radio size={14}/> Live Event
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
             </div>
             <div className="flex-1 overflow-y-auto relative flex bg-white">
                <div className="w-16 border-r border-slate-100 bg-slate-50/50 pt-12 shrink-0 relative z-10">
                    {Array.from({ length: totalHours }).map((_, i) => (
                        <div key={i} className="h-[80px] text-[10px] font-bold text-slate-400 text-right pr-4 relative -top-2">{startHour + i}:00</div>
                    ))}
                </div>
                <div className="flex-1 flex overflow-x-auto">
                    {visibleDays.map((dayItem) => {
                        const dateStr = dayItem.dateStr;
                        const dayEvents = meetings.filter(m => m.date === dateStr);
                        const now=new Date(); const isToday = dateStr === `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; 
                        
                        return (
                            <div key={dayItem.day} className="flex-1 min-w-[160px] border-r border-slate-100 relative bg-white">
                                <div className={`text-center py-4 border-b border-slate-100 sticky top-0 z-10 bg-white/95 backdrop-blur-sm ${isToday ? 'bg-indigo-50/30' : ''}`}>
                                    <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>{dayItem.day}</div>
                                    <div className={`text-xl font-black ${isToday ? 'text-indigo-600' : 'text-slate-800'}`}>{dayItem.date}</div>
                                </div>
                                <div className="relative" style={{ height: `${totalHours * hourHeight}px` }}>
                                    {Array.from({ length: totalHours }).map((_, i) => (
                                        <div key={i} className="absolute w-full border-t border-slate-50" style={{ top: `${i * hourHeight}px` }}></div>
                                    ))}
                                    {isToday && (
                                        <div className="absolute w-full border-t-2 border-red-500 z-20" style={{ top: `${(10 - startHour) * hourHeight + 40}px` }}>
                                            <div className="absolute -left-1 -top-1.5 w-3 h-3 bg-red-500 rounded-full"></div>
                                        </div>
                                    )}
                                    {dayEvents.map(m => {
                                        const style = getEventStyle(m);
                                        return (
                                            <div key={m.id} style={{ top: style.top, height: style.height, left: style.left, width: style.width, zIndex: style.zIndex }} className={`absolute rounded-xl border-l-4 p-3 shadow-sm cursor-pointer hover:shadow-md transition-all overflow-hidden ${style.className}`} onClick={() => startMeeting(m.link)}>
                                                <div className="text-[11px] font-bold truncate">{m.title}</div>
                                                <div className="text-[9px] opacity-70 truncate flex items-center gap-1 mt-0.5"><Clock size={10}/> {m.time}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
             </div>
             {showModal && (
                 <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-200 border border-slate-100">
                        <div className="flex justify-between items-center mb-6"><h3 className="font-black text-lg text-slate-800">Schedule Meeting</h3><button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400 hover:text-red-500"/></button></div>
                        <form onSubmit={handleSchedule} className="space-y-4">
                            <div><label className="text-[9px] font-bold text-slate-400 uppercase ml-2 mb-1 block">Title</label><input required className="w-full bg-slate-50 p-4 rounded-xl text-xs font-bold outline-none border border-transparent focus:border-indigo-100 focus:bg-white transition-all text-slate-700" placeholder="e.g. Weekly Sync" value={newMeeting.title} onChange={e => setNewMeeting({...newMeeting, title: e.target.value})} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-[9px] font-bold text-slate-400 uppercase ml-2 mb-1 block">Date</label><input required type="date" className="w-full bg-slate-50 p-4 rounded-xl text-xs font-bold outline-none border border-transparent focus:border-indigo-100 focus:bg-white text-slate-700" value={newMeeting.date} onChange={e => setNewMeeting({...newMeeting, date: e.target.value})} /></div>
                                <div><label className="text-[9px] font-bold text-slate-400 uppercase ml-2 mb-1 block">Time</label><input required type="time" className="w-full bg-slate-50 p-4 rounded-xl text-xs font-bold outline-none border border-transparent focus:border-indigo-100 focus:bg-white text-slate-700" value={newMeeting.time} onChange={e => setNewMeeting({...newMeeting, time: e.target.value})} /></div>
                            </div>
                            <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 mt-2">Confirm Schedule</button>
                        </form>
                    </div>
                 </div>
             )}
        </div>
    );
};

// --- PROFILE SETTINGS MODAL ---
const ProfileSettingsModal = ({ user, onClose, onUpdate, onSecurity }) => {
 const [form,setForm]=useState({name:user?.name||'',jobTitle:user?.jobTitle||'',birthday:user?.birthday||'',avatar:user?.avatar||''});
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const input='w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:ring-2 focus:ring-indigo-400 outline-none';
 async function uploadPicture(event){
  const file=event.target.files?.[0];
  if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)){setError('Choose a PNG, JPEG or WebP photo.');return}
  if(file.size>5*1024*1024){setError('Choose a photo smaller than 5 MB.');return}
  try{
   const blob=await createImageBitmap(file);
   const canvas=document.createElement('canvas');
   canvas.width=96;canvas.height=96;
   const ctx=canvas.getContext('2d');
   const edge=Math.min(blob.width,blob.height);
   ctx.drawImage(blob,(blob.width-edge)/2,(blob.height-edge)/2,edge,edge,0,0,96,96);
   blob.close();
   const avatar=canvas.toDataURL('image/jpeg',0.68);
   if(avatar.length>11000)throw Error('Picture is too large after resizing.');
   setForm(old=>({...old,avatar}));setError('');
  }catch(e){setError(e.message||'Could not process picture')}
 }
 async function save(e){
  e.preventDefault();setBusy(true);setError('');
  try{
   const response=await fetch('/api/account/profile',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Could not update profile');
   onUpdate(data.user);onClose();
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section role="dialog" aria-modal="true" aria-label="Edit your profile" className="w-full max-w-lg max-h-[90vh] overflow-auto rounded-[2rem] bg-white p-7 shadow-2xl">
   <header className="flex items-center justify-between mb-6"><h2 className="text-xl font-black text-slate-900">My Profile</h2><button type="button" aria-label="Close profile" onClick={onClose} className="rounded-full p-2 hover:bg-slate-100"><X size={20}/></button></header>
   <form className="space-y-4" onSubmit={save}>
    <div className="flex flex-col items-center gap-3">
     <UserAvatar name={form.name} src={form.avatar} className="w-20 h-20"/>
     <label className="cursor-pointer text-sm font-semibold text-indigo-700">Change profile photo<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={uploadPicture}/></label>
     {form.avatar&&<button type="button" className="text-xs text-slate-500 underline" onClick={()=>setForm(v=>({...v,avatar:''}))}>Remove picture</button>}
    </div>
    <label className="block text-sm font-semibold text-slate-700">Display name<input required maxLength={120} minLength={2} className={input+' mt-2'} value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))}/></label>
    <label className="block text-sm font-semibold text-slate-700">Job title<input maxLength={120} className={input+' mt-2'} value={form.jobTitle} onChange={e=>setForm(v=>({...v,jobTitle:e.target.value}))}/></label>
    <label className="block text-sm font-semibold text-slate-700">Birthday (optional)<input type="date" className={input+' mt-2'} value={form.birthday} onChange={e=>setForm(v=>({...v,birthday:e.target.value}))}/></label>
    <label className="block text-sm font-semibold text-slate-700">Email address<input disabled className={input+' mt-2 opacity-70'} value={user?.email||''} readOnly/></label>
    <button type="button" onClick={()=>{onClose();onSecurity()}} className="flex items-center gap-2 text-indigo-700 font-semibold text-sm"><ShieldCheck size={17}/> Password and two-factor authentication</button>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={onClose} className="rounded-xl border px-5 py-3 text-sm font-bold">Cancel</button><button disabled={busy||form.name.trim().length<2} className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?'Saving...':'Save changes'}</button></div>
   </form>
  </section>
 </div>;
};

// --- SETTINGS MODAL COMPONENT ---
const ChatSettingsModal = ({ onClose }) => {
    // ... existing ChatSettingsModal code ...
    const [activeTab, setActiveTab] = useState('display');

    const tabs = [
        { id: 'notifications', label: 'Notifications', icon: <Bell size={14}/> },
        { id: 'display', label: 'Display', icon: <Monitor size={14}/> },
        { id: 'sidebar', label: 'Sidebar', icon: <Layout size={14}/> },
        { id: 'advanced', label: 'Advanced', icon: <Cpu size={14}/> },
    ];

    const SettingRow = ({ label, sublabel, value, actionLabel = 'Edit' }) => (
        <div className="flex justify-between py-6 border-b border-white/5 hover:bg-white/5 px-4 rounded-lg transition-colors group">
            <div className="pr-8">
                <div className="text-sm font-bold text-slate-200 mb-1">{label}</div>
                <div className="text-[11px] text-slate-500 font-medium">{sublabel}</div>
                {value && <div className="mt-2 text-[11px] text-indigo-400 font-bold">{value}</div>}
            </div>
            <button className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-400 flex items-center gap-1 h-fit py-1 px-3 rounded-md hover:bg-white/10 transition-all">
                <Edit2 size={10}/> {actionLabel}
            </button>
        </div>
    );

    return (
        <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200">
            <div className="w-full max-w-4xl h-[85vh] bg-[#1e1e1e] rounded-xl shadow-2xl flex overflow-hidden border border-white/10 font-sans text-slate-300">
                {/* Sidebar */}
                <div className="w-64 bg-[#252526] flex flex-col border-r border-black/20">
                    <div className="p-6 border-b border-black/20">
                        <h2 className="text-lg font-black text-white tracking-tight">Settings</h2>
                    </div>
                    <div className="p-3 space-y-1 overflow-y-auto flex-1">
                        {tabs.map(t => (
                            <button 
                                key={t.id} 
                                onClick={() => setActiveTab(t.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-bold transition-all ${activeTab === t.id ? 'bg-[#37373d] text-white' : 'text-slate-400 hover:bg-[#2d2d30] hover:text-slate-200'}`}
                            >
                                {t.icon} {t.label}
                            </button>
                        ))}
                        <div className="pt-4 mt-4 border-t border-white/5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Plugin Preferences</div>
                        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-bold text-slate-400 hover:bg-[#2d2d30] hover:text-slate-200">
                            <PhoneCall size={14}/> Calls
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col bg-[#1e1e1e]">
                    <div className="p-6 border-b border-black/20 flex justify-between items-center bg-[#1e1e1e]">
                        <h3 className="text-xl font-bold text-white capitalize">{activeTab} Settings</h3>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20} className="text-slate-400"/></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 md:px-12">
                        {activeTab === 'display' && (
                            <div className="space-y-2 animate-in slide-in-from-right-4 duration-300 fade-in">
                                <div className="mb-8 p-6 bg-[#252526] rounded-xl border border-white/5">
                                    <div className="text-sm font-bold text-white mb-4">Theme</div>
                                    <div className="grid grid-cols-4 gap-4">
                                        {['Onyx', 'Quartz', 'Indigo', 'Ruby'].map(theme => (
                                            <div key={theme} className="cursor-pointer group">
                                                <div className={`h-16 rounded-lg mb-2 border-2 ${theme === 'Onyx' ? 'border-indigo-500 bg-[#1e1e1e]' : 'border-transparent bg-[#333]'}`}></div>
                                                <div className="text-[10px] font-bold text-center group-hover:text-white transition-colors">{theme}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <SettingRow label="Clock Display" sublabel="12-hour clock (example: 4:00 PM)" />
                                <SettingRow label="Teammate Name Display" sublabel="Show username" value="username_only" />
                                <SettingRow label="Show online availability on profile images" sublabel="On" value="Enabled" />
                                <SettingRow label="Timezone" sublabel="Automatic (Eastern Time US & Canada)" value="UTC-05:00" />
                            </div>
                        )}

                        {activeTab === 'notifications' && (
                            <div className="space-y-2 animate-in slide-in-from-right-4 duration-300 fade-in">
                                <SettingRow label="Desktop and mobile notifications" sublabel="Mentions, Direct Messages, and Group Messages" />
                                <SettingRow label="Desktop notification sounds" sublabel="Bing for messages, Calm for calls" />
                                <SettingRow label="Email notifications" sublabel="On" value="Immediate" />
                                <SettingRow label="Keywords that trigger notifications" sublabel='"@channel", "@here", "@all"' />
                                
                                <div className="mt-8 p-6 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex gap-4 items-start">
                                    <AlertTriangle className="text-indigo-400 shrink-0" size={20}/>
                                    <div>
                                        <div className="text-xs font-bold text-indigo-200 mb-1">Troubleshooting notifications</div>
                                        <p className="text-[10px] text-indigo-300/80 leading-relaxed">Not receiving notifications? Start by sending a test notification to check if your browser permissions are set correctly.</p>
                                        <button className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-indigo-500">Send Test Notification</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'sidebar' && (
                            <div className="space-y-2 animate-in slide-in-from-right-4 duration-300 fade-in">
                                <SettingRow label="Group unread channels separately" sublabel="Off" />
                                <SettingRow label="Number of direct messages to show" sublabel="40" />
                                <SettingRow label="Sort channels by" sublabel="Most recent activity" />
                            </div>
                        )}

                        {activeTab === 'advanced' && (
                            <div className="space-y-2 animate-in slide-in-from-right-4 duration-300 fade-in">
                                <SettingRow label="Send Messages on CTRL+ENTER" sublabel="On only for code blocks starting with ```" />
                                <SettingRow label="Enable Post Formatting" sublabel="On" value="Markdown Enabled" />
                                <SettingRow label="Enable Join/Leave Messages" sublabel="On" />
                                <SettingRow label="Scroll position when viewing an unread channel" sublabel="Start me where I left off" />
                            </div>
                        )}
                    </div>
                    
                    <div className="p-6 border-t border-black/20 bg-[#252526] flex justify-end gap-3">
                        <button onClick={onClose} className="px-6 py-2.5 rounded-lg text-xs font-bold text-slate-300 hover:bg-white/10 transition-colors">Cancel</button>
                        <button onClick={onClose} className="px-6 py-2.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/20 transition-colors">Save Settings</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- VIDEO ROOM (IMMERSIVE) ---
const VideoRoom = ({ roomId, user, onEnd }) => {
    // ... existing VideoRoom code ...
    // No simulated participants. Actual conferences use LiveKit's authenticated roster.
    const [participants, setParticipants] = useState([
        { id: 'local', name: user?.name || 'You', isLocal: true, stream: null }
    ]);
    const [localStream, setLocalStream] = useState(null);
    const [screenStream, setScreenStream] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [sidePanel, setSidePanel] = useState(null); 
    const [isRecording, setIsRecording] = useState(false);
    const [devices, setDevices] = useState({ audioInput: [], videoInput: [] });
    const [chatMsg, setChatMsg] = useState('');
    const [roomMessages, setRoomMessages] = useState([]);
    const [breakoutActive, setBreakoutActive] = useState(false);
    const [showBreakoutSetup, setShowBreakoutSetup] = useState(false);
    const [numRooms, setNumRooms] = useState(2);

    const startStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            setLocalStream(stream);
            const dev = await getDevices(); 
            setDevices(dev);
            setIsCameraOff(false);
            setIsMuted(false);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { 
        startStream(); 
        return () => {
            stopAllTracks();
        }; 
    }, []);

    const stopAllTracks = () => {
        if (localStream) localStream.getTracks().forEach(t => t.stop());
        if (screenStream) screenStream.getTracks().forEach(t => t.stop());
    }

    const toggleScreen = async () => {
        if (screenStream) { 
            screenStream.getTracks().forEach(t => t.stop()); 
            setScreenStream(null); 
        } else {
            try {
                const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
                setScreenStream(s);
                s.getVideoTracks()[0].onended = () => setScreenStream(null);
            } catch (e) {}
        }
    };

    const toggleMute = async () => {
        if (isMuted) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                // In a real app we'd merge tracks, here we just simulate state for simplicity as re-getting stream causes flicker
                setIsMuted(false);
            } catch(e) {}
        } else {
            setIsMuted(true);
            if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = false);
        }
    }

    const toggleCamera = async () => {
        if (isCameraOff) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                setLocalStream(stream);
                setIsCameraOff(false);
            } catch(e) {}
        } else {
            setIsCameraOff(true);
            if (localStream) localStream.getVideoTracks().forEach(t => t.stop());
        }
    }

    const handleEndCall = () => {
        stopAllTracks();
        onEnd();
    }

    const handleShareLink = () => {
        navigator.clipboard.writeText(window.location.href);
        alert("Link copied!");
        setShowMenu(false);
    }
    
    const handleCreateBreakout = () => {
        setShowBreakoutSetup(false);
        setBreakoutActive(true);
        alert("Breakout rooms started");
    }

    const toggleBreakout = () => {
         if (breakoutActive) {
             setBreakoutActive(false);
             alert("Ending breakouts");
         } else {
             setShowBreakoutSetup(true);
             setShowMenu(false);
         }
    }

    const handleKickParticipant = (id) => {
        if (confirm("Remove this participant?")) {
            setParticipants(prev => prev.filter(p => p.id !== id));
        }
    };

    const sendRoomMessage = (e) => {
        e.preventDefault();
        if(!chatMsg.trim()) return;
        setRoomMessages([...roomMessages, { sender: user?.name || 'You', text: chatMsg, time: 'Now' }]);
        setChatMsg('');
    };

    return (
        <div className="fixed inset-0 bg-black z-[200] flex font-sans overflow-hidden">
            {/* Breakout Setup Modal */}
            {showBreakoutSetup && (
                <div className="absolute inset-0 z-[220] bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-white/10 w-full max-w-sm p-8 rounded-3xl text-white shadow-2xl animate-in zoom-in duration-200">
                        <h3 className="font-black text-xl mb-6 flex items-center gap-3"><Layers className="text-indigo-500"/> Breakout Rooms</h3>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">Number of Rooms</label>
                                <div className="flex items-center gap-4">
                                    <button onClick={()=>setNumRooms(Math.max(1, numRooms-1))} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center">-</button>
                                    <span className="font-black text-xl w-8 text-center">{numRooms}</span>
                                    <button onClick={()=>setNumRooms(Math.min(10, numRooms+1))} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center">+</button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => setShowBreakoutSetup(false)} className="py-3 rounded-xl font-bold text-xs bg-white/5 hover:bg-white/10 transition-colors">Cancel</button>
                                <button onClick={handleCreateBreakout} className="py-3 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 transition-colors">Create Rooms</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettings && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 bg-zinc-900 border border-white/10 p-8 rounded-[2rem] shadow-2xl z-[250] text-white backdrop-blur-xl">
                    <div className="flex justify-between items-center mb-6 font-black text-[10px] uppercase tracking-widest"><span>Hardware</span><X className="cursor-pointer hover:text-red-400" size={16} onClick={()=>setShowSettings(false)}/></div>
                    <div className="space-y-4">
                        <div>
                            <label className="text-[9px] font-bold text-zinc-500 uppercase block mb-2">Mic Input</label>
                            <select className="w-full bg-zinc-800 p-3 rounded-xl text-[11px] outline-none border border-white/5">{devices.audioInput.map((d,i)=><option key={i}>{d.label || `Mic ${i+1}`}</option>)}</select>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-zinc-500 uppercase block mb-2">Camera Input</label>
                            <select className="w-full bg-zinc-800 p-3 rounded-xl text-[11px] outline-none border border-white/5">{devices.videoInput.map((d,i)=><option key={i}>{d.label || `Cam ${i+1}`}</option>)}</select>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Stage */}
            <div className="flex-1 relative flex flex-col transition-all duration-300">
                <div className="flex-1 relative bg-zinc-950 p-4 flex items-center justify-center">
                    {/* Grid Layout for Video Tiles */}
                    <div className={`grid gap-4 w-full h-full ${participants.length <= 1 ? 'grid-cols-1' : participants.length <= 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2 md:grid-cols-2 lg:grid-cols-2'}`}>
                        {participants.map((p) => (
                            <div key={p.id} className="relative bg-zinc-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center group">
                                {p.isLocal ? (
                                    <>
                                        {screenStream ? (
                                            <video ref={el => { if(el) el.srcObject = screenStream }} autoPlay playsInline className="w-full h-full object-contain" />
                                        ) : (
                                            <video ref={el => { if(el && localStream) el.srcObject = localStream }} autoPlay playsInline muted={true} className={`w-full h-full object-cover transform scale-x-[-1] ${isCameraOff ? 'hidden' : 'block'}`} />
                                        )}
                                        {isCameraOff && !screenStream && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                                                <UserAvatar name={p.name} className="w-24 h-24 text-3xl"/>
                                            </div>
                                        )}
                                        <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-xs font-bold flex items-center gap-2">
                                            {p.name} (You) {isMuted && <MicOff size={12} className="text-red-400"/>}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* Mock Remote User Representation */}
                                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                                            <div className="relative">
                                                <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 rounded-full animate-pulse"></div>
                                                <UserAvatar name={p.name} className="w-24 h-24 text-3xl relative z-10"/>
                                            </div>
                                        </div>
                                        <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-xs font-bold flex items-center gap-2">
                                            {p.name} <span className="opacity-50 text-[10px] uppercase tracking-wider">{p.role}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                    
                    {/* Floating Room ID Overlay */}
                     <div className="absolute top-6 left-6 flex gap-3 z-50">
                        <div className="bg-zinc-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-white flex items-center gap-3 shadow-lg">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-80">{roomId}</span>
                        </div>
                    </div>
                </div>

                {/* Menu Dropdown - Moved out to avoid clipping */}
                {showMenu && (
                    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 mb-4 w-56 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl py-2 text-white text-[10px] font-black uppercase tracking-widest overflow-hidden z-[210] animate-in slide-in-from-bottom-2 fade-in duration-200">
                        <button onClick={()=>alert("Control Request Sent")} className="w-full px-5 py-3 hover:bg-white/5 flex items-center gap-3 text-left"><Sliders size={14}/> Take Control</button>
                        <button onClick={handleShareLink} className="w-full px-5 py-3 hover:bg-white/5 flex items-center gap-3 text-left border-t border-white/5"><Share2 size={14}/> Share Link</button>
                        <button onClick={()=>{setShowSettings(true); setShowMenu(false)}} className="w-full px-5 py-3 hover:bg-white/5 flex items-center gap-3 text-left border-t border-white/5"><Settings size={14}/> Hardware Settings</button>
                        <button onClick={toggleBreakout} className="w-full px-5 py-3 hover:bg-white/5 flex items-center gap-3 text-left border-t border-white/5"><Layers size={14}/> {breakoutActive ? 'Close Breakouts' : 'Breakout Rooms'}</button>
                    </div>
                )}

                {/* Control Bar - Responsive */}
                <div className="absolute bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 md:gap-3 px-4 py-3 md:px-6 md:py-3 bg-zinc-900/90 backdrop-blur-2xl rounded-full border border-white/10 shadow-2xl z-50 max-w-[95vw] overflow-x-auto no-scrollbar">
                     <button onClick={toggleMute} className={`p-3 md:p-4 rounded-full transition-all shrink-0 ${isMuted ? 'bg-red-500' : 'bg-white/5 hover:bg-white/10'} text-white`}>{isMuted ? <MicOff size={18}/> : <Mic size={18}/>}</button>
                     <button onClick={toggleCamera} className={`p-3 md:p-4 rounded-full transition-all shrink-0 ${isCameraOff ? 'bg-red-500' : 'bg-white/5 hover:bg-white/10'} text-white`}>{isCameraOff ? <CameraOff size={18}/> : <Camera size={18}/>}</button>
                     <button onClick={toggleScreen} className={`p-3 md:p-4 rounded-full transition-all shrink-0 ${screenStream ? 'bg-indigo-500' : 'bg-white/5 hover:bg-white/10'} text-white`}><MonitorUp size={18}/></button>
                     <button onClick={() => setIsRecording(!isRecording)} className={`hidden md:block p-3 md:p-4 rounded-full transition-all shrink-0 ${isRecording ? 'bg-red-500' : 'bg-white/5 hover:bg-white/10'} text-white`}>{isRecording ? <Stop size={18}/> : <Disc size={18}/>}</button>
                     
                     <div className="w-px h-8 bg-white/10 mx-1 shrink-0"></div>
                     
                     <button onClick={() => setSidePanel(sidePanel === 'chat' ? null : 'chat')} className={`p-3 md:p-4 rounded-full transition-all shrink-0 ${sidePanel === 'chat' ? 'bg-indigo-600' : 'bg-white/5 hover:bg-white/10'} text-white relative`}>
                         <MessageSquare size={18}/>
                         {roomMessages.length > 0 && sidePanel !== 'chat' && <div className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full"></div>}
                     </button>
                     <button onClick={() => setSidePanel(sidePanel === 'participants' ? null : 'participants')} className={`hidden md:block p-3 md:p-4 rounded-full transition-all shrink-0 ${sidePanel === 'participants' ? 'bg-indigo-600' : 'bg-white/5 hover:bg-white/10'} text-white`}><Users size={18}/></button>
                     
                     <div className="relative shrink-0">
                        <button onClick={() => setShowMenu(!showMenu)} className={`p-3 md:p-4 rounded-full bg-white/5 text-white hover:bg-white/10 ${showMenu ? 'bg-indigo-600' : ''}`}><MoreVertical size={18}/></button>
                     </div>
                     <button onClick={handleEndCall} className="bg-red-600 text-white px-5 py-3 md:px-6 md:py-4 rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-red-700 ml-2 shrink-0">End</button>
                </div>
            </div>

            {/* Side Panel */}
            {sidePanel && (
                <div className="w-full md:w-80 absolute inset-0 md:static md:inset-auto bg-zinc-900 border-l border-white/10 flex flex-col z-[100] animate-in slide-in-from-right duration-300">
                    <div className="p-6 border-b border-white/10 flex justify-between items-center text-white">
                        <span className="font-black uppercase tracking-widest text-xs">{sidePanel === 'chat' ? 'Room Chat' : 'Participants (4)'}</span>
                        <X size={16} className="cursor-pointer hover:text-indigo-400" onClick={() => setSidePanel(null)}/>
                    </div>
                    
                    {sidePanel === 'chat' && (
                        <>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                <div className="text-center text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-4">Session Started</div>
                                {roomMessages.map((m, i) => (
                                    <div key={i} className="flex flex-col gap-1">
                                        <div className="flex justify-between items-end"><span className="text-[10px] font-bold text-zinc-400">{m.sender}</span><span className="text-[9px] text-zinc-600">{m.time}</span></div>
                                        <div className="bg-white/10 p-3 rounded-xl rounded-tl-none text-xs text-zinc-200">{m.text}</div>
                                    </div>
                                ))}
                            </div>
                            <form onSubmit={sendRoomMessage} className="p-4 border-t border-white/10">
                                <div className="bg-zinc-800 rounded-xl flex items-center px-3 border border-white/5">
                                    <input value={chatMsg} onChange={e=>setChatMsg(e.target.value)} className="bg-transparent border-none outline-none flex-1 py-3 text-xs text-white placeholder:text-zinc-600" placeholder="Type..." />
                                    <button type="submit" className="text-indigo-400"><Send size={14}/></button>
                                </div>
                            </form>
                        </>
                    )}
                    
                    {sidePanel === 'participants' && (
                        <div className="p-4 space-y-2">
                           {participants.map((u, i) => (
                               <div key={i} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl group">
                                   <div className="flex items-center gap-3">
                                       <UserAvatar name={u.name} className="w-8 h-8 text-[10px]"/>
                                       <div>
                                           <div className="text-xs font-bold text-zinc-200">{u.name}</div>
                                           <div className="text-[9px] text-zinc-500 uppercase tracking-wider">{u.isLocal ? 'Host' : 'Attendee'}</div>
                                       </div>
                                   </div>
                                   {/* Kick Button for Host */}
                                   {!u.isLocal && !user?.isGuest && (
                                       <button 
                                           onClick={() => handleKickParticipant(u.id)}
                                           className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-500 transition-opacity p-2 rounded-lg hover:bg-white/5"
                                           title="Remove Participant"
                                       >
                                           <UserMinus size={14} />
                                       </button>
                                   )}
                               </div>
                           ))}
                       </div>
                    )}
                </div>
            )}
        </div>
    );
};

// --- ADMIN CONTROL ---
const Messenger = ({ startMeeting, users, currentUser }) => {
    // ... existing Messenger code ...
    // Note: Re-pasting the Messenger component to ensure it's not lost if user copies this block
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState({});
    const [chatError, setChatError] = useState("");
    const [prefs,setPrefs] = useState(()=>readChatPreferences(currentUser?.id||0));
    const [recentMap,setRecentMap] = useState({});
    const lastSeenRef=useRef({});
    const formatMessageTime=createdAt=>new Date(createdAt).toLocaleTimeString([],{
      hour:'2-digit',minute:'2-digit',hour12:!prefs.clock24,
      ...(prefs.timezone==='UTC'?{timeZone:'UTC'}:{})
    });
    useEffect(()=>{
      let active=true;
      async function refreshRecent(){
        try{const r=await fetch('/api/messages/recent',{credentials:'same-origin'});
          if(!r.ok)return;const data=await r.json();
          if(active)setRecentMap(Object.fromEntries((data.recent||[]).map(v=>[v.peer,new Date(v.last).getTime()])));
        }catch{}
      }
      refreshRecent();const timer=setInterval(refreshRecent,15000);
      return ()=>{active=false;clearInterval(timer)};
    },[currentUser?.id]);
    useEffect(()=>{
      if(!selectedChat||selectedChat.members)return;
      const peer=Number(selectedChat.id);
      if(!Number.isInteger(peer))return;
      let active=true;
      async function poll(){
        try{
          const data=await getMessages(peer);
          if(!active)return;
          const list=data.messages||[];
          const newest=Math.max(0,...list.map(m=>Number(m.id)));
          const lastSeen=lastSeenRef.current[peer];
          if(lastSeen!==undefined&&newest>lastSeen){
            const inbound=list.find(m=>Number(m.id)>lastSeen&&Number(m.sender)!==Number(currentUser?.id));
            if(inbound&&prefs.desktopNotifications&&'Notification' in window&&Notification.permission==='granted'){
              new Notification(selectedChat.name||'New message',{body:String(inbound.text).slice(0,120)});
              if(prefs.notificationSound==='gentle')try{
                const context=new (window.AudioContext||window.webkitAudioContext)();
                const osc=context.createOscillator(),gain=context.createGain();
                osc.connect(gain);gain.connect(context.destination);
                gain.gain.value=0.04;osc.frequency.value=600;osc.start();osc.stop(context.currentTime+0.1);
                osc.onended=()=>context.close();
              }catch{}
            }
          }
          lastSeenRef.current[peer]=Math.max(lastSeen||0,newest);
          setMessages(previous=>({...previous,[peer]:list.map(m=>({
            id:m.id,text:m.text,sender:Number(m.sender)===Number(currentUser?.id)?'me':String(m.sender),
            timestamp:m.created_at,time:formatMessageTime(m.created_at)
          }))}));
        }catch(e){if(active)setChatError(e.message);}
      }
      poll();const timer=setInterval(poll,8000);
      return ()=>{active=false;clearInterval(timer)};
    },[selectedChat?.id,currentUser?.id,prefs.clock24,prefs.timezone,prefs.desktopNotifications,prefs.notificationSound]);
    const [inputText, setInputText] = useState('');
    const [groups, setGroups] = useState([]);
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedUsersForGroup, setSelectedUsersForGroup] = useState([]);
    const [favorites, setFavorites] = useState([]); 
    const [showChatSettings, setShowChatSettings] = useState(false);
    const [showChatMenu, setShowChatMenu] = useState(false); 
    const [showPeopleMenu, setShowPeopleMenu] = useState(false); 
    const [showSearch, setShowSearch] = useState(false); 

    const [sectionState, setSectionState] = useState({
        favorites: true,
        teams: true,
        groups: true,
        dms: true
    });

    const toggleSection = (section) => {
        setSectionState(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const sendMessage = async () => {
      if(!inputText.trim() || !selectedChat) return;
      if(selectedChat.members){setChatError("Group messaging is not yet available");return;}
      setChatError("");
      try {
        const result=await postMessage(Number(selectedChat.id),inputText.trim());
        setMessages(previous=>({...previous,[selectedChat.id]:[...(previous[selectedChat.id]||[]),{id:result.message.id,text:result.message.text,sender:"me",timestamp:result.message.created_at,time:formatMessageTime(result.message.created_at)}]}));
        lastSeenRef.current[Number(selectedChat.id)]=Math.max(lastSeenRef.current[Number(selectedChat.id)]||0,Number(result.message.id));
        setRecentMap(p=>({...p,[Number(selectedChat.id)]:Date.now()}));
        setInputText("");
      } catch(e){setChatError(e.message||"Message not sent");}
    };
    
    const handleCreateGroup = () => {
        if(!newGroupName || selectedUsersForGroup.length === 0) return;
        const newGroup = { 
            id: `g-${Date.now()}`, 
            name: newGroupName, 
            members: selectedUsersForGroup, 
            type: 'Group' 
        };
        setGroups([...groups, newGroup]);
        setShowCreateGroup(false);
        setNewGroupName('');
        setSelectedUsersForGroup([]);
        setSelectedChat(newGroup);
    };

    // Filter Lists
    const favUsers = users.filter(u => favorites.includes(u.id));
    const dmUsers=users.filter(u=>u.active!==false&&!favorites.includes(u.id)).sort((a,b)=>{
      if(prefs.sort==='recent'){const diff=(recentMap[b.id]||0)-(recentMap[a.id]||0);if(diff)return diff;}
      const aa=String(prefs.sort==='role'?a.role:(prefs.nameDisplay==='email'?a.email:a.name));
      const bb=String(prefs.sort==='role'?b.role:(prefs.nameDisplay==='email'?b.email:b.name));
      return aa.localeCompare(bb);
    }).slice(0,prefs.dmCount);
    const teamsList = groups.filter(g => g.type === 'Team');
    const groupsList = groups.filter(g => g.type === 'Group');

    const renderSidebarItem = (item, isUser = true) => (
        <div key={item.id} className={`p-2 md:p-3 rounded-xl cursor-pointer flex items-center justify-center md:justify-start transition-all ${selectedChat?.id === item.id ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'hover:bg-slate-50'}`} onClick={() => setSelectedChat(item)}>
            <div className="relative shrink-0">
                {isUser ? (
                    <>
                    <UserAvatar name={item.name} src={item.avatar} className="w-10 h-10 text-[10px]" />
                    {prefs.showPresence&&item.status&&<div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${item.status === 'online' ? 'bg-green-500' : item.status === 'busy' ? 'bg-red-500' : 'bg-slate-300'}`}></div>}
                    </>
                ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center text-[10px] font-bold border border-slate-100 shrink-0">
                        {item.type === 'Team' ? <Shield size={14}/> : <Hash size={14}/>}
                    </div>
                )}
            </div>
            <div className="ml-3 hidden md:block overflow-hidden">
                <span className="text-[12px] font-bold block text-slate-800 truncate">{isUser&&prefs.nameDisplay==='email'?item.email:item.name}</span>
                <span className="text-[10px] text-slate-400 font-medium truncate capitalize">{isUser ? item.role : `${item.members.length} members`}</span>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col relative bg-white">
            {showChatSettings && <ChatPreferences userId={currentUser?.id||0} initial={prefs} onSave={setPrefs} onClose={() => setShowChatSettings(false)} />}
            {chatError && <div role="alert" className="p-3 text-sm bg-red-50 text-red-700">{chatError}</div>}
            
            {/* Create Group Modal */}
            {showCreateGroup && (
                <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 shadow-2xl rounded-[2rem] w-full max-w-md p-8 animate-in zoom-in duration-200">
                        {/* ... Create Group Modal Content ... */}
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-lg text-slate-800">Create New Group</h3>
                            <button onClick={()=>setShowCreateGroup(false)}><X className="text-slate-400 hover:text-red-500"/></button>
                        </div>
                        <input className="w-full bg-slate-50 p-4 rounded-xl font-bold text-xs outline-none mb-6 border border-slate-100" placeholder="Group Name" value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} />
                        <div className="mb-6">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Select Members</label>
                            <div className="max-h-48 overflow-y-auto space-y-2">
                                {users.map(u => (
                                    <div key={u.id} onClick={() => {
                                        if(selectedUsersForGroup.includes(u.id)) setSelectedUsersForGroup(prev => prev.filter(id => id !== u.id));
                                        else setSelectedUsersForGroup(prev => [...prev, u.id]);
                                    }} className={`p-3 rounded-xl flex items-center gap-3 cursor-pointer border ${selectedUsersForGroup.includes(u.id) ? 'border-indigo-600 bg-indigo-50' : 'border-transparent hover:bg-slate-50'}`}>
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedUsersForGroup.includes(u.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                                            {selectedUsersForGroup.includes(u.id) && <CheckSquare size={10} className="text-white"/>}
                                        </div>
                                        <UserAvatar name={u.name} src={u.avatar} className="w-6 h-6 text-[8px]"/>
                                        <span className="text-xs font-bold text-slate-700">{u.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button onClick={handleCreateGroup} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-700">Create Group</button>
                    </div>
                </div>
            )}

            <div className="flex-1 flex min-h-0 overflow-hidden">
                {/* Sidebar */}
                <div className="w-20 md:w-80 border-r border-slate-100 bg-white overflow-y-auto flex flex-col z-20">
                    <div className="p-5 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm z-10">
                        <h1 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                            Chats 
                            <span className="text-[9px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-400 font-bold uppercase tracking-wider hidden md:block">Secure</span>
                            <Settings size={14} className="text-slate-400 hover:text-indigo-600 cursor-pointer transition-colors" onClick={() => setShowChatSettings(true)}/>
                        </h1>
                        <button className="md:hidden"><Plus size={18} onClick={()=>setShowCreateGroup(true)}/></button>
                    </div>
                    
                    {/* Sidebar Sections */}
                    <div className="px-5 py-2 hidden md:flex justify-between items-center mt-2">
                        <button onClick={() => toggleSection('favorites')} className="font-bold text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-1 hover:text-slate-600 transition-colors outline-none">
                            <ChevronRight size={10} className={`transition-transform duration-200 ${sectionState.favorites ? 'rotate-90' : ''}`}/>
                            <span className="flex items-center gap-1"><Star size={10}/> Favorites</span>
                        </button>
                    </div>
                    {sectionState.favorites && (
                        <div className="px-3 space-y-1 mb-2 animate-in slide-in-from-top-2 duration-200">
                            {favUsers.map(u => renderSidebarItem(u, true))}
                        </div>
                    )}

                    <div className="px-5 py-2 hidden md:flex justify-between items-center border-t border-slate-50 pt-4 mt-2">
                        <button onClick={() => toggleSection('groups')} className="font-bold text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-1 hover:text-slate-600 transition-colors outline-none">
                            <ChevronRight size={10} className={`transition-transform duration-200 ${sectionState.groups ? 'rotate-90' : ''}`}/>
                            <span className="flex items-center gap-1"><Hash size={10}/> Groups</span>
                        </button>
                        <Plus size={12} className="cursor-pointer hover:text-indigo-600" onClick={()=>setShowCreateGroup(true)}/>
                    </div>
                    {sectionState.groups && (
                        <div className="px-3 space-y-1 mb-2 animate-in slide-in-from-top-2 duration-200">
                            {groupsList.map(g => renderSidebarItem(g, false))}
                        </div>
                    )}

                    <div className="px-5 py-2 hidden md:flex justify-between items-center border-t border-slate-50 pt-4 mt-2">
                        <button onClick={() => toggleSection('dms')} className="font-bold text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-1 hover:text-slate-600 transition-colors outline-none">
                            <ChevronRight size={10} className={`transition-transform duration-200 ${sectionState.dms ? 'rotate-90' : ''}`}/>
                            <span>Direct Messages</span>
                        </button>
                        <button onClick={() => alert("Invite Link Generated")} className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1">
                            <UserPlus size={12}/> Invite
                        </button>
                    </div>
                    {sectionState.dms && (
                        <div className="px-3 space-y-1 mb-4 animate-in slide-in-from-top-2 duration-200">
                            {dmUsers.map(u => renderSidebarItem(u, true))}
                        </div>
                    )}

                     <div className="px-5 py-2 hidden md:flex justify-between items-center border-t border-slate-50 pt-4 mt-2">
                        <button onClick={() => toggleSection('teams')} className="font-bold text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-1 hover:text-slate-600 transition-colors outline-none">
                            <ChevronRight size={10} className={`transition-transform duration-200 ${sectionState.teams ? 'rotate-90' : ''}`}/>
                            <span className="flex items-center gap-1"><Shield size={10}/> Teams</span>
                        </button>
                        <Plus size={12} className="cursor-pointer hover:text-indigo-600" onClick={()=>setShowCreateGroup(true)}/>
                    </div>
                    {sectionState.teams && (
                        <div className="px-3 space-y-1 mb-2 animate-in slide-in-from-top-2 duration-200">
                            {teamsList.map(g => renderSidebarItem(g, false))}
                        </div>
                    )}
                </div>
                
                {/* Chat Area */}
                <div className="flex-1 flex flex-col relative" style={{backgroundColor:chatThemes[prefs.theme]||chatThemes.Quartz,backgroundImage:(chatBackgrounds[prefs.background]||chatBackgrounds.solid).backgroundImage,backgroundSize:(chatBackgrounds[prefs.background]||chatBackgrounds.solid).backgroundSize||"auto"}}>
                    {selectedChat ? (
                        <>
                             {/* Chat Header */}
                            <div className="h-16 px-6 border-b border-slate-200/60 flex justify-between items-center bg-white shadow-sm z-10 relative">
                                <div className="flex items-center gap-4">
                                    <div className="md:hidden"><UserAvatar name={selectedChat.name} src={selectedChat.avatar} className="w-8 h-8 text-[10px]"/></div>
                                    <div>
                                        <span className="font-black text-slate-800 text-sm block">{selectedChat.name}</span>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                            {selectedChat.members ? `${selectedChat.members.length} Participants` : 'Private Conversation'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* ... chat controls ... */}
                                    <button disabled={!!selectedChat.members} title="Call this member" onClick={() => window.dispatchEvent(new CustomEvent("novanexus:call",{detail:{recipientId:selectedChat.id,name:selectedChat.name,audioOnly:true}}))} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><Phone size={18}/></button>
                                    <button disabled={!!selectedChat.members} title="Video call this member" onClick={() => window.dispatchEvent(new CustomEvent("novanexus:call",{detail:{recipientId:selectedChat.id,name:selectedChat.name,audioOnly:false}}))} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><Video size={18}/></button>
                                    
                                    {/* People Menu Button */}
                                    <div className="relative">
                                        <button 
                                            onClick={() => setShowPeopleMenu(!showPeopleMenu)} 
                                            className={`p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all ${showPeopleMenu ? 'bg-indigo-50 text-indigo-600' : ''}`}
                                        >
                                            <UserPlusIcon size={18}/>
                                        </button>
                                        {/* ... People Menu Dropdown ... */}
                                         {showPeopleMenu && (
                                            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                                {/* ... people list content ... */}
                                                 <div className="px-4 py-3 border-b border-slate-50">
                                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">People</h3>
                                                </div>
                                                <div className="py-2 max-h-48 overflow-y-auto">
                                                    <div className="px-4 py-2 hover:bg-slate-50 flex items-center gap-3">
                                                        <UserAvatar name="You" className="w-8 h-8 text-[10px]"/>
                                                        <div className="text-xs font-bold text-slate-700">You</div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="w-px h-6 bg-slate-200 mx-1"></div>
                                    <button className={`p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all ${showSearch ? 'bg-indigo-50 text-indigo-600' : ''}`} onClick={() => setShowSearch(!showSearch)}><Search size={18}/></button>
                                    
                                    <div className="relative">
                                        <button onClick={() => setShowChatMenu(!showChatMenu)} className={`p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all ${showChatMenu ? 'bg-indigo-50 text-indigo-600' : ''}`}><MoreVertical size={18}/></button>
                                        {/* ... Chat Menu Dropdown ... */}
                                         {showChatMenu && (
                                            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                                <div className="py-1">
                                                    <button onClick={() => { startMeeting(`Meeting-${selectedChat.id}`); setShowChatMenu(false); }} className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3"><Calendar size={14}/> Schedule meeting</button>
                                                    <button onClick={() => { startMeeting("unavailable");setShowChatMenu(false); }} className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3"><MonitorUp size={14}/> Screen sharing</button>
                                                    {/* ... other items ... */}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex-1 flex overflow-hidden">
                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {messages[selectedChat.id]?.map((msg, idx) => (
                                        <div key={idx} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[70%] p-4 rounded-2xl text-[12px] font-medium leading-relaxed shadow-sm ${msg.sender === 'me' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-100 text-slate-700 rounded-bl-none'}`}>
                                                {msg.sender !== 'me' && selectedChat.members && <div className="text-[10px] font-bold text-indigo-600 mb-1">{msg.sender}</div>}
                                                {msg.text}
                                                <div className={`mt-1.5 text-[9px] font-bold uppercase tracking-wider opacity-70 text-right ${msg.sender === 'me' ? 'text-indigo-200' : 'text-slate-400'}`}>{msg.time}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {/* Search Sidebar */}
                                {showSearch && (
                                    <div className="w-80 bg-white border-l border-slate-100 flex flex-col animate-in slide-in-from-right duration-200">
                                        <div className="h-16 px-4 border-b border-slate-100 flex items-center justify-between"><span className="text-xs font-bold text-slate-800">Find</span><button onClick={() => setShowSearch(false)}><X size={16} className="text-slate-400"/></button></div>
                                        <div className="p-4"><input className="w-full bg-slate-50 border border-slate-200 rounded-md py-2 px-3 text-xs" placeholder="Search..." /></div>
                                    </div>
                                )}
                            </div>
                            
                            <div className="p-4 bg-white border-t border-slate-200/60">
                                <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-3 max-w-4xl mx-auto w-full">
                                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl flex items-center px-2 focus-within:ring-2 focus-within:ring-indigo-50 focus-within:border-indigo-200 transition-all">
                                        <input className="flex-1 px-3 py-3.5 bg-transparent border-none outline-none text-xs font-medium text-slate-700 placeholder:text-slate-400" placeholder="Type a message..." value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&prefs.sendCtrlEnter){e.preventDefault();if(e.ctrlKey)sendMessage();}}}/>
                                        <button type="button" className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><ImageIcon size={18}/></button>
                                        <button type="button" className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><MessageCircle size={18}/></button>
                                    </div>
                                    <button type="submit" className="bg-indigo-600 w-12 h-12 flex items-center justify-center rounded-xl text-white shadow-lg shadow-indigo-100 hover:scale-105 active:scale-95 transition-all"><Send size={18}/></button>
                                </form>
                            </div>
                        </>
                    ) : ( 
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                             <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-slate-100"><MessageSquare size={40} className="text-slate-200"/></div>
                             <p className="font-bold text-xs uppercase tracking-widest">Select a chat to begin</p>
                        </div> 
                    )}
                </div>
            </div>
        </div>
    );
};

// --- ADMIN CONTROL (Enhanced with Security & Password Reset) ---
const AdminPanel = ({ users, setUsers }) => {
    // ... existing AdminPanel code ...
    const [tab, setTab] = useState('users');
    const [newName, setNewName] = useState(''); 
    const [newEmail, setNewEmail] = useState(''); 
    const [newPassword, setNewPassword] = useState('');
    const [newPolicyName, setNewPolicyName] = useState('');
    const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(true);
    const [waitingRoomMsg, setWaitingRoomMsg] = useState('Please wait, the meeting host will let you in shortly.');
    const [branding, setBranding] = useState({ name: 'Nexus Workspace', siteLogo: null, loginLogo: null, favicon: null });
    const [policies, setPolicies] = useState(MOCK_POLICIES);
    const [showPolicyForm, setShowPolicyForm] = useState(false);
    const [logFilter, setLogFilter] = useState('All');

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
          const result = await provisionUser(newName, newEmail, newPassword);
          setUsers(previous => [...previous, result.user]);
          setNewName(''); setNewEmail(''); setNewPassword('');
          alert('User created successfully');
        } catch (error) { alert(error.message); }
    };

    const handleCreatePolicy = (e) => {
        e.preventDefault();
        if(!newPolicyName) return;
        setPolicies([...policies, { id: Date.now(), name: newPolicyName, description: 'Custom policy set', members: 0, color: 'blue' }]);
        setNewPolicyName('');
        setShowPolicyForm(false);
    };

    const handleResetPassword = (name) => {
        alert('Password resets are disabled until a verified reset flow is implemented.');
    };

    const handleBrandUpload = (key, e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setBranding(prev => ({ ...prev, [key]: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="p-6 md:p-12 h-full max-w-6xl mx-auto overflow-y-auto">
            <header className="mb-10">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase mb-2">Admin Console</h1>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Global Configuration & Security</p>
            </header>
            
            <div className="flex gap-8 border-b border-slate-200 mb-10 overflow-x-auto no-scrollbar">
                {['users', 'groups', 'security', 'meetings', 'branding', 'logs'].map(t=>(
                    <button key={t} onClick={()=>setTab(t)} className={`pb-4 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${tab===t ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>{t}</button>
                ))}
            </div>

            {/* ... tabs content (users, groups, security, meetings, branding, logs) ... */}
            {tab === 'users' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                     {/* ... users tab content ... */}
                     <div className="lg:col-span-1">
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm sticky top-8">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center"><UserPlus size={16} className="mr-3 text-indigo-600"/> Provision Identity</h3>
                            <form onSubmit={handleCreate} className="space-y-4">
                                <input className="w-full bg-slate-50 p-4 rounded-xl text-[11px] font-bold outline-none" placeholder="Display Name" value={newName} onChange={e=>setNewName(e.target.value)} required />
                                <input className="w-full bg-slate-50 p-4 rounded-xl text-[11px] font-bold outline-none" placeholder="Email Address" value={newEmail} onChange={e=>setNewEmail(e.target.value)} required />
                                <input className="w-full bg-slate-50 p-4 rounded-xl text-[11px] font-bold outline-none" type="password" placeholder="Initial Password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required />
                                <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-[9px] uppercase tracking-widest hover:bg-indigo-700">Enroll Member</button>
                            </form>
                        </div>
                    </div>
                    <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                             {/* ... table content ... */}
                            <thead className="bg-slate-50/80 text-slate-400 font-bold uppercase text-[9px] tracking-widest border-b border-slate-100">
                                <tr><th className="p-6 pl-8">Identity</th><th className="p-6">Role</th><th className="p-6 text-right pr-8">Actions</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {users?.map(u => (
                                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-6 pl-8 flex items-center gap-4">
                                            <UserAvatar name={u.name} src={u.avatar} className="w-8 h-8 text-[10px]"/>
                                            <div><div className="font-bold text-slate-700 text-xs">{u.name}</div><div className="text-[9px] text-slate-400">{u.email}</div></div>
                                        </td>
                                        <td className="p-6"><span className={`px-2 py-1 rounded text-[9px] font-bold uppercase ${u.role==='Admin'?'bg-purple-100 text-purple-600':'bg-slate-100 text-slate-500'}`}>{u.role}</span></td>
                                        <td className="p-6 text-right pr-8 flex justify-end gap-2">
                                            <button onClick={()=>handleResetPassword(u.name)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Reset Password"><RotateCcw size={14}/></button>
                                            <button onClick={() => setUsers(users.filter(user => user.id !== u.id))} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    </div>
                </div>
            )}
            
             {tab === 'groups' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-2 space-y-4">
                        {policies.map(policy => (
                            <div key={policy.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center group hover:border-indigo-100 transition-colors">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="font-bold text-slate-800 text-sm">{policy.name}</h3>
                                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide bg-${policy.color}-100 text-${policy.color}-600`}>{policy.members} Members</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-medium">{policy.description}</p>
                                </div>
                                <button className="p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                                    <Edit2 size={16}/>
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm h-fit">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-xs uppercase tracking-widest text-slate-400">New Policy</h3>
                            {showPolicyForm && <button onClick={()=>setShowPolicyForm(false)}><X size={16} className="text-slate-400"/></button>}
                        </div>
                        {showPolicyForm ? (
                            <form onSubmit={handleCreatePolicy} className="space-y-4">
                                <input autoFocus className="w-full bg-slate-50 p-4 rounded-xl text-[11px] font-bold outline-none border border-transparent focus:border-indigo-100 focus:bg-white transition-all" placeholder="Policy Name" value={newPolicyName} onChange={e=>setNewPolicyName(e.target.value)} />
                                <div className="space-y-2">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Permissions</label>
                                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="w-4 h-4 bg-indigo-600 rounded flex items-center justify-center"><CheckSquare size={10} className="text-white"/></div>
                                        <span className="text-[10px] font-bold text-slate-600">Video Access</span>
                                    </div>
                                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 opacity-50">
                                        <div className="w-4 h-4 border-2 border-slate-300 rounded"></div>
                                        <span className="text-[10px] font-bold text-slate-600">Admin Control</span>
                                    </div>
                                </div>
                                <button className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-[9px] uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100">Create Group</button>
                            </form>
                        ) : (
                            <button onClick={()=>setShowPolicyForm(true)} className="w-full border-2 border-dashed border-slate-200 text-slate-400 py-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50 transition-all flex flex-col items-center gap-2">
                                <Plus size={24}/> Create Policy
                            </button>
                        )}
                    </div>
                </div>
            )}
            
            {tab === 'security' && (
                 <div className="grid md:grid-cols-2 gap-8">
                     {/* Security Content */}
                     <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                         <div className="flex items-center gap-4 mb-8">
                             <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Lock size={24}/></div>
                             <div>
                                 <h3 className="font-black text-slate-800">Authentication Policy</h3>
                                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Login & Access Control</p>
                             </div>
                         </div>
                         <div className="space-y-6">
                             <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                 <div>
                                     <div className="font-bold text-xs text-slate-700">Two-Factor Enforcement</div>
                                     <div className="text-[9px] text-slate-400">Require 2FA for all admin accounts</div>
                                 </div>
                                 <div className="w-10 h-6 bg-indigo-600 rounded-full relative cursor-pointer"><div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div></div>
                             </div>
                             <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                 <div>
                                     <div className="font-bold text-xs text-slate-700">Session Timeout</div>
                                     <div className="text-[9px] text-slate-400">Auto-lock after 15 minutes of inactivity</div>
                                 </div>
                                 <div className="w-10 h-6 bg-slate-200 rounded-full relative cursor-pointer"><div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></div></div>
                             </div>
                         </div>
                     </div>
                     <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                         <h3 className="font-black text-slate-800 mb-6">Audit Logs</h3>
                         <div className="space-y-3">
                             {[1,2,3].map(i => (
                                 <div key={i} className="flex gap-4 items-start p-3 border-b border-slate-50 last:border-0">
                                     <div className="mt-1 w-2 h-2 rounded-full bg-orange-400"></div>
                                     <div>
                                         <div className="text-[10px] font-bold text-slate-700">Password Reset Requested</div>
                                         <div className="text-[9px] text-slate-400">User: Alice Chen • IP: 192.168.1.{i+40} • {i}h ago</div>
                                     </div>
                                 </div>
                             ))}
                         </div>
                     </div>
                 </div>
            )}
            
            {tab === 'meetings' && (
                 <div className="grid md:grid-cols-2 gap-8">
                     {/* Meetings Content */}
                     <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                         <div className="flex items-center gap-4 mb-8">
                             <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Clock size={24}/></div>
                             <div>
                                 <h3 className="font-black text-slate-800">Waiting Room</h3>
                                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Guest Access Control</p>
                             </div>
                         </div>
                         <div className="space-y-8">
                             <div className="flex items-center justify-between">
                                 <div>
                                     <div className="font-bold text-xs text-slate-700">Enable Waiting Room</div>
                                     <div className="text-[9px] text-slate-400">All guests enter a holding area before joining</div>
                                 </div>
                                 <div 
                                    onClick={() => setWaitingRoomEnabled(!waitingRoomEnabled)}
                                    className={`w-12 h-7 rounded-full relative cursor-pointer transition-colors ${waitingRoomEnabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                                 >
                                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${waitingRoomEnabled ? 'left-6' : 'left-1'}`}></div>
                                 </div>
                             </div>
                             <div className={`transition-opacity duration-200 ${!waitingRoomEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                                 <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Custom Welcome Message</label>
                                 <textarea 
                                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-50 min-h-[100px] resize-none"
                                    value={waitingRoomMsg}
                                    onChange={(e) => setWaitingRoomMsg(e.target.value)}
                                 />
                             </div>
                             <div className={!waitingRoomEnabled ? 'opacity-50 pointer-events-none' : ''}>
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Branding Asset</label>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300">
                                        <ImageIcon size={20}/>
                                    </div>
                                    <button className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-4 py-3 rounded-xl hover:bg-indigo-100 transition-colors">Upload Logo</button>
                                </div>
                             </div>
                         </div>
                     </div>
                     <div className="bg-zinc-900 p-8 rounded-[3rem] shadow-2xl flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[400px]">
                         <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900 via-zinc-900 to-zinc-950"></div>
                         <div className="relative z-10 p-8 bg-white/10 backdrop-blur-xl rounded-3xl border border-white/10 max-w-xs w-full shadow-2xl">
                             <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl mx-auto mb-4 flex items-center justify-center text-white shadow-lg"><Video size={20}/></div>
                             <h4 className="text-white font-black text-lg mb-2 tracking-tight">{branding.name || 'Nexus'}</h4>
                             {waitingRoomEnabled ? (
                                 <div className="animate-in fade-in zoom-in duration-300">
                                    <div className="text-xs font-bold text-indigo-200 mb-6 uppercase tracking-widest">Waiting for host</div>
                                    <p className="text-[11px] text-zinc-300 leading-relaxed font-medium">{waitingRoomMsg}</p>
                                    <div className="mt-6 flex justify-center gap-1">
                                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"></div>
                                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce delay-75"></div>
                                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce delay-150"></div>
                                    </div>
                                 </div>
                             ) : (
                                 <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest py-8">Waiting room disabled</div>
                             )}
                         </div>
                         <p className="relative z-10 text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-8">Live Preview</p>
                     </div>
                 </div>
            )}
            
            {tab === 'branding' && (
                <div className="max-w-4xl mx-auto">
                    {/* Branding Content */}
                    <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm mb-8">
                        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                            <div>
                                <h3 className="font-black text-lg text-slate-800 tracking-tight">Identity & Assets</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Customize your workspace appearance</p>
                            </div>
                            <button className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg hover:bg-black transition-all w-full md:w-auto">Save Changes</button>
                        </div>
                        <div className="space-y-8">
                            <div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Company Alias</label>
                                <input 
                                    className="w-full p-5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-50 outline-none transition-all" 
                                    value={branding.name}
                                    onChange={(e) => setBranding({...branding, name: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {[
                                    { label: 'Site Logo', icon: <LayoutGrid size={24}/>, key: 'siteLogo', desc: 'Top-left header area' },
                                    { label: 'Login Screen', icon: <Lock size={24}/>, key: 'loginLogo', desc: 'Authentication portal' },
                                    { label: 'Favicon', icon: <GlobeIcon size={24}/>, key: 'favicon', desc: 'Browser tab icon' }
                                ].map((item) => (
                                    <div key={item.key} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col items-center text-center group hover:bg-white hover:border-indigo-100 hover:shadow-lg transition-all relative overflow-hidden">
                                        <input 
                                            type="file" 
                                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                            onChange={(e) => handleBrandUpload(item.key, e)}
                                            accept="image/*"
                                        />
                                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm mb-4 border border-slate-100 group-hover:scale-110 transition-transform">
                                            {branding[item.key] ? <img src={branding[item.key]} className="w-10 h-10 object-contain"/> : item.icon}
                                        </div>
                                        <h4 className="font-bold text-xs text-slate-700 mb-1">{item.label}</h4>
                                        <p className="text-[9px] text-slate-400 font-medium">{item.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {tab === 'logs' && (
                <div className="bg-white p-6 md:p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                    {/* Logs Content */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                        <div>
                            <h3 className="font-black text-lg text-slate-800 tracking-tight">System Logs</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Monitor activity and events</p>
                        </div>
                        <div className="flex gap-4">
                             <button className="px-4 py-2 bg-slate-50 text-slate-500 rounded-xl text-[10px] font-bold uppercase hover:bg-slate-100 transition-colors flex items-center gap-2"><Filter size={12}/> Filter</button>
                             <button className="px-4 py-2 bg-slate-50 text-slate-500 rounded-xl text-[10px] font-bold uppercase hover:bg-slate-100 transition-colors flex items-center gap-2"><Download size={12}/> Export</button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[9px] tracking-widest">
                                <tr>
                                    <th className="p-4 rounded-l-xl pl-8">Event</th>
                                    <th className="p-4">User</th>
                                    <th className="p-4">Type</th>
                                    <th className="p-4">Time</th>
                                    <th className="p-4 rounded-r-xl text-right pr-8">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {MOCK_LOGS.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4 pl-8 font-bold text-xs text-slate-700 min-w-[200px]">{log.event}</td>
                                        <td className="p-4 text-[10px] text-slate-500 font-medium">{log.user}</td>
                                        <td className="p-4"><span className="px-2 py-1 bg-slate-100 rounded text-[8px] font-bold text-slate-500 uppercase tracking-wide">{log.type}</span></td>
                                        <td className="p-4 text-[10px] text-slate-400 whitespace-nowrap">{log.time}</td>
                                        <td className="p-4 text-right pr-8">
                                            <span className={`px-2 py-1 rounded text-[8px] font-bold uppercase tracking-wide flex items-center justify-end gap-1 w-fit ml-auto ${log.status === 'Success' ? 'bg-green-50 text-green-600' : log.status === 'Warning' ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'}`}>
                                                {log.status === 'Success' ? <CheckCircle size={10}/> : <AlertCircle size={10}/>}
                                                {log.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- MAIN APP ---

// Backed by the API. Prototype administrative controls must not appear as operational.
const SecureUserManagement = ({ users, setUsers }) => {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const addUser = async e => {
    e.preventDefault();
    setFeedback('');
    setBusy(true);
    try {
      const body = await provisionUser(form.name, form.email, form.password);
      setUsers(current => [...current, body.user]);
      setForm({ name: '', email: '', password: '' });
      setFeedback('User account created.');
    } catch (error) { setFeedback(error.message); }
    finally { setBusy(false); }
  };
  return (
    <section className="p-6 md:p-12 max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">User Management</h1>
      <p className="text-sm text-slate-600">This section uses the authenticated account directory. Only administrators can create accounts.</p>
      <form onSubmit={addUser} className="grid gap-3 max-w-xl">
        <label htmlFor="admin-name">Full name</label>
        <input id="admin-name" required minLength={2} maxLength={120} className="border rounded-lg p-3" value={form.name} onChange={e => setForm({...form,name:e.target.value})}/>
        <label htmlFor="admin-email">Email address</label>
        <input id="admin-email" required type="email" className="border rounded-lg p-3" value={form.email} onChange={e => setForm({...form,email:e.target.value})}/>
        <label htmlFor="admin-password">Temporary password (at least 8 characters)</label>
        <input id="admin-password" required type="password" minLength={8} autoComplete="new-password" className="border rounded-lg p-3" value={form.password} onChange={e => setForm({...form,password:e.target.value})}/>
        <button type="submit" disabled={busy} className="bg-indigo-600 text-white p-3 rounded-lg disabled:opacity-60">{busy?'Creating account...':'Create account'}</button>
        {feedback && <p role="status" className="text-sm">{feedback}</p>}
      </form>
      <div className="overflow-auto">
        <table className="min-w-full text-sm text-left"><thead><tr className="border-b"><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th></tr></thead>
          <tbody>{users.map(u => <tr key={u.id} className="border-b"><td className="p-3">{u.name}</td><td className="p-3">{u.email}</td><td className="p-3">{u.role}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
};


const ChangeInitialPassword = ({ onComplete }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError('');
    if (newPassword !== repeatPassword) {setError('New passwords must match');return;}
    if (newPassword.length < 8 || newPassword === currentPassword) {setError('Use a different password with at least 8 characters');return;}
    setBusy(true);
    try {
      await rotateInitialPassword(currentPassword,newPassword);
      onComplete();
    } catch(e) {setError(e.message);}
    finally {setBusy(false);}
  }
  return <div className="min-h-screen flex justify-center items-center bg-slate-100 p-4">
    <form onSubmit={submit} className="bg-white rounded-2xl p-8 shadow max-w-md w-full grid gap-4">
      <h1 className="font-bold text-2xl">Change administrator password</h1>
      <p className="text-slate-600 text-sm">The initial admin password must be replaced before accessing NovaNexus. Your session will end after the password is changed.</p>
      <label htmlFor="current-password">Current password</label>
      <input id="current-password" className="border p-3 rounded" type="password" required value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/>
      <label htmlFor="new-password">New password (8+ characters)</label>
      <input id="new-password" className="border p-3 rounded" type="password" minLength={8} required value={newPassword} onChange={e=>setNewPassword(e.target.value)}/>
      <label htmlFor="repeat-password">Confirm new password</label>
      <input id="repeat-password" className="border p-3 rounded" type="password" minLength={8} required value={repeatPassword} onChange={e=>setRepeatPassword(e.target.value)}/>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <button disabled={busy} type="submit" className="bg-indigo-600 text-white p-3 rounded"> {busy?'Changing...':'Change password and sign in again'} </button>
    </form>
  </div>;
};

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('auth'); 
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [adminInitialTab,setAdminInitialTab] = useState('users');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [meetingRoom, setMeetingRoom] = useState(()=>/^\/[0-9]{8}\/?$/.test(window.location.pathname)?window.location.pathname.replaceAll('/',''):'');
  const [meetingOptions,setMeetingOptions]=useState({autoJoin:false,audioOnly:false,callId:null});
  const [users, setUsers] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [workspaceName,setWorkspaceName] = useState('NovaNexus Workspace');
  const [siteLogo,setSiteLogo] = useState('');
  const [visibleSiteLogo,setVisibleSiteLogo] = useState('');
  // Older square logo uploads may contain substantial transparent padding.
  // Trim only transparent edges at display time so existing saved logos fill the navigation header.
  useEffect(()=>{
    if(!siteLogo){setVisibleSiteLogo('');return;}
    let active=true;
    const logo=new Image();
    logo.onload=()=>{
      try{
        const w=logo.naturalWidth,h=logo.naturalHeight;
        if(!w||!h||w*h>12000000){if(active)setVisibleSiteLogo(siteLogo);return;}
        const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        if(!ctx){if(active)setVisibleSiteLogo(siteLogo);return;}
        ctx.drawImage(logo,0,0);
        const pixels=ctx.getImageData(0,0,w,h).data;
        let left=w,top=h,right=-1,bottom=-1;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
          if(pixels[(y*w+x)*4+3]>12){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
        }
        if(right<left||bottom<top){if(active)setVisibleSiteLogo(siteLogo);return;}
        const pad=Math.ceil(Math.max(right-left+1,bottom-top+1)*0.04);
        left=Math.max(0,left-pad);top=Math.max(0,top-pad);right=Math.min(w-1,right+pad);bottom=Math.min(h-1,bottom+pad);
        const trimmed=document.createElement('canvas');trimmed.width=right-left+1;trimmed.height=bottom-top+1;
        trimmed.getContext('2d').drawImage(canvas,left,top,trimmed.width,trimmed.height,0,0,trimmed.width,trimmed.height);
        if(active)setVisibleSiteLogo(trimmed.toDataURL('image/png'));
      }catch{if(active)setVisibleSiteLogo(siteLogo);}
    };
    logo.onerror=()=>{if(active)setVisibleSiteLogo(siteLogo)};
    logo.src=siteLogo;
    return()=>{active=false};
  },[siteLogo]);
  const [brandingVersion,setBrandingVersion] = useState(0);
  useEffect(()=>{const refresh=()=>setBrandingVersion(v=>v+1);window.addEventListener('novanexus:branding-changed',refresh);return()=>window.removeEventListener('novanexus:branding-changed',refresh);},[]);
  useEffect(()=>{if(!user||user.must_change_password)return;fetch('/api/branding',{credentials:'same-origin'}).then(r=>r.json()).then(d=>{if(d?.branding){setWorkspaceName(d.branding.workspace_name||'NovaNexus Workspace');setSiteLogo(d.branding.site_logo||'');document.title=d.branding.workspace_name||'NovaNexus';if(d.branding.favicon){let link=document.querySelector('link[rel="icon"]');if(!link){link=document.createElement('link');link.rel='icon';document.head.appendChild(link);}link.href=d.branding.favicon;}}}).catch(()=>{});},[user,currentTab,brandingVersion]);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pathRoom=/^\/([0-9]{8})\/?$/.exec(window.location.pathname)?.[1];
    const r = pathRoom||params.get('room');
    if (r&&/^[0-9]{8}$/.test(r)) setMeetingRoom(r);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getSession();
        if (active) { setUser(data.user); const requestedRoom=/^\/([0-9]{8})\/?$/.exec(window.location.pathname)?.[1]||new URLSearchParams(window.location.search).get('room');setView(data.user.must_change_password ? 'change-password' : (requestedRoom&&/^[0-9]{8}$/.test(requestedRoom)?'meeting':'dashboard')); }
      } catch (error) {
        console.error('Authentication service unavailable', error);
      } finally {
        if (active) setAuthLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchUsers()
      .then(data => setUsers(data.users))
      .catch(error => console.error(error));
  }, [user]);

  const startMeeting = async (room, options={}) => {
      let id=String(room||'').trim();
      if(!/^[0-9]{8}$/.test(id)){
        if(id && !['unavailable','new'].includes(id) && !/^(Meeting-|Call-|Video-)/.test(id)){
          window.alert('Meeting ID must be exactly 8 digits.');return;
        }
        try {
          const response=await fetch('/api/meetings/create',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'normal'})});
          const data=await response.json();
          if(!response.ok)throw new Error(data.error||'Unable to create meeting');
          id=data.room;
        }catch(error){window.alert(error.message||'Unable to create meeting');return;}
      }
      setMeetingOptions({autoJoin:!!options.autoJoin,audioOnly:!!options.audioOnly,callId:options.callId||null});
      setMeetingRoom(id);
      window.history.pushState({},'', '/'+id);
      setView('meeting');
  };

  const handleUpdateProfile = (updatedUser) => {
      setUser(updatedUser);
  };

  const handleLogout = async () => {
    try { await signOut(); }
    finally { setView('auth'); setUser(null); setUsers([]); }
  };
  
  // Clean handle end call to manage guest vs user redirection
  const handleMeetingEnd = () => {
      if(meetingOptions.callId){
        fetch('/api/calls',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'end',callId:meetingOptions.callId})}).catch(()=>{});
      }
      window.history.replaceState({},'','/');
      setMeetingOptions({autoJoin:false,audioOnly:false,callId:null});
      if (user?.isGuest) {
          setUser(null);
          setView('auth');
      } else {
          setView('dashboard');
      }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center" role="status">Checking your session...</div>;
  if (view === 'change-password') return <ChangeInitialPassword onComplete={() => {setUser(null);setView('auth');}} />;
  if (view === 'auth') return <AuthScreen setUser={setUser} setView={setView} prefilledRoom={meetingRoom} />;
  if (view === 'meeting') return <MeetingRoom roomId={meetingRoom} user={user} onEnd={handleMeetingEnd} autoJoin={meetingOptions.autoJoin} audioOnly={meetingOptions.audioOnly} />; 

  return (
    // ... existing layout code ...
        <div className="h-screen w-full bg-[#f9fafb] flex font-sans text-slate-800 overflow-hidden selection:bg-indigo-100 selection:text-indigo-800 flex-col md:flex-row">
            <CallNotifications user={user} onJoin={startMeeting} />
            {/* Profile Modal */}
          {showProfile && (
              <ProfileSettingsModal 
                  user={user} 
                  onClose={() => setShowProfile(false)} 
                  onUpdate={handleUpdateProfile}
                  onSecurity={() => {setAdminInitialTab('security');setCurrentTab(user?.role==='Admin'?'admin':'security')}}
              />
          )}

          {/* Sidebar - Desktop */}
          <aside className={`bg-white border-r border-slate-100 flex-col justify-between hidden md:flex transition-all duration-300 relative z-20 ${sidebarCollapsed ? 'w-20' : 'w-64'}`}>
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="absolute -right-3 top-10 bg-white border border-slate-200 text-slate-400 p-1.5 rounded-full shadow-sm z-50 hover:text-indigo-600 transition-all hover:scale-110">
                {sidebarCollapsed ? <ChevronRight size={14}/> : <ArrowRight size={14} className="rotate-180"/>}
            </button>
            <div className="pt-8">
              <div className={`flex items-center min-h-24 px-4 pb-8 overflow-hidden ${sidebarCollapsed?'justify-center':'justify-start'}`}>
                {siteLogo
                  ? <img src={visibleSiteLogo||siteLogo} alt={workspaceName} title={workspaceName} className={`block object-contain object-left ${sidebarCollapsed?'max-h-12 max-w-12':'max-h-24 w-full max-w-[224px]'}`}/>
                  : <span className={`font-black tracking-tight text-slate-900 truncate ${sidebarCollapsed?'text-base':'text-lg'}`} title={workspaceName}>{sidebarCollapsed?(workspaceName||'N').slice(0,2):workspaceName}</span>}
              </div>
              <nav className="px-3 space-y-1">
                <NavItem icon={<LayoutGrid />} label="Overview" active={currentTab === 'dashboard'} onClick={() => setCurrentTab('dashboard')} collapsed={sidebarCollapsed} />
                <NavItem icon={<MessageCircle />} label="Chat" active={currentTab === 'chats'} onClick={() => setCurrentTab('chats')} collapsed={sidebarCollapsed} />
                <NavItem icon={<Phone />} label="Calls" active={currentTab === 'calls'} onClick={() => setCurrentTab('calls')} collapsed={sidebarCollapsed} />
                <NavItem icon={<Calendar />} label="Schedule" active={currentTab === 'schedule'} onClick={() => setCurrentTab('schedule')} collapsed={sidebarCollapsed} />
                <NavItem icon={<Sparkles />} label="AI Assistant" active={currentTab === 'ai'} onClick={() => setCurrentTab('ai')} collapsed={sidebarCollapsed} />
                {user?.role === 'Admin' && <NavItem icon={<Shield />} label="Admin" active={currentTab === 'admin'} onClick={() => setCurrentTab('admin')} collapsed={sidebarCollapsed} />}
              </nav>
            </div>
            <div className="p-4 border-t border-slate-50">
                <button onClick={handleLogout} className="w-full flex items-center justify-center p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all group font-bold">
                    <LogOut size={18} className="group-hover:-translate-x-1 transition-transform"/>
                    {!sidebarCollapsed && <span className="ml-3 text-[10px] uppercase tracking-widest font-black">Sign Out</span>}
                </button>
            </div>
          </aside>
          
          {/* Main Content */}
          <main className="flex-1 flex flex-col relative bg-white overflow-hidden h-full pb-20 md:pb-0">
            <header className="h-16 flex items-center justify-between px-6 z-20 border-b border-slate-50 bg-white/80 backdrop-blur-sm sticky top-0 shrink-0">
                <div className="md:hidden text-slate-800 font-black tracking-tighter text-lg uppercase flex items-center gap-2">
                    <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2 rounded-xl text-white shadow-md"><Command size={16} /></div>
                    Nexus
                </div>
                <div className="hidden md:block text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                <div className="flex items-center gap-6">
                    <button type="button" aria-label="Open my profile" onClick={() => setShowProfile(true)} className="flex items-center gap-3 bg-white pl-1.5 pr-4 py-1.5 rounded-full border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group">
                        <UserAvatar name={user?.name} src={user?.avatar} className="w-7 h-7"/>
                        <span className="text-[10px] font-black uppercase text-slate-700 group-hover:text-indigo-600 transition-colors hidden sm:block">{user?.name}</span>
                    </button>
                </div>
            </header>

            <div className={`flex-1 ${currentTab === 'chats' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
                {currentTab === 'dashboard' && (
                    <div className="p-6 md:p-12 max-w-5xl mx-auto space-y-10">
                        <div className="space-y-10">
                        <header>
                            <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-tight mb-2">Welcome back, <span className="text-indigo-600">{user?.name?.split(' ')[0]}.</span></h1>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] flex items-center gap-2"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Authenticated workspace</p>
                        </header>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white cursor-pointer shadow-xl shadow-indigo-200 transition-all hover:scale-[1.02] flex flex-col justify-between h-64 group relative overflow-hidden" onClick={() => startMeeting('unavailable')}>
                                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity"><Video size={140}/></div>
                                <div className="relative z-10"><div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center group-hover:rotate-90 transition-all duration-500 shadow-inner backdrop-blur-md mb-4"><Plus size={24} strokeWidth={3}/></div><h3 className="font-black text-2xl tracking-tighter">Start Video Meeting</h3><p className="text-indigo-100 mt-2 text-[10px] uppercase font-bold tracking-widest opacity-80">Audio • Video • Screen sharing • Up to 1000 participants</p></div>
                            </div>
                            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-center h-64 relative overflow-hidden">
                                <div className="relative z-10"><h3 className="font-black mb-6 text-slate-800 text-[10px] uppercase tracking-[0.3em] flex items-center gap-2"><LinkIcon size={14}/> Join Session</h3><div className="flex flex-col sm:flex-row gap-3"><input placeholder="8-digit meeting number" value={meetingRoom} onChange={e=>setMeetingRoom(e.target.value)} className="flex-1 px-6 py-4 bg-slate-50 border-none rounded-[1.5rem] text-xs outline-none shadow-inner focus:ring-4 focus:ring-indigo-50 transition-all font-bold" /><button onClick={() => startMeeting(meetingRoom)} disabled={!/^[0-9]{8}$/.test(meetingRoom)} className="bg-slate-900 text-white px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-black hover:scale-105 transition-all disabled:opacity-50">Connect</button></div></div>
                            </div>
                        </div>

                        {/* Recent Activity Section */}
                        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                            <div className="p-8 border-b border-slate-50">
                                <h3 className="font-bold text-slate-800 text-sm">Recent Activity</h3><p className="text-xs text-slate-500 mt-2">Activity reporting is not yet connected.</p>
                            </div>
                            <div className="p-2">
                                <table className="w-full text-left">
                                    <tbody className="divide-y divide-slate-50">
                                        {[].map(activity => (
                                            <tr key={activity.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activity.color}`}>
                                                            {activity.icon}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-700 text-xs">{activity.title}</div>
                                                            <div className="text-[9px] text-slate-400 font-medium flex items-center gap-2">
                                                                <span className="capitalize">{activity.type}</span> • {activity.time}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <span className="hidden sm:inline text-[9px] font-bold text-slate-400">{activity.user}</span>
                                                        <UserAvatar name={activity.user} className="w-6 h-6 text-[8px]"/>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Team Directory Section - Box Layout */}
                        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                            <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                                <h3 className="font-bold text-slate-800 text-sm">Active Team Members</h3>
                                <button disabled={user?.role!=='Admin'} title={user?.role==='Admin'?'Open Admin Users to create a member':'Administrator access required'} onClick={()=>setCurrentTab('admin')} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors flex items-center gap-2 disabled:opacity-40">
                                    <UserPlus size={12}/> Add Member
                                </button>
                            </div>
                            <div className="p-2">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50/50 text-slate-400 font-bold uppercase text-[9px] tracking-widest">
                                        <tr>
                                            <th className="px-8 py-4 rounded-l-xl">Identity</th>
                                            <th className="px-6 py-4 hidden sm:table-cell">Role</th>
                                            <th className="px-6 py-4 text-right rounded-r-xl">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {users.slice(0, 5).map(u => (
                                            <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <UserAvatar name={u.name} src={u.avatar} className="w-10 h-10 text-[10px] shadow-sm"/>
                                                        <div>
                                                            <div className="font-bold text-slate-700 text-xs">{u.name}</div>
                                                            <div className="text-[9px] text-slate-400 font-medium">{u.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 hidden sm:table-cell">
                                                    <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-[9px] font-bold uppercase tracking-wider">{u.role}</span>
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <div className="flex items-center justify-end gap-3">
                                                        <span className="text-[10px] font-medium text-slate-400">Member</span>
                                                        <button aria-label={'Call '+u.name} onClick={()=>window.dispatchEvent(new CustomEvent('novanexus:call',{detail:{recipientId:u.id,name:u.name,audioOnly:true}}))} className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-white rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                                            <Phone size={14}/>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        </div>
                    </div>
                )}
                {currentTab === 'chats' && <Messenger startMeeting={startMeeting} users={users} currentUser={user} />}
                {currentTab === 'calls' && <CallsPanel user={user} users={users} />}
                {currentTab === 'security' && <AccountSecurity user={user} />}
                {currentTab === 'schedule' && <SchedulePanel startMeeting={startMeeting} />}
                {currentTab === 'ai' && <WorkspaceAssistant />}
                {currentTab === 'admin' && (user?.role === 'Admin' ? <AdminConsole users={users} setUsers={setUsers} initialTab={adminInitialTab} user={user} /> : <p className="p-12" role="alert">Administrator access required.</p>)}
            </div>
          </main>
          
          {/* Mobile Navigation Bar */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 pb-6 flex justify-around items-center z-50 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)]">
              <button onClick={() => setCurrentTab('dashboard')} className={`flex flex-col items-center gap-1 ${currentTab === 'dashboard' ? 'text-indigo-600' : 'text-slate-400'}`}>
                  <LayoutGrid size={24} />
                  <span className="text-[10px] font-bold">Home</span>
              </button>
              <button onClick={() => setCurrentTab('chats')} className={`flex flex-col items-center gap-1 ${currentTab === 'chats' ? 'text-indigo-600' : 'text-slate-400'}`}>
                  <MessageCircle size={24} />
                  <span className="text-[10px] font-bold">Chat</span>
              </button>
              <button onClick={() => setCurrentTab('calls')} className={`flex flex-col items-center gap-1 ${currentTab === 'calls' ? 'text-indigo-600' : 'text-slate-400'}`}><Phone size={24}/><span className="text-[10px] font-bold">Calls</span></button>
               <button onClick={() => setCurrentTab('schedule')} className={`flex flex-col items-center gap-1 ${currentTab === 'schedule' ? 'text-indigo-600' : 'text-slate-400'}`}>
                  <Calendar size={24} />
                  <span className="text-[10px] font-bold">Plan</span>
              </button>
              {user?.role === 'Admin' && <button onClick={() => setCurrentTab('admin')} className={`flex flex-col items-center gap-1 ${currentTab === 'admin' ? 'text-indigo-600' : 'text-slate-400'}`}>
                  <Shield size={24} />
                  <span className="text-[10px] font-bold">Admin</span>
              </button>}
          </div>
        </div>
  );
}

export default function AppWithBoundary() {
    return <ErrorBoundary><App /></ErrorBoundary>;
}
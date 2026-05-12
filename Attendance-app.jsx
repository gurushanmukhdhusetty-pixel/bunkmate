import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Trash2, Calendar, CheckCircle2, XCircle, AlertTriangle, 
  BookOpen, History, Calculator, Sliders, RefreshCw, Ban, 
  CalendarDays, Edit3, ChevronLeft, Info, Target, MoreVertical,
  Undo2, Settings2, Save, X, ChevronRight, Clock, LogOut, User, Lock, Flame, ShieldCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, onAuthStateChanged, signOut,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, doc, onSnapshot, setDoc, collection 
} from 'firebase/firestore';

const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'bunkmate-pro-v1';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const calculateDetailedStats = (logs, target, totalExpected) => {
  const present = logs.filter(l => l.status === 'present').length;
  const absent = logs.filter(l => l.status === 'absent').length;
  const conducted = present + absent; 
  
  const percentage = conducted === 0 ? 100 : (present / conducted) * 100;
  const remainingInCap = Math.max(0, totalExpected - conducted);
  
  const maxPossible = totalExpected === 0 ? 0 : ((present + remainingInCap) / totalExpected) * 100;
  
  const targetDecimal = target / 100;
  let bunkable = 0;
  let recoup = 0;

  if (percentage >= target) {
    bunkable = Math.floor(present / targetDecimal - conducted);
    bunkable = Math.max(0, Math.min(bunkable, remainingInCap));
  } else {
    recoup = Math.ceil((targetDecimal * conducted - present) / (1 - targetDecimal));
  }

  const isImpossible = maxPossible < target;

  // Streak calculation
  let streak = 0;
  for (let i = 0; i < logs.length; i++) {
    if (logs[i].status === 'present') streak++;
    else if (logs[i].status === 'absent') break;
  }

  return { 
    percentage, bunkable, recoup, conducted, present, absent, 
    remainingInCap, maxPossible, isImpossible, streak
  };
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login', 'signup', 'none'
  const [authError, setAuthError] = useState('');
  
  const [subjects, setSubjects] = useState([]);
  const [timetable, setTimetable] = useState({ Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedSubId, setSelectedSubId] = useState(null);
  const [editingSubject, setEditingSubject] = useState(null);
  
  // Simulator State
  const [simAttend, setSimAttend] = useState(0);
  const [simSkip, setSimSkip] = useState(0);

  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        // We stay at login screen unless user is already cached
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) setAuthMode('none');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'userData', 'main');
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.subjects) setSubjects(data.subjects);
        if (data.timetable) setTimetable(data.timetable);
      }
    }, (error) => console.error("Firestore Error:", error));

    return () => unsubscribe();
  }, [user]);

  const persistData = async (newSubjects, newTimetable) => {
    if (!user) return;
    const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'userData', 'main');
    await setDoc(userDocRef, { 
      subjects: newSubjects || subjects, 
      timetable: newTimetable || timetable,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    const formData = new FormData(e.target);
    const username = formData.get('username').toLowerCase().trim();
    const password = formData.get('password');
    const email = `${username}@bunkmate.app`;

    try {
      if (authMode === 'signup') {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setAuthError(err.message.replace('Firebase:', '').replace('auth/', '').replace(/-/g, ' '));
    }
  };

  const logAttendance = (id, status, isExtra = false, date = new Date().toISOString()) => {
    const newSubjects = subjects.map(s => {
      if (s.id === id) {
        const newLogs = [{ id: Math.random().toString(36).substr(2, 9), date, status, isExtra }, ...s.logs];
        // If it's an extra class that DOESN'T count in cap, we increase the cap effectively
        // but if it's a standard class, it just consumes a slot.
        return { ...s, logs: newLogs };
      }
      return s;
    });
    setSubjects(newSubjects);
    persistData(newSubjects);
  };

  const selectedSubject = useMemo(() => 
    subjects.find(s => s.id === selectedSubId), 
    [subjects, selectedSubId]
  );

  if (authMode !== 'none') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 md:p-12">
        <Card className="w-full max-w-md rounded-[2.5rem] border-none shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
          <CardHeader className="bg-slate-900 text-white p-10 text-center relative">
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/20 rounded-full" />
            <div className="mx-auto w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center mb-4 shadow-xl">
              <ShieldCheck size={32} />
            </div>
            <CardTitle className="text-3xl font-black tracking-tight">BunkMate Pro</CardTitle>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Cloud Sync Enabled</p>
          </CardHeader>
          <CardContent className="p-8">
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Username</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <Input name="username" placeholder="student_name" className="h-14 rounded-2xl bg-slate-100 border-none pl-12 font-bold" required />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <Input name="password" type="password" placeholder="••••••••" className="h-14 rounded-2xl bg-slate-100 border-none pl-12 font-bold" required />
                </div>
              </div>
              {authError && <p className="text-rose-500 text-xs font-bold text-center px-2 animate-bounce">{authError}</p>}
              <Button type="submit" className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-indigo-600 text-white font-black transition-all shadow-lg">
                {authMode === 'login' ? 'Sign In' : 'Create Account'}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="bg-slate-100 p-6 flex justify-center border-t border-slate-200">
            <button 
              onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); }}
              className="text-sm font-black text-slate-500 hover:text-indigo-600 transition-colors"
            >
              {authMode === 'login' ? "Don't have an account? Sign Up" : "Already a user? Sign In"}
            </button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const renderDashboard = () => {
    const totalPresent = subjects.reduce((acc, s) => acc + s.logs.filter(l => l.status === 'present').length, 0);
    const totalConducted = subjects.reduce((acc, s) => acc + s.logs.filter(l => l.status !== 'canceled').length, 0);
    const overallPercent = totalConducted === 0 ? 100 : (totalPresent / totalConducted) * 100;

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 pt-4 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Overview</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`h-2 w-2 rounded-full ${overallPercent >= 75 ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Semester Health: {overallPercent.toFixed(0)}%</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-2xl bg-white shadow-sm h-12 w-12" onClick={() => setActiveTab('settings')}>
              <Settings2 size={20} className="text-slate-500" />
            </Button>
            <Button variant="ghost" className="rounded-2xl bg-white shadow-sm h-12 px-5 font-black text-slate-500" onClick={() => signOut(auth)}>
              <LogOut size={18} className="mr-2" /> Logout
            </Button>
          </div>
        </div>

        {/* Responsive Grid System */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Today's Schedule Card */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2.5rem] border-none text-white shadow-xl overflow-hidden relative min-h-[300px]">
              <div className="absolute -right-10 -bottom-10 opacity-10 rotate-12">
                <Clock size={200} />
              </div>
              <CardHeader className="relative z-10">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] bg-white/20 px-3 py-1 rounded-full font-black uppercase">Schedule Today</span>
                  <Calendar size={18} />
                </div>
                <CardTitle className="text-3xl font-black mt-2">
                  {DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 relative z-10">
                {(() => {
                  const todayName = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
                  const todaysIds = timetable[todayName] || [];
                  if (todaysIds.length === 0) return <p className="text-white/50 font-bold italic py-8 text-center">No classes today. Rest up!</p>;
                  return todaysIds.map((subId, idx) => {
                    const sub = subjects.find(s => s.id === subId);
                    if (!sub) return null;
                    return (
                      <div key={`${subId}-${idx}`} className="flex items-center justify-between p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
                        <div className="font-bold text-sm truncate max-w-[120px]">{sub.name}</div>
                        <div className="flex gap-2">
                          <button onClick={() => logAttendance(sub.id, 'present')} className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"><CheckCircle2 size={18} /></button>
                          <button onClick={() => logAttendance(sub.id, 'absent')} className="h-10 w-10 rounded-xl bg-rose-500 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"><XCircle size={18} /></button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {subjects.length === 0 ? (
              <div className="col-span-full py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200 text-center space-y-4">
                <BookOpen size={48} className="mx-auto text-slate-200" />
                <p className="text-slate-400 font-bold">Your semester is empty.<br/><span className="text-xs">Add subjects in the "Courses" tab to start tracking.</span></p>
                <Button variant="outline" className="rounded-2xl" onClick={() => setActiveTab('subjects')}>Add My First Subject</Button>
              </div>
            ) : subjects.map(subject => {
              const stats = calculateDetailedStats(subject.logs, subject.target, subject.totalExpected);
              const isDanger = stats.percentage < subject.target;
              
              return (
                <Card key={subject.id} className="rounded-[2.5rem] border-none shadow-sm bg-white overflow-hidden ring-1 ring-slate-100 transition-all hover:ring-indigo-100 hover:shadow-md">
                  <CardHeader className="pb-3 flex-row justify-between items-start space-y-0 pt-6">
                    <div className="max-w-[70%]">
                      <CardTitle className="text-xl font-black truncate text-slate-800">{subject.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase">Target: {subject.target}%</span>
                        {stats.streak >= 3 && (
                          <div className="flex items-center gap-1 bg-orange-100 px-2 py-0.5 rounded-full">
                            <Flame size={10} className="text-orange-500 fill-orange-500" />
                            <span className="text-[8px] font-black text-orange-600 uppercase">{stats.streak} Streak</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-black tabular-nums ${isDanger ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {stats.percentage.toFixed(0)}%
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pb-4 px-6">
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${isDanger ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                        style={{ width: `${Math.min(100, stats.percentage)}%` }} 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className={`p-4 rounded-2xl border ${isDanger ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">{!isDanger ? 'Safe to Skip' : 'Must Attend'}</p>
                        <p className={`text-base font-black ${isDanger ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {stats.isImpossible ? 'Impossible' : stats.bunkable > 0 ? `${stats.bunkable} more` : `${stats.recoup} next`}
                        </p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Cap Left</p>
                        <p className="text-base font-black text-slate-800">{stats.remainingInCap}</p>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-slate-50/50 p-2 flex justify-between gap-1 border-t border-slate-100">
                    <Button variant="ghost" size="sm" className="flex-1 rounded-xl font-bold text-[11px] h-10 text-slate-500" onClick={() => { setSelectedSubId(subject.id); setActiveTab('forecast'); }}>
                      <Calculator size={14} className="mr-2" /> Simulator
                    </Button>
                    <Button variant="ghost" size="sm" className="flex-1 rounded-xl font-bold text-[11px] h-10 text-slate-500" onClick={() => { setSelectedSubId(subject.id); setActiveTab('history'); }}>
                      <History size={14} className="mr-2" /> Logs
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderSubjects = () => (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 pt-4 max-w-2xl mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-slate-900">Manage Courses</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="rounded-2xl bg-slate-900 h-12 px-6 font-black"><Plus size={18} className="mr-2" /> Add New</Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] max-w-[90vw] md:max-w-md border-none p-8">
            <DialogHeader><DialogTitle className="text-2xl font-black">Add Subject</DialogTitle></DialogHeader>
            <form className="space-y-5 mt-4" onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.target);
              const name = f.get('name');
              const target = parseInt(f.get('target'));
              const cap = parseInt(f.get('cap'));
              const newSubs = [...subjects, { id: Date.now().toString(), name, target, totalExpected: cap, logs: [] }];
              setSubjects(newSubs);
              await persistData(newSubs);
              e.target.reset();
            }}>
              <Input name="name" placeholder="Course Name" className="h-14 rounded-2xl font-bold bg-slate-50 border-none px-5" required />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Goal %</label>
                  <Input name="target" type="number" defaultValue="75" className="h-14 rounded-2xl font-bold bg-slate-50 border-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Sem Cap</label>
                  <Input name="cap" type="number" placeholder="Total" className="h-14 rounded-2xl font-bold bg-slate-50 border-none" required />
                </div>
              </div>
              <Button type="submit" className="w-full h-14 rounded-2xl bg-indigo-600 font-black text-white shadow-xl">Create Subject</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {subjects.map(s => (
          <div key={s.id} className="bg-white p-5 rounded-[2rem] shadow-sm flex items-center justify-between border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black">{s.name[0]}</div>
              <div>
                <p className="font-bold text-slate-800">{s.name}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Goal: {s.target}% • Cap: {s.totalExpected}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" className="h-10 w-10 text-rose-500" onClick={async () => {
                if(!confirm("Delete this course and all its logs?")) return;
                const newSubs = subjects.filter(x => x.id !== s.id);
                setSubjects(newSubs);
                await persistData(newSubs);
              }}>
                <Trash2 size={18} />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100 max-w-full mx-auto relative pb-28 px-4 md:px-8 overflow-x-hidden">
      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'subjects' && renderSubjects()}
      {activeTab === 'timetable' && (
        <div className="max-w-4xl mx-auto pt-8 pb-20 space-y-8 animate-in fade-in duration-500">
          <h2 className="text-3xl font-black">Weekly Routine</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DAYS.map(day => (
              <Card key={day} className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white">
                <CardHeader className="bg-slate-50 py-4 border-b border-slate-100">
                  <p className="text-xs font-black uppercase text-slate-400 tracking-widest">{day}</p>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  {(timetable[day] || []).map((subId, idx) => {
                    const sub = subjects.find(s => s.id === subId);
                    return (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-sm font-bold text-slate-600 truncate max-w-[120px]">{sub?.name || 'Deleted'}</span>
                        <button onClick={async () => {
                          const newTT = { ...timetable };
                          newTT[day].splice(idx, 1);
                          setTimetable(newTT);
                          await persistData(null, newTT);
                        }} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={14}/></button>
                      </div>
                    );
                  })}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="dashed" className="w-full rounded-2xl h-12 border-2 border-dashed text-slate-400 border-slate-200">
                        <Plus size={16} className="mr-2"/> Add Slot
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-[2.5rem] max-w-[90vw]">
                       <DialogHeader><DialogTitle className="font-black">Add to {day}</DialogTitle></DialogHeader>
                       <div className="grid gap-2 pt-4">
                        {subjects.map(s => (
                          <Button key={s.id} variant="outline" className="h-14 rounded-2xl font-bold justify-between" onClick={async () => {
                            const newTT = { ...timetable };
                            newTT[day] = [...(newTT[day] || []), s.id];
                            setTimetable(newTT);
                            await persistData(null, newTT);
                          }}>{s.name} <ChevronRight size={16}/></Button>
                        ))}
                       </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'forecast' && (
        <div className="max-w-xl mx-auto pt-8 pb-20 space-y-6 animate-in slide-in-from-right-4 duration-500">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="rounded-2xl bg-white shadow-sm" onClick={() => setActiveTab('dashboard')}><ChevronLeft/></Button>
            <h2 className="text-2xl font-black">What-If Calculator</h2>
          </div>
          {selectedSubject ? (() => {
            const stats = calculateDetailedStats(selectedSubject.logs, selectedSubject.target, selectedSubject.totalExpected);
            const vP = stats.present + simAttend;
            const vC = stats.conducted + simAttend + simSkip;
            const vPerc = vC === 0 ? 100 : (vP / vC) * 100;
            return (
              <div className="space-y-6">
                <div className={`p-10 rounded-[3rem] text-white text-center shadow-xl transition-colors duration-500 ${vPerc >= selectedSubject.target ? 'bg-slate-900' : 'bg-rose-600'}`}>
                  <p className="text-[10px] font-black opacity-50 uppercase tracking-widest">Projected Percentage</p>
                  <h3 className="text-6xl font-black tabular-nums">{vPerc.toFixed(1)}%</h3>
                  <p className="text-xs font-bold uppercase mt-2">{vPerc >= selectedSubject.target ? 'Safe Zone' : 'Danger Zone'}</p>
                </div>
                <div className="bg-white p-8 rounded-[3rem] shadow-sm ring-1 ring-slate-100 space-y-8">
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <label className="text-[10px] font-black uppercase text-slate-400">If I go to...</label>
                      <span className="text-lg font-black text-indigo-600">{simAttend} classes</span>
                    </div>
                    <input type="range" min="0" max={stats.remainingInCap} value={simAttend} onChange={e => setSimAttend(parseInt(e.target.value))} className="w-full accent-indigo-600 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer" />
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <label className="text-[10px] font-black uppercase text-slate-400">If I skip...</label>
                      <span className="text-lg font-black text-rose-500">{simSkip} classes</span>
                    </div>
                    <input type="range" min="0" max={Math.max(0, stats.remainingInCap - simAttend)} value={simSkip} onChange={e => setSimSkip(parseInt(e.target.value))} className="w-full accent-rose-500 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer" />
                  </div>
                </div>
              </div>
            );
          })() : <p className="text-center py-20 text-slate-400 font-bold">Select a subject from the dashboard first.</p>}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="max-w-xl mx-auto pt-8 pb-20 space-y-6 animate-in slide-in-from-right-4 duration-500">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="rounded-2xl bg-white shadow-sm" onClick={() => setActiveTab('dashboard')}><ChevronLeft/></Button>
            <h2 className="text-2xl font-black">Past Attendance</h2>
          </div>
          {selectedSubject ? (
            <div className="space-y-4">
              <Card className="bg-white rounded-[2rem] p-6 border-none shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Current History</p>
                  <h3 className="text-2xl font-black text-slate-800">{selectedSubject.logs.length} Total Logs</h3>
                </div>
                <Dialog>
                  <DialogTrigger asChild><Button className="rounded-2xl bg-slate-900 h-12 font-black">Log Past Date</Button></DialogTrigger>
                  <DialogContent className="rounded-[2.5rem] border-none p-8">
                    <form className="space-y-5 pt-4" onSubmit={async (e) => {
                      e.preventDefault();
                      const f = new FormData(e.target);
                      logAttendance(selectedSubject.id, f.get('status'), false, f.get('date'));
                      e.target.reset();
                    }}>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400">Date</label>
                        <Input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="h-14 rounded-2xl bg-slate-100 font-bold" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400">Status</label>
                        <select name="status" className="w-full h-14 rounded-2xl bg-slate-100 px-4 font-bold appearance-none">
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                          <option value="canceled">Canceled</option>
                        </select>
                      </div>
                      <Button type="submit" className="w-full h-14 bg-indigo-600 rounded-2xl font-black">Add Log</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </Card>
              <div className="space-y-3">
                {selectedSubject.logs.map((log) => (
                  <div key={log.id} className="bg-white rounded-3xl p-4 ring-1 ring-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${log.status === 'present' ? 'bg-emerald-50 text-emerald-600' : log.status === 'absent' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                        {log.status === 'present' ? <CheckCircle2 size={18}/> : log.status === 'absent' ? <XCircle size={18}/> : <Ban size={18}/>}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">{new Date(log.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</p>
                        <p className="text-[9px] font-black uppercase text-slate-400">{log.status}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-rose-400" onClick={async () => {
                      const newSubs = subjects.map(s => s.id === selectedSubject.id ? { ...s, logs: s.logs.filter(l => l.id !== log.id) } : s);
                      setSubjects(newSubs);
                      await persistData(newSubs);
                    }}><Trash2 size={16}/></Button>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-center py-20 text-slate-400 font-bold">Select a subject first.</p>}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-xl mx-auto pt-8 pb-20 space-y-6 animate-in fade-in duration-500">
          <h2 className="text-3xl font-black">Settings</h2>
          <Card className="rounded-[2rem] border-none shadow-sm bg-white overflow-hidden">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                <div className="h-12 w-12 bg-indigo-600 rounded-full flex items-center justify-center text-white"><User/></div>
                <div>
                  <p className="font-bold text-slate-800">Logged in as</p>
                  <p className="text-xs text-slate-500 font-bold">{user?.email?.split('@')[0]}</p>
                </div>
              </div>
              <Button variant="outline" className="w-full h-14 rounded-2xl text-rose-500 border-rose-50 font-black" onClick={async () => {
                if(!confirm("Erase all data?")) return;
                setSubjects([]);
                setTimetable({ Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] });
                await persistData([], { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] });
              }}>Reset All Data</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Floating Navigation Dock */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[360px] bg-slate-900/90 backdrop-blur-xl h-20 rounded-[2.5rem] shadow-2xl flex items-center justify-around px-4 border border-white/10 z-50">
        <button onClick={() => setActiveTab('dashboard')} className={`p-4 rounded-2xl transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white'}`}>
          <BookOpen size={22} />
        </button>
        <button onClick={() => setActiveTab('subjects')} className={`p-4 rounded-2xl transition-all ${activeTab === 'subjects' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white'}`}>
          <Target size={22} />
        </button>
        <button onClick={() => setActiveTab('timetable')} className={`p-4 rounded-2xl transition-all ${activeTab === 'timetable' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white'}`}>
          <Calendar size={22} />
        </button>
      </nav>
      <style>{` ::-webkit-scrollbar { width: 0px; } input[type='range']::-webkit-slider-thumb { -webkit-appearance: none; height: 24px; width: 24px; border-radius: 50%; background: #4f46e5; border: 4px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.1); cursor: pointer; } `}</style>
    </div>
  );
}

"use client";
import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, getDocs, collection, query, where, updateDoc, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Settings, Loader2, Save, Plus, CheckCircle2, Circle, AlertCircle, Users, Trash2, Mail, User, ShieldCheck } from "lucide-react";

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Settings Data
  const [currentTerm, setCurrentTerm] = useState("");
  const [termsList, setTermsList] = useState<string[]>([]);
  const [adminsList, setAdminsList] = useState<any[]>([]);
  
  // Form State
  const [newTerm, setNewTerm] = useState("");
  const [adding, setAdding] = useState(false);
  const [savingCurrent, setSavingCurrent] = useState<string | null>(null);
  
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    try {
      const snap = await getDoc(doc(db, "settings", "system"));
      let dataTerms: string[] = [];
      let dataCurrent = "";

      if (snap.exists()) {
        const data = snap.data();
        dataCurrent = data.currentTerm || "";
        dataTerms = data.terms || [];
      }

      // Bootstrap terms from subjects if list is empty
      if (dataTerms.length === 0) {
        const subjectsSnap = await getDocs(collection(db, "subjects"));
        const termsSet = new Set<string>();
        subjectsSnap.forEach((d) => {
          const t = d.data().term;
          if (t) termsSet.add(t);
        });
        
        dataTerms = Array.from(termsSet).sort((a, b) => b.localeCompare(a));
        if (dataCurrent && !dataTerms.includes(dataCurrent)) {
          dataTerms.unshift(dataCurrent);
        }

        // Save bootstrapped data back
        if (dataTerms.length > 0) {
          await setDoc(doc(db, "settings", "system"), {
            currentTerm: dataCurrent || dataTerms[0],
            terms: dataTerms,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          
          if (!dataCurrent) dataCurrent = dataTerms[0];
        }
      }

      // Fetch admins
      const adminQ = query(collection(db, "users"), where("role", "==", "admin"));
      const adminSnap = await getDocs(adminQ);
      const admins: any[] = [];
      adminSnap.forEach((d) => admins.push({ id: d.id, ...d.data() }));

      setAdminsList(admins);
      setTermsList(dataTerms);
      setCurrentTerm(dataCurrent);
    } catch (err) {
      console.error(err);
      setError("ไม่สามารถโหลดข้อมูลการตั้งค่าได้");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewTerm = async () => {
    if (!newTerm.trim()) {
      setError("กรุณาระบุปีการศึกษา/ภาคเรียน");
      return;
    }
    const termValue = newTerm.trim();
    
    if (termsList.includes(termValue)) {
      setError("มีปีการศึกษานี้อยู่ในระบบแล้ว");
      return;
    }

    setAdding(true);
    setError("");

    try {
      const updatedTerms = [termValue, ...termsList].sort((a, b) => b.localeCompare(a));
      
      await setDoc(doc(db, "settings", "system"), {
        terms: updatedTerms,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setTermsList(updatedTerms);
      setNewTerm("");
    } catch (err) {
      console.error(err);
      setError("เกิดข้อผิดพลาดในการเพิ่มปีการศึกษา");
    } finally {
      setAdding(false);
    }
  };

  const handleSetCurrentTerm = async (term: string) => {
    if (term === currentTerm) return;
    
    setSavingCurrent(term);
    setError("");

    try {
      await setDoc(doc(db, "settings", "system"), {
        currentTerm: term,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setCurrentTerm(term);
    } catch (err) {
      console.error(err);
      setError("เกิดข้อผิดพลาดในการตั้งค่าปีปัจจุบัน");
    } finally {
      setSavingCurrent(null);
    }
  };

  const handleAddAdmin = async () => {
    if (!newAdminName.trim() || !newAdminEmail.trim()) {
      setError("กรุณากรอกชื่อและอีเมลให้ครบถ้วน");
      return;
    }
    
    setAddingAdmin(true);
    setError("");

    try {
      const emailQ = query(collection(db, "users"), where("email", "==", newAdminEmail.trim()));
      const snap = await getDocs(emailQ);

      if (!snap.empty) {
        const d = snap.docs[0];
        await updateDoc(doc(db, "users", d.id), { role: "admin" });
        setAdminsList([...adminsList, { id: d.id, ...d.data(), role: "admin" }]);
      } else {
        const newDoc = await addDoc(collection(db, "users"), {
          name: newAdminName.trim(),
          email: newAdminEmail.trim(),
          role: "admin",
          createdAt: new Date().toLocaleString("th-TH")
        });
        setAdminsList([...adminsList, { id: newDoc.id, name: newAdminName.trim(), email: newAdminEmail.trim(), role: "admin" }]);
      }
      setNewAdminName("");
      setNewAdminEmail("");
    } catch (err) {
      console.error(err);
      setError("เกิดข้อผิดพลาดในการเพิ่มผู้ดูแลระบบ");
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleRemoveAdmin = async (id: string, email: string) => {
    if (user?.email === email) {
      alert("ไม่สามารถลบตัวเองออกจากระบบได้");
      return;
    }
    if (!confirm(`ต้องการยกเลิกสิทธิ์ Admin ของ ${email} หรือไม่?`)) return;

    try {
      await updateDoc(doc(db, "users", id), { role: "student" });
      setAdminsList(adminsList.filter(a => a.id !== id));
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการลบผู้ดูแลระบบ");
    }
  };

  return (
    <AppLayout>
      <div className="relative min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-200 overflow-x-hidden pb-12">
        {/* Ambient Glowing Orbs */}
        <div className="absolute top-[3%] left-[10%] w-[45%] h-[45%] rounded-full bg-cyan-500/10 blur-[140px] pointer-events-none -z-0" />
        <div className="absolute top-[35%] right-[10%] w-[35%] h-[35%] rounded-full bg-purple-500/10 blur-[150px] pointer-events-none -z-0" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2.5 mb-6 pb-4 border-b border-slate-800">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">ตั้งค่าระบบ (ปีการศึกษา & สิทธิ์ดูแล)</h2>
              <p className="text-xs text-slate-400">จัดการภาคเรียนปัจจุบันและกำหนดสิทธิ์ผู้ดูแลระบบ</p>
            </div>
          </div>

          {error && (
            <div className="bg-rose-950/40 text-rose-300 border border-rose-500/30 px-4 py-3 rounded-2xl text-xs mb-6 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin"></div>
                <Settings className="w-5 h-5 text-cyan-400 absolute inset-0 m-auto animate-pulse" />
              </div>
              <p className="text-xs font-mono text-slate-400 tracking-wider">กำลังโหลดการตั้งค่า...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Add New Term Form */}
                <div className="glass bg-slate-900/75 rounded-3xl border border-slate-800/90 p-6 md:p-8 flex flex-col h-fit shadow-xl">
                  <h3 className="text-base font-bold text-white mb-1.5 flex items-center gap-2">
                    <span>เพิ่มปีการศึกษาใหม่</span>
                  </h3>
                  <p className="text-xs text-slate-400 mb-6">
                    เพิ่มภาคเรียนหรือปีการศึกษาใหม่เข้าสู่ระบบ เพื่อเตรียมความพร้อมสำหรับการสร้างคลาสเรียนในเทอมถัดไป
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase font-mono">
                        ปีการศึกษา / ภาคเรียน
                      </label>
                      <input
                        type="text"
                        value={newTerm}
                        onChange={(e) => setNewTerm(e.target.value)}
                        placeholder="เช่น 2/2569"
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:outline-none focus:border-cyan-400 text-sm font-mono text-white placeholder-slate-500"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddNewTerm()}
                      />
                    </div>
                    
                    <button
                      onClick={handleAddNewTerm}
                      disabled={adding || !newTerm.trim()}
                      className="w-full bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 px-6 py-3 rounded-xl text-xs font-extrabold transition-all shadow-[0_0_15px_rgba(6,182,212,0.25)] flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                    >
                      {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      <span>บันทึกปีการศึกษาใหม่</span>
                    </button>
                  </div>
                </div>

                {/* Right: List of Terms and Set Current */}
                <div className="glass bg-slate-900/75 rounded-3xl border border-slate-800/90 p-6 md:p-8 flex flex-col shadow-xl">
                  <h3 className="text-base font-bold text-white mb-1.5">เลือกปีการศึกษาปัจจุบัน</h3>
                  <p className="text-xs text-slate-400 mb-6">
                    คลิกเพื่อเลือกปีการศึกษาที่คุณต้องการให้เป็นค่าเริ่มต้นของระบบ ณ ปัจจุบัน
                  </p>
                  
                  <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto max-h-[380px] pr-1">
                    {termsList.length === 0 ? (
                      <div className="text-center py-10 text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                        ยังไม่มีข้อมูลปีการศึกษาในระบบ
                      </div>
                    ) : (
                      termsList.map((term) => (
                        <button
                          key={term}
                          onClick={() => handleSetCurrentTerm(term)}
                          disabled={savingCurrent !== null}
                          className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left ${
                            currentTerm === term
                              ? "border-cyan-500/60 bg-cyan-950/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                              : "border-slate-800/80 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900"
                          }`}
                        >
                          <span className={`font-mono text-sm font-bold ${currentTerm === term ? "text-cyan-300" : "text-slate-300"}`}>
                            ภาคเรียนที่ {term}
                          </span>
                          
                          <div className="flex items-center justify-center w-6 h-6">
                            {savingCurrent === term ? (
                              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                            ) : currentTerm === term ? (
                              <CheckCircle2 className="w-5 h-5 text-cyan-400" />
                            ) : (
                              <Circle className="w-5 h-5 text-slate-600" />
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Admin Management Section */}
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Add New Admin */}
                <div className="glass bg-slate-900/75 rounded-3xl border border-slate-800/90 p-6 md:p-8 shadow-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                      <User className="w-4 h-4" />
                    </div>
                    <h3 className="text-base font-bold text-white">เพิ่มผู้ดูแลระบบ (Admin)</h3>
                  </div>
                  <p className="text-xs text-slate-400 mb-6">ผู้ดูแลระบบจะสามารถจัดการคลาส นิสิต และการตั้งค่าได้</p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase font-mono">ชื่อ-นามสกุล</label>
                      <input
                        type="text"
                        placeholder="เช่น จิรวัฒน์ สุราสา"
                        value={newAdminName}
                        onChange={(e) => setNewAdminName(e.target.value)}
                        className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-400 text-sm text-white placeholder-slate-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase font-mono">อีเมล (ที่ล็อกอินด้วย Google)</label>
                      <input
                        type="email"
                        placeholder="เช่น admin@msu.ac.th"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-400 text-sm font-mono text-white placeholder-slate-500 transition-colors"
                      />
                    </div>
                    <button
                      onClick={handleAddAdmin}
                      disabled={addingAdmin || !newAdminName.trim() || !newAdminEmail.trim()}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 disabled:opacity-50 text-white font-extrabold py-3 px-4 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 mt-2 active:scale-95"
                    >
                      {addingAdmin ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      <span>เพิ่มผู้ดูแลระบบ</span>
                    </button>
                  </div>
                </div>

                {/* Right: List of Admins */}
                <div className="glass bg-slate-900/75 rounded-3xl border border-slate-800/90 p-6 md:p-8 flex flex-col shadow-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                      <Users className="w-4 h-4" />
                    </div>
                    <h3 className="text-base font-bold text-white">รายชื่อผู้ดูแลระบบทั้งหมด</h3>
                  </div>
                  <p className="text-xs text-slate-400 mb-6">ผู้ดูแลระบบปัจจุบันในระบบ</p>
                  
                  <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto max-h-[380px] pr-1">
                    {adminsList.map((admin) => (
                      <div key={admin.id} className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-800/80 bg-slate-950/60 hover:bg-slate-900 transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-900 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-bold overflow-hidden text-xs">
                            {admin.photoURL ? (
                              <img src={admin.photoURL} alt="Admin" className="w-full h-full object-cover" />
                            ) : (
                              admin.name.charAt(0)
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-white text-xs">{admin.name}</p>
                            <p className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                              <Mail className="w-3 h-3 text-cyan-400" /> {admin.email}
                            </p>
                          </div>
                        </div>
                        {user?.email !== admin.email && (
                          <button
                            onClick={() => handleRemoveAdmin(admin.id, admin.email)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 rounded-xl transition-colors border border-transparent hover:border-rose-500/30"
                            title="ยกเลิกสิทธิ์"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

"use client";
import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, getDocs, collection, query, where, deleteDoc, updateDoc, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Settings, Loader2, Save, Plus, CheckCircle2, Circle, AlertCircle, Users, Trash2, Mail, User } from "lucide-react";

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
      const updatedTerms = [termValue, ...termsList].sort((a, b) => b.localeCompare(a)); // keep sorted roughly
      
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
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-6">
          <Settings className="w-6 h-6 text-pink-500" />
          <h2 className="text-lg font-bold text-gray-700">ตั้งค่าระบบ (ปีการศึกษา)</h2>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm mb-4 flex items-center gap-2 border border-red-100">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left: Add New Term Form */}
            <div className="bg-white rounded-3xl shadow-sm border border-pink-100 p-6 md:p-8 flex flex-col h-fit">
              <h3 className="text-lg font-bold text-gray-800 mb-2">เพิ่มปีการศึกษาใหม่</h3>
              <p className="text-sm text-gray-500 mb-6">เพิ่มภาคเรียนหรือปีการศึกษาใหม่เข้าสู่ระบบ เพื่อเตรียมความพร้อมสำหรับการสร้างคลาสเรียนในเทอมถัดไป</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">ปีการศึกษา / ภาคเรียน</label>
                  <input
                    type="text"
                    value={newTerm}
                    onChange={(e) => setNewTerm(e.target.value)}
                    placeholder="เช่น 2/2569"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-pink-400 text-sm font-medium"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNewTerm()}
                  />
                </div>
                
                <button
                  onClick={handleAddNewTerm}
                  disabled={adding || !newTerm.trim()}
                  className="w-full bg-pink-500 hover:bg-pink-600 text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  บันทึกปีการศึกษาใหม่
                </button>
              </div>
            </div>

            {/* Right: List of Terms and Set Current */}
            <div className="bg-white rounded-3xl shadow-sm border border-pink-100 p-6 md:p-8 flex flex-col">
              <h3 className="text-lg font-bold text-gray-800 mb-2">เลือกปีการศึกษาปัจจุบัน</h3>
              <p className="text-sm text-gray-500 mb-6">คลิกเพื่อเลือกปีการศึกษาที่คุณต้องการให้เป็นค่าเริ่มต้นของระบบ ณ ปัจจุบัน</p>
              
              <div className="flex flex-col gap-3 flex-1 overflow-y-auto max-h-[400px] pr-2">
                {termsList.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">
                    ยังไม่มีข้อมูลปีการศึกษาในระบบ
                  </div>
                ) : (
                  termsList.map(term => (
                    <button
                      key={term}
                      onClick={() => handleSetCurrentTerm(term)}
                      disabled={savingCurrent !== null}
                      className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${
                        currentTerm === term
                          ? "border-pink-500 bg-pink-50"
                          : "border-gray-100 hover:border-pink-200 hover:bg-gray-50"
                      }`}
                    >
                      <span className={`font-bold ${currentTerm === term ? "text-pink-600" : "text-gray-700"}`}>
                        ภาคเรียนที่ {term}
                      </span>
                      
                      <div className="flex items-center justify-center w-6 h-6">
                        {savingCurrent === term ? (
                          <Loader2 className="w-5 h-5 text-pink-500 animate-spin" />
                        ) : currentTerm === term ? (
                          <CheckCircle2 className="w-6 h-6 text-pink-500 fill-pink-100" />
                        ) : (
                          <Circle className="w-6 h-6 text-gray-300" />
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
            <div className="bg-white rounded-3xl shadow-sm border border-pink-100 p-6 md:p-8">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-pink-100 flex items-center justify-center text-pink-500">
                  <User className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">เพิ่มผู้ดูแลระบบ (Admin)</h3>
              </div>
              <p className="text-sm text-gray-500 mb-6">ผู้ดูแลระบบจะสามารถจัดการคลาส นิสิต และการตั้งค่าได้</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">ชื่อ-นามสกุล</label>
                  <input
                    type="text"
                    placeholder="เช่น จิรวัฒน์ สุราสา"
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-pink-400 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">อีเมล (ที่ล็อกอินด้วย Google)</label>
                  <input
                    type="email"
                    placeholder="เช่น admin@msu.ac.th"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-pink-400 focus:bg-white transition-colors"
                  />
                </div>
                <button
                  onClick={handleAddAdmin}
                  disabled={addingAdmin || !newAdminName.trim() || !newAdminEmail.trim()}
                  className="w-full bg-pink-500 hover:bg-pink-600 disabled:bg-pink-300 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
                >
                  {addingAdmin ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  เพิ่มผู้ดูแลระบบ
                </button>
              </div>
            </div>

            {/* Right: List of Admins */}
            <div className="bg-white rounded-3xl shadow-sm border border-pink-100 p-6 md:p-8 flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-pink-100 flex items-center justify-center text-pink-500">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">รายชื่อผู้ดูแลระบบทั้งหมด</h3>
              </div>
              <p className="text-sm text-gray-500 mb-6">ผู้ดูแลระบบปัจจุบันในระบบ</p>
              
              <div className="flex flex-col gap-3 flex-1 overflow-y-auto max-h-[400px] pr-2">
                {adminsList.map(admin => (
                  <div key={admin.id} className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 hover:bg-gray-50 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold overflow-hidden">
                        {admin.photoURL ? (
                          <img src={admin.photoURL} alt="Admin" className="w-full h-full object-cover" />
                        ) : (
                          admin.name.charAt(0)
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 text-sm">{admin.name}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1"><Mail className="w-3 h-3" /> {admin.email}</p>
                      </div>
                    </div>
                    {user?.email !== admin.email && (
                      <button
                        onClick={() => handleRemoveAdmin(admin.id, admin.email)}
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
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
    </AppLayout>
  );
}

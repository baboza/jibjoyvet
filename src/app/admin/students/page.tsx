"use client";
import { useState, useEffect, useRef } from "react";
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, addDoc, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import Link from "next/link";
import { Users, Loader2, Plus, Upload, Pencil, Trash2, Search, X, Save, AlertCircle, Eye, Sparkles } from "lucide-react";

interface Student {
  id: string;
  name: string;
  email: string;
  studentId: string;
  role: string;
  photoURL?: string;
}

const EMPTY_FORM = { name: "", email: "", studentId: "" };

export default function AdminStudentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  
  const [showForm, setShowForm] = useState(false);
  const [showCSV, setShowCSV] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    fetchStudents();
  }, [user]);

  const fetchStudents = async () => {
    try {
      const usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "student")));
      const rows: Student[] = [];
      usersSnap.forEach((d) => {
        const data = d.data();
        rows.push({
          id: d.id,
          name: data.name || "",
          email: data.email || "",
          studentId: data.studentId || "",
          role: data.role || "student",
          photoURL: data.photoURL || "",
        });
      });
      rows.sort((a, b) => a.name.localeCompare(b.name, "th"));
      setStudents(rows);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openAddForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  };

  const openEditForm = (s: Student) => {
    setEditingId(s.id);
    setForm({ name: s.name, email: s.email, studentId: s.studentId });
    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(EMPTY_FORM);
    setError("");
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      setError("กรุณากรอกชื่อและอีเมลให้ครบถ้วน");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const data = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        studentId: form.studentId.trim(),
        role: "student",
      };

      if (editingId) {
        await updateDoc(doc(db, "users", editingId), data);
        setStudents((prev) =>
          prev.map((s) => (s.id === editingId ? { ...s, ...data } : s))
        );
      } else {
        const q = query(collection(db, "users"), where("email", "==", data.email));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setError("อีเมลนี้มีอยู่ในระบบแล้ว");
          setSaving(false);
          return;
        }

        const newDoc = await addDoc(collection(db, "users"), {
          ...data,
          createdAt: new Date().toISOString(),
        });
        setStudents((prev) => [
          ...prev,
          { id: newDoc.id, ...data },
        ].sort((a, b) => a.name.localeCompare(b.name, "th")));
      }
      closeForm();
    } catch (err) {
      console.error(err);
      setError("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ต้องการลบนิสิต "${name}" ออกจากระบบหรือไม่?`)) return;
    try {
      await deleteDoc(doc(db, "users", id));
      setStudents((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error(err);
      alert("ลบไม่สำเร็จ กรุณาลองใหม่");
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    setError("");

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      
      let addedCount = 0;
      let skippedCount = 0;

      const existingEmails = new Set(students.map(s => s.email.toLowerCase()));

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        let cols = line.split(",").map(c => c.trim().replace(/^["']|["']$/g, ''));
        if (cols.length < 2) {
          cols = line.split("\t").map(c => c.trim().replace(/^["']|["']$/g, ''));
        }

        if (cols.some(c => c.toLowerCase().includes("email") || c.includes("อีเมล") || c.includes("รหัส"))) {
          continue;
        }

        let studentId = "";
        let name = "";
        let email = "";

        if (cols.length >= 3) {
          studentId = cols[0];
          name = cols[1];
          email = cols[2].toLowerCase();
        } else if (cols.length === 2) {
          name = cols[0];
          email = cols[1].toLowerCase();
        }

        if (!email || !email.includes("@")) {
          skippedCount++;
          continue;
        }

        if (existingEmails.has(email)) {
          skippedCount++;
          continue;
        }

        await addDoc(collection(db, "users"), {
          name,
          email,
          studentId,
          role: "student",
          createdAt: new Date().toISOString()
        });

        existingEmails.add(email);
        addedCount++;
      }

      alert(`นำเข้าสำเร็จ!\nเพิ่มใหม่: ${addedCount} คน\nข้าม (ข้อมูลซ้ำ/ไม่สมบูรณ์): ${skippedCount} คน`);
      setShowCSV(false);
      fetchStudents();
    } catch (err) {
      console.error(err);
      setError("เกิดข้อผิดพลาดในการอ่านไฟล์ CSV");
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filtered = students.filter(
    (s) =>
      s.name.includes(search) ||
      s.email.includes(search) ||
      (s.studentId || "").includes(search)
  );

  const itemsPerPage = 30;
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginatedStudents = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <AppLayout>
      <div className="relative min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-200 overflow-x-hidden pb-12">
        {/* Ambient Glowing Orbs */}
        <div className="absolute top-[3%] left-[10%] w-[45%] h-[45%] rounded-full bg-cyan-500/10 blur-[140px] pointer-events-none -z-0" />
        <div className="absolute top-[35%] right-[10%] w-[35%] h-[35%] rounded-full bg-purple-500/10 blur-[150px] pointer-events-none -z-0" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  รายชื่อนิสิตทั้งหมด
                  <span className="text-xs font-mono font-normal text-slate-400">({students.length} คน)</span>
                </h2>
                <p className="text-xs text-slate-400">จัดการรายชื่อและตรวจสอบประวัติการลงทะเบียนของนิสิต</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCSV(true)}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                <Upload className="w-3.5 h-3.5 text-cyan-400" />
                <span>นำเข้า CSV</span>
              </button>
              <button
                onClick={openAddForm}
                className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-extrabold transition-all shadow-[0_0_15px_rgba(6,182,212,0.25)] active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มนิสิต</span>
              </button>
            </div>
          </div>

          {/* CSV Modal */}
          {showCSV && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <div className="glass bg-slate-950/95 border border-cyan-500/40 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.25)] w-full max-w-md p-6 relative">
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
                  <h3 className="font-bold text-base text-white">นำเข้าข้อมูลนิสิต (CSV)</h3>
                  <button onClick={() => setShowCSV(false)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400 mb-4 space-y-2">
                  <p>ไฟล์ CSV ควรมีโครงสร้างคอลัมน์ดังนี้ (คั่นด้วย comma หรือ tab):</p>
                  <div className="font-mono text-[11px] bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-cyan-300">
                    รหัสนิสิต, ชื่อ-นามสกุล, อีเมล<br/>
                    670101, สมชาย ใจดี, somchai@msu.ac.th<br/>
                    670102, สมหญิง รักเรียน, somying@msu.ac.th
                  </div>
                </div>
                
                <input 
                  type="file" 
                  accept=".csv, .txt, .tsv" 
                  ref={fileInputRef}
                  className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-cyan-500/15 file:text-cyan-300 hover:file:bg-cyan-500/25 cursor-pointer border border-slate-800 rounded-xl mb-4 bg-slate-900"
                />

                {error && <p className="text-rose-400 text-xs mb-4">{error}</p>}

                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setShowCSV(false)} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl">ยกเลิก</button>
                  <button 
                    onClick={() => {
                      if (fileInputRef.current?.files?.length) {
                        handleCSVUpload({ target: fileInputRef.current } as any);
                      } else {
                        setError("กรุณาเลือกไฟล์ก่อน");
                      }
                    }}
                    disabled={saving}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 rounded-xl text-xs font-extrabold hover:from-cyan-400 hover:to-emerald-400 disabled:opacity-50 flex gap-2 items-center shadow-md"
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>อัปโหลด</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add/Edit Modal */}
          {showForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <div className="glass bg-slate-950/95 border border-cyan-500/40 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.25)] w-full max-w-md overflow-hidden relative">
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                  <h3 className="text-base font-bold text-white">{editingId ? "แก้ไขรายชื่อนิสิต" : "เพิ่มรายชื่อนิสิต"}</h3>
                  <button onClick={closeForm} className="p-1.5 rounded-xl hover:bg-slate-900 text-slate-400 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase font-mono">รหัสนิสิต (ถ้ามี)</label>
                    <input
                      type="text"
                      value={form.studentId}
                      onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:outline-none focus:border-cyan-400 text-sm font-mono text-white placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase font-mono">ชื่อ-นามสกุล <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:outline-none focus:border-cyan-400 text-sm text-white placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase font-mono">อีเมล <span className="text-rose-400">*</span></label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      disabled={!!editingId}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:outline-none focus:border-cyan-400 text-sm font-mono text-white disabled:opacity-50 placeholder-slate-500"
                    />
                    {editingId && <p className="text-[11px] text-slate-500 mt-1">ไม่อนุญาตให้แก้ไขอีเมล หากต้องการเปลี่ยนให้ลบแล้วเพิ่มใหม่</p>}
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 bg-rose-950/40 text-rose-300 border border-rose-500/30 rounded-xl px-4 py-2.5 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex gap-2.5 pt-2">
                    <button
                      onClick={closeForm}
                      className="flex-1 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 text-xs font-bold transition-colors"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 text-xs font-extrabold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      <span>บันทึก</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative mb-5">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, อีเมล, รหัสนิสิต..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 focus:outline-none focus:border-cyan-400 text-xs text-white placeholder-slate-500 shadow-lg"
            />
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin"></div>
                <Users className="w-5 h-5 text-cyan-400 absolute inset-0 m-auto animate-pulse" />
              </div>
              <p className="text-xs font-mono text-slate-400 tracking-wider">กำลังโหลดรายชื่อนิสิต...</p>
            </div>
          ) : (
            <div className="glass bg-slate-900/75 rounded-3xl border border-slate-800/90 overflow-hidden shadow-2xl flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-xs whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-950/80 text-cyan-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-800">
                      <th className="text-left px-6 py-4">ชื่อ-นามสกุล</th>
                      <th className="text-left px-6 py-4">รหัสนิสิต</th>
                      <th className="text-left px-6 py-4">อีเมล</th>
                      <th className="text-center px-6 py-4">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {paginatedStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/40 transition-colors group">
                        <td className="px-6 py-4 font-sans font-medium text-white">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-950 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold overflow-hidden shrink-0 text-xs">
                              {s.photoURL ? (
                                <img src={s.photoURL} alt={s.name} className="w-full h-full object-cover" />
                              ) : (
                                s.name.charAt(0) || "S"
                              )}
                            </div>
                            <span className="group-hover:text-cyan-300 transition-colors">{s.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-400">{s.studentId || "–"}</td>
                        <td className="px-6 py-4 text-slate-400">{s.email}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-1.5">
                            <Link
                              href={`/admin/students/${s.id}`}
                              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-950/50 rounded-lg transition-colors border border-transparent hover:border-emerald-500/30"
                              title="ดูโปรไฟล์"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => openEditForm(s)}
                              className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-950/50 rounded-lg transition-colors border border-transparent hover:border-cyan-500/30"
                              title="แก้ไข"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(s.id, s.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 rounded-lg transition-colors border border-transparent hover:border-rose-500/30"
                              title="ลบ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paginatedStudents.length === 0 && (
                      <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-500 font-sans">ไม่พบข้อมูลนิสิต</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/60 text-xs">
                  <span className="text-slate-400 font-mono">
                    แสดง {((currentPage - 1) * itemsPerPage) + 1} ถึง {Math.min(currentPage * itemsPerPage, filtered.length)} จาก {filtered.length} คน
                  </span>
                  <div className="flex items-center gap-2 font-mono">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 disabled:opacity-40 transition-colors"
                    >
                      ก่อนหน้า
                    </button>
                    <span className="font-bold text-slate-200 px-2">
                      หน้า {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 disabled:opacity-40 transition-colors"
                    >
                      ถัดไป
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

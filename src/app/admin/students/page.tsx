"use client";
import { useState, useEffect, useRef } from "react";
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, addDoc, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import Link from "next/link";
import { Users, Loader2, Plus, Upload, Pencil, Trash2, Search, X, Save, AlertCircle, Eye } from "lucide-react";

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
        setStudents((prev) => prev.map(s => s.id === editingId ? { ...s, ...data } : s));
      } else {
        // เช็คก่อนว่ามีอีเมลนี้หรือยัง
        const check = await getDocs(query(collection(db, "users"), where("email", "==", data.email)));
        if (!check.empty) {
          setError("อีเมลนี้มีอยู่ในระบบแล้ว");
          setSaving(false);
          return;
        }

        const newDoc = await addDoc(collection(db, "users"), {
          ...data,
          createdAt: new Date().toISOString()
        });
        
        setStudents(prev => [...prev, { id: newDoc.id, ...data }].sort((a, b) => a.name.localeCompare(b.name, "th")));
      }
      closeForm();
    } catch (err) {
      console.error(err);
      setError("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ต้องการลบผู้ใช้ "${name}" ออกจากระบบใช่หรือไม่?\n(การลบนี้จะไม่ลบข้อมูลการเช็คชื่อในคลาสต่างๆ)`)) return;
    try {
      await deleteDoc(doc(db, "users", id));
      setStudents(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error(err);
      alert("ลบไม่สำเร็จ กรุณาลองใหม่");
    }
  };

  // CSV Import
  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    setError("");
    try {
      const text = await file.text();
      // ง่ายๆ Split ตามบรรทัด
      const lines = text.split("\n").map(l => l.trim()).filter(l => l);
      
      let addedCount = 0;
      let skippedCount = 0;

      // สร้าง Map สำหรับเช็คอีเมลซ้ำจากข้อมูลที่มีอยู่แล้ว
      const existingEmails = new Set(students.map(s => s.email.toLowerCase()));

      for (let i = 0; i < lines.length; i++) {
        // ข้าม header ถ้ามีคำว่า name, email (ทำแบบคร่าวๆ)
        if (i === 0 && (lines[i].toLowerCase().includes("email") || lines[i].toLowerCase().includes("ชื่อ"))) {
          continue;
        }

        // คาดหวังรูปแบบ: รหัสนิสิต, ชื่อ-นามสกุล, อีเมล (หรือแค่ ชื่อ,อีเมล)
        // แยกด้วย comma หรือ tab
        const cols = lines[i].split(/[,|\t]/).map(c => c.trim().replace(/^"|"$/g, ''));
        
        // ลองเดาคอลัมน์
        let studentId = "";
        let name = "";
        let email = "";

        if (cols.length >= 3) {
          studentId = cols[0];
          name = cols[1];
          email = cols[2];
        } else if (cols.length === 2) {
          name = cols[0];
          email = cols[1];
        } else {
          skippedCount++;
          continue;
        }

        if (!name || !email || !email.includes("@")) {
          skippedCount++;
          continue;
        }

        email = email.toLowerCase();

        if (existingEmails.has(email)) {
          skippedCount++;
          continue;
        }

        // บันทึกลง db
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
      fetchStudents(); // reload
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

  // Pagination logic
  const itemsPerPage = 30;
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginatedStudents = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-pink-500" />
            <h2 className="text-lg font-bold text-gray-700">รายชื่อนิสิตทั้งหมด ({students.length})</h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCSV(true)}
              className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 hover:border-pink-300 hover:text-pink-600 px-3 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm"
            >
              <Upload className="w-4 h-4" /> นำเข้า CSV
            </button>
            <button
              onClick={openAddForm}
              className="flex items-center gap-1.5 bg-pink-500 hover:bg-pink-600 text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> เพิ่มนิสิต
            </button>
          </div>
        </div>

        {/* CSV Modal ... (kept unchanged in rendering below) */}
        {showCSV && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">นำเข้าข้อมูลนิสิต (CSV)</h3>
                <button onClick={() => setShowCSV(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm text-gray-500 mb-4 space-y-2">
                <p>ไฟล์ CSV ควรมีโครงสร้างคอลัมน์ดังนี้ (คั่นด้วย comma หรือ tab):</p>
                <div className="font-mono text-xs bg-white p-2 border rounded overflow-x-auto text-gray-700">
                  รหัสนิสิต, ชื่อ-นามสกุล, อีเมล<br/>
                  640101, สมชาย ใจดี, somchai@msu.ac.th<br/>
                  640102, สมหญิง รักเรียน, somying@msu.ac.th
                </div>
              </div>
              
              <input 
                type="file" 
                accept=".csv, .txt, .tsv" 
                ref={fileInputRef}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-600 hover:file:bg-pink-100 cursor-pointer border border-gray-200 rounded-xl mb-4"
              />

              {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className="hidden"
              />

              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCSV(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl">ยกเลิก</button>
                <button 
                  onClick={() => {
                    if (fileInputRef.current?.files?.length) {
                      handleCSVUpload({ target: fileInputRef.current } as any);
                    } else {
                      setError("กรุณาเลือกไฟล์ก่อน");
                    }
                  }}
                  disabled={saving}
                  className="px-4 py-2 bg-pink-500 text-white rounded-xl text-sm font-semibold hover:bg-pink-600 disabled:opacity-50 flex gap-2 items-center"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  อัปโหลด
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-800">{editingId ? "แก้ไขรายชื่อนิสิต" : "เพิ่มรายชื่อนิสิต"}</h3>
                <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">รหัสนิสิต (ถ้ามี)</label>
                  <input
                    type="text"
                    value={form.studentId}
                    onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-pink-400 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">ชื่อ-นามสกุล <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-pink-400 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">อีเมล <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    disabled={!!editingId}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-pink-400 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                  />
                  {editingId && <p className="text-xs text-gray-400 mt-1">ไม่อนุญาตให้แก้ไขอีเมล หากต้องการเปลี่ยนให้ลบแล้วเพิ่มใหม่</p>}
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}
              </div>

              <div className="flex gap-3 p-6 pt-0 mt-4">
                <button
                  onClick={closeForm}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ค้นหาชื่อ, อีเมล, รหัสนิสิต..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1); // รีเซ็ตหน้าเมื่อค้นหาใหม่
            }}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-pink-400 text-sm"
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-pink-400 animate-spin" /></div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-pink-100 overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-pink-50 text-pink-600 text-xs uppercase font-bold">
                    <th className="text-left px-6 py-4">ชื่อ-นามสกุล</th>
                    <th className="text-left px-6 py-4">รหัสนิสิต</th>
                    <th className="text-left px-6 py-4">อีเมล</th>
                    <th className="text-center px-6 py-4">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedStudents.map((s, i) => (
                    <tr key={s.id} className="hover:bg-pink-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold overflow-hidden flex-shrink-0">
                            {s.photoURL ? (
                              <img src={s.photoURL} alt={s.name} className="w-full h-full object-cover" />
                            ) : (
                              s.name.charAt(0) || "S"
                            )}
                          </div>
                          <span className="font-medium text-gray-800">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-500">{s.studentId || "–"}</td>
                      <td className="px-6 py-4 text-gray-500">{s.email}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          <Link
                            href={`/admin/students/${s.id}`}
                            className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                            title="ดูโปรไฟล์"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => openEditForm(s)}
                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title="แก้ไข"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id, s.name)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="ลบ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginatedStudents.length === 0 && (
                    <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400">ไม่พบข้อมูลผู้ใช้</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                <span className="text-sm text-gray-500">
                  แสดง {((currentPage - 1) * itemsPerPage) + 1} ถึง {Math.min(currentPage * itemsPerPage, filtered.length)} จาก {filtered.length} รายการ
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                  >
                    ก่อนหน้า
                  </button>
                  <span className="text-sm font-medium text-gray-700 px-2">
                    หน้า {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                  >
                    ถัดไป
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import Link from "next/link";
import {
  GraduationCap, Loader2, ChevronRight, BookOpen, Users, CheckCircle,
  Clock, XCircle, Plus, Pencil, Trash2, Save, X, AlertCircle
} from "lucide-react";

interface SubjectCard {
  id: string;
  code: string;
  name: string;
  term: string;
  totalSessions: number;
  activeSessions: number;
  totalCheckins: number;
  totalLate: number;
  totalEnrolled: number;
}

const EMPTY_FORM = { code: "", name: "", term: "" };

export default function AdminSessionsPage() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<SubjectCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [currentTerm, setCurrentTerm] = useState("");

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const settingsSnap = await getDoc(doc(db, "settings", "system"));
      const sysTerm = settingsSnap.exists() ? (settingsSnap.data().currentTerm || "") : "";
      setCurrentTerm(sysTerm);

      const subjectsQ = sysTerm 
        ? query(collection(db, "subjects"), where("term", "==", sysTerm))
        : collection(db, "subjects");

      const [subjectsSnap, sessionsSnap, checkinsSnap, enrollmentsSnap] = await Promise.all([
        getDocs(subjectsQ),
        getDocs(collection(db, "sessions")),
        getDocs(collection(db, "checkins")),
        getDocs(collection(db, "enrollments")),
      ]);

      const sessionsBySubject: Record<string, { total: number; active: number }> = {};
      sessionsSnap.forEach((d) => {
        const sid = d.data().subjectId;
        if (!sessionsBySubject[sid]) sessionsBySubject[sid] = { total: 0, active: 0 };
        sessionsBySubject[sid].total++;
        if (d.data().status === "active") sessionsBySubject[sid].active++;
      });

      const sessionToSubject: Record<string, string> = {};
      sessionsSnap.forEach((d) => { sessionToSubject[d.id] = d.data().subjectId; });

      const checkinsBySubject: Record<string, { total: number; late: number }> = {};
      checkinsSnap.forEach((d) => {
        const subjectId = sessionToSubject[d.data().sessionId];
        if (!subjectId) return;
        if (!checkinsBySubject[subjectId]) checkinsBySubject[subjectId] = { total: 0, late: 0 };
        checkinsBySubject[subjectId].total++;
        if (d.data().status === "late") checkinsBySubject[subjectId].late++;
      });

      const enrollBySubject: Record<string, number> = {};
      enrollmentsSnap.forEach((d) => {
        const sid = d.data().subjectId;
        enrollBySubject[sid] = (enrollBySubject[sid] || 0) + 1;
      });

      const cards: SubjectCard[] = [];
      subjectsSnap.forEach((d) => {
        const data = d.data();
        const sessions = sessionsBySubject[d.id] || { total: 0, active: 0 };
        const checkins = checkinsBySubject[d.id] || { total: 0, late: 0 };
        cards.push({
          id: d.id,
          code: data.code,
          name: data.name,
          term: data.term,
          totalSessions: sessions.total,
          activeSessions: sessions.active,
          totalCheckins: checkins.total,
          totalLate: checkins.late,
          totalEnrolled: enrollBySubject[d.id] || 0,
        });
      });

      cards.sort((a, b) => a.code.localeCompare(b.code));
      setSubjects(cards);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- Form handlers ---
  const openAddForm = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, term: currentTerm });
    setFormError("");
    setShowForm(true);
  };

  const openEditForm = (s: SubjectCard) => {
    setEditingId(s.id);
    setForm({ code: s.code, name: s.name, term: s.term });
    setFormError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
  };

  const validate = () => {
    if (!form.code.trim()) return "กรุณากรอกรหัสวิชา";
    if (!form.name.trim()) return "กรุณากรอกชื่อวิชา";
    if (!form.term.trim()) return "กรุณากรอกภาคเรียน";
    return "";
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setFormError(err); return; }

    setSaving(true);
    try {
      const data = {
        code: form.code.trim(),
        name: form.name.trim(),
        term: form.term.trim(),
      };

      if (editingId) {
        await updateDoc(doc(db, "subjects", editingId), data);
        setSubjects((prev) =>
          prev.map((s) => s.id === editingId ? { ...s, ...data } : s)
        );
      } else {
        const newDoc = await addDoc(collection(db, "subjects"), {
          ...data,
          createdAt: new Date().toLocaleString("th-TH"),
        });
        setSubjects((prev) =>
          [...prev, { id: newDoc.id, ...data, totalSessions: 0, activeSessions: 0, totalCheckins: 0, totalLate: 0, totalEnrolled: 0 }]
            .sort((a, b) => a.code.localeCompare(b.code))
        );
      }
      closeForm();
    } catch (err) {
      console.error(err);
      setFormError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string, totalSessions: number) => {
    if (totalSessions > 0) {
      alert(`ไม่สามารถลบวิชา "${name}" ได้ เนื่องจากมีคลาสเรียน ${totalSessions} คลาสอยู่ในวิชานี้\nกรุณาลบคลาสเรียนทั้งหมดก่อน`);
      return;
    }
    if (!confirm(`ต้องการลบวิชา "${name}" ใช่หรือไม่?`)) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, "subjects", id));
      setSubjects((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error(err);
      alert("ลบไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-pink-500" />
            <h2 className="text-lg font-bold text-gray-700">รายวิชาทั้งหมด</h2>
            <span className="text-sm text-gray-400">({subjects.length} วิชา)</span>
          </div>
          <button
            onClick={openAddForm}
            className="flex items-center gap-2 bg-pink-500 hover:bg-pink-600 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            เพิ่มรายวิชา
          </button>
        </div>

        {/* Add/Edit Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
              {/* Modal header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-800">
                  {editingId ? "แก้ไขรายวิชา" : "เพิ่มรายวิชาใหม่"}
                </h3>
                <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form body */}
              <div className="p-6 space-y-4">
                {/* Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">รหัสวิชา</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="เช่น 1801 311"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-pink-400 text-sm font-mono"
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">ชื่อวิชา</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="เช่น วิทยาไวรัสทางสัตวแพทย์"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-pink-400 text-sm"
                  />
                </div>

                {/* Term */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">ภาคเรียน</label>
                  <input
                    type="text"
                    value={form.term}
                    onChange={(e) => setForm({ ...form, term: e.target.value })}
                    placeholder="เช่น 1/2569"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-pink-400 text-sm"
                  />
                </div>

                {/* Error */}
                {formError && (
                  <div className="flex items-center gap-2 bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {formError}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex gap-3 p-6 pt-0">
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
                  {editingId ? "บันทึกการแก้ไข" : "เพิ่มรายวิชา"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Subject Cards */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
          </div>
        ) : subjects.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-pink-100">
            <GraduationCap className="w-12 h-12 text-pink-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">ยังไม่มีรายวิชา</p>
            <button onClick={openAddForm} className="mt-4 text-sm text-pink-500 font-semibold underline">
              เพิ่มวิชาแรก
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {subjects.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl shadow-sm border border-pink-100 hover:shadow-md transition-shadow overflow-hidden group">
                {/* Card Header */}
                <div className="bg-gradient-to-r from-pink-500 to-pink-400 px-5 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-base">{s.code}</p>
                      <p className="text-pink-100 text-xs mt-0.5 leading-relaxed line-clamp-2">{s.name}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 ml-3 flex-shrink-0">
                      <span className="text-pink-200 text-xs">{s.term}</span>
                      {s.activeSessions > 0 && (
                        <span className="bg-green-400 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                          ACTIVE
                        </span>
                      )}
                      {/* Edit / Delete buttons */}
                      <div className="flex gap-1 mt-1">
                        <button
                          onClick={(e) => { e.preventDefault(); openEditForm(s); }}
                          className="p-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
                          title="แก้ไข"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); handleDelete(s.id, s.name, s.totalSessions); }}
                          disabled={deletingId === s.id}
                          className="p-1.5 bg-white/20 hover:bg-red-400/50 text-white rounded-lg transition-colors disabled:opacity-50"
                          title="ลบ"
                        >
                          {deletingId === s.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />
                          }
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card body with stats + link */}
                <Link href={`/admin/sessions/subject/${s.id}`} className="block p-5">
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-800">{s.totalSessions}</p>
                      <p className="text-[10px] text-gray-400">คลาส</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-800">{s.totalEnrolled}</p>
                      <p className="text-[10px] text-gray-400">นิสิต</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-green-600">{s.totalCheckins - s.totalLate}</p>
                      <p className="text-[10px] text-gray-400">ทันเวลา</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-amber-500">{s.totalLate}</p>
                      <p className="text-[10px] text-gray-400">สาย</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{s.totalSessions} คลาสเรียน</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-pink-500 font-medium">
                      ดูคลาสเรียน
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

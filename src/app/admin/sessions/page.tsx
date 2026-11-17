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
        const ref = await addDoc(collection(db, "subjects"), {
          ...data,
          createdAt: new Date().toISOString(),
        });
        setSubjects((prev) => [
          ...prev,
          {
            id: ref.id,
            ...data,
            totalSessions: 0,
            activeSessions: 0,
            totalCheckins: 0,
            totalLate: 0,
            totalEnrolled: 0,
          },
        ].sort((a, b) => a.code.localeCompare(b.code)));
      }
      closeForm();
    } catch (err) {
      console.error(err);
      setFormError("บันทึกไม่สำเร็จ กรุณาลองใหม่");
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
      <div className="relative min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-200 overflow-x-hidden pb-12">
        {/* Ambient Glowing Orbs */}
        <div className="absolute top-[3%] left-[10%] w-[45%] h-[45%] rounded-full bg-cyan-500/10 blur-[140px] pointer-events-none -z-0" />
        <div className="absolute top-[35%] right-[10%] w-[35%] h-[35%] rounded-full bg-purple-500/10 blur-[150px] pointer-events-none -z-0" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 py-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  รายวิชาทั้งหมด
                  <span className="text-xs font-mono font-normal text-slate-400">({subjects.length} วิชา)</span>
                </h2>
                <p className="text-xs text-slate-400">จัดการข้อมูลรายวิชาและคลาสเรียนประจำภาคเรียน</p>
              </div>
            </div>
            <button
              onClick={openAddForm}
              className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs transition-all shadow-[0_0_15px_rgba(6,182,212,0.25)] active:scale-95"
            >
              <Plus className="w-4 h-4" />
              เพิ่มรายวิชา
            </button>
          </div>

          {/* Add/Edit Modal */}
          {showForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <div className="glass bg-slate-950/95 border border-cyan-500/40 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.25)] w-full max-w-md overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

                {/* Modal header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                  <h3 className="text-base font-bold text-white">
                    {editingId ? "แก้ไขรายวิชา" : "เพิ่มรายวิชาใหม่"}
                  </h3>
                  <button onClick={closeForm} className="p-1.5 rounded-xl hover:bg-slate-900 text-slate-400 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form body */}
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase font-mono">รหัสวิชา</label>
                    <input
                      type="text"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      placeholder="เช่น 1801 311"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:outline-none focus:border-cyan-400 text-sm font-mono text-white placeholder-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase font-mono">ชื่อวิชา</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="เช่น ไวรัสวิทยาสัตวแพทย์"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:outline-none focus:border-cyan-400 text-sm text-white placeholder-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase font-mono">ภาคเรียน</label>
                    <input
                      type="text"
                      value={form.term}
                      onChange={(e) => setForm({ ...form, term: e.target.value })}
                      placeholder="เช่น 1/2569"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:outline-none focus:border-cyan-400 text-sm font-mono text-white placeholder-slate-500"
                    />
                  </div>

                  {formError && (
                    <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-950/40 border border-rose-500/30 p-3 rounded-xl">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={closeForm}
                      className="flex-1 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 text-xs font-bold transition-colors"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 text-xs font-extrabold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>กำลังบันทึก...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>บันทึก</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Subject Cards */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin"></div>
                <GraduationCap className="w-5 h-5 text-cyan-400 absolute inset-0 m-auto animate-pulse" />
              </div>
              <p className="text-xs font-mono text-slate-400 tracking-wider">กำลังโหลดรายวิชา...</p>
            </div>
          ) : subjects.length === 0 ? (
            <div className="glass bg-slate-900/60 rounded-3xl p-12 text-center border border-slate-800 shadow-xl">
              <GraduationCap className="w-12 h-12 text-cyan-400/40 mx-auto mb-3" />
              <p className="text-slate-300 font-bold text-sm">ยังไม่มีรายวิชาในระบบ</p>
              <button onClick={openAddForm} className="mt-3 text-xs text-cyan-400 hover:text-cyan-300 font-bold underline">
                + เพิ่มวิชาแรก
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subjects.map((s) => (
                <div key={s.id} className="glass bg-slate-900/75 rounded-3xl border border-slate-800/90 hover:border-cyan-500/50 transition-all duration-300 shadow-xl overflow-hidden group">
                  <div className="bg-slate-900/90 border-b border-slate-800 px-5 py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-500/30 text-cyan-300">
                          {s.code}
                        </span>
                        <p className="text-white font-bold text-sm mt-1.5 leading-relaxed line-clamp-2 group-hover:text-cyan-200 transition-colors">
                          {s.name}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 ml-3 shrink-0">
                        <span className="text-slate-400 text-xs font-mono">{s.term}</span>
                        {s.activeSessions > 0 && (
                          <span className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold font-mono animate-pulse">
                            ACTIVE
                          </span>
                        )}
                        <div className="flex gap-1 mt-1">
                          <button
                            onClick={(e) => { e.preventDefault(); openEditForm(s); }}
                            className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 rounded-lg transition-colors border border-slate-700/60"
                            title="แก้ไข"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.preventDefault(); handleDelete(s.id, s.name, s.totalSessions); }}
                            disabled={deletingId === s.id}
                            className="p-1.5 bg-slate-800/80 hover:bg-rose-950/80 text-slate-300 hover:text-rose-300 rounded-lg transition-colors border border-slate-700/60 disabled:opacity-50"
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

                  <Link href={`/admin/sessions/subject/${s.id}`} className="block p-5 hover:bg-slate-900/50 transition-colors">
                    <div className="grid grid-cols-4 gap-2 mb-3 font-mono">
                      <div className="text-center p-2 rounded-xl bg-slate-950/60 border border-slate-800/60">
                        <p className="text-lg font-bold text-white">{s.totalSessions}</p>
                        <p className="text-[10px] text-slate-400 font-sans">คลาส</p>
                      </div>
                      <div className="text-center p-2 rounded-xl bg-slate-950/60 border border-slate-800/60">
                        <p className="text-lg font-bold text-cyan-300">{s.totalEnrolled}</p>
                        <p className="text-[10px] text-slate-400 font-sans">นิสิต</p>
                      </div>
                      <div className="text-center p-2 rounded-xl bg-slate-950/60 border border-slate-800/60">
                        <p className="text-lg font-bold text-emerald-400">{s.totalCheckins - s.totalLate}</p>
                        <p className="text-[10px] text-slate-400 font-sans">ทันเวลา</p>
                      </div>
                      <div className="text-center p-2 rounded-xl bg-slate-950/60 border border-slate-800/60">
                        <p className="text-lg font-bold text-amber-400">{s.totalLate}</p>
                        <p className="text-[10px] text-slate-400 font-sans">สาย</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{s.totalSessions} คลาสเรียน</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-cyan-400 font-bold group-hover:translate-x-1 transition-transform">
                        <span>ดูคลาสเรียน</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc, query, where, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ChevronRight, Loader2, CheckCircle, Clock, XCircle,
  Users, AlertCircle, MapPin, Calendar, Plus, X, Save, Sparkles, BookOpen
} from "lucide-react";

interface SessionItem {
  id: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  lateTime: string;
  status: string;
  locationName: string;
  locationId: string;
  checkedIn: number;
  late: number;
  totalEnrolled: number;
}

interface LocationItem {
  id: string;
  name: string;
}

const EMPTY_FORM = {
  sessionDate: "",
  startTime: "",
  endTime: "",
  lateTime: "",
  locationId: "",
  status: "active",
};

export default function SubjectSessionsPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const subjectId = params.subjectId as string;

  const [subject, setSubject] = useState<any>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    fetchData();
  }, [user, subjectId]);

  const fetchData = async () => {
    try {
      const subjectSnap = await getDoc(doc(db, "subjects", subjectId));
      if (subjectSnap.exists()) setSubject(subjectSnap.data());

      const sessionsSnap = await getDocs(
        query(collection(db, "sessions"), where("subjectId", "==", subjectId))
      );

      const locationsSnap = await getDocs(collection(db, "locations"));
      const locList: LocationItem[] = [];
      const locMap: Record<string, string> = {};
      locationsSnap.forEach((d) => {
        locList.push({ id: d.id, name: d.data().name });
        locMap[d.id] = d.data().name;
      });
      setLocations(locList.sort((a, b) => a.name.localeCompare(b.name, "th")));

      const enrollSnap = await getDocs(
        query(collection(db, "enrollments"), where("subjectId", "==", subjectId))
      );
      const totalEnrolled = enrollSnap.size;

      const allCheckinsSnap = await getDocs(collection(db, "checkins"));
      const checkinBySession: Record<string, { total: number; late: number }> = {};
      allCheckinsSnap.forEach((d) => {
        const sid = d.data().sessionId;
        if (!checkinBySession[sid]) checkinBySession[sid] = { total: 0, late: 0 };
        checkinBySession[sid].total++;
        const raw = (d.data().status || "").toLowerCase().replace(/_/g, "-");
        if (raw === "late") checkinBySession[sid].late++;
      });

      const rows: SessionItem[] = [];
      sessionsSnap.forEach((d) => {
        const data = d.data();
        const checkins = checkinBySession[d.id] || { total: 0, late: 0 };
        rows.push({
          id: d.id,
          sessionDate: data.sessionDate,
          startTime: data.startTime,
          endTime: data.endTime,
          lateTime: data.lateTime,
          status: data.status,
          locationId: data.locationId,
          locationName: locMap[data.locationId] || "ไม่ทราบสถานที่",
          checkedIn: checkins.total,
          late: checkins.late,
          totalEnrolled,
        });
      });

      rows.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
      setSessions(rows);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openAddForm = () => {
    const today = new Date().toISOString().slice(0, 10);
    setForm({ ...EMPTY_FORM, sessionDate: today });
    setFormError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setFormError("");
  };

  const validateForm = () => {
    if (!form.sessionDate) return "กรุณาเลือกวันที่";
    if (!form.startTime) return "กรุณาเลือกเวลาเริ่ม";
    if (!form.endTime) return "กรุณาเลือกเวลาสิ้นสุด";
    if (!form.lateTime) return "กรุณาเลือกเวลาสาย";
    if (!form.locationId) return "กรุณาเลือกสถานที่";
    if (form.startTime >= form.endTime) return "เวลาเริ่มต้องก่อนเวลาสิ้นสุด";
    return "";
  };

  const handleSave = async () => {
    const err = validateForm();
    if (err) { setFormError(err); return; }

    setSaving(true);
    try {
      const data = {
        subjectId,
        sessionDate: form.sessionDate,
        startTime: form.startTime,
        endTime: form.endTime,
        lateTime: form.lateTime,
        locationId: form.locationId,
        status: form.status,
        createdAt: new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
      };

      const newDoc = await addDoc(collection(db, "sessions"), data);
      
      const locName = locations.find(l => l.id === form.locationId)?.name || "ไม่ทราบสถานที่";
      const totalEnrolled = sessions.length > 0 ? sessions[0].totalEnrolled : 0;

      setSessions((prev) => {
        const next = [...prev, {
          id: newDoc.id,
          ...data,
          locationName: locName,
          checkedIn: 0,
          late: 0,
          totalEnrolled,
        }];
        return next.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
      });

      closeForm();
    } catch (err) {
      console.error(err);
      setFormError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  };

  const onTime = (s: SessionItem) => s.checkedIn - s.late;
  const absent = (s: SessionItem) => Math.max(0, s.totalEnrolled - s.checkedIn);

  return (
    <AppLayout>
      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-[140px]" />
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all shadow-sm"
              aria-label="ย้อนกลับ"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              {subject ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                      {subject.code}
                    </span>
                    <span className="text-xs text-slate-400">ภาคเรียน {subject.term}</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {subject.name}
                  </h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ทั้งหมด {sessions.length} คลาสเรียนในวิชานี้
                  </p>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="h-5 w-48 bg-slate-800 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-slate-800/60 rounded animate-pulse" />
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={openAddForm}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-cyan-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            เพิ่มคลาสเรียน
          </button>
        </div>

        {/* Add Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <div className="bg-slate-900/95 border border-slate-800 rounded-3xl shadow-2xl shadow-cyan-950/50 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur-xl z-10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Plus className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-bold text-white">เพิ่มคลาสเรียนใหม่</h3>
                </div>
                <button
                  onClick={closeForm}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    วันที่เรียน
                  </label>
                  <input
                    type="date"
                    value={form.sessionDate}
                    onChange={(e) => setForm({ ...form, sessionDate: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:outline-none focus:border-cyan-500/60 text-slate-100 text-sm"
                  />
                </div>

                {/* Times */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                      เวลาเริ่ม
                    </label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:outline-none focus:border-cyan-500/60 text-slate-100 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                      เวลาสิ้นสุด
                    </label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:outline-none focus:border-cyan-500/60 text-slate-100 text-sm"
                    />
                  </div>
                </div>

                {/* Late limit */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    สายหลังเวลา
                  </label>
                  <input
                    type="time"
                    value={form.lateTime}
                    onChange={(e) => setForm({ ...form, lateTime: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:outline-none focus:border-cyan-500/60 text-slate-100 text-sm"
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    สถานที่เรียน
                  </label>
                  {locations.length === 0 ? (
                    <div className="text-sm text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                      ยังไม่มีสถานที่ในระบบ กรุณาเพิ่มสถานที่ก่อน
                    </div>
                  ) : (
                    <select
                      value={form.locationId}
                      onChange={(e) => setForm({ ...form, locationId: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:outline-none focus:border-cyan-500/60 text-slate-100 text-sm"
                    >
                      <option value="" className="bg-slate-900">-- เลือกสถานที่ --</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id} className="bg-slate-900">{loc.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    สถานะการเช็คชื่อ
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:outline-none focus:border-cyan-500/60 text-slate-100 text-sm"
                  >
                    <option value="active" className="bg-slate-900">เปิดรับเช็คชื่อ (Active)</option>
                    <option value="inactive" className="bg-slate-900">ปิดรับเช็คชื่อ (Inactive)</option>
                  </select>
                </div>

                {/* Error */}
                {formError && (
                  <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl px-4 py-3 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {formError}
                  </div>
                )}
              </div>

              <div className="flex gap-3 p-6 pt-0 sticky bottom-0 bg-slate-900/95 border-t border-slate-800/80 mt-4 pb-6">
                <button
                  onClick={closeForm}
                  className="flex-1 py-2.5 rounded-xl border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800/60 text-sm font-semibold transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || locations.length === 0}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-cyan-500/20"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  บันทึกคลาส
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Summary stats */}
        {!loading && sessions.length > 0 && (
          <div className="bg-slate-900/75 border border-slate-800 backdrop-blur-xl rounded-2xl shadow-xl shadow-black/20 p-5 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-800">
            {[
              { label: "คลาสทั้งหมด", value: sessions.length, color: "text-white" },
              { label: "นิสิตลงทะเบียน", value: sessions[0]?.totalEnrolled || 0, color: "text-cyan-400" },
              { label: "เช็คชื่อรวม", value: sessions.reduce((s, r) => s + r.checkedIn, 0), color: "text-emerald-400" },
              { label: "สายรวม", value: sessions.reduce((s, r) => s + r.late, 0), color: "text-amber-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center pt-3 md:pt-0 md:px-3">
                <p className={`text-2xl lg:text-3xl font-extrabold ${color} font-mono tracking-tight`}>{value}</p>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Session list */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="text-xs text-slate-400 font-mono">กำลังโหลดคลาสเรียน...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-14 text-center">
            <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">ยังไม่มีคลาสเรียนในวิชานี้</p>
            <p className="text-xs text-slate-600 mt-1">กดปุ่ม "เพิ่มคลาสเรียน" ด้านบนเพื่อเริ่มกำหนดตารางเรียน</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map((s, i) => {
              const attendanceRate = s.totalEnrolled ? Math.round((s.checkedIn / s.totalEnrolled) * 100) : 0;
              return (
                <Link
                  key={s.id}
                  href={`/admin/sessions/${s.id}`}
                  className="bg-slate-900/75 border border-slate-800 hover:border-cyan-500/40 rounded-2xl transition-all duration-200 group overflow-hidden shadow-lg shadow-black/20 hover:shadow-cyan-950/20"
                >
                  <div className="flex items-stretch">
                    {/* Index + status accent strip */}
                    <div
                      className={`w-1.5 flex-shrink-0 transition-colors ${
                        s.status === "active"
                          ? "bg-gradient-to-b from-emerald-400 to-cyan-500"
                          : "bg-slate-800"
                      }`}
                    />

                    <div className="flex-1 p-5">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        {/* Left: date + info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-white flex items-center gap-2 group-hover:text-cyan-300 transition-colors text-base">
                              <Calendar className="w-4 h-4 text-cyan-400" />
                              คลาสที่ {sessions.length - i} — {s.sessionDate}
                            </span>
                            {s.status === "active" ? (
                              <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                                ACTIVE
                              </span>
                            ) : (
                              <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">
                                CLOSED
                              </span>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-mono">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-cyan-400" /> {s.startTime} – {s.endTime}
                            </span>
                            <span className="flex items-center gap-1.5 text-amber-400/90">
                              <AlertCircle className="w-3.5 h-3.5" /> สายหลัง {s.lateTime}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2">
                            <MapPin className="w-3.5 h-3.5 text-slate-500" />
                            <span>{s.locationName}</span>
                          </div>
                        </div>

                        {/* Right: attendance chips */}
                        <div className="flex flex-col sm:items-end gap-2 flex-shrink-0">
                          <div className="flex flex-wrap gap-1.5">
                            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                              <CheckCircle className="w-3 h-3" />
                              {onTime(s)} ตรงเวลา
                            </span>
                            <span className="flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                              <Clock className="w-3 h-3" />
                              {s.late} สาย
                            </span>
                            <span className="flex items-center gap-1 text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg">
                              <XCircle className="w-3 h-3" />
                              {absent(s)} ขาด
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-400 font-mono">
                            <Users className="w-3.5 h-3.5 text-slate-500" />
                            <span>{s.checkedIn} จาก {s.totalEnrolled} คน</span>
                          </div>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-4 pt-3 border-t border-slate-800/80">
                        <div className="flex justify-between items-center text-[11px] mb-1.5">
                          <span className="text-slate-400 font-mono">อัตราการเข้าเรียน</span>
                          <span className="text-cyan-400 font-mono font-bold">{attendanceRate}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full transition-all duration-300"
                            style={{ width: `${attendanceRate}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center pr-4">
                      <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

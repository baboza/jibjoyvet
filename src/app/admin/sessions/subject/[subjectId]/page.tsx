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
  Users, AlertCircle, MapPin, Calendar, Plus, X, Save
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
    // Set default date to today
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
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl hover:bg-pink-100 text-gray-500 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              {subject ? (
                <>
                  <h1 className="text-lg font-bold text-gray-800">{subject.code} — {subject.name}</h1>
                  <p className="text-sm text-gray-400">ภาคเรียน {subject.term} · {sessions.length} คลาสเรียน</p>
                </>
              ) : (
                <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
              )}
            </div>
          </div>
          
          <button
            onClick={openAddForm}
            className="flex items-center gap-2 bg-pink-500 hover:bg-pink-600 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            เพิ่มคลาส
          </button>
        </div>

        {/* Add Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
                <h3 className="text-lg font-bold text-gray-800">เพิ่มคลาสเรียนใหม่</h3>
                <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">วันที่เรียน</label>
                  <input
                    type="date"
                    value={form.sessionDate}
                    onChange={(e) => setForm({ ...form, sessionDate: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-pink-400 text-sm"
                  />
                </div>

                {/* Times */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">เวลาเริ่ม</label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-pink-400 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">เวลาสิ้นสุด</label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-pink-400 text-sm"
                    />
                  </div>
                </div>

                {/* Late limit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">สายหลังเวลา</label>
                  <input
                    type="time"
                    value={form.lateTime}
                    onChange={(e) => setForm({ ...form, lateTime: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-pink-400 text-sm"
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">สถานที่เรียน</label>
                  {locations.length === 0 ? (
                    <div className="text-sm text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">
                      ยังไม่มีสถานที่ในระบบ กรุณาเพิ่มสถานที่ก่อน
                    </div>
                  ) : (
                    <select
                      value={form.locationId}
                      onChange={(e) => setForm({ ...form, locationId: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-pink-400 text-sm bg-white"
                    >
                      <option value="">-- เลือกสถานที่ --</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">สถานะการเช็คชื่อ</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-pink-400 text-sm bg-white"
                  >
                    <option value="active">เปิดรับเช็คชื่อ (Active)</option>
                    <option value="inactive">ปิดรับเช็คชื่อ</option>
                  </select>
                </div>

                {/* Error */}
                {formError && (
                  <div className="flex items-center gap-2 bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {formError}
                  </div>
                )}
              </div>

              <div className="flex gap-3 p-6 pt-0 sticky bottom-0 bg-white border-t border-gray-50 mt-4 pb-6">
                <button
                  onClick={closeForm}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || locations.length === 0}
                  className="flex-1 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  บันทึกคลาส
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Summary bar */}
        {!loading && sessions.length > 0 && (
          <div className="bg-white rounded-2xl border border-pink-100 shadow-sm p-4 mb-5 grid grid-cols-4 divide-x divide-gray-100">
            {[
              { label: "คลาสทั้งหมด", value: sessions.length, color: "text-gray-800" },
              { label: "นิสิตลงทะเบียน", value: sessions[0]?.totalEnrolled || 0, color: "text-gray-800" },
              { label: "เช็คชื่อรวม", value: sessions.reduce((s, r) => s + r.checkedIn, 0), color: "text-green-600" },
              { label: "สายรวม", value: sessions.reduce((s, r) => s + r.late, 0), color: "text-amber-500" },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center px-3">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Session list */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-pink-100">
            <p className="text-gray-400">ยังไม่มีคลาสเรียนในวิชานี้</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map((s, i) => (
              <Link
                key={s.id}
                href={`/admin/sessions/${s.id}`}
                className="bg-white rounded-2xl border border-pink-100 hover:border-pink-300 hover:shadow-md transition-all group overflow-hidden"
              >
                <div className="flex items-stretch">
                  {/* Index + status bar */}
                  <div className={`w-1.5 flex-shrink-0 ${s.status === "active" ? "bg-green-400" : "bg-gray-200"}`} />

                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: date + info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <p className="font-bold text-gray-800 flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-pink-400" />
                            คลาสที่ {sessions.length - i} — {s.sessionDate}
                          </p>
                          {s.status === "active" && (
                            <span className="bg-green-100 text-green-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {s.startTime}–{s.endTime}</span>
                          <span className="flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 text-amber-400" /> สายหลัง {s.lateTime}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                          <MapPin className="w-3.5 h-3.5" /> {s.locationName}
                        </div>
                      </div>

                      {/* Right: attendance chips */}
                      <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
                        <div className="flex gap-2">
                          <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                            <CheckCircle className="w-3 h-3" />
                            {onTime(s)}
                          </span>
                          <span className="flex items-center gap-1 text-xs font-semibold text-amber-500 bg-amber-50 px-2.5 py-1 rounded-full">
                            <Clock className="w-3 h-3" />
                            {s.late}
                          </span>
                          <span className="flex items-center gap-1 text-xs font-semibold text-red-400 bg-red-50 px-2.5 py-1 rounded-full">
                            <XCircle className="w-3 h-3" />
                            {absent(s)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Users className="w-3 h-3" />
                          {s.checkedIn}/{s.totalEnrolled} คน
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all"
                        style={{ width: `${s.totalEnrolled ? (s.checkedIn / s.totalEnrolled) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 text-right">
                      เช็คชื่อแล้ว {s.totalEnrolled ? Math.round((s.checkedIn / s.totalEnrolled) * 100) : 0}%
                    </p>
                  </div>

                  <div className="flex items-center pr-4">
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-pink-400 transition-colors" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

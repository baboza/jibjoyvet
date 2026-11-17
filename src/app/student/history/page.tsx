"use client";
import { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { ClipboardList, CheckCircle, Clock, XCircle, Loader2, Calendar, MapPin, Sparkles } from "lucide-react";

interface CheckinRecord {
  id: string;
  sessionId: string;
  status: string;
  createdAt: string;
  distance: number;
  subjectName?: string;
  subjectCode?: string;
  sessionDate?: string;
}

export default function HistoryPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<CheckinRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ onTime: 0, late: 0, total: 0 });

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    try {
      // ดึงข้อมูลแบบ Promise.all พร้อมกันเพื่อประสิทธิภาพสูงสุด
      const [checkinSnap, subjectsSnap, sessionsSnap] = await Promise.all([
        getDocs(query(collection(db, "checkins"), where("email", "==", user.email))),
        getDocs(collection(db, "subjects")),
        getDocs(collection(db, "sessions")),
      ]);

      const subjectsMap: Record<string, { name: string; code: string }> = {};
      subjectsSnap.forEach((d) => {
        subjectsMap[d.id] = { name: d.data().name, code: d.data().code };
      });

      const sessionsMap: Record<string, { subjectId: string; sessionDate: string }> = {};
      sessionsSnap.forEach((d) => {
        sessionsMap[d.id] = { subjectId: d.data().subjectId, sessionDate: d.data().sessionDate };
      });

      const result: CheckinRecord[] = [];
      let onTime = 0, late = 0;

      checkinSnap.forEach((d) => {
        const data = d.data();
        const session = sessionsMap[data.sessionId] || {};
        const subject = subjectsMap[session.subjectId || ""] || {};
        result.push({
          id: d.id,
          sessionId: data.sessionId,
          status: data.status,
          createdAt: data.createdAt,
          distance: data.distance,
          subjectName: subject.name,
          subjectCode: subject.code,
          sessionDate: session.sessionDate,
        });
        if (data.status === "on-time") onTime++;
        else if (data.status === "late") late++;
      });

      // Sort by createdAt desc
      result.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

      setRecords(result);
      setStats({ onTime, late, total: result.length });
    } catch (err) {
      console.error("Error fetching checkin history:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const statusBadge = (status: string) => {
    if (status === "on-time") {
      return (
        <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-3 py-1 rounded-full text-xs font-bold shadow-[0_0_12px_rgba(16,185,129,0.2)]">
          <CheckCircle className="w-3.5 h-3.5" /> ทันเวลา
        </span>
      );
    }
    if (status === "late") {
      return (
        <span className="flex items-center gap-1.5 text-amber-400 bg-amber-950/60 border border-amber-500/40 px-3 py-1 rounded-full text-xs font-bold shadow-[0_0_12px_rgba(245,158,11,0.2)]">
          <Clock className="w-3.5 h-3.5" /> สาย
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 text-rose-400 bg-rose-950/60 border border-rose-500/40 px-3 py-1 rounded-full text-xs font-bold shadow-[0_0_12px_rgba(244,63,94,0.2)]">
        <XCircle className="w-3.5 h-3.5" /> ขาด
      </span>
    );
  };

  return (
    <AppLayout>
      <div className="relative min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-200 overflow-x-hidden pb-12">
        {/* Ambient Glowing Orbs */}
        <div className="absolute top-[5%] left-[10%] w-[45%] h-[45%] rounded-full bg-cyan-500/10 blur-[130px] pointer-events-none -z-0"></div>
        <div className="absolute top-[40%] right-[10%] w-[35%] h-[35%] rounded-full bg-purple-500/10 blur-[140px] pointer-events-none -z-0"></div>

        <div className="relative z-10 max-w-xl mx-auto px-4 pt-6 sm:pt-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-cyan-500/40 backdrop-blur-xl text-xs font-bold text-cyan-400 uppercase tracking-wide mb-3">
              <ClipboardList className="w-3.5 h-3.5" />
              <span>ATTENDANCE HISTORY</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight uppercase">
              ประวัติการ<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400">เข้าเรียน</span>
            </h1>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: "เช็คชื่อทั้งหมด", value: stats.total, color: "text-cyan-400", border: "border-cyan-500/30", bg: "bg-cyan-950/30" },
              { label: "ทันเวลา", value: stats.onTime, color: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-950/30" },
              { label: "สาย", value: stats.late, color: "text-amber-400", border: "border-amber-500/30", bg: "bg-amber-950/30" },
            ].map(({ label, value, color, border, bg }) => (
              <div key={label} className={`p-4 rounded-2xl glass ${bg} border ${border} text-center shadow-lg`}>
                <p className={`text-2xl sm:text-3xl font-black ${color} mb-1 font-mono`}>{value}</p>
                <p className="text-[11px] text-slate-400 font-medium">{label}</p>
              </div>
            ))}
          </div>

          {/* Records */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin"></div>
                <Sparkles className="w-5 h-5 text-cyan-400 absolute inset-0 m-auto animate-pulse" />
              </div>
              <p className="text-xs font-mono text-slate-400 tracking-wider">กำลังโหลดประวัติ...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="p-10 rounded-3xl glass bg-slate-900/60 border border-slate-800/80 text-center shadow-xl">
              <ClipboardList className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-medium">ยังไม่มีประวัติการเช็คชื่อในระบบ</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {records.map((r) => (
                <div
                  key={r.id}
                  className="p-4 sm:p-5 rounded-2xl glass bg-slate-900/70 border border-slate-800/90 hover:border-cyan-500/40 transition-all flex items-start justify-between gap-3 shadow-lg"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-500/30 text-cyan-300">
                        {r.subjectCode || "VET"}
                      </span>
                      <p className="font-bold text-white text-sm">{r.subjectName || "ไม่ทราบวิชา"}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-cyan-400" /> {r.sessionDate}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" /> {r.createdAt}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" /> ระยะ {r.distance} ม.
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">{statusBadge(r.status)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

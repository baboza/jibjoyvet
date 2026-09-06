"use client";
import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { ClipboardList, CheckCircle, Clock, XCircle, Loader2 } from "lucide-react";

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

  useEffect(() => {
    if (!user) return;
    fetchHistory();
  }, [user]);

  const fetchHistory = async () => {
    try {
      const q = query(collection(db, "checkins"), where("email", "==", user!.email));
      const checkinSnap = await getDocs(q);

      const subjectsSnap = await getDocs(collection(db, "subjects"));
      const sessionsSnap = await getDocs(collection(db, "sessions"));

      const subjectsMap: Record<string, { name: string; code: string }> = {};
      subjectsSnap.forEach((d) => { subjectsMap[d.id] = { name: d.data().name, code: d.data().code }; });

      const sessionsMap: Record<string, { subjectId: string; sessionDate: string }> = {};
      sessionsSnap.forEach((d) => { sessionsMap[d.id] = { subjectId: d.data().subjectId, sessionDate: d.data().sessionDate }; });

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
      result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      setRecords(result);
      setStats({ onTime, late, total: result.length });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "on-time") return (
      <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full text-xs font-semibold">
        <CheckCircle className="w-3 h-3" /> ทันเวลา
      </span>
    );
    if (status === "late") return (
      <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-xs font-semibold">
        <Clock className="w-3 h-3" /> สาย
      </span>
    );
    return (
      <span className="flex items-center gap-1 text-red-500 bg-red-50 px-2 py-0.5 rounded-full text-xs font-semibold">
        <XCircle className="w-3 h-3" /> ขาด
      </span>
    );
  };

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto px-4 py-6">
        <h2 className="text-lg font-bold text-gray-700 mb-4">ประวัติการเข้าเรียน</h2>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "ทั้งหมด", value: stats.total, color: "bg-pink-500" },
            { label: "ทันเวลา", value: stats.onTime, color: "bg-green-500" },
            { label: "สาย", value: stats.late, color: "bg-amber-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl p-4 shadow-sm border border-pink-100 text-center">
              <p className={`text-2xl font-bold text-white ${color} w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2`}>{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Records */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-pink-400 animate-spin" /></div>
        ) : records.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-pink-100">
            <ClipboardList className="w-12 h-12 text-pink-200 mx-auto mb-3" />
            <p className="text-gray-400">ยังไม่มีประวัติการเช็คชื่อ</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {records.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl shadow-sm border border-pink-100 p-4 flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{r.subjectCode} – {r.subjectName || "ไม่ทราบวิชา"}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{r.sessionDate} · {r.createdAt}</p>
                  <p className="text-xs text-gray-400">ระยะ {r.distance} เมตร</p>
                </div>
                <div className="mt-1">{statusBadge(r.status)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

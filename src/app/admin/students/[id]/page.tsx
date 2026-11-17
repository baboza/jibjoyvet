"use client";
import { useState, useEffect } from "react";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, Loader2, UserCircle, Mail, Hash, 
  CheckCircle, Clock, XCircle, GraduationCap, Calendar, 
  MapPin, AlertCircle, BookOpen, Sparkles, Compass
} from "lucide-react";
import Link from "next/link";

interface StudentData {
  id: string;
  name: string;
  email: string;
  studentId: string;
  photoURL?: string;
  createdAt?: string;
}

interface EnrolledSubject {
  id: string;
  code: string;
  name: string;
  term: string;
}

interface CheckinHistory {
  id: string;
  subjectCode: string;
  subjectName: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: string;
  checkedAt?: string;
  distance?: number;
}

export default function StudentProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;

  const [student, setStudent] = useState<StudentData | null>(null);
  const [subjects, setSubjects] = useState<EnrolledSubject[]>([]);
  const [history, setHistory] = useState<CheckinHistory[]>([]);
  const [loading, setLoading] = useState(true);

  // Stats
  const [stats, setStats] = useState({ present: 0, late: 0, absent: 0 });

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    if (studentId) fetchData();
  }, [user, studentId]);

  const fetchData = async () => {
    try {
      // 1. Fetch Student Data
      const studentSnap = await getDoc(doc(db, "users", studentId));
      if (!studentSnap.exists()) {
        setLoading(false);
        return;
      }
      
      const sData = studentSnap.data();
      const studentEmail = sData.email;
      setStudent({
        id: studentSnap.id,
        name: sData.name,
        email: studentEmail,
        studentId: sData.studentId || "–",
        photoURL: sData.photoURL,
        createdAt: sData.createdAt,
      });

      // 2. Fetch Enrollments
      const enrollQ = query(collection(db, "enrollments"), where("email", "==", studentEmail));
      const enrollSnap = await getDocs(enrollQ);
      
      const enrolledSubjectIds: string[] = [];
      enrollSnap.forEach(d => enrolledSubjectIds.push(d.data().subjectId));

      // 3. Fetch Subjects detail
      const subjectsMap: Record<string, EnrolledSubject> = {};
      if (enrolledSubjectIds.length > 0) {
        const allSubs = await getDocs(collection(db, "subjects"));
        allSubs.forEach(d => {
          if (enrolledSubjectIds.includes(d.id)) {
            const sd = d.data();
            subjectsMap[d.id] = {
              id: d.id,
              code: sd.code,
              name: sd.name,
              term: sd.term,
            };
          }
        });
        setSubjects(Object.values(subjectsMap));
      }

      // 4. Fetch Check-ins
      const checkinQ = query(collection(db, "checkins"), where("email", "==", studentEmail));
      const checkinSnap = await getDocs(checkinQ);

      const checkinBySession: Record<string, any> = {};
      checkinSnap.forEach(d => {
        checkinBySession[d.data().sessionId] = { id: d.id, ...d.data() };
      });

      // 5. Fetch Sessions (for enrolled subjects to build complete attendance history)
      const allSessionsSnap = await getDocs(collection(db, "sessions"));
      
      const historyRows: CheckinHistory[] = [];
      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;

      allSessionsSnap.forEach(d => {
        const sess = d.data();
        if (enrolledSubjectIds.includes(sess.subjectId)) {
          const sub = subjectsMap[sess.subjectId];
          const checkin = checkinBySession[d.id];
          
          let status = "absent";
          if (checkin) {
            const rawStatus = (checkin.status || "").toLowerCase().replace(/_/g, "-");
            if (rawStatus === "late") {
              status = "late";
              lateCount++;
            } else {
              status = "on-time";
              presentCount++;
            }
          } else {
            absentCount++;
          }

          historyRows.push({
            id: d.id,
            subjectCode: sub?.code || "",
            subjectName: sub?.name || "",
            sessionDate: sess.sessionDate,
            startTime: sess.startTime,
            endTime: sess.endTime,
            status,
            checkedAt: checkin?.createdAt,
            distance: checkin?.distance,
          });
        }
      });

      // Sort history descending by date
      historyRows.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
      
      setHistory(historyRows);
      setStats({ present: presentCount, late: lateCount, absent: absentCount });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-28 gap-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-xs text-slate-400 font-mono">กำลังโหลดข้อมูลโปรไฟล์นิสิต...</p>
        </div>
      </AppLayout>
    );
  }

  if (!student) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-600">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">ไม่พบข้อมูลนิสิต</h2>
          <p className="text-sm text-slate-400 mb-6">ไม่พบนิสิตตามรหัสที่ระบุ หรือข้อมูลอาจถูกลบไปแล้ว</p>
          <button
            onClick={() => router.back()}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
          >
            กลับไปหน้ารายชื่อ
          </button>
        </div>
      </AppLayout>
    );
  }

  const totalSessions = stats.present + stats.late + stats.absent;
  const attendanceRate = totalSessions > 0 ? Math.round(((stats.present + stats.late) / totalSessions) * 100) : 0;

  return (
    <AppLayout>
      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-[140px]" />
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        
        {/* Header & Back Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all shadow-sm"
            aria-label="ย้อนกลับ"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                STUDENT PROFILE
              </span>
              <span className="text-xs text-slate-400 font-mono">ID: {student.studentId}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-0.5">
              {student.name}
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Col: Profile Card & Stats */}
          <div className="space-y-6">
            
            {/* Profile Info Card */}
            <div className="bg-slate-900/75 border border-slate-800 backdrop-blur-xl rounded-2xl p-6 shadow-xl shadow-black/20 text-center">
              <div className="relative w-24 h-24 mx-auto mb-4">
                <div className="w-full h-full rounded-full border-2 border-cyan-500/40 p-1 bg-slate-950 shadow-lg shadow-cyan-500/10 overflow-hidden flex items-center justify-center">
                  {student.photoURL ? (
                    <img src={student.photoURL} alt={student.name} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <UserCircle className="w-16 h-16 text-slate-500" />
                  )}
                </div>
              </div>

              <h2 className="text-lg font-bold text-white mb-1">{student.name}</h2>
              
              <div className="flex flex-col items-center gap-1.5 text-xs text-slate-400 font-mono mt-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300">
                  <Hash className="w-3.5 h-3.5 text-cyan-400" /> {student.studentId}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> {student.email}
                </span>
              </div>
            </div>

            {/* Overview Stats */}
            <div className="bg-slate-900/75 border border-slate-800 backdrop-blur-xl rounded-2xl p-6 shadow-xl shadow-black/20">
              <h3 className="font-bold text-white mb-4 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-cyan-400" /> สถิติภาพรวม
                </span>
                <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                  อัตราเข้าเรียน {attendanceRate}%
                </span>
              </h3>
              
              <div className="space-y-2.5">
                <div className="flex justify-between items-center bg-slate-950/70 border border-slate-800/80 px-4 py-2.5 rounded-xl">
                  <span className="text-xs text-slate-400">วิชาที่ลงทะเบียน</span>
                  <span className="text-sm font-bold text-white font-mono">{subjects.length} วิชา</span>
                </div>
                <div className="flex justify-between items-center bg-emerald-500/5 border border-emerald-500/20 px-4 py-2.5 rounded-xl">
                  <span className="text-xs text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" /> เข้าเรียนตรงเวลา
                  </span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">{stats.present} ครั้ง</span>
                </div>
                <div className="flex justify-between items-center bg-amber-500/5 border border-amber-500/20 px-4 py-2.5 rounded-xl">
                  <span className="text-xs text-amber-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> เข้าเรียนสาย
                  </span>
                  <span className="text-sm font-bold text-amber-400 font-mono">{stats.late} ครั้ง</span>
                </div>
                <div className="flex justify-between items-center bg-rose-500/5 border border-rose-500/20 px-4 py-2.5 rounded-xl">
                  <span className="text-xs text-rose-400 flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5" /> ขาดเรียน
                  </span>
                  <span className="text-sm font-bold text-rose-400 font-mono">{stats.absent} ครั้ง</span>
                </div>
              </div>
            </div>

            {/* Enrolled Subjects List */}
            <div className="bg-slate-900/75 border border-slate-800 backdrop-blur-xl rounded-2xl p-6 shadow-xl shadow-black/20">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-sm">
                <GraduationCap className="w-4 h-4 text-cyan-400" /> รายวิชาที่เรียน
              </h3>
              {subjects.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">ไม่ได้ลงทะเบียนเรียนในระบบ</p>
              ) : (
                <div className="space-y-2.5">
                  {subjects.map(s => (
                    <div
                      key={s.id}
                      className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl hover:border-cyan-500/30 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-cyan-300 font-mono">{s.code}</span>
                        <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md font-mono">
                          เทอม {s.term}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 line-clamp-1">{s.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Col: Detailed Check-in History */}
          <div className="lg:col-span-2">
            <div className="bg-slate-900/75 border border-slate-800 backdrop-blur-xl rounded-2xl p-6 shadow-xl shadow-black/20 h-full flex flex-col">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                <h3 className="font-bold text-white flex items-center gap-2 text-base">
                  <Calendar className="w-4 h-4 text-cyan-400" /> ประวัติการเข้าเรียนทั้งหมด
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  ทั้งหมด {history.length} รายการ
                </span>
              </div>

              {history.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                  <Clock className="w-12 h-12 text-slate-700 mb-3" />
                  <p className="text-slate-400 text-sm">ยังไม่มีประวัติการเช็คชื่อ</p>
                  <p className="text-xs text-slate-600 mt-1">เมื่อนิสิตเช็คชื่อในคลาส ประวัติจะแสดงที่นี่โดยอัตโนมัติ</p>
                </div>
              ) : (
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-left">
                        <th className="pb-3 pr-4 font-semibold">วันที่ / เวลาคลาส</th>
                        <th className="pb-3 pr-4 font-semibold">วิชา</th>
                        <th className="pb-3 pr-4 font-semibold">สถานะ</th>
                        <th className="pb-3 font-semibold">เวลาเช็คชื่อ / ระยะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {history.map((h, i) => (
                        <tr key={`${h.id}-${i}`} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 pr-4">
                            <div className="font-semibold text-white font-mono">{h.sessionDate}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{h.startTime} – {h.endTime}</div>
                          </td>
                          <td className="py-3.5 pr-4">
                            <div className="font-bold text-cyan-300 font-mono">{h.subjectCode}</div>
                            <div className="text-[11px] text-slate-300 truncate max-w-[200px]">{h.subjectName}</div>
                          </td>
                          <td className="py-3.5 pr-4">
                            {h.status === "on-time" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 font-mono">
                                <CheckCircle className="w-3 h-3" /> ทันเวลา
                              </span>
                            )}
                            {h.status === "late" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 font-mono">
                                <Clock className="w-3 h-3" /> สาย
                              </span>
                            )}
                            {h.status === "absent" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 font-mono">
                                <XCircle className="w-3 h-3" /> ขาด
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 text-slate-300 font-mono">
                            {h.checkedAt ? (
                              <div>
                                <span className="font-medium text-slate-200">
                                  {new Date(h.checkedAt).toLocaleTimeString("th-TH")}
                                </span>
                                {h.distance !== undefined && (
                                  <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400">
                                    <MapPin className="w-3 h-3 text-cyan-400" /> {Math.round(h.distance)} ม.
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-600">–</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}

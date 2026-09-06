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
  MapPin, AlertCircle, BookOpen
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
        // To avoid 'in' query limit of 10, we'll fetch all subjects and filter locally if > 10
        // Or just fetch all subjects because it's a small app
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

      // 5. Fetch Sessions (only for enrolled subjects to build history)
      // Because we need to know all sessions for enrolled subjects to calculate absences!
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
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-pink-400 animate-spin" /></div>
      </AppLayout>
    );
  }

  if (!student) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto px-4 py-10 text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-700">ไม่พบข้อมูลนิสิต</h2>
          <button onClick={() => router.back()} className="mt-4 text-pink-500 hover:underline">กลับไปหน้ารายชื่อ</button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        
        {/* Header & Back Button */}
        <div className="flex items-center gap-3">
          <Link href="/admin/students" className="p-2 hover:bg-white rounded-xl text-gray-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">โปรไฟล์นิสิต</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Col: Profile Card & Stats */}
          <div className="space-y-6">
            
            {/* Profile Info */}
            <div className="bg-white rounded-3xl p-6 border border-pink-100 shadow-sm text-center">
              <div className="w-24 h-24 mx-auto bg-pink-50 rounded-full border-4 border-white shadow-md flex items-center justify-center mb-4 overflow-hidden">
                {student.photoURL ? (
                  <img src={student.photoURL} alt={student.name} className="w-full h-full object-cover" />
                ) : (
                  <UserCircle className="w-16 h-16 text-pink-300" />
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-1">{student.name}</h2>
              <div className="inline-flex flex-col items-center gap-1.5 text-sm text-gray-500 mt-2">
                <span className="flex items-center gap-1.5"><Hash className="w-4 h-4" /> {student.studentId}</span>
                <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" /> {student.email}</span>
              </div>
            </div>

            {/* Overview Stats */}
            <div className="bg-white rounded-3xl p-6 border border-pink-100 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-pink-500" /> สถิติภาพรวม
              </h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-gray-50 p-3 rounded-2xl">
                  <span className="text-sm font-medium text-gray-600">วิชาที่ลงทะเบียน</span>
                  <span className="font-bold text-gray-800">{subjects.length} วิชา</span>
                </div>
                <div className="flex justify-between items-center bg-green-50 p-3 rounded-2xl">
                  <span className="text-sm font-medium text-green-700">เข้าเรียนตรงเวลา</span>
                  <span className="font-bold text-green-600">{stats.present} ครั้ง</span>
                </div>
                <div className="flex justify-between items-center bg-amber-50 p-3 rounded-2xl">
                  <span className="text-sm font-medium text-amber-700">เข้าเรียนสาย</span>
                  <span className="font-bold text-amber-600">{stats.late} ครั้ง</span>
                </div>
                <div className="flex justify-between items-center bg-red-50 p-3 rounded-2xl">
                  <span className="text-sm font-medium text-red-700">ขาดเรียน</span>
                  <span className="font-bold text-red-600">{stats.absent} ครั้ง</span>
                </div>
              </div>
            </div>

            {/* Enrolled Subjects List */}
            <div className="bg-white rounded-3xl p-6 border border-pink-100 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-pink-500" /> รายวิชาที่เรียน
              </h3>
              {subjects.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">ไม่ได้ลงทะเบียนเรียน</p>
              ) : (
                <div className="space-y-3">
                  {subjects.map(s => (
                    <div key={s.id} className="p-3 border border-gray-100 rounded-2xl hover:border-pink-200 transition-colors">
                      <p className="font-bold text-sm text-gray-800">{s.code}</p>
                      <p className="text-xs text-gray-500 line-clamp-1">{s.name}</p>
                      <p className="text-[10px] text-pink-500 mt-1 font-medium bg-pink-50 inline-block px-2 py-0.5 rounded-md">เทอม {s.term}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Col: Detailed Check-in History */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl p-6 border border-pink-100 shadow-sm h-full">
              <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-pink-500" /> ประวัติการเข้าเรียนทั้งหมด
              </h3>

              {history.length === 0 ? (
                <div className="text-center py-20">
                  <Clock className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400">ยังไม่มีประวัติการเช็คชื่อ</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400 text-xs uppercase text-left">
                        <th className="pb-3 font-semibold">วันที่ / เวลาคลาส</th>
                        <th className="pb-3 font-semibold">วิชา</th>
                        <th className="pb-3 font-semibold">สถานะ</th>
                        <th className="pb-3 font-semibold">เวลาเช็คชื่อ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {history.map((h, i) => (
                        <tr key={`${h.id}-${i}`} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-4 pr-4">
                            <div className="font-medium text-gray-800">{h.sessionDate}</div>
                            <div className="text-xs text-gray-400">{h.startTime} - {h.endTime}</div>
                          </td>
                          <td className="py-4 pr-4">
                            <div className="font-bold text-gray-700">{h.subjectCode}</div>
                            <div className="text-xs text-gray-500 truncate max-w-[200px]">{h.subjectName}</div>
                          </td>
                          <td className="py-4 pr-4">
                            {h.status === "on-time" && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-green-700 bg-green-100">
                                <CheckCircle className="w-3.5 h-3.5" /> ทันเวลา
                              </span>
                            )}
                            {h.status === "late" && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-amber-700 bg-amber-100">
                                <Clock className="w-3.5 h-3.5" /> สาย
                              </span>
                            )}
                            {h.status === "absent" && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-red-700 bg-red-100">
                                <XCircle className="w-3.5 h-3.5" /> ขาด
                              </span>
                            )}
                          </td>
                          <td className="py-4 text-xs text-gray-500">
                            {h.checkedAt ? (
                              <div>
                                <span className="font-medium text-gray-700">{new Date(h.checkedAt).toLocaleTimeString("th-TH")}</span>
                                {h.distance !== undefined && (
                                  <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-400">
                                    <MapPin className="w-3 h-3" /> ห่าง {Math.round(h.distance)}m
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-300">–</span>
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

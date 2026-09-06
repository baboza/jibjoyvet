"use client";
import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, doc, getDoc, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import Link from "next/link";
import {
  GraduationCap, Users, CheckCircle, Clock, ChevronRight,
  Loader2, Search, SlidersHorizontal, Calendar, AlertCircle, TrendingUp
} from "lucide-react";

interface SessionSummary {
  id: string;
  subjectCode: string;
  subjectName: string;
  subjectId: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: string;
  totalEnrolled: number;
  checkedIn: number;
  late: number;
  absent: number;
}

interface LateStudent {
  id: string; // The uid
  email: string;
  name: string;
  count: number;
}

type FilterStatus = "all" | "active" | "inactive";
type SortOption = "date-desc" | "date-asc" | "absent-desc" | "checkin-desc";

export default function AdminPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [topLateStudents, setTopLateStudents] = useState<LateStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTerm, setCurrentTerm] = useState("");

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [sortBy, setSortBy] = useState<SortOption>("date-desc");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      // 1. Get current setting
      const settingsSnap = await getDoc(doc(db, "settings", "system"));
      const sysTerm = settingsSnap.exists() ? (settingsSnap.data().currentTerm || "") : "";
      setCurrentTerm(sysTerm);

      // 2. Fetch subjects for the current term
      const subjectsQ = sysTerm 
        ? query(collection(db, "subjects"), where("term", "==", sysTerm))
        : collection(db, "subjects");

      const [sessionsSnap, subjectsSnap, enrollmentsSnap, checkinsSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, "sessions")),
        getDocs(subjectsQ),
        getDocs(collection(db, "enrollments")),
        getDocs(collection(db, "checkins")),
        getDocs(collection(db, "users")),
      ]);

      const emailToUidMap: Record<string, string> = {};
      usersSnap.forEach((d) => {
        emailToUidMap[d.data().email] = d.id;
      });

      const subjectsMap: Record<string, { name: string; code: string }> = {};
      subjectsSnap.forEach((d) => { subjectsMap[d.id] = { name: d.data().name, code: d.data().code }; });

      const enrollBySubject: Record<string, number> = {};
      enrollmentsSnap.forEach((d) => {
        const sid = d.data().subjectId;
        if (subjectsMap[sid]) {
          enrollBySubject[sid] = (enrollBySubject[sid] || 0) + 1;
        }
      });

      const checkinBySession: Record<string, { total: number; late: number }> = {};
      const lateStudentsMap: Record<string, { id: string; name: string; count: number; email: string }> = {};

      checkinsSnap.forEach((d) => {
        const data = d.data();
        const sid = data.sessionId;
        
        if (!checkinBySession[sid]) checkinBySession[sid] = { total: 0, late: 0 };
        checkinBySession[sid].total++;
        
        const raw = (data.status || "").toLowerCase().replace(/_/g, "-");
        if (raw === "late") {
          checkinBySession[sid].late++;
        }
      });

      const result: SessionSummary[] = [];
      const sessionIdsInTerm = new Set<string>();

      sessionsSnap.forEach((d) => {
        const data = d.data();
        if (!subjectsMap[data.subjectId]) return; // Skip if subject is not in current term
        
        sessionIdsInTerm.add(d.id);

        const subject = subjectsMap[data.subjectId];
        const enrolled = enrollBySubject[data.subjectId] || 0;
        const checkin = checkinBySession[d.id] || { total: 0, late: 0 };
        
        result.push({
          id: d.id,
          subjectCode: subject.code || "",
          subjectName: subject.name || "ไม่ทราบวิชา",
          subjectId: data.subjectId,
          sessionDate: data.sessionDate,
          startTime: data.startTime,
          endTime: data.endTime,
          status: data.status,
          totalEnrolled: enrolled,
          checkedIn: checkin.total,
          late: checkin.late,
          absent: Math.max(0, enrolled - checkin.total),
        });
      });

      // Now correctly calculate top late students ONLY for sessions in the current term
      checkinsSnap.forEach((d) => {
        const data = d.data();
        if (!sessionIdsInTerm.has(data.sessionId)) return;

        const raw = (data.status || "").toLowerCase().replace(/_/g, "-");
        if (raw === "late") {
          const email = data.email;
          if (!lateStudentsMap[email]) {
            lateStudentsMap[email] = { 
              id: emailToUidMap[email] || "", 
              name: data.name || email, 
              count: 0, 
              email 
            };
          }
          lateStudentsMap[email].count++;
        }
      });

      const topStudents = Object.values(lateStudentsMap)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setTopLateStudents(topStudents);
      setSessions(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered + sorted sessions for the left column
  const filtered = useMemo(() => {
    let list = [...sessions];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.subjectCode.toLowerCase().includes(q) ||
          s.subjectName.toLowerCase().includes(q) ||
          s.sessionDate.includes(q)
      );
    }

    if (filterStatus === "active") list = list.filter((s) => s.status === "active");
    if (filterStatus === "inactive") list = list.filter((s) => s.status !== "active");

    switch (sortBy) {
      case "date-desc": list.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate)); break;
      case "date-asc":  list.sort((a, b) => a.sessionDate.localeCompare(b.sessionDate)); break;
      case "absent-desc": list.sort((a, b) => b.absent - a.absent); break;
      case "checkin-desc": list.sort((a, b) => b.checkedIn - a.checkedIn); break;
    }

    if (sortBy === "date-desc") {
      const today = new Date().toISOString().slice(0, 10);
      list.sort((a, b) => {
        const diffA = Math.abs(new Date(a.sessionDate).getTime() - new Date(today).getTime());
        const diffB = Math.abs(new Date(b.sessionDate).getTime() - new Date(today).getTime());
        return diffA - diffB;
      });
    }

    return list;
  }, [sessions, search, filterStatus, sortBy]);

  const hasFilter = !!(search || filterStatus !== "all" || sortBy !== "date-desc");
  const LIMIT = 10;
  const displayed = hasFilter ? filtered : filtered.slice(0, LIMIT);
  const hasMore = !hasFilter && filtered.length > LIMIT;

  const totalCheckins = sessions.reduce((s, r) => s + r.checkedIn, 0);
  const totalAbsent   = sessions.reduce((s, r) => s + r.absent, 0);
  const totalLate     = sessions.reduce((s, r) => s + r.late, 0);
  const activeCount   = sessions.filter((s) => s.status === "active").length;

  // Top 5 sessions with most lates (for charts)
  const topLateSessions = useMemo(() => {
    return [...sessions]
      .filter(s => s.late > 0)
      .sort((a, b) => b.late - a.late)
      .slice(0, 5);
  }, [sessions]);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">แดชบอร์ด</h1>
            <p className="text-gray-500 text-sm mt-1">ภาพรวมการจัดการคลาสเรียนและการเช็คชื่อทั้งหมด</p>
          </div>
          
          <div className="flex items-center gap-3">
            {currentTerm && (
              <div className="bg-pink-100 text-pink-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 border border-pink-200 shadow-sm">
                <Calendar className="w-4 h-4" />
                ภาคเรียนที่ {currentTerm}
              </div>
            )}
            <Link
              href="/admin/sessions"
              className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium hover:border-pink-300 hover:text-pink-600 transition-colors shadow-sm hidden md:flex"
            >
              จัดการคลาสเรียน
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "คลาสทั้งหมด", value: sessions.length, sub: `${activeCount} active`, icon: GraduationCap, color: "text-pink-500 bg-pink-100" },
                { label: "เช็คชื่อแล้ว", value: totalCheckins, sub: "ครั้งรวม", icon: CheckCircle, color: "text-green-500 bg-green-100" },
                { label: "สาย",          value: totalLate,     sub: "ครั้งรวม", icon: Clock,        color: "text-amber-500 bg-amber-100" },
                { label: "ขาด",          value: totalAbsent,   sub: "ครั้งรวม", icon: Users,        color: "text-red-400 bg-red-100" },
              ].map(({ label, value, sub, icon: Icon, color }) => (
                <div key={label} className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-pink-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-3xl font-black text-gray-800 tracking-tight">{value}</p>
                    <p className="text-sm font-medium text-gray-500 mt-1">{label}</p>
                    <p className="text-xs text-gray-400 font-medium">{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Main Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Sessions List */}
              <div className="lg:col-span-2 space-y-4">
                
                {/* Search & Filter */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="ค้นหารหัสวิชา, ชื่อวิชา, วันที่..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-pink-400 text-sm"
                    />
                  </div>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
                  >
                    <SlidersHorizontal className="w-4 h-4" /> ตัวกรอง
                  </button>
                </div>

                {showFilters && (
                  <div className="bg-white p-4 rounded-xl border border-pink-100 shadow-sm flex flex-col sm:flex-row gap-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">สถานะ</label>
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                        className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-pink-400"
                      >
                        <option value="all">ทั้งหมด</option>
                        <option value="active">กำลังเปิดเช็คชื่อ (Active)</option>
                        <option value="inactive">ปิดเช็คชื่อแล้ว</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">เรียงลำดับ</label>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-pink-400"
                      >
                        <option value="date-desc">ใกล้วันปัจจุบันที่สุด (อัตโนมัติ)</option>
                        <option value="date-asc">เก่าที่สุด - ใหม่ที่สุด</option>
                        <option value="absent-desc">คนขาดเยอะที่สุด</option>
                        <option value="checkin-desc">คนเข้าเรียนเยอะที่สุด</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between px-1 mb-2 mt-4">
                  <h2 className="text-sm font-bold text-gray-700">
                    {hasFilter ? `ผลการค้นหา (${filtered.length})` : `คลาสใกล้เคียงวันนี้ (แสดง ${displayed.length} จาก ${filtered.length})`}
                  </h2>
                  <div className="text-xs font-bold text-green-500 bg-green-50 px-2 py-1 rounded-lg">
                    {activeCount} Active
                  </div>
                </div>

                <div className="space-y-3">
                  {displayed.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
                      <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <AlertCircle className="w-6 h-6 text-gray-300" />
                      </div>
                      <p className="text-gray-500 text-sm">ไม่พบคลาสเรียนที่ตรงกับเงื่อนไข</p>
                    </div>
                  ) : (
                    displayed.map((session) => {
                      const isActive = session.status === "active";
                      const presentPercent = session.totalEnrolled > 0 
                        ? Math.round(((session.checkedIn + session.late) / session.totalEnrolled) * 100) 
                        : 0;

                      return (
                        <Link
                          key={session.id}
                          href={`/admin/sessions/${session.id}`}
                          className="block bg-white rounded-2xl p-4 md:p-5 border border-pink-100 shadow-sm hover:shadow-md hover:border-pink-300 transition-all group"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-bold text-gray-800 text-base group-hover:text-pink-600 transition-colors flex items-center gap-2">
                                {session.subjectCode} – {session.subjectName}
                                {isActive && (
                                  <span className="bg-green-100 text-green-600 text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                                    Active
                                  </span>
                                )}
                              </h3>
                              <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                                <Calendar className="w-4 h-4" /> {session.sessionDate}
                                <Clock className="w-4 h-4 ml-2" /> {session.startTime}-{session.endTime}
                              </p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-pink-500 transition-colors hidden sm:block" />
                          </div>

                          {/* Progress Bar */}
                          <div className="flex items-center gap-3 mt-4">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-md">
                              <CheckCircle className="w-3.5 h-3.5" /> {session.checkedIn}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                              <Clock className="w-3.5 h-3.5" /> {session.late}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-medium text-red-500 bg-red-50 px-2 py-1 rounded-md">
                              <Users className="w-3.5 h-3.5" /> {session.absent}
                            </div>

                            <div className="flex-1 mx-2">
                              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-pink-500 rounded-full"
                                  style={{ width: `${presentPercent}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-xs font-bold text-gray-400">{presentPercent}%</span>
                          </div>
                        </Link>
                      );
                    })
                  )}

                  {hasMore && (
                    <Link
                      href="/admin/sessions"
                      className="block w-full py-3 text-center text-sm font-semibold text-pink-600 bg-pink-50 rounded-2xl hover:bg-pink-100 transition-colors mt-2"
                    >
                      ดูคลาสเรียนทั้งหมด ({filtered.length})
                    </Link>
                  )}
                </div>
              </div>

              {/* Right Column: Graphs & Top Lists */}
              <div className="lg:col-span-1 space-y-6">
                
                {/* Top Late Sessions Chart */}
                <div className="bg-white rounded-3xl p-6 border border-pink-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-500">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-gray-800">คลาสที่คนเข้าสายมากที่สุด</h3>
                  </div>

                  {topLateSessions.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">ไม่มีข้อมูลการเข้าสาย</p>
                  ) : (
                    <div className="space-y-4">
                      {topLateSessions.map((s, idx) => {
                        const maxLate = topLateSessions[0].late;
                        const percent = Math.max(5, (s.late / maxLate) * 100);
                        return (
                          <div key={s.id} className="relative">
                            <div className="flex justify-between text-xs mb-1.5">
                              <span className="font-semibold text-gray-700 truncate pr-2">{s.subjectCode} ({s.sessionDate})</span>
                              <span className="font-bold text-amber-500 whitespace-nowrap">{s.late} คน</span>
                            </div>
                            <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-amber-400 rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Top Late Students List */}
                <div className="bg-white rounded-3xl p-6 border border-pink-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center text-red-500">
                      <Users className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-gray-800">นิสิตที่เข้าสายบ่อยที่สุด</h3>
                  </div>

                  {topLateStudents.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">ไม่มีประวัติการมาสาย</p>
                  ) : (
                    <div className="space-y-0 divide-y divide-gray-50">
                      {topLateStudents.map((student, idx) => (
                        <Link 
                          key={student.email} 
                          href={student.id ? `/admin/students/${student.id}` : "#"}
                          className={`py-3 flex items-center justify-between group transition-colors ${student.id ? 'hover:bg-pink-50/50 cursor-pointer -mx-6 px-6' : ''}`}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 flex-shrink-0 group-hover:bg-white group-hover:text-pink-500 transition-colors">
                              {idx + 1}
                            </div>
                            <div className="truncate">
                              <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-pink-600 transition-colors">{student.name}</p>
                              <p className="text-[10px] text-gray-400 truncate">{student.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg ml-2 flex-shrink-0 group-hover:bg-amber-100 transition-colors">
                            <Clock className="w-3 h-3" />
                            <span className="text-xs font-bold">{student.count}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

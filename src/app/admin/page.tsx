"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, getDocs, doc, getDoc, query, where, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import Link from "next/link";
import {
  GraduationCap,
  Users,
  CheckCircle,
  Clock,
  ChevronRight,
  Loader2,
  Search,
  SlidersHorizontal,
  Calendar,
  AlertCircle,
  TrendingUp,
  RotateCw,
  Power,
  Sparkles,
  Percent,
  Check,
  X
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
  id: string;
  email: string;
  name: string;
  count: number;
}

type FilterStatus = "all" | "today" | "active" | "inactive";
type SortOption = "closest-today" | "date-desc" | "date-asc" | "absent-desc" | "checkin-desc";

export default function AdminPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [topLateStudents, setTopLateStudents] = useState<LateStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTerm, setCurrentTerm] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [sortBy, setSortBy] = useState<SortOption>("closest-today");
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user || user.role !== "admin") return;
    setRefreshing(true);
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
      subjectsSnap.forEach((d) => {
        subjectsMap[d.id] = { name: d.data().name, code: d.data().code };
      });

      const enrollBySubject: Record<string, number> = {};
      enrollmentsSnap.forEach((d) => {
        const sid = d.data().subjectId;
        if (subjectsMap[sid]) {
          enrollBySubject[sid] = (enrollBySubject[sid] || 0) + 1;
        }
      });

      const checkinBySession: Record<string, { total: number; late: number }> = {};
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

      // Calculate top late students ONLY for sessions in the current term
      const lateStudentsMap: Record<string, { id: string; name: string; count: number; email: string }> = {};
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
      console.error("Error fetching admin data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Quick Toggle Active / Inactive for a session directly from Dashboard
  const handleToggleActive = async (e: React.MouseEvent, session: SessionSummary) => {
    e.preventDefault();
    e.stopPropagation();

    const newStatus = session.status === "active" ? "inactive" : "active";
    setTogglingId(session.id);

    try {
      await updateDoc(doc(db, "sessions", session.id), { status: newStatus });
      setSessions((prev) =>
        prev.map((s) => (s.id === session.id ? { ...s, status: newStatus } : s))
      );
    } catch (err) {
      console.error("Error updating session status:", err);
    } finally {
      setTogglingId(null);
    }
  };

  const todayTH = useMemo(() => {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  }, []);

  // Filtered & Sorted Sessions
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

    if (filterStatus === "today") list = list.filter((s) => s.sessionDate === todayTH);
    if (filterStatus === "active") list = list.filter((s) => s.status === "active");
    if (filterStatus === "inactive") list = list.filter((s) => s.status !== "active");

    switch (sortBy) {
      case "closest-today": {
        list.sort((a, b) => {
          const diffA = Math.abs(new Date(a.sessionDate).getTime() - new Date(todayTH).getTime());
          const diffB = Math.abs(new Date(b.sessionDate).getTime() - new Date(todayTH).getTime());
          return diffA - diffB;
        });
        break;
      }
      case "date-desc":
        list.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
        break;
      case "date-asc":
        list.sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
        break;
      case "absent-desc":
        list.sort((a, b) => b.absent - a.absent);
        break;
      case "checkin-desc":
        list.sort((a, b) => b.checkedIn - a.checkedIn);
        break;
    }

    return list;
  }, [sessions, search, filterStatus, sortBy, todayTH]);

  const hasFilter = !!(search || filterStatus !== "all" || sortBy !== "closest-today");
  const LIMIT = 10;
  const displayed = hasFilter ? filtered : filtered.slice(0, LIMIT);
  const hasMore = !hasFilter && filtered.length > LIMIT;

  const totalCheckins = sessions.reduce((s, r) => s + r.checkedIn, 0);
  const totalAbsent   = sessions.reduce((s, r) => s + r.absent, 0);
  const totalLate     = sessions.reduce((s, r) => s + r.late, 0);
  const totalEnrolled = sessions.reduce((s, r) => s + r.totalEnrolled, 0);
  const activeCount   = sessions.filter((s) => s.status === "active").length;
  const todayCount    = sessions.filter((s) => s.sessionDate === todayTH).length;

  const overallPresentRate = totalEnrolled > 0
    ? Math.round((totalCheckins / totalEnrolled) * 100)
    : 0;

  // Top 5 sessions with most lates
  const topLateSessions = useMemo(() => {
    return [...sessions]
      .filter((s) => s.late > 0)
      .sort((a, b) => b.late - a.late)
      .slice(0, 5);
  }, [sessions]);

  return (
    <AppLayout>
      <div className="relative min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-200 overflow-x-hidden pb-12">
        {/* Ambient Glowing Orbs */}
        <div className="absolute top-[3%] left-[10%] w-[45%] h-[45%] rounded-full bg-cyan-500/10 blur-[140px] pointer-events-none -z-0 animate-pulse" />
        <div className="absolute top-[35%] right-[10%] w-[35%] h-[35%] rounded-full bg-purple-500/10 blur-[150px] pointer-events-none -z-0" />
        <div className="absolute bottom-[5%] left-[25%] w-[40%] h-[40%] rounded-full bg-emerald-500/10 blur-[130px] pointer-events-none -z-0" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 py-6 sm:py-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-slate-800/80 pb-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-bold uppercase mb-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                <span>COMMAND CENTER</span>
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight uppercase">
                แดชบอร์ด<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400">ผู้ดูแลระบบ</span>
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">
                ภาพรวมการจัดการคลาสเรียน การเช็คชื่อ และสถิติการเข้าเรียนทั้งหมด
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {currentTerm && (
                <div className="bg-slate-900/90 text-cyan-300 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)] font-mono">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  ภาคเรียนที่ {currentTerm}
                </div>
              )}

              <button
                onClick={fetchData}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 text-xs font-bold transition-all active:scale-95 disabled:opacity-60"
              >
                <RotateCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-cyan-400" : ""}`} />
                <span>{refreshing ? "กำลังโหลด..." : "รีเฟรช"}</span>
              </button>

              <Link
                href="/admin/sessions"
                className="bg-gradient-to-r from-cyan-500/20 to-emerald-500/10 hover:from-cyan-500/30 hover:to-emerald-500/20 border border-cyan-500/40 text-cyan-300 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                <GraduationCap className="w-4 h-4" />
                จัดการคลาสเรียน
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin"></div>
                <Sparkles className="w-5 h-5 text-cyan-400 absolute inset-0 m-auto animate-pulse" />
              </div>
              <p className="text-xs font-mono text-slate-400 tracking-wider">กำลังประมวลผลข้อมูลแดชบอร์ด...</p>
            </div>
          ) : (
            <>
              {/* Stat Cards Grid (Virus Go Dark Glassmorphism) */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 sm:gap-4 mb-8">
                {[
                  {
                    label: "คลาสทั้งหมด",
                    value: sessions.length,
                    sub: `${activeCount} กำลังเปิด • ${todayCount} วันนี้`,
                    icon: GraduationCap,
                    glow: "border-cyan-500/30 text-cyan-400 bg-cyan-950/20",
                    numColor: "text-white",
                  },
                  {
                    label: "เช็คชื่อแล้ว",
                    value: totalCheckins,
                    sub: "ครั้งรวมทั้งหมด",
                    icon: CheckCircle,
                    glow: "border-emerald-500/30 text-emerald-400 bg-emerald-950/20",
                    numColor: "text-emerald-300",
                  },
                  {
                    label: "เข้าเรียนสาย",
                    value: totalLate,
                    sub: "ครั้งรวมทั้งหมด",
                    icon: Clock,
                    glow: "border-amber-500/30 text-amber-400 bg-amber-950/20",
                    numColor: "text-amber-300",
                  },
                  {
                    label: "ขาดเรียน",
                    value: totalAbsent,
                    sub: "ครั้งรวมทั้งหมด",
                    icon: Users,
                    glow: "border-rose-500/30 text-rose-400 bg-rose-950/20",
                    numColor: "text-rose-400",
                  },
                  {
                    label: "อัตราการเข้าเรียน",
                    value: `${overallPresentRate}%`,
                    sub: "เฉลี่ยทั้งภาคเรียน",
                    icon: Percent,
                    glow: "border-purple-500/30 text-purple-400 bg-purple-950/20 col-span-2 md:col-span-1",
                    numColor: "text-purple-300",
                  },
                ].map(({ label, value, sub, icon: Icon, glow, numColor }) => (
                  <div
                    key={label}
                    className={`relative p-5 rounded-2xl sm:rounded-3xl glass bg-slate-900/70 border ${glow} shadow-xl flex flex-col justify-between hover:scale-[1.02] transition-transform`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-slate-400">{label}</span>
                      <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <p className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${numColor}`}>
                        {value}
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium mt-1 truncate">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Main Layout Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                {/* Left Column: Sessions List (2 Cols) */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Search & Quick Filters Bar */}
                  <div className="p-3 rounded-2xl glass bg-slate-900/70 border border-slate-800 flex flex-col gap-2.5 shadow-lg">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="ค้นหารหัสวิชา, ชื่อวิชา, วันที่ (YYYY-MM-DD)..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-cyan-400/80 focus:outline-none text-xs text-white placeholder-slate-500"
                        />
                      </div>
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all ${
                          showFilters
                            ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                            : "bg-slate-950/80 border-slate-800 text-slate-300 hover:text-cyan-300"
                        }`}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>ตัวกรองขั้นสูง</span>
                      </button>
                    </div>

                    {/* Quick Filter Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-800/80 text-xs">
                      <span className="text-slate-400 text-[11px] font-mono mr-1">สถานะ:</span>
                      {[
                        { key: "all", label: "ทั้งหมด" },
                        { key: "today", label: `คลาสวันนี้ (${todayCount})` },
                        { key: "active", label: `กำลังเปิด (${activeCount})` },
                        { key: "inactive", label: "ปิดเช็คชื่อแล้ว" },
                      ].map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => setFilterStatus(key as FilterStatus)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                            filterStatus === key
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                              : "bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800/60"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Advanced Filters Dropdown */}
                  {showFilters && (
                    <div className="p-4 rounded-2xl glass bg-slate-900/90 border border-cyan-500/30 shadow-xl flex flex-col sm:flex-row gap-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase font-mono">
                          เรียงลำดับรายการ
                        </label>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as SortOption)}
                          className="w-full p-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-400"
                        >
                          <option value="closest-today">ใกล้วันปัจจุบันที่สุด (อัตโนมัติ)</option>
                          <option value="date-desc">วันที่: ใหม่ล่าสุด → เก่าที่สุด</option>
                          <option value="date-asc">วันที่: เก่าที่สุด → ใหม่ล่าสุด</option>
                          <option value="absent-desc">จำนวนคนขาดเยอะที่สุด</option>
                          <option value="checkin-desc">จำนวนคนเข้าเรียนเยอะที่สุด</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* List Header */}
                  <div className="flex items-center justify-between px-1 pt-2">
                    <h2 className="text-xs font-bold text-slate-400 font-mono uppercase tracking-wider">
                      {hasFilter
                        ? `ผลการค้นหา (${filtered.length} คลาส)`
                        : `คลาสใกล้เคียงวันนี้ (แสดง ${displayed.length} จาก ${filtered.length})`}
                    </h2>
                    <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2.5 py-0.5 rounded-full">
                      {activeCount} ACTIVE
                    </span>
                  </div>

                  {/* Sessions Cards */}
                  <div className="space-y-3.5">
                    {displayed.length === 0 ? (
                      <div className="p-10 rounded-3xl glass bg-slate-900/60 border border-slate-800 text-center shadow-xl">
                        <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-500">
                          <AlertCircle className="w-6 h-6 text-cyan-400/50" />
                        </div>
                        <p className="text-slate-300 text-sm font-bold">ไม่พบคลาสเรียนที่ตรงกับเงื่อนไข</p>
                        <p className="text-xs text-slate-500 mt-1">ลองเปลี่ยนคำค้นหา หรือเลือกตัวกรองเป็น &quot;ทั้งหมด&quot;</p>
                      </div>
                    ) : (
                      displayed.map((session) => {
                        const isActive = session.status === "active";
                        const isToday = session.sessionDate === todayTH;
                        const presentPercent = session.totalEnrolled > 0
                          ? Math.round(((session.checkedIn) / session.totalEnrolled) * 100)
                          : 0;

                        return (
                          <div
                            key={session.id}
                            className={`relative group p-4 sm:p-5 rounded-2xl sm:rounded-3xl glass bg-slate-900/75 border transition-all duration-300 shadow-xl overflow-hidden hover:border-cyan-500/50 ${
                              isToday
                                ? "border-cyan-500/40 bg-slate-900/90 shadow-[0_0_20px_rgba(6,182,212,0.1)]"
                                : "border-slate-800/80"
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                              <Link href={`/admin/sessions/${session.id}`} className="flex-1 group-hover:opacity-95">
                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-500/30 text-cyan-300">
                                    {session.subjectCode}
                                  </span>
                                  {isToday && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/40 text-emerald-400">
                                      วันนี้ (TODAY)
                                    </span>
                                  )}
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border font-mono ${
                                      isActive
                                        ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-400 animate-pulse"
                                        : "bg-slate-950 border-slate-800 text-slate-500"
                                    }`}
                                  >
                                    {isActive ? "ACTIVE" : "INACTIVE"}
                                  </span>
                                </div>

                                <h3 className="font-bold text-white text-base group-hover:text-cyan-300 transition-colors">
                                  {session.subjectName}
                                </h3>

                                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1.5 font-mono">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-cyan-400" /> {session.sessionDate}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-emerald-400" /> {session.startTime} – {session.endTime} น.
                                  </span>
                                </div>
                              </Link>

                              {/* Quick 1-Click Toggle Active Button */}
                              <div className="flex items-center gap-2 self-end sm:self-start">
                                <button
                                  onClick={(e) => handleToggleActive(e, session)}
                                  disabled={togglingId === session.id}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm active:scale-95 disabled:opacity-60 ${
                                    isActive
                                      ? "bg-emerald-950/80 hover:bg-rose-950/80 border-emerald-500/40 hover:border-rose-500/40 text-emerald-300 hover:text-rose-300"
                                      : "bg-slate-950 hover:bg-emerald-950/80 border-slate-800 hover:border-emerald-500/40 text-slate-400 hover:text-emerald-300"
                                  }`}
                                  title={isActive ? "คลิกเพื่อปิดรับเช็คชื่อ" : "คลิกเพื่อเปิดรับเช็คชื่อ"}
                                >
                                  {togglingId === session.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Power className="w-3.5 h-3.5" />
                                  )}
                                  <span>{isActive ? "เปิดอยู่ (คลิกปิด)" : "ปิดอยู่ (คลิกเปิด)"}</span>
                                </button>

                                <Link
                                  href={`/admin/sessions/${session.id}`}
                                  className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors"
                                  title="ดูรายละเอียดคลาส"
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </Link>
                              </div>
                            </div>

                            {/* Progress & Stat Row */}
                            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800/80 text-xs">
                              <span className="flex items-center gap-1 font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                                <CheckCircle className="w-3 h-3" /> {session.checkedIn} ทัน
                              </span>
                              <span className="flex items-center gap-1 font-bold text-amber-400 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-lg">
                                <Clock className="w-3 h-3" /> {session.late} สาย
                              </span>
                              <span className="flex items-center gap-1 font-bold text-rose-400 bg-rose-950/60 border border-rose-500/30 px-2 py-0.5 rounded-lg">
                                <Users className="w-3 h-3" /> {session.absent} ขาด
                              </span>

                              <div className="flex-1 mx-2">
                                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                  <div
                                    className="h-full bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, presentPercent)}%` }}
                                  />
                                </div>
                              </div>
                              <span className="font-mono text-xs font-bold text-slate-300">
                                {presentPercent}%
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}

                    {hasMore && (
                      <Link
                        href="/admin/sessions"
                        className="block w-full py-3 text-center text-xs font-bold text-cyan-300 bg-slate-900/90 hover:bg-slate-850 border border-cyan-500/30 rounded-2xl transition-all shadow-sm mt-3"
                      >
                        ดูคลาสเรียนทั้งหมดในระบบ ({filtered.length})
                      </Link>
                    )}
                  </div>
                </div>

                {/* Right Column: Graphs & Top Lists */}
                <div className="lg:col-span-1 space-y-6">
                  {/* Top Late Sessions Chart */}
                  <div className="p-5 sm:p-6 rounded-3xl glass bg-slate-900/75 border border-amber-500/30 shadow-xl relative overflow-hidden">
                    <div className="flex items-center gap-2.5 mb-5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm">คลาสที่คนเข้าสายมากที่สุด</h3>
                        <p className="text-[11px] text-slate-400">สถิติจำนวนนิสิตเข้าเรียนสาย</p>
                      </div>
                    </div>

                    {topLateSessions.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-6 font-mono">ไม่มีประวัติการเข้าสายในเทอมนี้</p>
                    ) : (
                      <div className="space-y-3.5">
                        {topLateSessions.map((s) => {
                          const maxLate = topLateSessions[0].late || 1;
                          const percent = Math.max(8, (s.late / maxLate) * 100);
                          return (
                            <Link
                              key={s.id}
                              href={`/admin/sessions/${s.id}`}
                              className="block group/bar hover:bg-slate-950/40 p-2 rounded-xl transition-colors"
                            >
                              <div className="flex justify-between text-xs mb-1.5">
                                <span className="font-semibold text-slate-300 group-hover/bar:text-cyan-300 truncate pr-2">
                                  {s.subjectCode} ({s.sessionDate})
                                </span>
                                <span className="font-mono font-bold text-amber-400 whitespace-nowrap">
                                  {s.late} คน
                                </span>
                              </div>
                              <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                <div
                                  className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-700"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Top Late Students List */}
                  <div className="p-5 sm:p-6 rounded-3xl glass bg-slate-900/75 border border-rose-500/30 shadow-xl relative overflow-hidden">
                    <div className="flex items-center gap-2.5 mb-5">
                      <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm">นิสิตที่เข้าสายบ่อยที่สุด</h3>
                        <p className="text-[11px] text-slate-400">5 อันดับแรกในภาคเรียนปัจจุบัน</p>
                      </div>
                    </div>

                    {topLateStudents.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-6 font-mono">ไม่มีประวัติการเข้าสายในเทอมนี้</p>
                    ) : (
                      <div className="space-y-2">
                        {topLateStudents.map((student, idx) => (
                          <Link
                            key={student.email}
                            href={student.id ? `/admin/students/${student.id}` : "#"}
                            className="p-2.5 rounded-xl flex items-center justify-between group/st hover:bg-slate-950/60 border border-transparent hover:border-slate-800 transition-all"
                          >
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              <div className="w-6 h-6 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-[10px] font-mono font-bold text-slate-400 group-hover/st:border-cyan-500/40 group-hover/st:text-cyan-300 shrink-0">
                                {idx + 1}
                              </div>
                              <div className="truncate">
                                <p className="text-xs font-bold text-white truncate group-hover/st:text-cyan-300 transition-colors">
                                  {student.name}
                                </p>
                                <p className="text-[10px] text-slate-500 truncate font-mono">{student.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-amber-300 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-lg shrink-0 font-mono text-xs font-bold">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>{student.count}</span>
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
      </div>
    </AppLayout>
  );
}

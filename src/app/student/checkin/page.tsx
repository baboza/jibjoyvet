"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import {
  MapPin,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Calendar,
  AlertCircle,
  RotateCw,
  Sparkles,
  Navigation,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";

interface Session {
  id: string;
  subjectId: string;
  locationId: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  lateTime: string;
  status: string;
  subjectName?: string;
  subjectCode?: string;
  locationName?: string;
  locationLat?: number;
  locationLng?: number;
  locationRadius?: number;
}

interface CheckinRecord {
  id: string;
  sessionId: string;
  status: "on-time" | "late" | string;
  createdAt: string;
  distance: number;
  accuracy?: number;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function CheckinPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [checkinsMap, setCheckinsMap] = useState<Record<string, CheckinRecord>>({});
  const [loadingData, setLoadingData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isUnenrolledPreview, setIsUnenrolledPreview] = useState(false);
  const [currentTimeStr, setCurrentTimeStr] = useState("");

  const [checkinState, setCheckinState] = useState<Record<string, "idle" | "loading" | "success" | "error" | "out-of-range">>({});
  const [checkinMsg, setCheckinMsg] = useState<Record<string, string>>({});

  // Clock in Asia/Bangkok
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleTimeString("th-TH", {
          timeZone: "Asia/Bangkok",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchActiveSessions = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      // 1. Timezone ไทย (Asia/Bangkok = UTC+7) เสมอ
      const todayTH = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

      // 2. ขนานดึงข้อมูลทั้งหมดด้วย Promise.all ป้องกันปัญหา Waterfall
      const [sessionsSnap, enrollSnap, checkinSnap, subjectsSnap, locationsSnap] = await Promise.all([
        getDocs(query(collection(db, "sessions"), where("sessionDate", "==", todayTH))),
        getDocs(query(collection(db, "enrollments"), where("email", "==", user.email))),
        getDocs(query(collection(db, "checkins"), where("email", "==", user.email))),
        getDocs(collection(db, "subjects")),
        getDocs(collection(db, "locations")),
      ]);

      // Map วิชา
      const subjectsMap: Record<string, { name: string; code: string }> = {};
      subjectsSnap.forEach((d) => {
        subjectsMap[d.id] = { name: d.data().name, code: d.data().code };
      });

      // Map สถานที่
      const locationsMap: Record<string, { name: string; lat: number; lng: number; radius: number }> = {};
      locationsSnap.forEach((d) => {
        const data = d.data();
        locationsMap[d.id] = {
          name: data.name,
          lat: data.lat,
          lng: data.lng,
          radius: data.radius || 300
        };
      });

      // Map รายวิชาที่นิสิตลงทะเบียน
      const enrolledSubjectIds = new Set<string>();
      enrollSnap.forEach((d) => {
        const subId = d.data().subjectId;
        if (subId) enrolledSubjectIds.add(String(subId));
      });

      // Map ประวัติการเช็คชื่อของนิสิต
      const myCheckins: Record<string, CheckinRecord> = {};
      checkinSnap.forEach((d) => {
        const data = d.data();
        if (data.sessionId) {
          myCheckins[data.sessionId] = {
            id: d.id,
            sessionId: data.sessionId,
            status: data.status,
            createdAt: data.createdAt,
            distance: data.distance,
            accuracy: data.accuracy,
          };
        }
      });
      setCheckinsMap(myCheckins);

      // กรอง Session
      const hasEnrollments = enrolledSubjectIds.size > 0;
      setIsUnenrolledPreview(!hasEnrollments);

      const result: Session[] = [];
      sessionsSnap.forEach((d) => {
        const data = d.data();
        // ถ้านิสิตมีวิชาลงทะเบียน ให้กรองเฉพาะวิชาที่ลงทะเบียน
        if (hasEnrollments && !enrolledSubjectIds.has(String(data.subjectId))) {
          return;
        }

        const subject = subjectsMap[data.subjectId] || {};
        const location = locationsMap[data.locationId] || {};
        result.push({
          id: d.id,
          subjectId: data.subjectId,
          locationId: data.locationId,
          sessionDate: data.sessionDate,
          startTime: data.startTime,
          endTime: data.endTime,
          lateTime: data.lateTime,
          status: data.status,
          subjectName: subject.name || "ไม่ระบุชื่อวิชา",
          subjectCode: subject.code || "VET-000",
          locationName: location.name || "ห้องเรียนคณะสัตวแพทย์",
          locationLat: location.lat,
          locationLng: location.lng,
          locationRadius: location.radius || 300,
        });
      });

      // เรียงตามเวลาเริ่ม
      result.sort((a, b) => a.startTime.localeCompare(b.startTime));
      setSessions(result);
    } catch (err) {
      console.error("Error fetching active sessions:", err);
    } finally {
      setLoadingData(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchActiveSessions();
  }, [fetchActiveSessions]);

  // ฟังก์ชันคำนวณช่วงเวลาคลาสเรียน
  const getSessionPhase = useCallback((session: Session) => {
    const now = new Date();
    const nowTH = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));

    const parseTime = (tStr?: string) => {
      const [h, m] = (tStr || "00:00").split(":").map(Number);
      const d = new Date(nowTH);
      d.setHours(h || 0, m || 0, 0, 0);
      return d;
    };

    const start = parseTime(session.startTime);
    const late = parseTime(session.lateTime);
    const end = parseTime(session.endTime);

    if (nowTH < start) {
      return { phase: "upcoming" as const, label: `เริ่มเรียน ${session.startTime} น.` };
    }
    if (nowTH > end) {
      return { phase: "expired" as const, label: `หมดเวลาเรียนแล้ว (${session.endTime} น.)` };
    }
    if (nowTH <= late) {
      return { phase: "on-time" as const, label: `ทันเวลา (ภายใน ${session.lateTime} น.)` };
    }
    return { phase: "late" as const, label: `สาย (หลัง ${session.lateTime} น.)` };
  }, []);

  const handleCheckin = (session: Session) => {
    // 1. ตรวจสอบว่าเช็คชื่อแล้วหรือไม่จาก State ทันที ไม่ต้องรอคิวรี
    if (checkinsMap[session.id]) {
      return;
    }

    setCheckinState((prev) => ({ ...prev, [session.id]: "loading" }));
    setCheckinMsg((prev) => ({ ...prev, [session.id]: "กำลังค้นหาสัญญาณดาวเทียม GPS..." }));

    if (!navigator.geolocation) {
      setCheckinState((prev) => ({ ...prev, [session.id]: "error" }));
      setCheckinMsg((prev) => ({ ...prev, [session.id]: "อุปกรณ์ไม่รองรับการระบุพิกัด GPS" }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (!session.locationLat || !session.locationLng) {
          setCheckinState((prev) => ({ ...prev, [session.id]: "error" }));
          setCheckinMsg((prev) => ({ ...prev, [session.id]: "ไม่พบพิกัดตำแหน่งห้องเรียนในระบบ" }));
          return;
        }

        const dist = haversineDistance(
          pos.coords.latitude,
          pos.coords.longitude,
          session.locationLat,
          session.locationLng
        );

        const radius = session.locationRadius || 300;

        if (dist > radius) {
          setCheckinState((prev) => ({ ...prev, [session.id]: "out-of-range" }));
          setCheckinMsg((prev) => ({
            ...prev,
            [session.id]: `อยู่ห่าง ${Math.round(dist)} เมตร (เกินรัศมีที่อนุญาต ${radius} ม.)`
          }));
          return;
        }

        // คำนวณ on-time / late โดยใช้เวลาไทย
        const nowTH = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
        const [lateH, lateM] = (session.lateTime || "00:00").split(":").map(Number);
        const lateLimit = new Date(nowTH);
        lateLimit.setHours(lateH, lateM, 0, 0);

        const isLate = nowTH > lateLimit;
        const status = isLate ? "late" : "on-time";

        const createdAtTH = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
        const accuracy = Math.round(pos.coords.accuracy || 0);

        try {
          const docRef = await addDoc(collection(db, "checkins"), {
            name: user!.name || "",
            email: user!.email || "",
            sessionId: session.id,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            distance: Math.round(dist),
            accuracy,
            status,
            createdAt: createdAtTH,
          });

          const newRecord: CheckinRecord = {
            id: docRef.id,
            sessionId: session.id,
            status,
            createdAt: createdAtTH,
            distance: Math.round(dist),
            accuracy,
          };

          // อัปเดต Map สถานะเช็คชื่อทันที ทำให้ปุ่มเปลี่ยนเป็นการ์ดสำเร็จทันที
          setCheckinsMap((prev) => ({ ...prev, [session.id]: newRecord }));
          setCheckinState((prev) => ({ ...prev, [session.id]: "success" }));
          setCheckinMsg((prev) => ({
            ...prev,
            [session.id]: status === "on-time"
              ? `เช็คชื่อสำเร็จ ทันเวลา (ระยะ ${Math.round(dist)} ม.)`
              : `เช็คชื่อสำเร็จ สาย (ระยะ ${Math.round(dist)} ม.)`,
          }));
        } catch (saveErr) {
          console.error("Error saving checkin:", saveErr);
          setCheckinState((prev) => ({ ...prev, [session.id]: "error" }));
          setCheckinMsg((prev) => ({ ...prev, [session.id]: "เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่" }));
        }
      },
      (err) => {
        let msg = "ไม่สามารถระบุพิกัดได้ กรุณาเปิด GPS";
        if (err.code === err.PERMISSION_DENIED) {
          msg = "กรุณาอนุญาตการเข้าถึงตำแหน่งพิกัด (Location Permission)";
        } else if (err.code === err.TIMEOUT) {
          msg = "หมดเวลาการค้นหาสัญญาณ GPS กรุณาลองใหม่อีกครั้ง";
        }
        setCheckinState((prev) => ({ ...prev, [session.id]: "error" }));
        setCheckinMsg((prev) => ({ ...prev, [session.id]: msg }));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString("th-TH", {
      timeZone: "Asia/Bangkok",
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, []);

  return (
    <AppLayout>
      <div className="relative min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-200 overflow-x-hidden pb-12">
        {/* Ambient Glowing Orbs (Virus Go Aesthetic) */}
        <div className="absolute top-[5%] left-[8%] w-[45%] h-[45%] rounded-full bg-cyan-500/10 blur-[130px] pointer-events-none -z-0 animate-pulse"></div>
        <div className="absolute top-[35%] right-[8%] w-[35%] h-[35%] rounded-full bg-purple-500/10 blur-[140px] pointer-events-none -z-0"></div>
        <div className="absolute bottom-[10%] left-[20%] w-[40%] h-[40%] rounded-full bg-emerald-500/10 blur-[130px] pointer-events-none -z-0"></div>

        <div className="relative z-10 max-w-xl mx-auto px-4 pt-6 sm:pt-8">
          {/* Top Status Pill */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-cyan-500/40 backdrop-blur-xl text-[11px] sm:text-xs font-bold text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)] uppercase tracking-wider mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
              <span>SMART GPS CHECK-IN PORTAL</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300 font-normal">{todayFormatted}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white uppercase drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)]">
              คลาสเรียน<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400">วันนี้</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1.5 max-w-sm leading-relaxed">
              ยืนยันการเข้าห้องเรียนด้วยระบบตรวจสอบพิกัดความแม่นยำสูง
            </p>
          </div>

          {/* Time & Control Bar */}
          <div className="flex items-center justify-between p-3 px-4 rounded-2xl glass bg-slate-900/60 border border-slate-800/80 mb-6 shadow-lg">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
              <Clock className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />
              <span>เวลาปัจจุบัน:</span>
              <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                {currentTimeStr || "--:--:--"}
              </span>
            </div>
            <button
              onClick={fetchActiveSessions}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 transition-all text-xs font-bold active:scale-95 disabled:opacity-60"
            >
              <RotateCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-cyan-400" : ""}`} />
              <span>{refreshing ? "กำลังโหลด..." : "รีเฟรช"}</span>
            </button>
          </div>

          {/* Unenrolled Notice Banner (Only if student has no enrollments in DB) */}
          {isUnenrolledPreview && (
            <div className="mb-5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5 backdrop-blur-md">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <div>
                <p className="font-bold">โหมดดูตัวอย่าง (ยังไม่มีรายวิชาที่ลงทะเบียนไว้)</p>
                <p className="text-[11px] text-amber-300/80">ระบบกำลังแสดงคลาสเรียนทั้งหมดของวันนี้เพื่อให้คุณสามารถทดสอบเช็คชื่อได้</p>
              </div>
            </div>
          )}

          {/* Sessions List */}
          {loadingData ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin"></div>
                <Sparkles className="w-5 h-5 text-cyan-400 absolute inset-0 m-auto animate-pulse" />
              </div>
              <p className="text-xs font-mono text-slate-400 tracking-wider">กำลังโหลดข้อมูลคลาสเรียน...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="relative p-10 sm:p-12 rounded-3xl glass bg-slate-900/60 border border-slate-800/80 text-center shadow-2xl backdrop-blur-xl overflow-hidden">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-500">
                <Clock className="w-8 h-8 text-cyan-400/60" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">ไม่มีคลาสเรียนในวันนี้</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                ไม่มีกำหนดการเรียนการสอนสำหรับรายวิชาของคุณในวันที่ {todayFormatted}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {sessions.map((session) => {
                const existingCheckin = checkinsMap[session.id];
                const state = checkinState[session.id] || (existingCheckin ? "success" : "idle");
                const msg = checkinMsg[session.id] || "";
                const timing = getSessionPhase(session);
                const isSessionActive = session.status === "active";
                const isExpired = timing.phase === "expired";
                const isUpcoming = timing.phase === "upcoming";

                return (
                  <div
                    key={session.id}
                    className="relative group p-5 sm:p-6 rounded-3xl glass bg-slate-900/75 border border-slate-800/90 hover:border-cyan-500/40 transition-all duration-300 shadow-xl overflow-hidden backdrop-blur-xl"
                  >
                    {/* Ambient Glow Corner */}
                    <div className="absolute top-0 right-0 w-36 h-36 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none -z-0"></div>

                    {/* Top Row: Subject Code & Status Tag */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="px-3 py-1 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold tracking-wider shadow-sm">
                        {session.subjectCode}
                      </span>

                      {existingCheckin ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-xs font-bold">
                          <CheckCircle className="w-3.5 h-3.5" />
                          {existingCheckin.status === "on-time" ? "เช็คชื่อทันเวลา" : "เช็คชื่อสาย"}
                        </span>
                      ) : !isSessionActive ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-400 text-xs font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          ยังไม่เปิดเช็คชื่อ
                        </span>
                      ) : isExpired ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-500/40 text-rose-400 text-xs font-bold">
                          <AlertCircle className="w-3.5 h-3.5" />
                          หมดเวลาเรียน
                        </span>
                      ) : isUpcoming ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs font-bold">
                          <Clock className="w-3.5 h-3.5" />
                          ยังไม่ถึงเวลาเริ่ม
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          เปิดรับเช็คชื่อ
                        </span>
                      )}
                    </div>

                    {/* Subject Name */}
                    <h2 className="text-lg sm:text-xl font-bold text-white mb-4 leading-snug group-hover:text-cyan-200 transition-colors">
                      {session.subjectName}
                    </h2>

                    {/* Session Info Chips */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400 mb-5">
                      <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800/80 rounded-xl px-3 py-2">
                        <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>{session.sessionDate}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800/80 rounded-xl px-3 py-2">
                        <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{session.startTime} – {session.endTime} น.</span>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800/80 rounded-xl px-3 py-2">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>สายหลัง {session.lateTime} น.</span>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800/80 rounded-xl px-3 py-2">
                        <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                        <span className="truncate">{session.locationName} ({session.locationRadius} ม.)</span>
                      </div>
                    </div>

                    {/* Action & Result Section */}
                    {existingCheckin ? (
                      /* กรณีที่เช็คชื่อสำเร็จแล้ว (ตรวจพบตั้งแต่โหลดหน้า) */
                      <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 flex items-center justify-between gap-3 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                            <CheckCircle className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm font-bold text-white">
                              {existingCheckin.status === "on-time"
                                ? "เช็คชื่อเข้าเรียนสำเร็จ (ทันเวลา)"
                                : "เช็คชื่อเข้าเรียนสำเร็จ (สาย)"}
                            </p>
                            <p className="text-[11px] text-emerald-400/80 mt-0.5">
                              ระยะ {existingCheckin.distance} เมตร • บันทึกเมื่อ {existingCheckin.createdAt}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-extrabold uppercase px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                          {existingCheckin.status === "on-time" ? "ON-TIME" : "LATE"}
                        </span>
                      </div>
                    ) : !isSessionActive ? (
                      /* กรณีอาจารย์ยังไม่เปิดรับเช็คชื่อ */
                      <div className="flex items-center justify-center gap-2 bg-slate-950/70 text-slate-400 text-xs font-semibold px-4 py-3.5 rounded-2xl border border-dashed border-slate-800">
                        <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                        <span>อาจารย์ผู้สอนยังไม่เปิดระบบรับเช็คชื่อสำหรับคลาสนี้</span>
                      </div>
                    ) : isExpired ? (
                      /* กรณีหมดเวลาเรียน */
                      <div className="flex items-center justify-center gap-2 bg-rose-950/20 text-rose-400 text-xs font-semibold px-4 py-3.5 rounded-2xl border border-rose-900/40">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>หมดเวลาเช็คชื่อแล้ว (สิ้นสุดเวลา {session.endTime} น.)</span>
                      </div>
                    ) : isUpcoming ? (
                      /* กรณียังไม่ถึงเวลาเริ่มเรียน */
                      <div className="flex items-center justify-center gap-2 bg-slate-950/70 text-slate-400 text-xs font-semibold px-4 py-3.5 rounded-2xl border border-slate-800">
                        <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>ยังไม่ถึงเวลาเรียน (ระบบจะเปิดให้เช็คเวลา {session.startTime} น.)</span>
                      </div>
                    ) : (
                      /* กรณีพร้อมเช็คชื่อ */
                      <div className="flex flex-col gap-2">
                        {state === "out-of-range" && (
                          <div className="flex items-center gap-2 bg-rose-950/40 text-rose-300 text-xs font-medium px-4 py-2.5 rounded-xl border border-rose-500/30">
                            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            <span>{msg}</span>
                          </div>
                        )}
                        {state === "error" && (
                          <div className="flex items-center gap-2 bg-amber-950/40 text-amber-300 text-xs font-medium px-4 py-2.5 rounded-xl border border-amber-500/30">
                            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>{msg}</span>
                          </div>
                        )}

                        <div className="relative group/btn w-full">
                          {/* Virus Go Glowing Button Halo */}
                          <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 rounded-2xl blur-md opacity-70 group-hover/btn:opacity-100 transition duration-300 animate-pulse"></div>

                          <button
                            onClick={() => handleCheckin(session)}
                            disabled={state === "loading"}
                            className="relative w-full bg-slate-950 hover:bg-slate-900 active:scale-[0.98] border border-cyan-400/40 text-white font-extrabold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-xl"
                          >
                            {state === "loading" ? (
                              <>
                                <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                                <span className="text-cyan-300 text-xs font-mono">{msg || "กำลังระบุพิกัดความแม่นยำสูง..."}</span>
                              </>
                            ) : (
                              <>
                                <Navigation className="w-4 h-4 text-cyan-400 animate-bounce" />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-teal-200 to-emerald-300 text-sm tracking-wide">
                                  เช็คชื่อเข้าเรียน (GPS)
                                </span>
                                <ShieldCheck className="w-4 h-4 text-emerald-400 ml-1" />
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

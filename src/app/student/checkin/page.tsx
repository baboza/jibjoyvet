"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { MapPin, CheckCircle, XCircle, Clock, Loader2, Calendar, AlertCircle } from "lucide-react";

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
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [checkinState, setCheckinState] = useState<Record<string, "idle" | "loading" | "success" | "error" | "out-of-range">>({});
  const [checkinMsg, setCheckinMsg] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    fetchActiveSessions();
  }, [user]);

  const fetchActiveSessions = async () => {
    try {
      // ใช้ timezone ไทย (Asia/Bangkok = UTC+7) เสมอ ไม่ขึ้นกับ timezone ของอุปกรณ์
      const todayTH = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
      // en-CA format = YYYY-MM-DD ซึ่งตรงกับที่ sessionDate เก็บในฐานข้อมูล
      
      const q = query(
        collection(db, "sessions"),
        where("sessionDate", "==", todayTH)
      );
      const sessionSnap = await getDocs(q);

      const subjectsSnap = await getDocs(collection(db, "subjects"));
      const locationsSnap = await getDocs(collection(db, "locations"));

      const subjectsMap: Record<string, { name: string; code: string }> = {};
      subjectsSnap.forEach((d) => { subjectsMap[d.id] = { name: d.data().name, code: d.data().code }; });

      const locationsMap: Record<string, { name: string; lat: number; lng: number; radius: number }> = {};
      locationsSnap.forEach((d) => {
        locationsMap[d.id] = { name: d.data().name, lat: d.data().lat, lng: d.data().lng, radius: d.data().radius };
      });

      const result: Session[] = [];
      sessionSnap.forEach((d) => {
        const data = d.data();
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
          subjectName: subject.name,
          subjectCode: subject.code,
          locationName: location.name,
          locationLat: location.lat,
          locationLng: location.lng,
          locationRadius: location.radius || 300,
        });
      });

      setSessions(result);
    } catch (err) {
      console.error("Error fetching sessions:", err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleCheckin = (session: Session) => {
    setCheckinState((prev) => ({ ...prev, [session.id]: "loading" }));
    setCheckinMsg((prev) => ({ ...prev, [session.id]: "กำลังดึงตำแหน่ง GPS..." }));

    if (!navigator.geolocation) {
      setCheckinState((prev) => ({ ...prev, [session.id]: "error" }));
      setCheckinMsg((prev) => ({ ...prev, [session.id]: "เบราว์เซอร์ไม่รองรับ GPS" }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, session.locationLat!, session.locationLng!);

        if (dist > session.locationRadius!) {
          setCheckinState((prev) => ({ ...prev, [session.id]: "out-of-range" }));
          setCheckinMsg((prev) => ({ ...prev, [session.id]: `อยู่ห่าง ${Math.round(dist)} เมตร เกินรัศมี ${session.locationRadius} เมตร` }));
          return;
        }

        // ตรวจสอบว่าเช็คชื่อแล้วยัง
        const existing = await getDocs(query(collection(db, "checkins"), where("email", "==", user!.email), where("sessionId", "==", session.id)));
        if (!existing.empty) {
          setCheckinState((prev) => ({ ...prev, [session.id]: "success" }));
          setCheckinMsg((prev) => ({ ...prev, [session.id]: "เช็คชื่อแล้ว (เช็คซ้ำไม่ได้)" }));
          return;
        }

        // คำนวณสถานะ on-time / late โดยใช้เวลาไทย (Asia/Bangkok = UTC+7)
        const nowTH = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
        const [lateH, lateM] = session.lateTime.split(":").map(Number);
        const lateLimit = new Date(nowTH);
        lateLimit.setHours(lateH, lateM, 0, 0);
        const status = nowTH <= lateLimit ? "on-time" : "late";

        // เก็บเวลาไทยใน Firestore
        const createdAtTH = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });

        await addDoc(collection(db, "checkins"), {
          name: user!.name,
          email: user!.email,
          sessionId: session.id,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          distance: Math.round(dist),
          status,
          createdAt: createdAtTH,
        });

        setCheckinState((prev) => ({ ...prev, [session.id]: "success" }));
        setCheckinMsg((prev) => ({
          ...prev,
          [session.id]: status === "on-time"
            ? `เช็คชื่อสำเร็จ ทันเวลา (ระยะ ${Math.round(dist)} ม.)`
            : `เช็คชื่อสำเร็จ สาย (ระยะ ${Math.round(dist)} ม.)`,
        }));
      },
      () => {
        setCheckinState((prev) => ({ ...prev, [session.id]: "error" }));
        setCheckinMsg((prev) => ({ ...prev, [session.id]: "ไม่สามารถดึงตำแหน่งได้ กรุณาเปิด GPS" }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto px-4 py-6">
        {/* User Card */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 flex items-center gap-3 border border-pink-100">
          {user?.photoURL ? (
            <img src={user.photoURL} className="w-12 h-12 rounded-full" alt="avatar" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-pink-200 flex items-center justify-center text-pink-600 font-bold text-lg">
              {user?.name?.[0]}
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-800">{user?.name}</p>
            <p className="text-xs text-gray-400">{user?.email}</p>
          </div>
        </div>

        {/* Sessions */}
        <h2 className="text-lg font-bold text-gray-700 mb-3">คลาสเรียนวันนี้</h2>

        {loadingData ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-pink-100">
            <Clock className="w-12 h-12 text-pink-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">ไม่มีคลาสเรียนในวันนี้</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {sessions.map((session) => {
              const state = checkinState[session.id] || "idle";
              const msg = checkinMsg[session.id] || "";
              return (
                <div key={session.id} className="bg-white rounded-2xl shadow-sm border border-pink-100 overflow-hidden">
                  <div className={`px-5 py-3 ${session.status === 'active' ? 'bg-pink-500' : 'bg-gray-400'}`}>
                    <div className="flex justify-between items-center">
                      <p className="text-white font-bold text-sm">{session.subjectCode}</p>
                      {session.status !== 'active' && (
                        <span className="text-xs bg-gray-500 text-white px-2 py-0.5 rounded-full font-medium">ยังไม่เปิดเช็คชื่อ</span>
                      )}
                    </div>
                    <p className="text-white/80 text-xs mt-1">{session.subjectName}</p>
                  </div>
                  <div className="p-5">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mb-1">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-pink-400" /> {session.sessionDate}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {session.startTime} – {session.endTime}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mb-4">
                      <span className="flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 text-amber-400" /> สายหลัง {session.lateTime}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {session.locationName}</span>
                    </div>

                    {session.status !== 'active' ? (
                      <div className="flex items-center justify-center gap-2 bg-gray-50 text-gray-400 text-sm font-medium px-4 py-3 rounded-xl border border-dashed border-gray-200">
                        <Clock className="w-5 h-5 flex-shrink-0" />
                        คลาสนี้ยังไม่เปิดรับเช็คชื่อ
                      </div>
                    ) : state === "success" ? (
                      <div className="flex items-center gap-2 bg-green-50 text-green-700 text-sm font-medium px-4 py-3 rounded-xl">
                        <CheckCircle className="w-5 h-5 flex-shrink-0" />
                        {msg}
                      </div>
                    ) : state === "out-of-range" ? (
                      <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm font-medium px-4 py-3 rounded-xl">
                        <XCircle className="w-5 h-5 flex-shrink-0" />
                        {msg}
                      </div>
                    ) : state === "error" ? (
                      <div className="flex items-center gap-2 bg-orange-50 text-orange-600 text-sm font-medium px-4 py-3 rounded-xl">
                        <XCircle className="w-5 h-5 flex-shrink-0" />
                        {msg}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleCheckin(session)}
                        disabled={state === "loading"}
                        className="w-full bg-pink-500 hover:bg-pink-600 disabled:opacity-60 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                      >
                        {state === "loading" ? (
                          <><Loader2 className="w-5 h-5 animate-spin" />{msg || "กำลังดำเนินการ..."}</>
                        ) : (
                          <><MapPin className="w-5 h-5" />เช็คชื่อเข้าเรียน</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

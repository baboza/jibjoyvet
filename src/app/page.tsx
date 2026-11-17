"use client";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Loader2,
  MapPin,
  Gamepad2,
  Sparkles,
  ArrowRight,
  CheckCircle,
  GraduationCap,
  BarChart3,
  ShieldCheck,
  Clock,
  Radio,
  ExternalLink,
  ChevronRight,
  Heart
} from "lucide-react";

// Google icon component
function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function Home() {
  const { user, loading, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push(user.role === "admin" ? "/admin" : "/student/checkin");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="relative">
          <div className="w-14 h-14 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin"></div>
          <Sparkles className="w-6 h-6 text-cyan-400 absolute inset-0 m-auto animate-pulse" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 relative overflow-x-hidden flex flex-col justify-between selection:bg-cyan-500/30 selection:text-white">
      {/* ── Ambient Glowing Orbs (Virus Go Signature Glow) ── */}
      <div className="fixed top-[-100px] left-[-80px] w-[550px] h-[550px] rounded-full bg-cyan-500/15 blur-[140px] pointer-events-none -z-0 animate-pulse" />
      <div className="fixed top-[30%] right-[-100px] w-[500px] h-[500px] rounded-full bg-purple-500/15 blur-[150px] pointer-events-none -z-0" />
      <div className="fixed bottom-[-100px] left-[20%] w-[550px] h-[550px] rounded-full bg-amber-500/10 blur-[140px] pointer-events-none -z-0" />

      <div className="relative z-10 flex-grow">
        {/* ── TOP NAV ── */}
        <nav className="flex items-center justify-between px-6 md:px-12 py-5 max-w-7xl mx-auto border-b border-slate-800/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-cyan-500/20 to-emerald-500/10 border border-cyan-500/40 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <Sparkles className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-white text-lg tracking-tight uppercase flex items-center gap-1">
                JIBJOY<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400">VET</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">HUB</span>
              </span>
              <span className="text-[9px] text-slate-400 uppercase tracking-widest font-mono hidden sm:inline">
                Faculty of Veterinary Sciences · MSU
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-slate-400 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Smart GPS Campus Gateway</span>
            </div>

            <button
              onClick={() => setShowLogin(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 text-xs font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)] active:scale-95"
            >
              <span>เข้าสู่ระบบ</span>
              <ChevronRight className="w-3.5 h-3.5 text-cyan-400" />
            </button>
          </div>
        </nav>

        {/* ── HERO SECTION ── */}
        <section className="text-center px-4 sm:px-6 pt-12 sm:pt-16 pb-16 max-w-4xl mx-auto">
          {/* Top Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/80 border border-cyan-500/40 backdrop-blur-xl text-xs font-bold text-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.25)] uppercase tracking-wide mb-6">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>AI-POWERED VET EDUCATION PLATFORM</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
          </div>

          <h1 className="text-4xl xs:text-5xl sm:text-6xl md:text-7xl font-black text-white leading-tight tracking-tight mb-6 uppercase drop-shadow-[0_10px_35px_rgba(0,0,0,0.8)]">
            VET<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400">CHECK</span> &amp;{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-300 drop-shadow-[0_0_35px_rgba(16,185,129,0.5)]">
              LEARNING
            </span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-lg leading-relaxed max-w-2xl mx-auto font-normal px-2">
            แพลตฟอร์มการจัดการเรียนการสอนและเช็คชื่อเข้าชั้นเรียนด้วยพิกัด GPS ความแม่นยำสูง
            ควบคู่กับระบบเกมการเรียนรู้ไวรัสวิทยาและเกมจำลองการดูแลสัตว์เลี้ยง 3D สำหรับนิสิตและคณาจารย์คณะสัตวแพทยศาสตร์ มหาวิทยาลัยมหาสารคาม
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-8">
            {[
              { icon: MapPin, label: "GPS Attendance", color: "text-cyan-400" },
              { icon: BarChart3, label: "Live Analytics", color: "text-emerald-400" },
              { icon: Gamepad2, label: "Virus Go Games", color: "text-purple-400" },
              { icon: Heart, label: "VetSim 3D Pets", color: "text-amber-400" },
            ].map(({ icon: Icon, label, color }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 bg-slate-900/60 border border-slate-800 text-slate-300 text-xs font-semibold px-3.5 py-1.5 rounded-xl shadow-sm backdrop-blur-sm"
              >
                <Icon className={`w-3.5 h-3.5 ${color}`} />
                {label}
              </span>
            ))}
          </div>
        </section>

        {/* ── MODULE CARDS ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          
          {/* Card 1: Vet Checkin */}
          <div className="group relative rounded-3xl glass bg-slate-900/75 border border-cyan-500/30 hover:border-cyan-400/80 transition-all duration-300 shadow-2xl overflow-hidden hover:-translate-y-1 flex flex-col justify-between">
            {/* Top gradient accent line */}
            <div className="h-1 bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400" />
            <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="p-7 sm:p-8 relative z-10 flex flex-col justify-between h-full">
              <div>
                {/* Icon & Badge */}
                <div className="flex items-center justify-between mb-5">
                  <div className="w-14 h-14 bg-gradient-to-br from-cyan-500/20 to-emerald-500/10 border border-cyan-500/40 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                    <MapPin className="w-7 h-7 text-cyan-400" strokeWidth={2} />
                  </div>
                  <div className="inline-flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live &amp; Ready
                  </div>
                </div>

                <h2 className="text-2xl font-black text-white mb-2 tracking-tight">
                  ระบบเช็คชื่อ <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-emerald-300">Vet Checkin</span>
                </h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  เช็คชื่อเข้าชั้นเรียนด้วยระบบพิกัด GPS ตรวจสอบรัศมีอัตโนมัติ คำนวณสถานะตรงเวลา/สาย พร้อมรายงานสถิติแบบเรียลไทม์
                </p>

                <div className="space-y-2.5 mb-8">
                  {[
                    "ตรวจสอบพิกัด GPS อัตโนมัติในรัศมีที่กำหนด",
                    "เช็คชื่อทันใจ ไม่ต้องรอคิว ลดเวลาในห้องเรียน",
                    "แดชบอร์ดสรุปสถิติสำหรับอาจารย์ผู้สอน",
                  ].map((f) => (
                    <div key={f} className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-300">
                      <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="relative group/btn w-full mt-2">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-2xl blur-md opacity-60 group-hover/btn:opacity-100 transition duration-300"></div>
                <button
                  onClick={() => setShowLogin(true)}
                  className="relative w-full bg-slate-950 hover:bg-slate-900 border border-cyan-400/50 text-white font-extrabold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl active:scale-[0.98]"
                >
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-teal-200 to-emerald-300 text-sm tracking-wide">
                    เข้าสู่ระบบเช็คชื่อ
                  </span>
                  <ArrowRight className="w-4 h-4 text-cyan-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Virus Go */}
          <div className="group relative rounded-3xl glass bg-slate-900/75 border border-purple-500/30 hover:border-purple-400/80 transition-all duration-300 shadow-2xl overflow-hidden hover:-translate-y-1 flex flex-col justify-between">
            {/* Top gradient accent line */}
            <div className="h-1 bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-500" />
            <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="p-7 sm:p-8 relative z-10 flex flex-col justify-between h-full">
              <div>
                {/* Icon & Badge */}
                <div className="flex items-center justify-between mb-5">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-500/20 to-fuchsia-500/10 border border-purple-500/40 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <Gamepad2 className="w-7 h-7 text-purple-400" strokeWidth={2} />
                  </div>
                  <div className="inline-flex items-center gap-1.5 bg-purple-950/60 border border-purple-500/40 text-purple-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    Gamified Learning
                  </div>
                </div>

                <h2 className="text-2xl font-black text-white mb-2 tracking-tight">
                  เกมการเรียนรู้ <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Virus Go</span>
                </h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  แพลตฟอร์ม Game-Based Learning เปลี่ยน 15 บทเรียนวิชาไวรัสวิทยาสัตวแพทย์ให้เป็นภารกิจเกมสุดท้าทาย สนุก กระชับ ตอบทันใจ
                </p>

                <div className="space-y-2.5 mb-8">
                  {[
                    "ภารกิจแล็บสืบสวนโรคและเคสทางคลินิก (Lab Detective)",
                    "ระบบแข่งขันตอบคำถามในห้องเรียนแบบเรียลไทม์",
                    "จำลองการระบาดของไวรัสเพื่อฝึกวางแผนรับมือ",
                  ].map((f) => (
                    <div key={f} className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-300">
                      <CheckCircle className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="relative group/btn w-full mt-2">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-fuchsia-500 rounded-2xl blur-md opacity-60 group-hover/btn:opacity-100 transition duration-300"></div>
                <a
                  href="https://virusgo.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative w-full bg-slate-950 hover:bg-slate-900 border border-purple-400/50 text-white font-extrabold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl active:scale-[0.98]"
                >
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-fuchsia-200 to-pink-300 text-sm tracking-wide">
                    เปิดเล่น Virus Go
                  </span>
                  <ExternalLink className="w-4 h-4 text-purple-400" />
                </a>
              </div>
            </div>
          </div>

          {/* Card 3: VetSim Home */}
          <div className="group relative rounded-3xl glass bg-slate-900/75 border border-amber-500/30 hover:border-amber-400/80 transition-all duration-300 shadow-2xl overflow-hidden hover:-translate-y-1 flex flex-col justify-between">
            {/* Top gradient accent line */}
            <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400" />
            <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="p-7 sm:p-8 relative z-10 flex flex-col justify-between h-full">
              <div>
                {/* Icon & Badge */}
                <div className="flex items-center justify-between mb-5">
                  <div className="w-14 h-14 bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/40 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <Heart className="w-7 h-7 text-amber-400 fill-amber-400/20" strokeWidth={2} />
                  </div>
                  <div className="inline-flex items-center gap-1.5 bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    3D Simulation
                  </div>
                </div>

                <h2 className="text-2xl font-black text-white mb-2 tracking-tight">
                  เกมจำลองสัตว์เลี้ยง <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-300 to-yellow-300">VetSim Home</span>
                </h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  บ้านฟาร์มรักสัตว์เลี้ยง 3D จำลองการดูแล สุนัข แมว และกระต่าย เสมือนจริง ฝึกทักษะสังเกตอาการและดูแลสุขภาพสัตว์
                </p>

                <div className="space-y-2.5 mb-8">
                  {[
                    "แบบจำลอง 3D สุนัข • แมว • กระต่าย (Three.js)",
                    "ฝึกให้อาหาร อาบน้ำแปรงขน และสังเกตพฤติกรรมสัตว์",
                    "เซฟความคืบหน้าขึ้น Cloud ผ่าน Google Account",
                  ].map((f) => (
                    <div key={f} className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-300">
                      <CheckCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="relative group/btn w-full mt-2">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 rounded-2xl blur-md opacity-60 group-hover/btn:opacity-100 transition duration-300"></div>
                <a
                  href="https://vetpet-silk.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative w-full bg-slate-950 hover:bg-slate-900 border border-amber-400/50 text-white font-extrabold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl active:scale-[0.98]"
                >
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-200 to-yellow-200 text-sm tracking-wide">
                    เปิดเล่น VetSim Home (3D Farm)
                  </span>
                  <ExternalLink className="w-4 h-4 text-amber-400" />
                </a>
              </div>
            </div>
          </div>

        </section>
      </div>

      {/* ── FOOTER ── */}
      <footer className="text-center py-8 px-6 border-t border-slate-800/80 backdrop-blur-md">
        <div className="flex flex-col items-center gap-1.5 mb-2">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-cyan-400" />
            <span className="text-xs sm:text-sm font-bold text-slate-300">
              Faculty of Veterinary Sciences, Mahasarakham University
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Developed by <span className="font-semibold text-cyan-400">DVM Wilasinee Surasa</span>
          </p>
        </div>
        <p className="text-[11px] text-slate-600 font-mono">© 2026 JIBJOYVET · All rights reserved</p>
      </footer>

      {/* ── LOGIN MODAL (Virus Go Dark Glassmorphic) ── */}
      {showLogin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
          onClick={() => setShowLogin(false)}
        >
          <div
            className="relative glass bg-slate-950/95 border border-cyan-500/40 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.25)] w-full max-w-sm p-7 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient Modal Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={() => setShowLogin(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl transition-colors"
            >
              ✕
            </button>

            {/* Icon */}
            <div className="w-14 h-14 bg-gradient-to-br from-cyan-500/20 to-emerald-500/10 border border-cyan-500/40 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20 mx-auto mb-4">
              <MapPin className="w-7 h-7 text-cyan-400" strokeWidth={2} />
            </div>

            <h3 className="text-xl font-black text-white text-center mb-1 uppercase tracking-tight">
              VET<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">CHECK</span>
            </h3>
            <p className="text-slate-400 text-xs text-center mb-6">
              เข้าสู่ระบบด้วยบัญชี Google ของมหาวิทยาลัย
            </p>

            <button
              onClick={loginWithGoogle}
              className="w-full flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-850 border border-cyan-500/40 hover:border-cyan-400 text-white font-bold py-3.5 px-4 rounded-2xl transition-all shadow-lg active:scale-95 group"
            >
              <div className="bg-white rounded-lg p-1 shadow-sm shrink-0">
                <GoogleIcon />
              </div>
              <span className="text-xs sm:text-sm font-bold text-slate-200 group-hover:text-white">
                Continue with Google
              </span>
            </button>

            <div className="mt-5 pt-4 border-t border-slate-800 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                ใช้อีเมล <span className="font-bold text-cyan-300 font-mono">@msu.ac.th</span> เท่านั้น
              </span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

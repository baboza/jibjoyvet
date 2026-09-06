"use client";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Loader2, MapPin, Gamepad2, Sparkles,
  ArrowRight, CheckCircle, GraduationCap, BarChart3, ShieldCheck, Clock
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
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pink-50 via-white to-rose-50">
        <Loader2 className="w-10 h-10 text-pink-400 animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50 relative overflow-hidden">

      {/* Ambient blobs */}
      <div className="fixed top-[-120px] right-[-120px] w-[500px] h-[500px] rounded-full bg-pink-200/40 blur-3xl pointer-events-none -z-0" />
      <div className="fixed bottom-[-100px] left-[-100px] w-[400px] h-[400px] rounded-full bg-rose-200/35 blur-3xl pointer-events-none -z-0" />
      <div className="fixed top-1/2 right-1/3 w-[250px] h-[250px] rounded-full bg-pink-100/50 blur-2xl pointer-events-none -z-0" />

      <div className="relative z-10">

        {/* ── NAV ── */}
        <nav className="flex items-center justify-between px-6 md:px-12 py-5 max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl flex items-center justify-center shadow-md shadow-pink-200">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-gray-800 text-lg tracking-tight">
              Jibjoy<span className="text-pink-500">VetHub</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
            Faculty of Veterinary Sciences · MSU
          </div>
        </nav>

        {/* ── HERO ── */}
        <section className="text-center px-6 pt-12 pb-20 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-pink-100 text-pink-600 text-xs font-bold px-4 py-2 rounded-full border border-pink-200 shadow-sm mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered Vet Education Platform
          </div>

          <h1 className="text-5xl md:text-6xl font-black text-gray-900 leading-tight tracking-tight mb-6">
            Educational Tools for<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-500">
              Veterinary Medicine
            </span>
          </h1>

          <p className="text-gray-500 text-lg leading-relaxed max-w-xl mx-auto">
            A comprehensive platform for veterinary students and faculty —
            featuring AI-powered attendance tracking and game-based learning.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
            {[
              { icon: MapPin, label: "GPS Check-in" },
              { icon: BarChart3, label: "Analytics" },
              { icon: Gamepad2, label: "Game Learning" },
              { icon: Clock, label: "Real-time" },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5 bg-white text-gray-600 text-sm font-semibold px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
                <Icon className="w-4 h-4 text-pink-400" />
                {label}
              </span>
            ))}
          </div>
        </section>

        {/* ── MODULE CARDS ── */}
        <section className="max-w-5xl mx-auto px-6 pb-24 grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Card 1: Vet Checkin */}
          <div className="group relative bg-white/80 backdrop-blur-sm rounded-3xl border border-pink-100 shadow-xl shadow-pink-100/50 overflow-hidden hover:-translate-y-1 transition-all duration-300">
            {/* Top gradient bar */}
            <div className="h-1.5 bg-gradient-to-r from-pink-400 to-rose-500" />

            <div className="p-8">
              {/* Icon */}
              <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl flex items-center justify-center shadow-lg shadow-pink-200 mb-6">
                <MapPin className="w-7 h-7 text-white" strokeWidth={1.5} />
              </div>

              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 bg-green-50 text-green-600 text-xs font-bold px-2.5 py-1 rounded-full mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Live & Ready
              </div>

              <h2 className="text-2xl font-black text-gray-900 mb-2">Vet Checkin</h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                AI-powered GPS attendance system — track student check-ins, analyze statistics, and generate instant reports.
              </p>

              <div className="space-y-2.5 mb-8">
                {["Precise GPS location check-in", "Analytics dashboard & statistics", "Mobile & PC friendly"].map(f => (
                  <div key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-pink-400 flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowLogin(true)}
                className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold py-3.5 rounded-2xl transition-all shadow-lg shadow-pink-200 hover:shadow-pink-300 hover:scale-[1.02] active:scale-[0.98] duration-200"
              >
                Get Started — Vet Checkin
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Card 2: Virus Go */}
          <div className="group relative rounded-3xl overflow-hidden hover:-translate-y-1 transition-all duration-300 shadow-xl shadow-slate-800/30">
            {/* Dark background */}
            <div className="absolute inset-0 bg-slate-950" />
            {/* Glow effects */}
            <div className="absolute top-0 left-1/4 w-3/4 h-1/2 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-1/2 h-1/2 rounded-full bg-violet-500/15 blur-3xl pointer-events-none" />
            {/* Top gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-400 via-violet-500 to-pink-500" />

            <div className="relative p-8">
              {/* Icon */}
              <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/30 mb-6">
                <Gamepad2 className="w-7 h-7 text-white" strokeWidth={1.5} />
              </div>

              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold px-2.5 py-1 rounded-full mb-4 uppercase tracking-wide">
                <Sparkles className="w-3 h-3" />
                Game-Based Learning
              </div>

              <h2 className="text-2xl font-black text-white mb-2">Virus<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400"> Go</span></h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                The ultimate game-based learning platform — conquer Veterinary Virology through interactive missions, clinical cases, and outbreak simulations.
              </p>

              <div className="space-y-2.5 mb-8">
                {["Lab Detective & Clinical Cases", "Multiplayer Classroom Battles", "Boss Virus Outbreak Simulation"].map(f => (
                  <div key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>

              <a
                href="https://virusgo.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-bold py-3.5 rounded-2xl transition-all shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98] duration-200"
              >
                Launch Virus Go
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>

        </section>

        {/* ── FOOTER ── */}
        <footer className="text-center pb-10 px-6">
          <div className="flex flex-col items-center gap-1 mb-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-pink-400" />
              <span className="text-sm font-bold text-gray-600">Faculty of Veterinary Sciences, Mahasarakham University</span>
            </div>
            <p className="text-xs text-gray-400">Developed by <span className="font-semibold text-pink-500">DVM Wilasinee Surasa</span></p>
          </div>
          <p className="text-xs text-gray-300">© 2024 · Powered by AI · All rights reserved</p>
        </footer>

      </div>

      {/* ── LOGIN MODAL ── */}
      {showLogin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowLogin(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setShowLogin(false)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              ✕
            </button>

            {/* Icon */}
            <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl flex items-center justify-center shadow-lg shadow-pink-200 mx-auto mb-5">
              <MapPin className="w-7 h-7 text-white" strokeWidth={1.5} />
            </div>

            <h3 className="text-xl font-black text-gray-800 text-center mb-1">Vet Checkin</h3>
            <p className="text-gray-500 text-sm text-center mb-6">Sign in with your MSU Google account</p>

            <button
              onClick={loginWithGoogle}
              className="w-full group flex items-center justify-center gap-3 bg-white border-2 border-gray-200 hover:border-pink-300 hover:bg-pink-50 text-gray-700 font-bold py-3.5 rounded-2xl transition-all shadow-sm hover:shadow-md"
            >
              <div className="bg-white rounded-lg p-0.5 shadow-sm border border-gray-100">
                <GoogleIcon />
              </div>
              Continue with Google
            </button>

            <p className="text-center text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
              Use your <span className="font-semibold text-pink-400 mx-1">@msu.ac.th</span> account only
            </p>
          </div>
        </div>
      )}

    </main>
  );
}

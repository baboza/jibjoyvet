"use client";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { MapPin, ClipboardList, LayoutDashboard, Users, LogOut, GraduationCap, Building2, Settings } from "lucide-react";

function StudentNav({ onLogout, user }: { onLogout: () => void; user: any }) {
  const pathname = usePathname();
  const navItems = [
    { href: "/student/checkin", label: "เช็คชื่อ", icon: MapPin },
    { href: "/student/history", label: "ประวัติ", icon: ClipboardList },
  ];

  return (
    <>
      <nav className="bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80 sticky top-0 z-50 transition-all">
        <div className="max-w-xl mx-auto px-4 flex items-center justify-between h-16">
          <Link href="/student/checkin" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/10 border border-cyan-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)] group-hover:scale-105 transition-transform">
              <MapPin className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-sm tracking-tight text-white uppercase flex items-center gap-1">
                VET<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400">CHECK</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">GO</span>
              </span>
              <span className="text-[9px] text-slate-400 uppercase tracking-widest font-mono">MSU SMART GPS</span>
            </div>
          </Link>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-2">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-slate-900 border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </Link>
              );
            })}
            <div className="h-5 w-px bg-slate-800 mx-2"></div>
            <div className="flex items-center gap-2 mr-1">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-7 h-7 rounded-full border border-cyan-500/40 object-cover ring-2 ring-cyan-500/20" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-900 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold text-xs">
                  {user?.name?.charAt(0) || "S"}
                </div>
              )}
            </div>
            <button onClick={onLogout} className="p-2 text-slate-400 hover:text-rose-400 transition-colors" title="ออกจากระบบ">
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Nav Top Right */}
          <div className="flex md:hidden items-center gap-2">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-7 h-7 rounded-full border border-cyan-500/40 object-cover ring-2 ring-cyan-500/20" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-slate-900 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold text-xs">
                {user?.name?.charAt(0) || "S"}
              </div>
            )}
            <button onClick={onLogout} className="p-2 text-slate-400 hover:text-rose-400 transition-colors" title="ออกจากระบบ">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/90 border-t border-slate-800/80 backdrop-blur-xl z-50 pb-safe">
        <div className="flex justify-around items-center h-16">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all ${
                  isActive ? "text-cyan-400 font-bold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${isActive ? "bg-cyan-500/15 border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.3)]" : ""}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] tracking-wide">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}

function AdminNav({ onLogout, user }: { onLogout: () => void; user: any }) {
  const pathname = usePathname();
  const navItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/sessions", label: "คลาส", icon: GraduationCap },
    { href: "/admin/locations", label: "สถานที่", icon: Building2 },
    { href: "/admin/students", label: "นิสิต", icon: Users },
    { href: "/admin/settings", label: "ตั้งค่า", icon: Settings },
  ];

  return (
    <>
      <nav className="bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80 sticky top-0 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
          <Link href="/admin" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/10 border border-cyan-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)] group-hover:scale-105 transition-transform">
              <MapPin className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-sm tracking-tight text-white uppercase hidden sm:inline">
                VET<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400">ADMIN</span>
              </span>
              <span className="bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-[10px] px-2 py-0.5 rounded-full font-bold font-mono">
                CONTROL
              </span>
            </div>
          </Link>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1.5">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = href === "/admin" 
                ? pathname === "/admin" 
                : pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-slate-900 border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </Link>
              );
            })}
            
            <div className="h-5 w-px bg-slate-800 mx-2"></div>

            <div className="flex items-center gap-2 mr-1">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-7 h-7 rounded-full border border-cyan-500/40 object-cover ring-2 ring-cyan-500/20" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-900 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold text-xs">
                  {user?.name?.charAt(0) || "A"}
                </div>
              )}
              <span className="text-xs font-semibold text-slate-300 hidden lg:inline">{user?.name}</span>
            </div>

            <button onClick={onLogout} className="p-2 text-slate-400 hover:text-rose-400 transition-colors" title="ออกจากระบบ">
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Nav Top Right */}
          <div className="flex md:hidden items-center gap-2">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-7 h-7 rounded-full border border-cyan-500/40 object-cover ring-2 ring-cyan-500/20" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-slate-900 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold text-xs">
                {user?.name?.charAt(0) || "A"}
              </div>
            )}
            <button onClick={onLogout} className="p-2 text-slate-400 hover:text-rose-400 transition-colors" title="ออกจากระบบ">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/90 border-t border-slate-800/80 backdrop-blur-xl z-50 pb-safe">
        <div className="flex justify-around items-center h-16">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === "/admin" 
              ? pathname === "/admin" 
              : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all ${
                  isActive ? "text-cyan-400 font-bold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${isActive ? "bg-cyan-500/15 border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.3)]" : ""}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] tracking-wide">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
    if (!loading && user) {
      // redirect admin ออกจากหน้า student
      if (user.role === "admin" && pathname.startsWith("/student")) {
        router.push("/admin");
      }
      // redirect student ออกจากหน้า admin
      if (user.role === "student" && pathname.startsWith("/admin")) {
        router.push("/student/checkin");
      }
    }
  }, [user, loading, pathname, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16 md:pb-0 selection:bg-cyan-500/30 selection:text-white">
      {user.role === "admin" ? (
        <AdminNav onLogout={logout} user={user} />
      ) : (
        <StudentNav onLogout={logout} user={user} />
      )}
      {children}
    </div>
  );
}

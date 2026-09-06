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
      <nav className="bg-white border-b border-pink-100 sticky top-0 z-50">
        <div className="max-w-xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-1">
            <div className="w-7 h-7 bg-pink-500 rounded-lg flex items-center justify-center">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-pink-600 text-sm">ระบบเช็คชื่อ</span>
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? "bg-pink-100 text-pink-600" : "text-gray-500 hover:text-pink-500"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
            <div className="h-6 w-px bg-gray-200 mx-2"></div>
            <div className="flex items-center gap-2 mr-2">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-7 h-7 rounded-full border border-gray-200 object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold text-xs">
                  {user?.name?.charAt(0) || "S"}
                </div>
              )}
            </div>
            <button onClick={onLogout} className="p-2 text-gray-400 hover:text-red-400 transition-colors ml-1" title="ออกจากระบบ">
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Nav Top Right */}
          <div className="flex md:hidden items-center gap-2">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-7 h-7 rounded-full border border-gray-200 object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold text-xs">
                {user?.name?.charAt(0) || "S"}
              </div>
            )}
            <button onClick={onLogout} className="p-2 text-gray-400 hover:text-red-400 transition-colors" title="ออกจากระบบ">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-pink-100 z-50 pb-safe">
        <div className="flex justify-around items-center h-14">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
                  isActive ? "text-pink-600" : "text-gray-400 hover:text-pink-500"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "fill-pink-50" : ""}`} />
                <span className="text-[10px] font-medium">{label}</span>
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
      <nav className="bg-white border-b border-pink-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-pink-500 rounded-lg flex items-center justify-center">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-pink-600 text-sm hidden sm:inline">ระบบเช็คชื่อ</span>
            <span className="bg-pink-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">ADMIN</span>
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = href === "/admin" 
                ? pathname === "/admin" 
                : pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-pink-100 text-pink-600"
                      : "text-gray-500 hover:text-pink-500"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
            
            <div className="h-6 w-px bg-gray-200 mx-2"></div>

            <div className="flex items-center gap-2 mr-2">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-7 h-7 rounded-full border border-gray-200 object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold text-xs">
                  {user?.name?.charAt(0) || "A"}
                </div>
              )}
              <span className="text-sm font-semibold text-gray-700 hidden lg:inline">{user?.name}</span>
            </div>

            <button onClick={onLogout} className="p-2 text-gray-400 hover:text-red-400 transition-colors ml-1" title="ออกจากระบบ">
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Nav Top Right */}
          <div className="flex md:hidden items-center gap-2">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-7 h-7 rounded-full border border-gray-200 object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold text-xs">
                {user?.name?.charAt(0) || "A"}
              </div>
            )}
            <button onClick={onLogout} className="p-2 text-gray-400 hover:text-red-400 transition-colors" title="ออกจากระบบ">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-pink-100 z-50 pb-safe">
        <div className="flex justify-around items-center h-14">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === "/admin" 
              ? pathname === "/admin" 
              : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
                  isActive ? "text-pink-600" : "text-gray-400 hover:text-pink-500"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "fill-pink-50" : ""}`} />
                <span className="text-[10px] font-medium">{label}</span>
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
      <div className="flex min-h-screen items-center justify-center bg-pink-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pink-50 pb-16 md:pb-0">
      {user.role === "admin" ? (
        <AdminNav onLogout={logout} user={user} />
      ) : (
        <StudentNav onLogout={logout} user={user} />
      )}
      {children}
    </div>
  );
}

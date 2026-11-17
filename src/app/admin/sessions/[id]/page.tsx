"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc, query, where, deleteDoc, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle, Clock, XCircle, Download, ArrowLeft, Loader2, Calendar, AlertCircle, Plus, Trash2, X, Save, Search, Sparkles } from "lucide-react";

interface StudentRow {
  enrollmentId: string;
  name: string;
  email: string;
  status: "on-time" | "late" | "absent";
  checkedAt?: string;
  distance?: number;
}

export default function AdminSessionDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<any>(null);
  const [subject, setSubject] = useState<any>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "on-time" | "late" | "absent">("all");

  // Add student state
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [availableStudents, setAvailableStudents] = useState<{name: string, email: string}[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchUser, setSearchUser] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    fetchData();
  }, [user, sessionId]);

  const fetchData = async () => {
    try {
      // ดึงข้อมูล session
      const sessionSnap = await getDoc(doc(db, "sessions", sessionId));
      if (!sessionSnap.exists()) return;
      const sessionData = sessionSnap.data();
      setSession(sessionData);

      // ดึงข้อมูล subject
      const subjectSnap = await getDoc(doc(db, "subjects", sessionData.subjectId));
      setSubject(subjectSnap.data());

      // ดึง enrollments ของ subject นี้
      const enrollSnap = await getDocs(query(collection(db, "enrollments"), where("subjectId", "==", sessionData.subjectId)));

      // ดึง checkins ของ session นี้
      const checkinSnap = await getDocs(query(collection(db, "checkins"), where("sessionId", "==", sessionId)));

      const checkinMap: Record<string, { status: string; createdAt: string; distance: number }> = {};
      checkinSnap.forEach((d) => {
        checkinMap[d.data().email] = {
          status: d.data().status,
          createdAt: d.data().createdAt,
          distance: d.data().distance,
        };
      });

      // ฟังก์ชัน normalize status จากข้อมูลเก่า/ใหม่
      const normalizeStatus = (raw: string | undefined): "on-time" | "late" | "absent" => {
        if (!raw) return "on-time";
        const s = raw.toLowerCase().replace(/_/g, "-").trim();
        if (s === "late" || s === "ล่าช้า" || s === "สาย") return "late";
        if (s === "absent" || s === "ขาด") return "absent";
        return "on-time";
      };

      const rows: StudentRow[] = [];
      enrollSnap.forEach((d) => {
        const { name, email } = d.data();
        const checkin = checkinMap[email];
        rows.push({
          enrollmentId: d.id,
          name,
          email,
          status: checkin ? normalizeStatus(checkin.status) : "absent",
          checkedAt: checkin?.createdAt,
          distance: checkin?.distance,
        });
      });

      rows.sort((a, b) => {
        const order = { "on-time": 0, late: 1, absent: 2 };
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        return a.name.localeCompare(b.name, "th");
      });

      setStudents(rows);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openAddForm = async () => {
    setShowAddForm(true);
    setLoadingUsers(true);
    setSelectedUsers(new Set());
    setSearchUser("");
    try {
      const usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "student")));
      const enrolledEmails = new Set(students.map(s => s.email));
      
      const avail: {name: string, email: string}[] = [];
      usersSnap.forEach(d => {
        const data = d.data();
        if (data.email && !enrolledEmails.has(data.email)) {
          avail.push({
            name: data.name || data.email,
            email: data.email
          });
        }
      });
      avail.sort((a, b) => a.name.localeCompare(b.name, "th"));
      setAvailableStudents(avail);
    } catch (err) {
      console.error(err);
      setAddError("ไม่สามารถดึงรายชื่อนิสิตได้");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAddStudent = async () => {
    if (selectedUsers.size === 0) return;
    setAdding(true);
    setAddError("");
    try {
      const batchPromises = Array.from(selectedUsers).map(email => {
        const st = availableStudents.find(s => s.email === email);
        return addDoc(collection(db, "enrollments"), {
          subjectId: session.subjectId,
          email: email,
          name: st?.name || email,
          createdAt: new Date().toISOString()
        });
      });

      await Promise.all(batchPromises);
      setShowAddForm(false);
      fetchData();
    } catch (err) {
      console.error(err);
      setAddError("เกิดข้อผิดพลาดในการเพิ่มรายชื่อ");
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveStudent = async (enrollmentId: string, studentName: string) => {
    if (!confirm(`ต้องการลบ "${studentName}" ออกจากรายวิชานี้หรือไม่? (นิสิตจะถูกลบออกจากทุกคลาสในวิชานี้)`)) return;
    try {
      await deleteDoc(doc(db, "enrollments", enrollmentId));
      setStudents(prev => prev.filter(s => s.enrollmentId !== enrollmentId));
    } catch (err) {
      console.error(err);
      alert("ลบไม่สำเร็จ กรุณาลองใหม่");
    }
  };

  const exportCSV = () => {
    const BOM = "\uFEFF";
    const header = ["ลำดับ", "ชื่อ-นามสกุล", "อีเมล", "สถานะ", "เวลาที่เช็คชื่อ", "ระยะทาง (เมตร)"];
    const rows = students.map((s, idx) => [
      idx + 1,
      s.name,
      s.email,
      s.status === "on-time" ? "ทันเวลา" : s.status === "late" ? "สาย" : "ขาด",
      s.checkedAt || "-",
      s.distance || "-",
    ]);

    const csvContent =
      BOM +
      [header.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `checkin_${subject?.code || "subject"}_${session?.sessionDate || "date"}.csv`;
    link.click();
  };

  const filtered = students.filter((s) => tab === "all" || s.status === tab);
  const counts = {
    "on-time": students.filter((s) => s.status === "on-time").length,
    late: students.filter((s) => s.status === "late").length,
    absent: students.filter((s) => s.status === "absent").length,
  };

  const statusBadge = (status: string) => {
    if (status === "on-time") {
      return (
        <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-0.5 rounded-full text-xs font-bold">
          <CheckCircle className="w-3.5 h-3.5" /> ทันเวลา
        </span>
      );
    }
    if (status === "late") {
      return (
        <span className="flex items-center gap-1.5 text-amber-400 bg-amber-950/60 border border-amber-500/40 px-2.5 py-0.5 rounded-full text-xs font-bold">
          <Clock className="w-3.5 h-3.5" /> สาย
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 text-rose-400 bg-rose-950/60 border border-rose-500/40 px-2.5 py-0.5 rounded-full text-xs font-bold">
        <XCircle className="w-3.5 h-3.5" /> ขาด
      </span>
    );
  };

  return (
    <AppLayout>
      <div className="relative min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-200 overflow-x-hidden pb-12">
        {/* Ambient Glowing Orbs */}
        <div className="absolute top-[3%] left-[10%] w-[45%] h-[45%] rounded-full bg-cyan-500/10 blur-[140px] pointer-events-none -z-0" />
        <div className="absolute top-[35%] right-[10%] w-[35%] h-[35%] rounded-full bg-purple-500/10 blur-[150px] pointer-events-none -z-0" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 transition-colors shrink-0"
                title="ย้อนกลับ"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                {loading ? (
                  <div className="h-5 bg-slate-800 rounded w-48 animate-pulse" />
                ) : (
                  <>
                    <h1 className="text-lg font-bold text-white flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-500/30 text-cyan-300">
                        {subject?.code}
                      </span>
                      <span>{subject?.name}</span>
                    </h1>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-cyan-400" />{session?.sessionDate}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-emerald-400" />{session?.startTime}–{session?.endTime} น.</span>
                      <span className="flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 text-amber-400" />สายหลัง {session?.lateTime} น.</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openAddForm}
                className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all shadow-[0_0_15px_rgba(6,182,212,0.25)] active:scale-95"
              >
                <Plus className="w-4 h-4" /> เพิ่มนิสิต
              </button>
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                <Download className="w-4 h-4 text-cyan-400" /> ดาวน์โหลด CSV
              </button>
            </div>
          </div>

          {/* Add Student Modal */}
          {showAddForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <div className="glass bg-slate-950/95 border border-cyan-500/40 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.25)] w-full max-w-md p-6 relative">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                  <h3 className="text-base font-bold text-white">เพิ่มรายชื่อนิสิตในวิชา</h3>
                  <button onClick={() => { setShowAddForm(false); setAddError(""); }} className="p-1 rounded-lg text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="text-xs text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 p-3 rounded-2xl flex gap-2 items-start">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-cyan-400" />
                    <p>เลือกรายชื่อนิสิตเพื่อเพิ่มเข้าสู่รายวิชา <strong>{subject?.code}</strong> นิสิตจะปรากฏในทุกคลาสของวิชานี้</p>
                  </div>
                  
                  {/* Search */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="ค้นหาชื่อ หรือ อีเมล..."
                      value={searchUser}
                      onChange={(e) => setSearchUser(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:outline-none focus:border-cyan-400 text-xs text-white placeholder-slate-500"
                    />
                  </div>

                  {/* List of available users */}
                  <div className="border border-slate-800 rounded-2xl h-[260px] overflow-y-auto bg-slate-900/60 p-2 space-y-1.5">
                    {loadingUsers ? (
                      <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
                    ) : availableStudents.filter(u => 
                        u.name.toLowerCase().includes(searchUser.toLowerCase()) || 
                        u.email.toLowerCase().includes(searchUser.toLowerCase())
                      ).length === 0 ? (
                      <div className="text-center py-10 text-slate-500 text-xs">ไม่พบรายชื่อนิสิตที่สามารถเพิ่มได้</div>
                    ) : (
                      availableStudents
                        .filter(u => 
                          u.name.toLowerCase().includes(searchUser.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchUser.toLowerCase())
                        )
                        .map(u => (
                          <label
                            key={u.email}
                            className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                              selectedUsers.has(u.email)
                                ? "bg-cyan-950/40 border-cyan-500/50"
                                : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedUsers.has(u.email)}
                              onChange={(e) => {
                                const next = new Set(selectedUsers);
                                if (e.target.checked) next.add(u.email);
                                else next.delete(u.email);
                                setSelectedUsers(next);
                              }}
                              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-400 focus:ring-cyan-400"
                            />
                            <div>
                              <p className="text-xs font-bold text-white">{u.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{u.email}</p>
                            </div>
                          </label>
                        ))
                    )}
                  </div>
                  
                  {addError && (
                    <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-500/30 p-2.5 rounded-xl">{addError}</div>
                  )}
                </div>

                <div className="flex gap-2.5 pt-4 border-t border-slate-800 mt-4">
                  <button
                    onClick={() => { setShowAddForm(false); setAddError(""); }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 text-xs font-bold transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleAddStudent}
                    disabled={adding || selectedUsers.size === 0}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 text-xs font-extrabold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>เพิ่ม {selectedUsers.size > 0 ? `${selectedUsers.size} คน` : ""}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
            {[
              { id: "all", label: "ทั้งหมด", count: students.length },
              { id: "on-time", label: "ทันเวลา", count: counts["on-time"] },
              { id: "late", label: "สาย", count: counts.late },
              { id: "absent", label: "ขาด", count: counts.absent },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  tab === t.id
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                    : "bg-slate-900/70 border border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                {t.label}{" "}
                <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                  tab === t.id ? "bg-cyan-500/30 text-white" : "bg-slate-800 text-slate-400"
                }`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="glass bg-slate-900/75 rounded-3xl border border-slate-800/90 overflow-hidden shadow-2xl">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin"></div>
                  <Sparkles className="w-5 h-5 text-cyan-400 absolute inset-0 m-auto animate-pulse" />
                </div>
                <p className="text-xs font-mono text-slate-400 tracking-wider">กำลังโหลดข้อมูลการเช็คชื่อ...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs font-mono">ไม่มีข้อมูลนิสิตในกลุ่มนี้</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-950/80 text-cyan-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4">ชื่อ - นามสกุล</th>
                      <th className="px-6 py-4">อีเมล</th>
                      <th className="px-6 py-4">สถานะ</th>
                      <th className="px-6 py-4">เวลา</th>
                      <th className="px-6 py-4">ระยะ (m)</th>
                      <th className="px-6 py-4 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {filtered.map((s, i) => (
                      <tr key={i} className="hover:bg-slate-800/40 transition-colors group">
                        <td className="px-6 py-4 font-sans font-medium text-white">{s.name}</td>
                        <td className="px-6 py-4 text-slate-400">{s.email}</td>
                        <td className="px-6 py-4 font-sans">{statusBadge(s.status)}</td>
                        <td className="px-6 py-4 text-slate-300">{s.checkedAt ? s.checkedAt.split(" ")[1] : "-"}</td>
                        <td className="px-6 py-4 text-slate-300">{s.distance ? s.distance : "-"}</td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleRemoveStudent(s.enrollmentId, s.name)}
                            className="text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 transition-colors p-1.5 rounded-lg border border-transparent hover:border-rose-500/30"
                            title="ลบรายชื่อออกจากวิชา"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
    </AppLayout>
  );
}

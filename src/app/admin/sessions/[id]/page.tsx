"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc, query, where, deleteDoc, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle, Clock, XCircle, Download, ArrowLeft, Loader2, Calendar, AlertCircle, Plus, Trash2, X, Save, Search } from "lucide-react";

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
        if (!raw) return "on-time"; // มีข้อมูลเช็คชื่อแต่ไม่มี status → ถือว่ามา
        const s = raw.toLowerCase().replace(/_/g, "-").trim();
        if (s === "late" || s === "ล่าช้า" || s === "สาย") return "late";
        if (s === "absent" || s === "ขาด") return "absent";
        return "on-time"; // on-time, present, checked, หรืออื่นๆ → ถือว่าทันเวลา
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
    setSearchUser("");
    setSelectedUsers(new Set());
    setAddError("");
    setLoadingUsers(true);
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const list: {name: string, email: string}[] = [];
      const enrolledEmails = new Set(students.map(s => s.email));

      usersSnap.forEach(d => {
        const u = d.data();
        if (u.role !== "admin" && !enrolledEmails.has(u.email)) {
          list.push({ name: u.name, email: u.email });
        }
      });
      list.sort((a, b) => a.name.localeCompare(b.name, "th"));
      setAvailableStudents(list);
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
      const selected = availableStudents.filter(u => selectedUsers.has(u.email));
      const newRows: StudentRow[] = [];

      // ใช้ Promise.all เพื่อเพิ่มหลายคนพร้อมกัน
      await Promise.all(selected.map(async (u) => {
        const newDoc = await addDoc(collection(db, "enrollments"), {
          subjectId: session.subjectId,
          name: u.name,
          email: u.email,
          createdAt: new Date().toISOString()
        });

        newRows.push({
          enrollmentId: newDoc.id,
          name: u.name,
          email: u.email,
          status: "absent"
        });
      }));

      setStudents(prev => [...prev, ...newRows].sort((a, b) => {
        const order = { "on-time": 0, late: 1, absent: 2 };
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        return a.name.localeCompare(b.name, "th");
      }));

      setShowAddForm(false);
    } catch (err) {
      console.error(err);
      setAddError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveStudent = async (enrollmentId: string, name: string) => {
    if (!confirm(`ต้องการลบรายชื่อ "${name}" ออกจากรายวิชานี้ใช่หรือไม่? (ลบแล้วจะหายไปจากทุกคลาสในวิชานี้)`)) return;
    try {
      await deleteDoc(doc(db, "enrollments", enrollmentId));
      setStudents(prev => prev.filter(s => s.enrollmentId !== enrollmentId));
    } catch (err) {
      console.error(err);
      alert("ลบไม่สำเร็จ กรุณาลองใหม่");
    }
  };

  const exportCSV = () => {
    const headers = ["ชื่อ", "อีเมล", "สถานะ", "เวลาเช็ค", "ระยะ (เมตร)"];
    const rows = students.map((s) => [
      s.name, s.email,
      s.status === "on-time" ? "ทันเวลา" : s.status === "late" ? "สาย" : "ขาด",
      s.checkedAt || "-", s.distance?.toString() || "-",
    ]);
    const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `checkin_${sessionId}.csv`;
    link.click();
  };

  const filtered = students.filter((s) => tab === "all" || s.status === tab);
  const counts = {
    "on-time": students.filter((s) => s.status === "on-time").length,
    late: students.filter((s) => s.status === "late").length,
    absent: students.filter((s) => s.status === "absent").length,
  };

  const statusBadge = (status: string) => {
    if (status === "on-time") return <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full text-xs font-semibold"><CheckCircle className="w-3 h-3" /> ทันเวลา</span>;
    if (status === "late") return <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-xs font-semibold"><Clock className="w-3 h-3" /> สาย</span>;
    return <span className="flex items-center gap-1 text-red-500 bg-red-50 px-2 py-0.5 rounded-full text-xs font-semibold"><XCircle className="w-3 h-3" /> ขาด</span>;
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-pink-100 text-gray-500 flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              {loading ? (
                <div className="h-5 bg-gray-200 rounded w-48 animate-pulse" />
              ) : (
                <>
                  <h1 className="text-lg font-bold text-gray-800">{subject?.code} – {subject?.name}</h1>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-0.5">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-pink-400" />{session?.sessionDate}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{session?.startTime}–{session?.endTime}</span>
                    <span className="flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 text-amber-400" />สายหลัง {session?.lateTime}</span>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openAddForm}
              className="flex items-center gap-1.5 bg-pink-500 hover:bg-pink-600 text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> เพิ่มนิสิต
            </button>
            <button onClick={exportCSV} className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 hover:border-pink-300 hover:text-pink-600 px-3 py-2 rounded-xl text-sm font-medium transition-colors">
              <Download className="w-4 h-4" /> ดาวน์โหลด
            </button>
          </div>
        </div>

        {/* Add Student Modal */}
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-800">เพิ่มรายชื่อนิสิต</h3>
                <button onClick={() => { setShowAddForm(false); setAddError(""); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-xl flex gap-2 items-start">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>เลือกรายชื่อนิสิตเพื่อเพิ่มเข้าสู่รายวิชา <strong>{subject?.code}</strong> นิสิตจะปรากฏในทุกคลาสของวิชานี้</p>
                </div>
                
                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อ หรือ อีเมล..."
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-pink-400 text-sm"
                  />
                </div>

                {/* List of available users */}
                <div className="border border-gray-100 rounded-xl h-[300px] overflow-y-auto bg-gray-50/50 p-2 space-y-1">
                  {loadingUsers ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-pink-400 animate-spin" /></div>
                  ) : availableStudents.filter(u => 
                      u.name.toLowerCase().includes(searchUser.toLowerCase()) || 
                      u.email.toLowerCase().includes(searchUser.toLowerCase())
                    ).length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-sm">ไม่พบรายชื่อนิสิต</div>
                  ) : (
                    availableStudents
                      .filter(u => 
                        u.name.toLowerCase().includes(searchUser.toLowerCase()) || 
                        u.email.toLowerCase().includes(searchUser.toLowerCase())
                      )
                      .map(u => (
                        <label
                          key={u.email}
                          className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100 cursor-pointer hover:border-pink-200 transition-colors"
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
                            className="w-4 h-4 text-pink-500 rounded border-gray-300 focus:ring-pink-500"
                          />
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{u.name}</p>
                            <p className="text-xs text-gray-400">{u.email}</p>
                          </div>
                        </label>
                      ))
                  )}
                </div>
                
                {addError && (
                  <div className="text-sm text-red-500 font-medium">{addError}</div>
                )}
              </div>

              <div className="flex gap-3 p-6 pt-0 border-t border-gray-50 mt-4">
                <button
                  onClick={() => { setShowAddForm(false); setAddError(""); }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleAddStudent}
                  disabled={adding || selectedUsers.size === 0}
                  className="flex-1 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  เพิ่ม {selectedUsers.size > 0 ? `${selectedUsers.size} คน` : ""}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { id: "all", label: "ทั้งหมด", count: students.length },
            { id: "on-time", label: "ทันเวลา", count: counts["on-time"] },
            { id: "late", label: "สาย", count: counts.late },
            { id: "absent", label: "ขาด", count: counts.absent },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === t.id
                  ? "bg-gray-800 text-white shadow-md"
                  : "bg-white text-gray-500 hover:bg-gray-100"
              }`}
            >
              {t.label} <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-md ${tab === t.id ? "bg-white/20" : "bg-gray-200 text-gray-600"}`}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-pink-400 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">ไม่มีข้อมูลนิสิตในกลุ่มนี้</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50/50 text-gray-500 font-medium">
                  <tr>
                    <th className="px-6 py-4">ชื่อ - นามสกุล</th>
                    <th className="px-6 py-4">อีเมล</th>
                    <th className="px-6 py-4">สถานะ</th>
                    <th className="px-6 py-4">เวลา</th>
                    <th className="px-6 py-4">ระยะ (m)</th>
                    <th className="px-6 py-4 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((s, i) => (
                    <tr key={i} className="hover:bg-pink-50/30 transition-colors group">
                      <td className="px-6 py-4 font-medium text-gray-800">{s.name}</td>
                      <td className="px-6 py-4 text-gray-500">{s.email}</td>
                      <td className="px-6 py-4">{statusBadge(s.status)}</td>
                      <td className="px-6 py-4 text-gray-600">{s.checkedAt ? s.checkedAt.split(" ")[1] : "-"}</td>
                      <td className="px-6 py-4 text-gray-600">{s.distance ? s.distance : "-"}</td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleRemoveStudent(s.enrollmentId, s.name)}
                          className="text-gray-300 hover:text-red-500 transition-colors p-1"
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
    </AppLayout>
  );
}

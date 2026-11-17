"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import {
  Building2, Plus, Pencil, Trash2, Loader2,
  MapPin, Radius, Save, X, AlertCircle, ExternalLink, Navigation
} from "lucide-react";

interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  createdAt?: string;
}

const EMPTY_FORM = { name: "", lat: "", lng: "", radius: "300" };

export default function AdminLocationsPage() {
  const { user } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    fetchLocations();
  }, [user]);

  const fetchLocations = async () => {
    try {
      const snap = await getDocs(collection(db, "locations"));
      const list: Location[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Location);
      });
      list.sort((a, b) => a.name.localeCompare(b.name, "th"));
      setLocations(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openAddForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  };

  const openEditForm = (loc: Location) => {
    setEditingId(loc.id);
    setForm({
      name: loc.name,
      lat: String(loc.lat),
      lng: String(loc.lng),
      radius: String(loc.radius),
    });
    setFormError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
  };

  const validate = () => {
    if (!form.name.trim()) return "กรุณากรอกชื่อสถานที่";
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    const radius = parseInt(form.radius);
    if (isNaN(lat) || lat < -90 || lat > 90) return "Latitude ไม่ถูกต้อง (ต้องอยู่ระหว่าง -90 ถึง 90)";
    if (isNaN(lng) || lng < -180 || lng > 180) return "Longitude ไม่ถูกต้อง (ต้องอยู่ระหว่าง -180 ถึง 180)";
    if (isNaN(radius) || radius <= 0) return "รัศมีต้องมากกว่า 0 เมตร";
    return "";
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setFormError(err); return; }

    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        radius: parseInt(form.radius),
      };

      if (editingId) {
        await updateDoc(doc(db, "locations", editingId), data);
        setLocations((prev) =>
          prev.map((l) => (l.id === editingId ? { ...l, ...data } : l))
        );
      } else {
        const ref = await addDoc(collection(db, "locations"), {
          ...data,
          createdAt: new Date().toISOString(),
        });
        setLocations((prev) => [
          ...prev,
          { id: ref.id, ...data },
        ].sort((a, b) => a.name.localeCompare(b.name, "th")));
      }
      closeForm();
    } catch (err) {
      console.error(err);
      setFormError("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ต้องการลบสถานที่ "${name}" ใช่หรือไม่?`)) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, "locations", id));
      setLocations((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      console.error(err);
      alert("ลบไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setDeletingId(null);
    }
  };

  const getMapsUrl = (lat: number, lng: number) =>
    `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <AppLayout>
      <div className="relative min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-200 overflow-x-hidden pb-12">
        {/* Ambient Glowing Orbs */}
        <div className="absolute top-[3%] left-[10%] w-[45%] h-[45%] rounded-full bg-cyan-500/10 blur-[140px] pointer-events-none -z-0" />
        <div className="absolute top-[35%] right-[10%] w-[35%] h-[35%] rounded-full bg-emerald-500/10 blur-[150px] pointer-events-none -z-0" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 py-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  จัดการสถานที่เรียน
                  <span className="text-xs font-mono font-normal text-slate-400">({locations.length} สถานที่)</span>
                </h2>
                <p className="text-xs text-slate-400">กำหนดพิกัด GPS และรัศมีการเช็คชื่อของแต่ละห้องเรียน</p>
              </div>
            </div>
            <button
              onClick={openAddForm}
              className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs transition-all shadow-[0_0_15px_rgba(6,182,212,0.25)] active:scale-95"
            >
              <Plus className="w-4 h-4" />
              เพิ่มสถานที่
            </button>
          </div>

          {/* Add/Edit Form Modal */}
          {showForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <div className="glass bg-slate-950/95 border border-cyan-500/40 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.25)] w-full max-w-md overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

                {/* Modal header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                  <h3 className="text-base font-bold text-white">
                    {editingId ? "แก้ไขสถานที่" : "เพิ่มสถานที่ใหม่"}
                  </h3>
                  <button onClick={closeForm} className="p-1.5 rounded-xl hover:bg-slate-900 text-slate-400 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form body */}
                <div className="p-6 space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase font-mono">ชื่อสถานที่</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="เช่น คณะสัตวแพทยศาสตร์ เขตในเมือง"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:outline-none focus:border-cyan-400 text-sm text-white placeholder-slate-500"
                    />
                  </div>

                  {/* Lat / Lng */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase font-mono">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        value={form.lat}
                        onChange={(e) => setForm({ ...form, lat: e.target.value })}
                        placeholder="เช่น 16.2015"
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:outline-none focus:border-cyan-400 text-sm font-mono text-white placeholder-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase font-mono">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        value={form.lng}
                        onChange={(e) => setForm({ ...form, lng: e.target.value })}
                        placeholder="เช่น 103.2832"
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:outline-none focus:border-cyan-400 text-sm font-mono text-white placeholder-slate-500"
                      />
                    </div>
                  </div>

                  {/* Radius */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase font-mono">
                      รัศมีที่อนุญาต (เมตร)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={form.radius}
                        onChange={(e) => setForm({ ...form, radius: e.target.value })}
                        placeholder="300"
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:outline-none focus:border-cyan-400 text-sm font-mono text-white pr-16"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">เมตร</span>
                    </div>
                  </div>

                  {/* Hint */}
                  <div className="flex items-start gap-2 bg-slate-900/80 border border-cyan-500/30 text-cyan-300 rounded-xl px-4 py-3 text-xs">
                    <Navigation className="w-4 h-4 shrink-0 mt-0.5 text-cyan-400" />
                    <p>
                      หาพิกัดได้จาก{" "}
                      <a href="https://maps.google.com" target="_blank" rel="noreferrer" className="underline font-bold text-white">
                        Google Maps
                      </a>{" "}
                      → คลิกขวาที่จุดห้องเรียน → คัดลอกพิกัด Latitude, Longitude
                    </p>
                  </div>

                  {/* Error */}
                  {formError && (
                    <div className="flex items-center gap-2 bg-rose-950/40 text-rose-300 border border-rose-500/30 rounded-xl px-4 py-2.5 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex gap-2.5 pt-2">
                    <button
                      onClick={closeForm}
                      className="flex-1 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 text-xs font-bold transition-colors"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 text-xs font-extrabold transition-all shadow-md active:scale-95 disabled:opacity-60 flex items-center justify-center gap-1.5"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      <span>{editingId ? "บันทึกการแก้ไข" : "เพิ่มสถานที่"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Location List */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin"></div>
                <Building2 className="w-5 h-5 text-cyan-400 absolute inset-0 m-auto animate-pulse" />
              </div>
              <p className="text-xs font-mono text-slate-400 tracking-wider">กำลังโหลดสถานที่...</p>
            </div>
          ) : locations.length === 0 ? (
            <div className="glass bg-slate-900/60 rounded-3xl p-12 text-center border border-slate-800 shadow-xl">
              <Building2 className="w-12 h-12 text-cyan-400/40 mx-auto mb-3" />
              <p className="text-slate-300 font-bold text-sm">ยังไม่มีสถานที่เรียนในระบบ</p>
              <button
                onClick={openAddForm}
                className="mt-3 text-xs text-cyan-400 hover:text-cyan-300 font-bold underline"
              >
                + เพิ่มสถานที่แรก
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {locations.map((loc) => (
                <div
                  key={loc.id}
                  className="glass bg-slate-900/75 rounded-3xl border border-slate-800/90 hover:border-cyan-500/50 transition-all duration-300 shadow-xl overflow-hidden group"
                >
                  {/* Card header */}
                  <div className="bg-slate-900/90 border-b border-slate-800 px-5 py-4 flex items-start justify-between">
                    <div>
                      <p className="text-white font-bold text-sm leading-tight group-hover:text-cyan-200 transition-colors">
                        {loc.name}
                      </p>
                      <p className="text-slate-500 text-[11px] font-mono mt-1">ID: {loc.id}</p>
                    </div>
                    <div className="flex gap-1.5 ml-3 shrink-0">
                      <button
                        onClick={() => openEditForm(loc)}
                        className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 rounded-lg transition-colors border border-slate-700/60"
                        title="แก้ไข"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(loc.id, loc.name)}
                        disabled={deletingId === loc.id}
                        className="p-1.5 bg-slate-800/80 hover:bg-rose-950/80 text-slate-300 hover:text-rose-300 rounded-lg transition-colors border border-slate-700/60 disabled:opacity-50"
                        title="ลบ"
                      >
                        {deletingId === loc.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                      </button>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="p-5 space-y-3 font-mono text-xs">
                    <div className="flex items-center gap-2 text-slate-300">
                      <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                        {loc.lat}, {loc.lng}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-300 font-sans">
                      <Radius className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>รัศมี <strong className="text-emerald-300 font-mono text-sm">{loc.radius}</strong> เมตร</span>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80">
                      <a
                        href={getMapsUrl(loc.lat, loc.lng)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-bold transition-colors"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>เปิดดูแผนที่บน Google Maps</span>
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

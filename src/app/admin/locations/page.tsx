"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import {
  Building2, Plus, Pencil, Trash2, Loader2,
  MapPin, Radius, Save, X, AlertCircle
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
    setForm({ name: loc.name, lat: String(loc.lat), lng: String(loc.lng), radius: String(loc.radius) });
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
    if (!form.lat || isNaN(Number(form.lat))) return "กรุณากรอก Latitude ให้ถูกต้อง";
    if (!form.lng || isNaN(Number(form.lng))) return "กรุณากรอก Longitude ให้ถูกต้อง";
    if (!form.radius || isNaN(Number(form.radius)) || Number(form.radius) <= 0) return "กรุณากรอกรัศมีที่ถูกต้อง";
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
          prev.map((l) => l.id === editingId ? { ...l, ...data } : l)
        );
      } else {
        const newDoc = await addDoc(collection(db, "locations"), {
          ...data,
          createdAt: new Date().toLocaleString("th-TH"),
        });
        setLocations((prev) =>
          [...prev, { id: newDoc.id, ...data }].sort((a, b) => a.name.localeCompare(b.name, "th"))
        );
      }
      closeForm();
    } catch (err) {
      console.error(err);
      setFormError("เกิดข้อผิดพลาด กรุณาลองใหม่");
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
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-pink-500" />
            <h2 className="text-lg font-bold text-gray-700">จัดการสถานที่เรียน</h2>
            <span className="text-sm text-gray-400">({locations.length} สถานที่)</span>
          </div>
          <button
            onClick={openAddForm}
            className="flex items-center gap-2 bg-pink-500 hover:bg-pink-600 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            เพิ่มสถานที่
          </button>
        </div>

        {/* Add/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
              {/* Modal header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-800">
                  {editingId ? "แก้ไขสถานที่" : "เพิ่มสถานที่ใหม่"}
                </h3>
                <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form body */}
              <div className="p-6 space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">ชื่อสถานที่</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="เช่น คณะสัตวแพทยศาสตร์ เขตในเมือง"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-pink-400 text-sm"
                  />
                </div>

                {/* Lat / Lng */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={form.lat}
                      onChange={(e) => setForm({ ...form, lat: e.target.value })}
                      placeholder="เช่น 16.2015"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-pink-400 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={form.lng}
                      onChange={(e) => setForm({ ...form, lng: e.target.value })}
                      placeholder="เช่น 103.2832"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-pink-400 text-sm"
                    />
                  </div>
                </div>

                {/* Radius */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    รัศมี (เมตร)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={form.radius}
                      onChange={(e) => setForm({ ...form, radius: e.target.value })}
                      placeholder="300"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-pink-400 text-sm pr-16"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">เมตร</span>
                  </div>
                </div>

                {/* Hint */}
                <div className="flex items-start gap-2 bg-blue-50 text-blue-600 rounded-xl px-4 py-3 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>
                    หาพิกัดได้จาก{" "}
                    <a href="https://maps.google.com" target="_blank" rel="noreferrer" className="underline font-semibold">
                      Google Maps
                    </a>{" "}
                    → คลิกขวาที่จุดที่ต้องการ → คัดลอกพิกัด
                  </p>
                </div>

                {/* Error */}
                {formError && (
                  <div className="flex items-center gap-2 bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {formError}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex gap-3 p-6 pt-0">
                <button
                  onClick={closeForm}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingId ? "บันทึกการแก้ไข" : "เพิ่มสถานที่"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Location List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
          </div>
        ) : locations.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-pink-100">
            <Building2 className="w-12 h-12 text-pink-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">ยังไม่มีสถานที่เรียน</p>
            <button
              onClick={openAddForm}
              className="mt-4 text-sm text-pink-500 font-semibold underline"
            >
              เพิ่มสถานที่แรก
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {locations.map((loc) => (
              <div
                key={loc.id}
                className="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Card header */}
                <div className="bg-gradient-to-r from-pink-500 to-pink-400 px-5 py-4 flex items-start justify-between">
                  <div>
                    <p className="text-white font-bold text-base leading-tight">{loc.name}</p>
                    <p className="text-pink-100 text-xs mt-1">ID: {loc.id}</p>
                  </div>
                  <div className="flex gap-1.5 ml-3 flex-shrink-0">
                    <button
                      onClick={() => openEditForm(loc)}
                      className="p-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
                      title="แก้ไข"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(loc.id, loc.name)}
                      disabled={deletingId === loc.id}
                      className="p-1.5 bg-white/20 hover:bg-red-400/50 text-white rounded-lg transition-colors disabled:opacity-50"
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
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4 text-pink-400 flex-shrink-0" />
                    <span className="font-mono text-xs bg-gray-50 px-2 py-1 rounded-lg">
                      {loc.lat}, {loc.lng}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Radius className="w-4 h-4 text-pink-400 flex-shrink-0" />
                    <span>รัศมี <strong>{loc.radius}</strong> เมตร</span>
                  </div>

                  <a
                    href={getMapsUrl(loc.lat, loc.lng)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    ดูบน Google Maps ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

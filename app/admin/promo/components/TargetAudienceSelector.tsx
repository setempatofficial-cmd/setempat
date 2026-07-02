"use client";

import { useState } from "react";
import { MapPin, Users, Radio, Target, UserCheck, Crown, Search } from "lucide-react";
import WilayahSelector from "@/components/ui/WilayahSelector";

interface TargetAudienceSelectorProps {
  value: any;
  onChange: (value: any) => void;
}

export default function TargetAudienceSelector({ value, onChange }: TargetAudienceSelectorProps) {
  const [useNominatim, setUseNominatim] = useState(false);

  const targetTypes = [
    { value: 'all', label: '🌍 Semua User', icon: Users },
    { value: 'radius', label: '📍 Radius Lokasi', icon: Radio },
    { value: 'region', label: '🏙️ Wilayah', icon: MapPin },
    { value: 'role', label: '🎭 Peran User', icon: Target },
    { value: 'active', label: '💚 User Aktif', icon: UserCheck },
    { value: 'premium', label: '👑 User Premium', icon: Crown },
  ];

  const roles = [
    { value: 'warga', label: 'Warga' },
    { value: 'bakul', label: 'Bakul' },
    { value: 'ojek', label: 'Ojek' },
    { value: 'rewang', label: 'Rewang' },
  ];

  const handleTargetChange = (type: string) => {
    onChange({ ...value, targetType: type });
  };

  const handleWilayahChange = (wilayah: any) => {
    onChange({
      ...value,
      provinsi: wilayah.provinsi,
      kabupaten: wilayah.kabupaten,
      kecamatan: wilayah.kecamatan,
      desa: wilayah.desa,
      lat: wilayah.lat,
      lon: wilayah.lon
    });
  };

  return (
    <div className="space-y-4">
      {/* Target Type Selection */}
      <div className="grid grid-cols-3 gap-2">
        {targetTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => handleTargetChange(type.value)}
            className={`p-3 rounded-xl border text-center transition-all ${
              value.targetType === type.value
                ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <type.icon size={20} className="mx-auto mb-1" />
            <span className="text-[10px] font-bold">{type.label}</span>
          </button>
        ))}
      </div>

      {/* Radius Option */}
      {value.targetType === 'radius' && (
        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Latitude</label>
              <input
                type="number"
                step="0.0000001"
                value={value.latitude || ''}
                onChange={(e) => onChange({ ...value, latitude: parseFloat(e.target.value) })}
                placeholder="-7.981894"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Longitude</label>
              <input
                type="number"
                step="0.0000001"
                value={value.longitude || ''}
                onChange={(e) => onChange({ ...value, longitude: parseFloat(e.target.value) })}
                placeholder="112.615822"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Radius (km)</label>
            <input
              type="number"
              step="1"
              min="1"
              max="100"
              value={value.radiusKm || ''}
              onChange={(e) => onChange({ ...value, radiusKm: parseInt(e.target.value) })}
              placeholder="10"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm"
            />
          </div>
          <p className="text-[10px] text-slate-500">
            💡 User dalam radius {value.radiusKm || '?'} km dari titik ini akan menerima promo
          </p>
        </div>
      )}

      {/* 🔥 Region Option dengan Wilayah Selector */}
      {value.targetType === 'region' && (
        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-400 block">
              Pilih Wilayah Target
            </label>
            <button
              type="button"
              onClick={() => setUseNominatim(!useNominatim)}
              className="text-[10px] text-purple-400 hover:text-purple-300 transition"
            >
              {useNominatim ? '📡 Pakai Database' : '🌐 Pakai Nominatim'}
            </button>
          </div>
          
          <WilayahSelector
            value={{
              provinsi: value.provinsi,
              kabupaten: value.kabupaten,
              kecamatan: value.kecamatan,
              desa: value.desa
            }}
            onChange={handleWilayahChange}
          />

          {/* Tampilkan ringkasan */}
          {(value.provinsi || value.kabupaten || value.kecamatan || value.desa) && (
            <div className="bg-slate-800/30 rounded-lg p-2">
              <p className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                <MapPin size={12} className="text-purple-400" />
                <span className="text-white">Target Wilayah:</span>
                {value.provinsi && <span className="text-purple-400">{value.provinsi}</span>}
                {value.kabupaten && <span className="text-purple-400">› {value.kabupaten}</span>}
                {value.kecamatan && <span className="text-purple-400">› {value.kecamatan}</span>}
                {value.desa && <span className="text-emerald-400">› {value.desa}</span>}
              </p>
            </div>
          )}

          <p className="text-[10px] text-slate-500">
            💡 User di wilayah terpilih akan menerima promo. Semakin spesifik, semakin tepat sasaran.
          </p>
        </div>
      )}

      {/* Role Option */}
      {value.targetType === 'role' && (
        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
          <label className="text-xs text-slate-400 block mb-2">Pilih Peran</label>
          <div className="grid grid-cols-2 gap-2">
            {roles.map((role) => (
              <button
                key={role.value}
                onClick={() => {
                  const current = value.roles || [];
                  const newRoles = current.includes(role.value)
                    ? current.filter((r: string) => r !== role.value)
                    : [...current, role.value];
                  onChange({ ...value, roles: newRoles });
                }}
                className={`p-2 rounded-xl border text-center text-xs font-bold transition-all ${
                  (value.roles || []).includes(role.value)
                    ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            💡 User dengan peran terpilih akan menerima promo
          </p>
        </div>
      )}

      {/* Active Option */}
      {value.targetType === 'active' && (
        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
          <label className="text-xs text-slate-400 block mb-1">Aktif dalam N hari terakhir</label>
          <input
            type="number"
            step="1"
            min="1"
            max="90"
            value={value.activeDays || ''}
            onChange={(e) => onChange({ ...value, activeDays: parseInt(e.target.value) })}
            placeholder="7"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm"
          />
          <p className="text-[10px] text-slate-500 mt-1">
            💡 User yang aktif dalam {value.activeDays || '?'} hari terakhir akan menerima promo
          </p>
        </div>
      )}

      {/* Summary */}
      {value.targetType !== 'all' && (
        <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700">
          <p className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
            <Target size={14} className="text-purple-400" />
            <span>Target: <strong className="text-white">{value.targetType}</strong></span>
            {value.kabupaten && <span className="text-purple-400">• {value.kabupaten}</span>}
            {value.kecamatan && <span className="text-purple-400">• {value.kecamatan}</span>}
            {value.desa && <span className="text-emerald-400">• {value.desa}</span>}
            {value.radiusKm && <span className="text-purple-400">• {value.radiusKm}km</span>}
            {value.roles && value.roles.length > 0 && (
              <span className="text-purple-400">• {value.roles.join(', ')}</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
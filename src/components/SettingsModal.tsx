import { X, Volume2, VolumeX } from 'lucide-react';
import { GameSettings, TimeOfDayMode } from '../game/types';

interface SettingsModalProps {
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
  onClose: () => void;
}

export function SettingsModal({ settings, onChange, onClose }: SettingsModalProps) {
  const timeOptions: Array<{ id: TimeOfDayMode; label: string }> = [
    { id: 'dynamic', label: 'Siklus Siang–Sore' },
    { id: 'day', label: 'Siang Cerah' },
    { id: 'afternoon', label: 'Sore Emas' },
  ];

  const lapOptions = [2, 3, 5];

  const touchOptions: Array<{ id: GameSettings['touchControls']; label: string }> = [
    { id: 'auto', label: 'Otomatis' },
    { id: 'on', label: 'Selalu Aktif' },
    { id: 'off', label: 'Nonaktif' },
  ];

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-2xl bg-[#0c0c10] border border-white/15 rounded-xl p-6 text-neutral-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">Pengaturan Simulator</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Pencahayaan, jumlah lap, audio, dan kontrol berkendara
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Pengaturan"
            className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-neutral-300 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5 mt-5">
          {/* Time of Day */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-2">
              Waktu & Pencahayaan Pegunungan
            </label>
            <div className="grid grid-cols-3 gap-2">
              {timeOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChange({ ...settings, timeOfDay: opt.id })}
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                    settings.timeOfDay === opt.id
                      ? 'bg-red-600 border-red-500 text-white'
                      : 'bg-neutral-900 border-white/10 text-neutral-300 hover:bg-neutral-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Laps */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-2">
              Jumlah Lap (Circuit Race & Time Trial)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {lapOptions.map((laps) => (
                <button
                  key={laps}
                  type="button"
                  onClick={() => onChange({ ...settings, laps })}
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold border cursor-pointer transition-colors font-mono-num ${
                    settings.laps === laps
                      ? 'bg-red-600 border-red-500 text-white'
                      : 'bg-neutral-900 border-white/10 text-neutral-300 hover:bg-neutral-800'
                  }`}
                >
                  {laps} Lap
                </button>
              ))}
            </div>
          </div>

          {/* Audio Volume */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-neutral-300">
                Volume Suara Mesin & Efek
              </label>
              <button
                type="button"
                onClick={() => onChange({ ...settings, muted: !settings.muted })}
                className="flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white bg-neutral-900 border border-white/10 px-2.5 py-1 rounded-md cursor-pointer"
              >
                {settings.muted ? <VolumeX className="w-3.5 h-3.5 text-red-500" /> : <Volume2 className="w-3.5 h-3.5 text-white" />}
                {settings.muted ? 'Mati' : `${Math.round(settings.volume * 100)}%`}
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(settings.volume * 100)}
              onChange={(e) =>
                onChange({ ...settings, volume: Number(e.target.value) / 100, muted: false })
              }
              className="w-full accent-red-600 cursor-pointer"
            />
          </div>

          {/* Graphics & Touch Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-2">
                Kualitas Grafis 3D
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onChange({ ...settings, highQuality: true })}
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold border cursor-pointer ${
                    settings.highQuality
                      ? 'bg-red-600 border-red-500 text-white'
                      : 'bg-neutral-900 border-white/10 text-neutral-300'
                  }`}
                >
                  Tinggi
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...settings, highQuality: false })}
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold border cursor-pointer ${
                    !settings.highQuality
                      ? 'bg-red-600 border-red-500 text-white'
                      : 'bg-neutral-900 border-white/10 text-neutral-300'
                  }`}
                >
                  Performa
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-2">
                Tombol Layar Sentuh
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {touchOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChange({ ...settings, touchControls: opt.id })}
                    className={`py-2.5 px-2 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                      settings.touchControls === opt.id
                        ? 'bg-red-600 border-red-500 text-white'
                        : 'bg-neutral-900 border-white/10 text-neutral-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Controls Summary */}
          <div className="bg-neutral-900/90 border border-white/10 rounded-lg p-4">
            <div className="text-xs font-semibold text-white mb-2">Panduan Kontrol Keyboard</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-1.5 gap-x-4 text-xs text-neutral-300">
              <div><span className="text-red-400 font-mono-num font-bold">W / ↑</span> : Gas</div>
              <div><span className="text-red-400 font-mono-num font-bold">S / ↓</span> : Rem / Mundur</div>
              <div><span className="text-red-400 font-mono-num font-bold">A D / ← →</span> : Belok</div>
              <div><span className="text-red-400 font-mono-num font-bold">SPACE</span> : Rem Tangan / Drift</div>
              <div><span className="text-red-400 font-mono-num font-bold">SHIFT</span> : Nitro Boost</div>
              <div><span className="text-red-400 font-mono-num font-bold">C / R / ESC</span> : Kamera / Reset / Pause</div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-red-600 hover:bg-red-500 text-white font-display font-bold text-sm px-6 py-2.5 rounded-lg cursor-pointer"
          >
            Simpan & Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Play, Wrench, Settings, Power, Flag, Timer, Compass, ChevronRight, ArrowLeft } from 'lucide-react';
import { CarSpec, GameMode, PaintColor } from '../game/types';
import { formatRaceTime } from '../game/formatTime';

interface MainMenuProps {
  selectedCar: CarSpec;
  selectedPaint: PaintColor;
  selectedMode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  onStartRace: (mode: GameMode) => void;
  onOpenGarage: () => void;
  onOpenSettings: () => void;
  onQuit: () => void;
  bestTimeTrialMs: number;
}

const MODE_OPTIONS: Array<{
  id: GameMode;
  title: string;
  subtitle: string;
  detail: string;
  icon: typeof Flag;
}> = [
  {
    id: 'circuit',
    title: 'Circuit Race',
    subtitle: 'Balapan melawan 5 pembalap AI',
    detail: 'Rebut posisi ke-1 di Sirkuit Bukit Barisan dengan sistem lap & checkpoint.',
    icon: Flag,
  },
  {
    id: 'timetrial',
    title: 'Time Trial',
    subtitle: 'Uji waktu solo & rekor lintasan',
    detail: 'Kejar catatan lap tercepat tanpa gangguan lalu lintas maupun lawan.',
    icon: Timer,
  },
  {
    id: 'freedrive',
    title: 'Free Drive',
    subtitle: 'Berkendara bebas pegunungan',
    detail: 'Jelajahi jalur Sumatera Utara dengan lalu lintas kendaraan & siklus siang-sore.',
    icon: Compass,
  },
];

export function MainMenu({
  selectedCar,
  selectedPaint,
  selectedMode,
  onSelectMode,
  onStartRace,
  onOpenGarage,
  onOpenSettings,
  onQuit,
  bestTimeTrialMs,
}: MainMenuProps) {
  const [showModePicker, setShowModePicker] = useState(false);

  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-6 md:p-10">
      {/* Top Bar */}
      <div className="flex items-start justify-between gap-6">
        <div className="pointer-events-auto bg-[#0a0a0d]/90 border border-white/10 px-5 py-4 rounded-xl">
          <div className="text-xs font-medium tracking-widest text-red-500 uppercase">
            Sirkuit Bukit Barisan · Sumatera Utara
          </div>
          <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white mt-0.5">
            REALISTIC RACING SIMULATOR
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400 mt-1.5">
            <span>{selectedCar.name}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full border border-white/30"
                style={{ backgroundColor: selectedPaint.hex }}
              />
              {selectedPaint.name}
            </span>
            {bestTimeTrialMs > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num text-neutral-300">
                  Rekor Lap: {formatRaceTime(bestTimeTrialMs)}
                </span>
              </>
            )}
          </div>
          <div className="text-[11px] text-neutral-400 mt-2 pt-2 border-t border-white/10">
            Tim Pengembang: <span className="text-white font-semibold">Suwandi</span> · <span className="text-red-400 font-medium">SMKN 4 Soppeng</span>
          </div>
        </div>
      </div>

      {/* Bottom Action Menu */}
      <div className="flex flex-col md:flex-row items-stretch md:items-end justify-between gap-6">
        {!showModePicker ? (
          <div className="pointer-events-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-[#0a0a0d]/92 border border-white/10 p-3 rounded-xl">
            <button
              type="button"
              onClick={() => setShowModePicker(true)}
              className="flex items-center justify-center gap-2.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-display font-bold text-base tracking-wide px-8 py-3.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-5 h-5 fill-current" />
              PLAY
            </button>
            <button
              type="button"
              onClick={onOpenGarage}
              className="flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-white font-display font-semibold text-sm tracking-wide px-6 py-3.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Wrench className="w-4 h-4 text-red-500" />
              GARAGE
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-white font-display font-semibold text-sm tracking-wide px-6 py-3.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Settings className="w-4 h-4 text-neutral-300" />
              SETTINGS
            </button>
            <button
              type="button"
              onClick={onQuit}
              className="flex items-center justify-center gap-2 bg-neutral-950 hover:bg-neutral-900 border border-white/10 text-neutral-300 hover:text-white font-display font-semibold text-sm tracking-wide px-5 py-3.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Power className="w-4 h-4 text-red-500" />
              QUIT
            </button>
          </div>
        ) : (
          <div className="pointer-events-auto w-full max-w-4xl bg-[#0a0a0d]/95 border border-white/10 p-5 rounded-xl">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="font-display text-xl font-bold text-white">Pilih Mode Balapan</h2>
                <p className="text-xs text-neutral-400">
                  Lintasan Pegunungan Sumatera Utara · {selectedCar.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModePicker(false)}
                className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 border border-white/10 px-3.5 py-2 rounded-lg cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Kembali
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {MODE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = selectedMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onSelectMode(opt.id);
                      onStartRace(opt.id);
                    }}
                    className={`text-left p-4 rounded-lg border transition-colors cursor-pointer flex flex-col justify-between gap-3 ${
                      active
                        ? 'bg-red-950/50 border-red-500 text-white'
                        : 'bg-neutral-900/90 border-white/10 text-neutral-200 hover:border-red-500/60 hover:bg-neutral-900'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Icon className="w-5 h-5 text-red-500" />
                        <ChevronRight className="w-4 h-4 text-neutral-400" />
                      </div>
                      <div className="font-display font-bold text-base text-white">{opt.title}</div>
                      <div className="text-xs font-medium text-red-400 mt-0.5">{opt.subtitle}</div>
                      <p className="text-xs text-neutral-400 mt-2 leading-relaxed">{opt.detail}</p>
                    </div>
                    <div className="text-xs font-semibold text-white">Mulai Sekarang</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Controls Hint */}
        <div className="hidden lg:flex pointer-events-auto bg-[#0a0a0d]/90 border border-white/10 px-4 py-3 rounded-xl text-xs text-neutral-300 items-center gap-4">
          <span>WASD / Panah: Kemudi</span>
          <span aria-hidden="true">·</span>
          <span>Space: Drift</span>
          <span aria-hidden="true">·</span>
          <span>Shift: Nitro</span>
          <span aria-hidden="true">·</span>
          <span>C: Kamera</span>
          <span aria-hidden="true">·</span>
          <span>R: Reset</span>
        </div>
      </div>
    </div>
  );
}

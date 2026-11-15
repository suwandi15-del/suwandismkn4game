import { useEffect, useState } from 'react';
import {
  Camera,
  RotateCcw,
  Pause,
  Volume2,
  VolumeX,
  ArrowLeft,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { CameraMode, ControlInputs, GameMode, TelemetryData } from '../game/types';
import { formatRaceTime } from '../game/formatTime';

interface RaceHUDProps {
  mode: GameMode;
  telemetry: TelemetryData;
  muted: boolean;
  touchSetting: 'auto' | 'on' | 'off';
  onCycleCamera: () => void;
  onResetTrack: () => void;
  onToggleMute: () => void;
  onPause: () => void;
  onTouchInput: (key: keyof ControlInputs, active: boolean) => void;
}

const CAMERA_LABELS: Record<CameraMode, string> = {
  third_person: '3rd Person',
  cockpit: 'Cockpit POV',
  bumper: 'Bumper Cam',
};

export function RaceHUD({
  mode,
  telemetry,
  muted,
  touchSetting,
  onCycleCamera,
  onResetTrack,
  onToggleMute,
  onPause,
  onTouchInput,
}: RaceHUDProps) {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const coarse =
      typeof window !== 'undefined' &&
      (navigator.maxTouchPoints > 0 || window.matchMedia?.('(pointer: coarse)').matches);
    setIsTouchDevice(Boolean(coarse));
  }, []);

  const showTouchControls =
    touchSetting === 'on' || (touchSetting === 'auto' && isTouchDevice);

  // Compute SVG minimap bounds from track outline
  const outline = telemetry.trackOutline;
  let minX = -400;
  let maxX = 400;
  let minZ = -400;
  let maxZ = 400;
  if (outline.length > 0) {
    minX = Infinity;
    maxX = -Infinity;
    minZ = Infinity;
    maxZ = -Infinity;
    for (const pt of outline) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.z < minZ) minZ = pt.z;
      if (pt.z > maxZ) maxZ = pt.z;
    }
  }
  const pad = 40;
  const spanX = Math.max(1, maxX - minX + pad * 2);
  const spanZ = Math.max(1, maxZ - minZ + pad * 2);
  const mapPoint = (x: number, z: number) => ({
    mx: ((x - minX + pad) / spanX) * 100,
    my: ((z - minZ + pad) / spanZ) * 100,
  });

  const pathD =
    outline.length > 2
      ? outline
          .map((pt, idx) => {
            const { mx, my } = mapPoint(pt.x, pt.z);
            return `${idx === 0 ? 'M' : 'L'} ${mx.toFixed(1)} ${my.toFixed(1)}`;
          })
          .join(' ') + ' Z'
      : '';

  const rpmPct = Math.min(100, Math.max(0, (telemetry.rpm / telemetry.maxRpm) * 100));
  const gearLabel =
    telemetry.gear === -1 ? 'R' : telemetry.gear === 0 ? 'N' : String(telemetry.gear);

  const bindHold = (key: keyof ControlInputs) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      onTouchInput(key, true);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      onTouchInput(key, false);
    },
    onPointerCancel: () => onTouchInput(key, false),
    onLostPointerCapture: () => onTouchInput(key, false),
  });

  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-5">
      {/* TOP BAR */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left: Position, Lap & Checkpoint */}
        <div className="pointer-events-auto bg-[#0a0a0d]/88 border border-white/10 rounded-xl px-4 py-2.5 flex items-center gap-4">
          {mode === 'circuit' && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-400">Posisi</div>
              <div className="font-display text-2xl font-bold text-white leading-none font-mono-num">
                <span className="text-red-500">{telemetry.position}</span>
                <span className="text-sm text-neutral-400">/{telemetry.totalRacers}</span>
              </div>
            </div>
          )}

          {mode !== 'freedrive' ? (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-400">Lap</div>
              <div className="font-display text-2xl font-bold text-white leading-none font-mono-num">
                {telemetry.lap}
                <span className="text-sm text-neutral-400">/{telemetry.totalLaps}</span>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-red-400">Mode</div>
              <div className="font-display text-lg font-bold text-white leading-none">
                Free Drive
              </div>
            </div>
          )}

          <div className="hidden sm:block border-l border-white/10 pl-3">
            <div className="text-[10px] uppercase tracking-wider text-neutral-400">
              {telemetry.timeOfDayLabel}
            </div>
            <div className="text-xs font-mono-num text-neutral-200 mt-0.5">
              {mode !== 'freedrive'
                ? `CP ${telemetry.checkpointIndex}/${telemetry.totalCheckpoints}`
                : 'Bukit Barisan'}
            </div>
          </div>
        </div>

        {/* Top-Center: Timers & Minimap */}
        <div className="hidden md:flex items-center gap-3 bg-[#0a0a0d]/88 border border-white/10 rounded-xl px-4 py-2">
          <svg viewBox="0 0 100 100" className="w-14 h-14 shrink-0">
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke="#3f3f46"
                strokeWidth="5"
                strokeLinejoin="round"
              />
            )}
            {telemetry.minimapRacers.map((r, i) => {
              const { mx, my } = mapPoint(r.x, r.z);
              return (
                <circle
                  key={i}
                  cx={mx}
                  cy={my}
                  r={r.isPlayer ? 4.8 : 3.2}
                  fill={r.color}
                  stroke="#09090b"
                  strokeWidth="1"
                />
              );
            })}
          </svg>

          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
            <div className="text-neutral-400">Waktu Lap</div>
            <div className="font-mono-num text-white font-semibold text-right">
              {formatRaceTime(telemetry.currentLapMs)}
            </div>
            <div className="text-neutral-400">Lap Terbaik</div>
            <div className="font-mono-num text-red-400 font-semibold text-right">
              {telemetry.bestLapMs > 0 ? formatRaceTime(telemetry.bestLapMs) : '--:--.--'}
            </div>
            <div className="text-neutral-400">Total</div>
            <div className="font-mono-num text-neutral-200 text-right">
              {formatRaceTime(telemetry.raceTimeMs)}
            </div>
          </div>
        </div>

        {/* Top-Right: Functional Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-[#0a0a0d]/88 border border-white/10 rounded-xl p-1.5">
          <button
            type="button"
            onClick={onCycleCamera}
            title="Ganti Kamera (C)"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-xs font-medium text-white cursor-pointer transition-colors whitespace-nowrap"
          >
            <Camera className="w-4 h-4 text-red-500" />
            <span className="hidden sm:inline">{CAMERA_LABELS[telemetry.cameraMode]}</span>
          </button>
          <button
            type="button"
            onClick={onResetTrack}
            title="Reset ke Lintasan (R)"
            aria-label="Reset ke Lintasan"
            className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white cursor-pointer transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            title="Suara"
            aria-label="Toggle Suara"
            className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white cursor-pointer transition-colors"
          >
            {muted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onPause}
            title="Pause (ESC)"
            aria-label="Pause"
            className="p-2 rounded-lg bg-red-600 hover:bg-red-500 text-white cursor-pointer transition-colors"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CENTER OVERLAYS: COUNTDOWN OR WRONG WAY */}
      <div className="flex flex-col items-center justify-center my-auto">
        {telemetry.countdown >= 0 && (
          <div className="bg-[#0a0a0d]/90 border border-red-500/60 px-10 py-5 rounded-2xl text-center">
            <div className="font-display text-6xl sm:text-7xl font-bold tracking-wider text-white">
              {telemetry.countdown === 0 ? (
                <span className="text-red-500">GO!</span>
              ) : (
                telemetry.countdown
              )}
            </div>
          </div>
        )}

        {telemetry.wrongWay && telemetry.countdown < 0 && (
          <div className="bg-red-700/95 border border-white/25 px-6 py-2.5 rounded-xl text-center">
            <div className="font-display text-lg font-bold tracking-wider text-white">
              ARAH SALAH — PUTAR BALIK (TEKAN R UNTUK RESET)
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM BAR: Touch Controls + Digital Speedometer */}
      <div className="flex items-end justify-between gap-3">
        {/* Left: Touch Steer (when enabled) or subtle controls strip */}
        {showTouchControls ? (
          <div className="pointer-events-auto flex items-center gap-2.5 touch-none">
            <button
              type="button"
              aria-label="Belok Kiri"
              {...bindHold('left')}
              className="w-16 h-16 rounded-xl bg-[#0a0a0d]/90 active:bg-red-600 border border-white/20 flex items-center justify-center text-white select-none"
            >
              <ArrowLeft className="w-7 h-7" />
            </button>
            <button
              type="button"
              aria-label="Belok Kanan"
              {...bindHold('right')}
              className="w-16 h-16 rounded-xl bg-[#0a0a0d]/90 active:bg-red-600 border border-white/20 flex items-center justify-center text-white select-none"
            >
              <ArrowRight className="w-7 h-7" />
            </button>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-3 bg-[#0a0a0d]/80 border border-white/10 rounded-lg px-3.5 py-2 text-[11px] text-neutral-400">
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
        )}

        {/* Right: Speedometer + optional Touch Pedals */}
        <div className="flex items-end gap-3 ml-auto">
          {showTouchControls && (
            <div className="pointer-events-auto grid grid-cols-2 gap-2 touch-none">
              <button
                type="button"
                {...bindHold('handbrake')}
                className="px-3.5 py-3 rounded-xl bg-[#0a0a0d]/90 active:bg-amber-600 border border-white/20 text-xs font-display font-bold text-white select-none"
              >
                DRIFT
              </button>
              <button
                type="button"
                {...bindHold('nitro')}
                className="px-3.5 py-3 rounded-xl bg-[#0a0a0d]/90 active:bg-sky-600 border border-white/20 text-xs font-display font-bold text-sky-300 flex items-center justify-center gap-1 select-none"
              >
                <Zap className="w-3.5 h-3.5" />
                NOS
              </button>
              <button
                type="button"
                {...bindHold('brake')}
                className="px-4 py-4 rounded-xl bg-neutral-900/95 active:bg-red-700 border border-white/20 text-xs font-display font-bold text-red-400 select-none"
              >
                REM
              </button>
              <button
                type="button"
                {...bindHold('throttle')}
                className="px-4 py-4 rounded-xl bg-red-600/95 active:bg-red-500 border border-red-400/50 text-xs font-display font-bold text-white select-none"
              >
                GAS
              </button>
            </div>
          )}

          {/* Speedometer / Tachometer / Gear / Nitro */}
          <div className="pointer-events-auto bg-[#0a0a0d]/92 border border-white/10 rounded-xl px-4 py-3 min-w-[210px] sm:min-w-[245px]">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <div className="font-display text-4xl sm:text-5xl font-bold text-white leading-none font-mono-num">
                  {telemetry.speedKmh}
                </div>
                <div className="text-[10px] tracking-widest text-neutral-400 uppercase mt-1">
                  KM/H
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] tracking-wider text-neutral-400 uppercase">Gigi</div>
                <div className="font-display text-3xl font-bold text-red-500 leading-none font-mono-num">
                  {gearLabel}
                </div>
              </div>
            </div>

            {/* RPM Bar */}
            <div className="mt-2.5">
              <div className="flex justify-between text-[10px] text-neutral-400 mb-1 font-mono-num">
                <span>RPM</span>
                <span>{telemetry.rpm}</span>
              </div>
              <div className="h-2 w-full bg-neutral-800 rounded-sm overflow-hidden flex">
                <div
                  className={`h-full transition-all duration-75 ${
                    rpmPct > 84 ? 'bg-red-500' : 'bg-white'
                  }`}
                  style={{ width: `${rpmPct}%` }}
                />
              </div>
            </div>

            {/* Nitro Bar */}
            <div className="mt-2">
              <div className="flex justify-between text-[10px] mb-1">
                <span className={telemetry.isNitroActive ? 'text-sky-400 font-semibold' : 'text-neutral-400'}>
                  NITRO {telemetry.isDrifting ? '· DRIFT +NOS' : ''}
                </span>
                <span className="font-mono-num text-neutral-300">{telemetry.nitro}%</span>
              </div>
              <div className="h-1.5 w-full bg-neutral-800 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-red-600 transition-all duration-75"
                  style={{
                    width: `${telemetry.nitro}%`,
                    backgroundColor: telemetry.isNitroActive ? '#38bdf8' : '#dc2626',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

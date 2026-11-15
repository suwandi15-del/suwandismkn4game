import { Trophy, RotateCcw, Home, AlertTriangle } from 'lucide-react';
import { GameMode, TelemetryData } from '../game/types';
import { formatRaceTime } from '../game/formatTime';

interface ResultsOverlayProps {
  mode: GameMode;
  telemetry: TelemetryData;
  onRestart: () => void;
  onExitMenu: () => void;
}

export function ResultsOverlay({
  mode,
  telemetry,
  onRestart,
  onExitMenu,
}: ResultsOverlayProps) {
  const isWin = telemetry.isVictory;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/80">
      <div className="w-full max-w-2xl bg-[#0c0c10] border border-white/15 rounded-xl p-6 text-neutral-100">
        {/* Header Victory / Defeat */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-xl flex items-center justify-center border ${
                isWin
                  ? 'bg-red-600/20 border-red-500 text-red-500'
                  : 'bg-neutral-900 border-white/15 text-neutral-300'
              }`}
            >
              {isWin ? <Trophy className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7 text-red-500" />}
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-red-500">
                {mode === 'timetrial'
                  ? 'Time Trial Selesai'
                  : isWin
                    ? 'Kemenangan Balapan'
                    : 'Balapan Selesai — Kalah'}
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
                {mode === 'timetrial'
                  ? 'CATATAN WAKTU TERCATAT'
                  : isWin
                    ? 'JUARA 1 SIRKUIT'
                    : `FINIS POSISI KE-${telemetry.position}`}
              </h2>
            </div>
          </div>

          <div className="flex gap-5 text-right">
            <div>
              <div className="text-[11px] text-neutral-400">Total Waktu</div>
              <div className="font-mono-num text-lg font-bold text-white">
                {formatRaceTime(telemetry.raceTimeMs)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-neutral-400">Lap Terbaik</div>
              <div className="font-mono-num text-lg font-bold text-red-400">
                {formatRaceTime(telemetry.bestLapMs)}
              </div>
            </div>
          </div>
        </div>

        {/* Standings Table */}
        <div className="mt-5">
          <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2.5">
            Klasemen Akhir
          </div>
          <div className="border border-white/10 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-900 text-neutral-400">
                <tr>
                  <th className="py-2.5 px-3 font-medium">Pos</th>
                  <th className="py-2.5 px-3 font-medium">Pembalap</th>
                  <th className="py-2.5 px-3 font-medium hidden sm:table-cell">Mobil</th>
                  <th className="py-2.5 px-3 font-medium text-right">Status / Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {telemetry.standings.map((row) => (
                  <tr
                    key={row.id}
                    className={row.isPlayer ? 'bg-red-950/35 text-white font-semibold' : 'text-neutral-300'}
                  >
                    <td className="py-2.5 px-3 font-mono-num font-bold">
                      #{row.position}
                    </td>
                    <td className="py-2.5 px-3">{row.name}</td>
                    <td className="py-2.5 px-3 hidden sm:table-cell text-neutral-400">
                      {row.carName}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num">
                      {row.finished ? formatRaceTime(row.finishTimeMs) : `Lap ${row.lap}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
          <button
            type="button"
            onClick={onExitMenu}
            className="flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-white text-sm font-medium px-5 py-3 rounded-lg cursor-pointer transition-colors"
          >
            <Home className="w-4 h-4" />
            Menu Utama
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-display font-bold text-sm px-6 py-3 rounded-lg cursor-pointer transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Balap Ulang
          </button>
        </div>
      </div>
    </div>
  );
}

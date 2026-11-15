import { Play, RotateCcw, Settings, Camera, Home } from 'lucide-react';

interface PauseOverlayProps {
  onResume: () => void;
  onRestart: () => void;
  onCycleCamera: () => void;
  onOpenSettings: () => void;
  onExitMenu: () => void;
}

export function PauseOverlay({
  onResume,
  onRestart,
  onCycleCamera,
  onOpenSettings,
  onExitMenu,
}: PauseOverlayProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/75">
      <div className="w-full max-w-sm bg-[#0c0c10] border border-white/15 rounded-xl p-6">
        <div className="text-xs font-medium text-red-500 uppercase tracking-wider">
          Permainan Dijeda
        </div>
        <h2 className="font-display text-3xl font-bold text-white mt-0.5 mb-5">PAUSE</h2>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-display font-bold py-3 px-4 rounded-lg cursor-pointer transition-colors"
          >
            <Play className="w-4 h-4 fill-current" />
            Lanjutkan Balapan
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-white font-medium text-sm py-3 px-4 rounded-lg cursor-pointer transition-colors"
          >
            <RotateCcw className="w-4 h-4 text-red-500" />
            Ulangi Balapan
          </button>
          <button
            type="button"
            onClick={onCycleCamera}
            className="flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-white font-medium text-sm py-3 px-4 rounded-lg cursor-pointer transition-colors"
          >
            <Camera className="w-4 h-4 text-neutral-300" />
            Ganti Kamera
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-white font-medium text-sm py-3 px-4 rounded-lg cursor-pointer transition-colors"
          >
            <Settings className="w-4 h-4 text-neutral-300" />
            Pengaturan
          </button>
          <button
            type="button"
            onClick={onExitMenu}
            className="flex items-center justify-center gap-2 bg-neutral-950 hover:bg-neutral-900 border border-white/10 text-neutral-300 hover:text-white font-medium text-sm py-3 px-4 rounded-lg cursor-pointer transition-colors mt-1"
          >
            <Home className="w-4 h-4" />
            Keluar ke Menu Utama
          </button>
        </div>
      </div>
    </div>
  );
}

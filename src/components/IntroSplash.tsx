import { ChevronRight } from 'lucide-react';

interface IntroSplashProps {
  onContinue: () => void;
}

export function IntroSplash({ onContinue }: IntroSplashProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-black/75">
      <div className="w-full max-w-lg bg-[#0a0a0d]/95 border border-white/15 rounded-2xl p-8 text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-red-500">
          Mempersembahkan
        </div>

        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white mt-2">
          REALISTIC RACING SIMULATOR
        </h1>

        <div className="my-6 h-px w-full bg-white/10" />

        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-widest text-neutral-400">
            Tim Pengembang
          </div>
          <div className="font-display text-2xl sm:text-3xl font-bold text-white">
            Suwandi
          </div>
          <div className="text-sm font-semibold text-red-400">
            SMKN 4 Soppeng
          </div>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="mt-8 w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-display font-bold text-base tracking-wide py-3.5 px-6 rounded-xl transition-colors cursor-pointer"
        >
          Masuk ke Menu Utama
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

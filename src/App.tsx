import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { CAR_CATALOG, PAINT_COLORS } from './game/catalog';
import { RacingEngine } from './game/engine';
import {
  ControlInputs,
  GameMode,
  GameSettings,
  ScreenState,
  TelemetryData,
} from './game/types';
import { MainMenu } from './components/MainMenu';
import { GarageScreen } from './components/GarageScreen';
import { SettingsModal } from './components/SettingsModal';
import { RaceHUD } from './components/RaceHUD';
import { PauseOverlay } from './components/PauseOverlay';
import { ResultsOverlay } from './components/ResultsOverlay';
import { IntroSplash } from './components/IntroSplash';

const INITIAL_SETTINGS: GameSettings = {
  timeOfDay: 'dynamic',
  laps: 3,
  volume: 0.65,
  muted: false,
  touchControls: 'auto',
  highQuality: true,
};

const EMPTY_TELEMETRY: TelemetryData = {
  speedKmh: 0,
  rpm: 1100,
  maxRpm: 8500,
  gear: 1,
  nitro: 100,
  isNitroActive: false,
  isDrifting: false,
  isBraking: false,
  lap: 1,
  totalLaps: 3,
  position: 1,
  totalRacers: 6,
  raceTimeMs: 0,
  currentLapMs: 0,
  bestLapMs: 0,
  countdown: -1,
  checkpointIndex: 0,
  totalCheckpoints: 3,
  cameraMode: 'third_person',
  timeOfDayLabel: 'Siang Cerah',
  wrongWay: false,
  standings: [],
  minimapRacers: [],
  trackOutline: [],
  raceFinished: false,
  isVictory: false,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<RacingEngine | null>(null);

  const [screen, setScreen] = useState<ScreenState>('intro');
  const [returnScreenFromSettings, setReturnScreenFromSettings] = useState<ScreenState>('menu');
  const [selectedCarId, setSelectedCarId] = useState<string>(CAR_CATALOG[0].id);
  const [selectedPaintId, setSelectedPaintId] = useState<string>(PAINT_COLORS[0].id);
  const [selectedMode, setSelectedMode] = useState<GameMode>('circuit');
  const [settings, setSettings] = useState<GameSettings>(INITIAL_SETTINGS);
  const [telemetry, setTelemetry] = useState<TelemetryData>(EMPTY_TELEMETRY);
  const [contextLost, setContextLost] = useState(false);
  const [bestTimeTrialMs, setBestTimeTrialMs] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('rrs_best_timetrial_ms') || '0');
    } catch {
      return 0;
    }
  });

  const screenRef = useRef<ScreenState>(screen);
  screenRef.current = screen;

  const selectedCar = CAR_CATALOG.find((c) => c.id === selectedCarId) ?? CAR_CATALOG[0];
  const selectedPaint = PAINT_COLORS.find((p) => p.id === selectedPaintId) ?? PAINT_COLORS[0];

  // Mount Three.js Engine once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new RacingEngine(
      mount,
      INITIAL_SETTINGS,
      (data) => {
        setTelemetry(data);
        if (data.raceFinished && screenRef.current === 'playing') {
          setScreen('results');
          engine.setPaused(true);
          try {
            const saved = Number(localStorage.getItem('rrs_best_timetrial_ms') || '0');
            if (saved > 0) setBestTimeTrialMs(saved);
          } catch {
            // ignore
          }
        }
      },
      (lost) => setContextLost(lost)
    );
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Sync car & paint selection into engine
  useEffect(() => {
    engineRef.current?.setSelectedCar(selectedCarId, selectedPaintId);
  }, [selectedCarId, selectedPaintId]);

  // Sync showcase mode
  useEffect(() => {
    if (screen === 'garage') {
      engineRef.current?.setShowcaseMode('garage');
    } else if (screen === 'menu' || screen === 'intro') {
      engineRef.current?.setShowcaseMode('menu');
    }
  }, [screen]);

  // Sync settings
  const handleSettingsChange = useCallback((next: GameSettings) => {
    setSettings(next);
    engineRef.current?.updateSettings(next);
  }, []);

  const handleStartRace = useCallback(
    (mode: GameMode) => {
      setSelectedMode(mode);
      setScreen('playing');
      engineRef.current?.startRace(mode);
    },
    []
  );

  const handlePause = useCallback(() => {
    if (screenRef.current === 'playing') {
      engineRef.current?.setPaused(true);
      engineRef.current?.clearInputs();
      setScreen('paused');
    }
  }, []);

  const handleResume = useCallback(() => {
    if (screenRef.current === 'paused') {
      engineRef.current?.setPaused(false);
      setScreen('playing');
    }
  }, []);

  const handleRestartRace = useCallback(() => {
    setScreen('playing');
    engineRef.current?.startRace(selectedMode);
  }, [selectedMode]);

  const handleExitToMenu = useCallback(() => {
    engineRef.current?.stopRaceToMenu();
    setScreen('menu');
  }, []);

  const handleCycleCamera = useCallback(() => {
    const cam = engineRef.current?.cycleCamera();
    if (cam) {
      setTelemetry((prev) => ({ ...prev, cameraMode: cam }));
    }
  }, []);

  const handleResetTrack = useCallback(() => {
    engineRef.current?.resetPlayerToTrack();
  }, []);

  const handleToggleMute = useCallback(() => {
    setSettings((prev) => {
      const next = { ...prev, muted: !prev.muted };
      engineRef.current?.updateSettings(next);
      return next;
    });
  }, []);

  const handleTouchInput = useCallback((key: keyof ControlInputs, active: boolean) => {
    engineRef.current?.audio.unlock();
    engineRef.current?.setInput(key, active);
  }, []);

  // Keyboard Controls
  useEffect(() => {
    const mapKey = (code: string): keyof ControlInputs | null => {
      switch (code) {
        case 'KeyW':
        case 'ArrowUp':
          return 'throttle';
        case 'KeyS':
        case 'ArrowDown':
          return 'brake';
        case 'KeyA':
        case 'ArrowLeft':
          return 'left';
        case 'KeyD':
        case 'ArrowRight':
          return 'right';
        case 'Space':
          return 'handbrake';
        case 'ShiftLeft':
        case 'ShiftRight':
          return 'nitro';
        default:
          return null;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (screenRef.current === 'intro' && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        engineRef.current?.audio.unlock();
        setScreen('menu');
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (screenRef.current === 'playing') {
          e.preventDefault();
          handlePause();
          return;
        } else if (screenRef.current === 'paused') {
          e.preventDefault();
          handleResume();
          return;
        }
      }

      if (screenRef.current !== 'playing') return;

      engineRef.current?.audio.unlock();

      if (!e.repeat) {
        if (e.code === 'KeyC') {
          e.preventDefault();
          handleCycleCamera();
          return;
        }
        if (e.code === 'KeyR') {
          e.preventDefault();
          handleResetTrack();
          return;
        }
      }

      const inputKey = mapKey(e.code);
      if (inputKey) {
        e.preventDefault();
        engineRef.current?.setInput(inputKey, true);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const inputKey = mapKey(e.code);
      if (inputKey) {
        engineRef.current?.setInput(inputKey, false);
      }
    };

    const onBlur = () => {
      engineRef.current?.clearInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [handleCycleCamera, handlePause, handleResetTrack, handleResume]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#08080a]">
      {/* Isolated WebGL Viewport Container */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Context Lost Recovery Notice */}
      {contextLost && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 p-6">
          <div className="bg-neutral-900 border border-red-500/40 rounded-xl p-6 max-w-sm text-center">
            <h3 className="font-display text-xl font-bold text-white">Koneksi Grafis 3D Terputus</h3>
            <p className="text-xs text-neutral-400 mt-2">
              Browser sedang memulihkan konteks WebGL. Muat ulang halaman jika tampilan belum kembali.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center gap-2 bg-red-600 text-white text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Muat Ulang
            </button>
          </div>
        </div>
      )}

      {/* Intro Developer Credit Screen */}
      {screen === 'intro' && (
        <IntroSplash
          onContinue={() => {
            engineRef.current?.audio.unlock();
            setScreen('menu');
          }}
        />
      )}

      {/* Main Menu */}
      {screen === 'menu' && (
        <MainMenu
          selectedCar={selectedCar}
          selectedPaint={selectedPaint}
          selectedMode={selectedMode}
          onSelectMode={setSelectedMode}
          onStartRace={handleStartRace}
          onOpenGarage={() => setScreen('garage')}
          onOpenSettings={() => {
            setReturnScreenFromSettings('menu');
            setScreen('settings');
          }}
          onQuit={() => setScreen('quit')}
          bestTimeTrialMs={bestTimeTrialMs}
        />
      )}

      {/* Garage */}
      {screen === 'garage' && (
        <GarageScreen
          selectedCar={selectedCar}
          selectedPaint={selectedPaint}
          onSelectCar={setSelectedCarId}
          onSelectPaint={setSelectedPaintId}
          onBack={() => setScreen('menu')}
          onRaceNow={() => handleStartRace(selectedMode)}
        />
      )}

      {/* Settings */}
      {screen === 'settings' && (
        <SettingsModal
          settings={settings}
          onChange={handleSettingsChange}
          onClose={() => setScreen(returnScreenFromSettings)}
        />
      )}

      {/* In-Game HUD */}
      {(screen === 'playing' || screen === 'paused') && (
        <RaceHUD
          mode={selectedMode}
          telemetry={telemetry}
          muted={settings.muted}
          touchSetting={settings.touchControls}
          onCycleCamera={handleCycleCamera}
          onResetTrack={handleResetTrack}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onTouchInput={handleTouchInput}
        />
      )}

      {/* Pause Menu */}
      {screen === 'paused' && (
        <PauseOverlay
          onResume={handleResume}
          onRestart={handleRestartRace}
          onCycleCamera={handleCycleCamera}
          onOpenSettings={() => {
            setReturnScreenFromSettings('paused');
            setScreen('settings');
          }}
          onExitMenu={handleExitToMenu}
        />
      )}

      {/* Race Results (Win / Lose) */}
      {screen === 'results' && (
        <ResultsOverlay
          mode={selectedMode}
          telemetry={telemetry}
          onRestart={handleRestartRace}
          onExitMenu={handleExitToMenu}
        />
      )}

      {/* Quit Standby Screen */}
      {screen === 'quit' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/88 p-4">
          <div className="max-w-md w-full bg-[#0c0c10] border border-white/15 rounded-xl p-6 text-center">
            <div className="text-xs font-semibold uppercase tracking-widest text-red-500">
              REALISTIC RACING SIMULATOR
            </div>
            <h2 className="font-display text-2xl font-bold text-white mt-1">
              Sesi Simulator Dihentikan
            </h2>
            <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
              Terima kasih telah bermain di Sirkuit Bukit Barisan, Sumatera Utara. Anda dapat menutup tab browser atau kembali ke menu utama.
            </p>
            <button
              type="button"
              onClick={() => setScreen('menu')}
              className="mt-5 w-full bg-red-600 hover:bg-red-500 text-white font-display font-bold text-sm py-3 rounded-lg cursor-pointer transition-colors"
            >
              Kembali ke Menu Utama
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

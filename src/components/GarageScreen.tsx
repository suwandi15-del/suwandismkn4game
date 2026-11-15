import { ArrowLeft, Check, Play } from 'lucide-react';
import { CAR_CATALOG, PAINT_COLORS } from '../game/catalog';
import { CarSpec, PaintColor } from '../game/types';

interface GarageScreenProps {
  selectedCar: CarSpec;
  selectedPaint: PaintColor;
  onSelectCar: (carId: string) => void;
  onSelectPaint: (paintId: string) => void;
  onBack: () => void;
  onRaceNow: () => void;
}

export function GarageScreen({
  selectedCar,
  selectedPaint,
  onSelectCar,
  onSelectPaint,
  onBack,
  onRaceNow,
}: GarageScreenProps) {
  const statRows = [
    { label: 'Kecepatan Maks', value: selectedCar.stats.topSpeed, unit: `${selectedCar.physics.maxSpeedKmh} km/h` },
    { label: 'Akselerasi', value: selectedCar.stats.acceleration, unit: `${selectedCar.stats.acceleration}/100` },
    { label: 'Handling', value: selectedCar.stats.handling, unit: `${selectedCar.stats.handling}/100` },
    { label: 'Pengereman', value: selectedCar.stats.braking, unit: `${selectedCar.stats.braking}/100` },
  ];

  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 md:p-8">
      {/* Top Bar */}
      <div className="flex items-start justify-between gap-4">
        <div className="pointer-events-auto bg-[#0a0a0d]/92 border border-white/10 px-5 py-4 rounded-xl max-w-md">
          <div className="text-xs font-medium text-red-500 uppercase tracking-wider">
            {selectedCar.categoryLabel} · {selectedCar.physics.mass} kg
          </div>
          <h2 className="font-display text-2xl md:text-3xl font-bold text-white mt-0.5">
            {selectedCar.name}
          </h2>
          <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
            {selectedCar.description}
          </p>
          <p className="text-[11px] text-neutral-500 mt-2">
            Geser layar untuk memutar tampilan 3D mobil
          </p>
        </div>

        <div className="pointer-events-auto flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 bg-[#0a0a0d]/92 hover:bg-neutral-900 border border-white/10 text-white text-sm font-medium px-4 py-2.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            Menu Utama
          </button>
          <button
            type="button"
            onClick={onRaceNow}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-display font-bold text-sm px-5 py-2.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
          >
            <Play className="w-4 h-4 fill-current" />
            Pilih & Balap
          </button>
        </div>
      </div>

      {/* Bottom Dock: Specs, Paint Swatches, 5 Cars */}
      <div className="pointer-events-auto w-full max-w-5xl mx-auto bg-[#0a0a0d]/94 border border-white/10 rounded-xl p-4 flex flex-col gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Performance Stats */}
          <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {statRows.map((st) => (
              <div key={st.label} className="bg-neutral-900/90 border border-white/5 rounded-lg p-2.5">
                <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1.5">
                  <span>{st.label}</span>
                  <span className="font-mono-num text-white font-semibold">{st.unit}</span>
                </div>
                <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full transition-all duration-300"
                    style={{ width: `${st.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Paint Swatches */}
          <div className="lg:col-span-6 flex flex-wrap items-center lg:justify-end gap-2">
            <span className="text-xs text-neutral-400 mr-1">Warna Cat:</span>
            {PAINT_COLORS.map((color) => {
              const active = color.id === selectedPaint.id;
              return (
                <button
                  key={color.id}
                  type="button"
                  title={color.name}
                  aria-label={color.name}
                  onClick={() => onSelectPaint(color.id)}
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer transition-transform ${
                    active
                      ? 'border-white scale-110 ring-2 ring-red-500'
                      : 'border-white/20 hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.hex }}
                >
                  {active && (
                    <Check
                      className={`w-4 h-4 ${
                        color.id === 'pearl' || color.id === 'solar' ? 'text-black' : 'text-white'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5 Car Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {CAR_CATALOG.map((car) => {
            const active = car.id === selectedCar.id;
            return (
              <button
                key={car.id}
                type="button"
                onClick={() => onSelectCar(car.id)}
                className={`text-left px-3.5 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                  active
                    ? 'bg-red-600 border-red-400 text-white'
                    : 'bg-neutral-900 border-white/10 text-neutral-300 hover:bg-neutral-800 hover:text-white'
                }`}
              >
                <div className={`text-[11px] font-medium ${active ? 'text-red-100' : 'text-neutral-400'}`}>
                  {car.categoryLabel}
                </div>
                <div className="font-display font-bold text-sm truncate mt-0.5">{car.name}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

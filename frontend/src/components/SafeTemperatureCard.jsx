import React from 'react';
import { Thermometer, AlertTriangle, CheckCircle } from 'lucide-react';

export const SafeTemperatureCard = ({ temperature }) => {
  if (!temperature) return null;

  return (
    <div className="glass-card p-6 border-neon-gold/20" data-testid="safe-temperature-card">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-lg bg-neon-gold/20 flex items-center justify-center">
          <Thermometer className="w-5 h-5 text-neon-gold" />
        </div>
        <div>
          <h2 className="font-chivo font-bold text-lg">
            Safe Cooking Temperature
          </h2>
          <p className="text-xs text-neutral-400">{temperature.category}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-4 rounded-lg bg-neon-gold/10 border border-neon-gold/20">
          <p className="text-xs text-neutral-400 mb-1">Fahrenheit</p>
          <p className="text-3xl font-mono font-bold text-neon-gold">
            {temperature.min_temp_f}°F
          </p>
        </div>
        <div className="p-4 rounded-lg bg-neon-cyan/10 border border-neon-cyan/20">
          <p className="text-xs text-neutral-400 mb-1">Celsius</p>
          <p className="text-3xl font-mono font-bold text-neon-cyan">
            {temperature.min_temp_c}°C
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-start gap-2 text-sm">
          <CheckCircle className="w-4 h-4 text-neon-green shrink-0 mt-0.5" />
          <span className="text-neutral-300">
            Use a food thermometer to check internal temperature
          </span>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-neon-gold shrink-0 mt-0.5" />
          <span className="text-neutral-300">
            Let meat rest 3 minutes after reaching temperature
          </span>
        </div>
      </div>

      {/* Source */}
      <div className="mt-4 pt-4 border-t border-white/5 text-xs text-neutral-500">
        Source: USDA / foodsafety.gov
      </div>
    </div>
  );
};

export default SafeTemperatureCard;

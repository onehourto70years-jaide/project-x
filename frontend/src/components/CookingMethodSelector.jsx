import React from 'react';
import { ChefHat, Flame, Droplets, Wind, Thermometer, Salad } from 'lucide-react';

const COOKING_METHODS = [
  { id: 'raw', label: 'Raw', icon: Salad, description: 'No cooking' },
  { id: 'steamed', label: 'Steamed', icon: Wind, description: 'Best for nutrients' },
  { id: 'boiled', label: 'Boiled', icon: Droplets, description: 'Water-based' },
  { id: 'baked', label: 'Baked', icon: Thermometer, description: 'Oven cooking' },
  { id: 'grilled', label: 'Grilled', icon: Flame, description: 'High heat' },
  { id: 'fried', label: 'Fried', icon: ChefHat, description: 'Oil-based' },
];

export const CookingMethodSelector = ({ selectedMethod, onMethodChange }) => {
  return (
    <div className="glass-card p-6">
      <h2 className="font-chivo font-bold text-lg flex items-center gap-2 mb-4">
        <ChefHat className="w-5 h-5 text-neon-gold" />
        Cooking Method
      </h2>
      
      <div className="grid grid-cols-3 gap-3">
        {COOKING_METHODS.map(method => (
          <button
            key={method.id}
            onClick={() => onMethodChange(method.id)}
            className={`method-tile text-left ${selectedMethod === method.id ? 'active' : ''}`}
            data-testid={`cooking-method-${method.id}`}
          >
            <method.icon 
              className={`w-5 h-5 mb-2 ${
                selectedMethod === method.id ? 'text-neon-cyan' : 'text-neutral-500'
              }`} 
            />
            <p className={`text-sm font-medium ${
              selectedMethod === method.id ? 'text-white' : 'text-neutral-300'
            }`}>
              {method.label}
            </p>
            <p className="text-[10px] text-neutral-500 mt-1">
              {method.description}
            </p>
          </button>
        ))}
      </div>

      {/* Nutrient Preservation Info */}
      <div className="mt-4 p-3 rounded-lg bg-black/30 border border-white/5">
        <p className="text-xs text-neutral-500 mb-2">Nutrient Preservation Rating</p>
        <div className="flex items-center gap-2">
          {['raw', 'steamed', 'baked', 'grilled', 'boiled', 'fried'].map((method, i) => {
            const rating = 5 - i;
            const isSelected = selectedMethod === method;
            return (
              <div 
                key={method}
                className={`flex-1 h-2 rounded-full ${
                  isSelected 
                    ? rating >= 4 ? 'bg-neon-green' 
                    : rating >= 2 ? 'bg-neon-gold' 
                    : 'bg-neon-red'
                    : 'bg-neutral-700'
                }`}
                title={`${method}: ${rating}/5`}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-neutral-600">
          <span>Best</span>
          <span>Less Optimal</span>
        </div>
      </div>
    </div>
  );
};

export default CookingMethodSelector;

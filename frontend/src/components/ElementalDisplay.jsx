import React from 'react';
import { Atom } from 'lucide-react';

// Element data for periodic table display
const ELEMENT_DATA = {
  C: { name: 'Carbon', number: 6, category: 'nonmetal', color: 'neon-cyan' },
  H: { name: 'Hydrogen', number: 1, category: 'nonmetal', color: 'neon-green' },
  O: { name: 'Oxygen', number: 8, category: 'nonmetal', color: 'neon-gold' },
  N: { name: 'Nitrogen', number: 7, category: 'nonmetal', color: 'neon-purple' },
  S: { name: 'Sulfur', number: 16, category: 'nonmetal', color: 'neon-red' },
  Na: { name: 'Sodium', number: 11, category: 'alkali', color: 'periodic-alkali' },
  K: { name: 'Potassium', number: 19, category: 'alkali', color: 'periodic-alkali' },
  Ca: { name: 'Calcium', number: 20, category: 'alkaline', color: 'periodic-alkaline' },
  Mg: { name: 'Magnesium', number: 12, category: 'alkaline', color: 'periodic-alkaline' },
  P: { name: 'Phosphorus', number: 15, category: 'nonmetal', color: 'periodic-nonmetal' },
  Fe: { name: 'Iron', number: 26, category: 'transition', color: 'periodic-transition' },
  Zn: { name: 'Zinc', number: 30, category: 'transition', color: 'periodic-transition' },
  Cu: { name: 'Copper', number: 29, category: 'transition', color: 'periodic-transition' },
  Mn: { name: 'Manganese', number: 25, category: 'transition', color: 'periodic-transition' },
  Se: { name: 'Selenium', number: 34, category: 'nonmetal', color: 'periodic-metalloid' },
};

const ElementTile = ({ symbol, amount, unit, confidence }) => {
  const element = ELEMENT_DATA[symbol] || { name: symbol, number: '?', color: 'neon-cyan' };
  
  const colorClasses = {
    'neon-cyan': 'text-neon-cyan border-neon-cyan/30 bg-neon-cyan/5 hover:bg-neon-cyan/10',
    'neon-green': 'text-neon-green border-neon-green/30 bg-neon-green/5 hover:bg-neon-green/10',
    'neon-gold': 'text-neon-gold border-neon-gold/30 bg-neon-gold/5 hover:bg-neon-gold/10',
    'neon-purple': 'text-neon-purple border-neon-purple/30 bg-neon-purple/5 hover:bg-neon-purple/10',
    'neon-red': 'text-neon-red border-neon-red/30 bg-neon-red/5 hover:bg-neon-red/10',
    'periodic-alkali': 'text-periodic-alkali border-periodic-alkali/30 bg-periodic-alkali/5 hover:bg-periodic-alkali/10',
    'periodic-alkaline': 'text-periodic-alkaline border-periodic-alkaline/30 bg-periodic-alkaline/5 hover:bg-periodic-alkaline/10',
    'periodic-transition': 'text-periodic-transition border-periodic-transition/30 bg-periodic-transition/5 hover:bg-periodic-transition/10',
    'periodic-nonmetal': 'text-periodic-nonmetal border-periodic-nonmetal/30 bg-periodic-nonmetal/5 hover:bg-periodic-nonmetal/10',
    'periodic-metalloid': 'text-periodic-metalloid border-periodic-metalloid/30 bg-periodic-metalloid/5 hover:bg-periodic-metalloid/10',
  };

  const colorClass = colorClasses[element.color] || colorClasses['neon-cyan'];

  return (
    <div 
      className={`element-tile rounded-lg ${colorClass} border`}
      data-testid={`element-${symbol}`}
    >
      <div className="flex justify-between items-start">
        <span className="text-xs opacity-60 font-mono">{element.number}</span>
        {confidence === 'estimated' && (
          <span className="text-[8px] px-1 py-0.5 rounded bg-white/10 text-neutral-400">EST</span>
        )}
      </div>
      <div className="text-center flex-1 flex flex-col justify-center">
        <span className="text-2xl sm:text-3xl font-chivo font-black">{symbol}</span>
        <span className="text-[10px] text-neutral-400 truncate">{element.name}</span>
      </div>
      <div className="text-right">
        <span className="text-xs font-mono font-bold">
          {amount < 0.01 ? '<0.01' : amount.toFixed(2)}
        </span>
        <span className="text-[10px] text-neutral-500 ml-0.5">{unit}</span>
      </div>
    </div>
  );
};

export const ElementalDisplay = ({ composition }) => {
  if (!composition) return null;

  // Main elements from macronutrient conversion
  const mainElements = [
    { symbol: 'C', amount: composition.carbon || 0, unit: 'g', confidence: 'estimated' },
    { symbol: 'H', amount: composition.hydrogen || 0, unit: 'g', confidence: 'estimated' },
    { symbol: 'O', amount: composition.oxygen || 0, unit: 'g', confidence: 'estimated' },
    { symbol: 'N', amount: composition.nitrogen || 0, unit: 'g', confidence: 'estimated' },
    { symbol: 'S', amount: composition.sulfur || 0, unit: 'g', confidence: 'estimated' },
  ].filter(el => el.amount > 0);

  // Minerals from database
  const minerals = Object.entries(composition.minerals || {})
    .map(([symbol, amount]) => ({
      symbol,
      amount: amount / 1000, // Convert mg to g for display consistency
      unit: 'mg',
      confidence: 'direct'
    }))
    .filter(el => el.amount > 0);

  // Calculate total mass for percentage
  const totalMass = composition.total_mass_g || mainElements.reduce((sum, el) => sum + el.amount, 0);

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-chivo font-bold text-lg flex items-center gap-2">
          <Atom className="w-5 h-5 text-neon-cyan" />
          Elemental Composition
        </h2>
        <div className="text-xs text-neutral-500 font-mono">
          Total: {totalMass.toFixed(1)}g
        </div>
      </div>

      {/* Main Elements Grid */}
      <div className="mb-6">
        <p className="text-xs text-neutral-500 uppercase tracking-wider mb-3">
          From Macronutrients (Estimated)
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {mainElements.map(el => (
            <ElementTile key={el.symbol} {...el} />
          ))}
        </div>
      </div>

      {/* Mass Distribution Bar */}
      <div className="mb-6">
        <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">
          Mass Distribution
        </p>
        <div className="h-4 rounded-full overflow-hidden flex bg-neutral-800">
          {mainElements.map(el => {
            const percentage = (el.amount / totalMass) * 100;
            const colorMap = {
              C: 'bg-neon-cyan',
              H: 'bg-neon-green',
              O: 'bg-neon-gold',
              N: 'bg-neon-purple',
              S: 'bg-neon-red',
            };
            return (
              <div
                key={el.symbol}
                className={`${colorMap[el.symbol]} h-full`}
                style={{ width: `${percentage}%` }}
                title={`${el.symbol}: ${percentage.toFixed(1)}%`}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-neutral-500">
          {mainElements.map(el => (
            <span key={el.symbol} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-sm ${
                el.symbol === 'C' ? 'bg-neon-cyan' :
                el.symbol === 'H' ? 'bg-neon-green' :
                el.symbol === 'O' ? 'bg-neon-gold' :
                el.symbol === 'N' ? 'bg-neon-purple' :
                'bg-neon-red'
              }`} />
              {el.symbol} {((el.amount / totalMass) * 100).toFixed(1)}%
            </span>
          ))}
        </div>
      </div>

      {/* Minerals Grid */}
      {minerals.length > 0 && (
        <div>
          <p className="text-xs text-neutral-500 uppercase tracking-wider mb-3">
            Minerals (From Database)
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {minerals.map(el => (
              <ElementTile 
                key={el.symbol} 
                symbol={el.symbol}
                amount={el.amount * 1000} // Display in mg
                unit="mg"
                confidence="direct"
              />
            ))}
          </div>
        </div>
      )}

      {/* Molar Information */}
      {composition.molar && Object.keys(composition.molar).length > 0 && (
        <div className="mt-6 p-4 rounded-lg bg-black/30 border border-white/5">
          <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">
            Molar Amounts (mol)
          </p>
          <div className="grid grid-cols-5 gap-4 font-mono text-sm">
            {Object.entries(composition.molar).map(([symbol, moles]) => (
              <div key={symbol} className="text-center">
                <span className="text-neutral-400">{symbol}:</span>{' '}
                <span className="text-white">{moles.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ElementalDisplay;

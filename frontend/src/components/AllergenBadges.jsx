import React from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

const ALLERGEN_ICONS = {
  dairy: '🥛',
  eggs: '🥚',
  fish: '🐟',
  shellfish: '🦐',
  tree_nuts: '🥜',
  peanuts: '🥜',
  wheat: '🌾',
  soy: '🫘',
  sesame: '⚪',
  other: '⚠️'
};

const ALLERGEN_LABELS = {
  dairy: 'Dairy',
  eggs: 'Eggs',
  fish: 'Fish',
  shellfish: 'Shellfish',
  tree_nuts: 'Tree Nuts',
  peanuts: 'Peanuts',
  wheat: 'Wheat/Gluten',
  soy: 'Soy',
  sesame: 'Sesame',
  other: 'Other Allergen'
};

export const AllergenBadges = ({ allergens }) => {
  if (!allergens || allergens.length === 0) return null;

  return (
    <div className="glass-card p-6 border-neon-red/20" data-testid="allergen-section">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-lg bg-neon-red/20 flex items-center justify-center">
          <ShieldAlert className="w-5 h-5 text-neon-red" />
        </div>
        <div>
          <h2 className="font-chivo font-bold text-lg text-neon-red">
            Allergen Alert
          </h2>
          <p className="text-xs text-neutral-400">
            {allergens.length} allergen{allergens.length > 1 ? 's' : ''} detected
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {allergens.map((allergen, i) => (
          <div
            key={i}
            className="allergen-badge-danger flex items-center gap-2"
            data-testid={`allergen-badge-${allergen.category}`}
          >
            <span>{ALLERGEN_ICONS[allergen.category] || ALLERGEN_ICONS.other}</span>
            <span>{ALLERGEN_LABELS[allergen.category] || allergen.allergen}</span>
          </div>
        ))}
      </div>

      {/* Source ingredients */}
      <div className="mt-4 pt-4 border-t border-white/5">
        <p className="text-xs text-neutral-500 mb-2">Found in:</p>
        <div className="flex flex-wrap gap-2">
          {allergens.map((a, i) => (
            a.ingredient && (
              <span 
                key={i} 
                className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-400"
              >
                {a.ingredient}
              </span>
            )
          ))}
        </div>
      </div>

      {/* Warning Note */}
      <div className="mt-4 p-3 rounded-lg bg-neon-red/10 border border-neon-red/20 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-neon-red shrink-0 mt-0.5" />
        <p className="text-xs text-neutral-300">
          Always verify ingredient labels if you have food allergies. 
          This detection is based on common allergen keywords and may not catch all sources.
        </p>
      </div>
    </div>
  );
};

export default AllergenBadges;

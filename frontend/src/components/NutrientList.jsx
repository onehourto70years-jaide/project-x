import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronUp, Database } from 'lucide-react';

export const NutrientList = ({ nutrients, cooking_method }) => {
  const [expanded, setExpanded] = useState(false);
  
  if (!nutrients || nutrients.length === 0) return null;

  // Group nutrients by category
  const categories = {
    vitamins: nutrients.filter(n => 
      n.name.toLowerCase().includes('vitamin') || 
      n.name.toLowerCase().includes('folate') ||
      n.name.toLowerCase().includes('thiamin') ||
      n.name.toLowerCase().includes('riboflavin') ||
      n.name.toLowerCase().includes('niacin') ||
      n.name.toLowerCase().includes('retinol') ||
      n.name.toLowerCase().includes('carotene')
    ),
    minerals: nutrients.filter(n => 
      n.name.toLowerCase().includes('calcium') ||
      n.name.toLowerCase().includes('iron') ||
      n.name.toLowerCase().includes('magnesium') ||
      n.name.toLowerCase().includes('phosphorus') ||
      n.name.toLowerCase().includes('potassium') ||
      n.name.toLowerCase().includes('sodium') ||
      n.name.toLowerCase().includes('zinc') ||
      n.name.toLowerCase().includes('copper') ||
      n.name.toLowerCase().includes('manganese') ||
      n.name.toLowerCase().includes('selenium')
    ),
    macros: nutrients.filter(n => 
      n.name.toLowerCase().includes('protein') ||
      n.name.toLowerCase().includes('carbohydrate') ||
      n.name.toLowerCase().includes('lipid') ||
      n.name.toLowerCase().includes('fat') ||
      n.name.toLowerCase().includes('fiber') ||
      n.name.toLowerCase().includes('sugar') ||
      n.name.toLowerCase().includes('energy')
    ),
  };

  // Get others
  const categorized = [...categories.vitamins, ...categories.minerals, ...categories.macros];
  categories.other = nutrients.filter(n => !categorized.includes(n));

  const displayNutrients = expanded ? nutrients : nutrients.slice(0, 12);

  const NutrientRow = ({ nutrient }) => (
    <div 
      className="flex items-center justify-between py-2 px-3 hover:bg-white/5 rounded"
      data-testid={`nutrient-row-${nutrient.name.replace(/\s+/g, '-').toLowerCase()}`}
    >
      <div className="flex items-center gap-2 flex-1">
        <span className="text-sm text-neutral-300 truncate max-w-[200px]">{nutrient.name}</span>
        {nutrient.retention_factor && nutrient.retention_factor < 1 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neon-gold/20 text-neon-gold">
            {(nutrient.retention_factor * 100).toFixed(0)}%
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm">
          {nutrient.amount?.toFixed(2)} {nutrient.unit}
        </span>
        {nutrient.confidence === 'high' && (
          <Database className="w-3 h-3 text-neon-green" title="Direct from database" />
        )}
      </div>
    </div>
  );

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-chivo font-bold text-lg">
          Full Nutrient Profile
          {cooking_method !== 'raw' && (
            <span className="text-sm font-normal text-neutral-400 ml-2">
              (after {cooking_method})
            </span>
          )}
        </h2>
        <span className="text-xs text-neutral-500">{nutrients.length} nutrients</span>
      </div>

      <ScrollArea className={expanded ? 'h-[400px]' : 'max-h-[300px]'}>
        <div className="space-y-4">
          {/* Macros */}
          {categories.macros.length > 0 && (
            <div>
              <p className="text-xs text-neon-cyan uppercase tracking-wider mb-2 px-3">
                Macronutrients
              </p>
              <div className="space-y-1">
                {categories.macros.slice(0, expanded ? undefined : 4).map((n, i) => (
                  <NutrientRow key={i} nutrient={n} />
                ))}
              </div>
            </div>
          )}

          {/* Vitamins */}
          {categories.vitamins.length > 0 && (
            <div>
              <p className="text-xs text-neon-purple uppercase tracking-wider mb-2 px-3">
                Vitamins
              </p>
              <div className="space-y-1">
                {categories.vitamins.slice(0, expanded ? undefined : 4).map((n, i) => (
                  <NutrientRow key={i} nutrient={n} />
                ))}
              </div>
            </div>
          )}

          {/* Minerals */}
          {categories.minerals.length > 0 && (
            <div>
              <p className="text-xs text-neon-gold uppercase tracking-wider mb-2 px-3">
                Minerals
              </p>
              <div className="space-y-1">
                {categories.minerals.slice(0, expanded ? undefined : 4).map((n, i) => (
                  <NutrientRow key={i} nutrient={n} />
                ))}
              </div>
            </div>
          )}

          {/* Other */}
          {expanded && categories.other.length > 0 && (
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2 px-3">
                Other Nutrients
              </p>
              <div className="space-y-1">
                {categories.other.map((n, i) => (
                  <NutrientRow key={i} nutrient={n} />
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {nutrients.length > 12 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-4 py-2 text-sm text-neutral-400 hover:text-white flex items-center justify-center gap-1 border-t border-white/5"
          data-testid="toggle-nutrients-btn"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show All {nutrients.length} Nutrients
            </>
          )}
        </button>
      )}

      {/* Data Source Note */}
      <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-neutral-500">
        <Database className="w-3 h-3" />
        <span>Data from USDA FoodData Central & Open Food Facts</span>
      </div>
    </div>
  );
};

export default NutrientList;

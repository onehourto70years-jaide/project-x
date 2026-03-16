import React, { useState, useEffect } from 'react';
import { API } from '@/App';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Target, Flame, Droplets, Footprints, Save, 
  Loader2, Info, Dumbbell
} from 'lucide-react';

const GOAL_TYPES = [
  { value: 'maintenance', label: 'Maintain Weight', description: 'Keep your current weight' },
  { value: 'weight_loss', label: 'Lose Weight', description: 'Caloric deficit for fat loss' },
  { value: 'weight_gain', label: 'Gain Weight', description: 'Caloric surplus for mass gain' },
  { value: 'muscle_gain', label: 'Build Muscle', description: 'High protein, moderate surplus' },
];

const CALORIE_PRESETS = {
  weight_loss: { calories: 1500, protein: 120, carbs: 150, fat: 50 },
  maintenance: { calories: 2000, protein: 150, carbs: 200, fat: 65 },
  weight_gain: { calories: 2500, protein: 175, carbs: 275, fat: 85 },
  muscle_gain: { calories: 2300, protein: 200, carbs: 225, fat: 70 },
};

export default function Goals() {
  const [goals, setGoals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modified, setModified] = useState(false);

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      const response = await fetch(`${API}/goals`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setGoals(data);
      }
    } catch (error) {
      console.error('Failed to fetch goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateGoal = (key, value) => {
    setGoals({ ...goals, [key]: value });
    setModified(true);
  };

  const applyPreset = (goalType) => {
    const preset = CALORIE_PRESETS[goalType];
    setGoals({
      ...goals,
      goal_type: goalType,
      ...preset
    });
    setModified(true);
  };

  const saveGoals = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API}/goals`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(goals)
      });

      if (response.ok) {
        toast.success('Goals saved!');
        setModified(false);
      } else {
        toast.error('Failed to save goals');
      }
    } catch (error) {
      toast.error('Failed to save goals');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Goals">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-neon-cyan" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-chivo font-bold text-2xl sm:text-3xl flex items-center gap-3">
          <Target className="w-8 h-8 text-neon-cyan" />
          Your Goals
        </h1>
        <Button 
          onClick={saveGoals} 
          className="btn-primary"
          disabled={!modified || saving}
          data-testid="save-goals-btn"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      {/* Goal Type Selection */}
      <div className="glass-card p-6 mb-6">
        <h2 className="font-chivo font-bold text-lg mb-4">What's your goal?</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {GOAL_TYPES.map(type => (
            <button
              key={type.value}
              onClick={() => applyPreset(type.value)}
              className={`p-4 rounded-lg border text-left transition-colors ${
                goals?.goal_type === type.value
                  ? 'bg-neon-cyan/10 border-neon-cyan text-white'
                  : 'bg-black/30 border-white/10 hover:border-white/20 text-neutral-300'
              }`}
              data-testid={`goal-type-${type.value}`}
            >
              <p className="font-chivo font-bold mb-1">{type.label}</p>
              <p className="text-xs text-neutral-500">{type.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Calorie & Macro Goals */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="glass-card p-6">
          <h2 className="font-chivo font-bold text-lg mb-4 flex items-center gap-2">
            <Flame className="w-5 h-5 text-neon-gold" />
            Daily Calories
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-neutral-400 mb-2 block">Target Calories</label>
              <Input
                type="number"
                value={goals?.calories || ''}
                onChange={(e) => updateGoal('calories', parseInt(e.target.value) || 0)}
                className="input-scientific text-2xl font-mono"
                data-testid="calories-input"
              />
            </div>
            <div className="p-3 rounded-lg bg-black/30 flex items-start gap-2">
              <Info className="w-4 h-4 text-neon-cyan shrink-0 mt-0.5" />
              <p className="text-xs text-neutral-400">
                Your daily calorie target. This will be used to track your progress and show remaining calories.
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="font-chivo font-bold text-lg mb-4 flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-neon-purple" />
            Macronutrients
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-neutral-400 mb-2 block">Protein (g)</label>
                <Input
                  type="number"
                  value={goals?.protein || ''}
                  onChange={(e) => updateGoal('protein', parseInt(e.target.value) || 0)}
                  className="input-scientific font-mono"
                  data-testid="protein-input"
                />
              </div>
              <div>
                <label className="text-sm text-neutral-400 mb-2 block">Carbs (g)</label>
                <Input
                  type="number"
                  value={goals?.carbs || ''}
                  onChange={(e) => updateGoal('carbs', parseInt(e.target.value) || 0)}
                  className="input-scientific font-mono"
                  data-testid="carbs-input"
                />
              </div>
              <div>
                <label className="text-sm text-neutral-400 mb-2 block">Fat (g)</label>
                <Input
                  type="number"
                  value={goals?.fat || ''}
                  onChange={(e) => updateGoal('fat', parseInt(e.target.value) || 0)}
                  className="input-scientific font-mono"
                  data-testid="fat-input"
                />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-black/30">
              <div>
                <p className="text-sm font-medium">Net Carbs Mode</p>
                <p className="text-xs text-neutral-500">Track net carbs (carbs - fiber) for keto</p>
              </div>
              <Switch
                checked={goals?.net_carbs_mode || false}
                onCheckedChange={(checked) => updateGoal('net_carbs_mode', checked)}
                data-testid="net-carbs-toggle"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Activity Goals */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h2 className="font-chivo font-bold text-lg mb-4 flex items-center gap-2">
            <Droplets className="w-5 h-5 text-neon-cyan" />
            Hydration
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-neutral-400 mb-2 block">Daily Water (glasses)</label>
              <Input
                type="number"
                value={goals?.water || ''}
                onChange={(e) => updateGoal('water', parseInt(e.target.value) || 0)}
                className="input-scientific font-mono"
                data-testid="water-input"
              />
            </div>
            <p className="text-xs text-neutral-500">
              Standard glass = 8 oz (240ml). Recommended: 8 glasses per day.
            </p>
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="font-chivo font-bold text-lg mb-4 flex items-center gap-2">
            <Footprints className="w-5 h-5 text-neon-green" />
            Activity
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-neutral-400 mb-2 block">Daily Steps Goal</label>
              <Input
                type="number"
                value={goals?.steps || ''}
                onChange={(e) => updateGoal('steps', parseInt(e.target.value) || 0)}
                className="input-scientific font-mono"
                data-testid="steps-input"
              />
            </div>
            <p className="text-xs text-neutral-500">
              Recommended: 10,000 steps per day for active lifestyle.
            </p>
          </div>
        </div>
      </div>

      {/* Macro Breakdown Preview */}
      <div className="glass-card p-6 mt-6">
        <h2 className="font-chivo font-bold text-lg mb-4">Macro Breakdown</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-4 rounded-lg bg-neon-cyan/10 border border-neon-cyan/20">
            <p className="text-2xl font-mono font-bold text-neon-cyan">{goals?.protein || 0}g</p>
            <p className="text-xs text-neutral-400">Protein</p>
            <p className="text-sm font-mono mt-1">{(goals?.protein || 0) * 4} cal</p>
          </div>
          <div className="p-4 rounded-lg bg-neon-gold/10 border border-neon-gold/20">
            <p className="text-2xl font-mono font-bold text-neon-gold">{goals?.carbs || 0}g</p>
            <p className="text-xs text-neutral-400">Carbs</p>
            <p className="text-sm font-mono mt-1">{(goals?.carbs || 0) * 4} cal</p>
          </div>
          <div className="p-4 rounded-lg bg-neon-purple/10 border border-neon-purple/20">
            <p className="text-2xl font-mono font-bold text-neon-purple">{goals?.fat || 0}g</p>
            <p className="text-xs text-neutral-400">Fat</p>
            <p className="text-sm font-mono mt-1">{(goals?.fat || 0) * 9} cal</p>
          </div>
        </div>
        <div className="mt-4 text-center">
          <p className="text-sm text-neutral-400">
            Total from macros:{' '}
            <span className="font-mono font-bold text-white">
              {((goals?.protein || 0) * 4) + ((goals?.carbs || 0) * 4) + ((goals?.fat || 0) * 9)} cal
            </span>
          </p>
        </div>
      </div>
    </AppLayout>
  );
}

import React, { useState, useEffect } from 'react';
import { API } from '@/App';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Plus, Trash2, Dumbbell, Flame, Clock, 
  ChevronLeft, ChevronRight, Loader2
} from 'lucide-react';

const WORKOUT_CATEGORIES = [
  { type: 'cardio', name: 'Cardio', color: 'neon-red' },
  { type: 'strength', name: 'Strength', color: 'neon-purple' },
  { type: 'flexibility', name: 'Flexibility', color: 'neon-cyan' },
  { type: 'sports', name: 'Sports', color: 'neon-green' },
  { type: 'walking', name: 'Walking', color: 'neon-gold' },
  { type: 'other', name: 'Other', color: 'white' },
];

const PRESET_WORKOUTS = [
  { name: 'Running', type: 'cardio', calories_per_min: 10 },
  { name: 'Cycling', type: 'cardio', calories_per_min: 8 },
  { name: 'Swimming', type: 'cardio', calories_per_min: 9 },
  { name: 'HIIT', type: 'cardio', calories_per_min: 12 },
  { name: 'Weight Lifting', type: 'strength', calories_per_min: 5 },
  { name: 'Bodyweight Training', type: 'strength', calories_per_min: 6 },
  { name: 'Yoga', type: 'flexibility', calories_per_min: 3 },
  { name: 'Stretching', type: 'flexibility', calories_per_min: 2 },
  { name: 'Walking', type: 'walking', calories_per_min: 4 },
  { name: 'Hiking', type: 'walking', calories_per_min: 6 },
  { name: 'Basketball', type: 'sports', calories_per_min: 8 },
  { name: 'Tennis', type: 'sports', calories_per_min: 7 },
];

export default function WorkoutLog() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [workouts, setWorkouts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newWorkout, setNewWorkout] = useState({
    workout_type: 'cardio',
    name: '',
    duration_minutes: 30,
    calories_burned: 0,
    notes: ''
  });

  useEffect(() => {
    fetchWorkouts();
  }, [selectedDate]);

  const fetchWorkouts = async () => {
    try {
      const response = await fetch(`${API}/workouts?date=${selectedDate}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setWorkouts(data);
      }
    } catch (error) {
      console.error('Failed to fetch workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const addWorkout = async () => {
    if (!newWorkout.name) {
      toast.error('Please enter workout name');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API}/workouts?date=${selectedDate}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newWorkout)
      });

      if (response.ok) {
        toast.success('Workout logged!');
        fetchWorkouts();
        setShowAddDialog(false);
        setNewWorkout({
          workout_type: 'cardio',
          name: '',
          duration_minutes: 30,
          calories_burned: 0,
          notes: ''
        });
      }
    } catch (error) {
      toast.error('Failed to log workout');
    } finally {
      setSaving(false);
    }
  };

  const deleteWorkout = async (workoutId) => {
    try {
      const response = await fetch(`${API}/workouts/${workoutId}?date=${selectedDate}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Workout deleted');
        fetchWorkouts();
      }
    } catch (error) {
      toast.error('Failed to delete workout');
    }
  };

  const selectPresetWorkout = (preset) => {
    const estimatedCalories = preset.calories_per_min * newWorkout.duration_minutes;
    setNewWorkout({
      ...newWorkout,
      name: preset.name,
      workout_type: preset.type,
      calories_burned: estimatedCalories
    });
  };

  const updateDuration = (duration) => {
    const preset = PRESET_WORKOUTS.find(p => p.name === newWorkout.name);
    const estimatedCalories = preset ? preset.calories_per_min * duration : newWorkout.calories_burned;
    setNewWorkout({
      ...newWorkout,
      duration_minutes: duration,
      calories_burned: estimatedCalories
    });
  };

  const changeDate = (days) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getCategoryColor = (type) => {
    const cat = WORKOUT_CATEGORIES.find(c => c.type === type);
    return cat?.color || 'white';
  };

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => changeDate(-1)}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="text-center">
            <h1 className="font-chivo font-bold text-xl">{formatDate(selectedDate)}</h1>
            <p className="text-xs text-neutral-500">{selectedDate}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => changeDate(1)}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="btn-primary" data-testid="add-workout-btn">
              <Plus className="w-4 h-4 mr-2" />
              Log Workout
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-surface-card border-white/10 max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-chivo">Log Workout</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Preset Workouts */}
              <div>
                <p className="text-xs text-neutral-500 mb-2">Quick Select</p>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_WORKOUTS.slice(0, 8).map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => selectPresetWorkout(preset)}
                      className={`p-2 rounded-lg text-xs border transition-colors ${
                        newWorkout.name === preset.name
                          ? 'bg-neon-cyan/20 border-neon-cyan text-neon-cyan'
                          : 'bg-black/30 border-white/10 hover:border-white/20'
                      }`}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                placeholder="Workout name"
                value={newWorkout.name}
                onChange={(e) => setNewWorkout({ ...newWorkout, name: e.target.value })}
                className="input-scientific"
                data-testid="workout-name-input"
              />

              <Select 
                value={newWorkout.workout_type} 
                onValueChange={(v) => setNewWorkout({ ...newWorkout, workout_type: v })}
              >
                <SelectTrigger className="input-scientific">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKOUT_CATEGORIES.map(cat => (
                    <SelectItem key={cat.type} value={cat.type}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-500 mb-1 block">Duration (min)</label>
                  <Input
                    type="number"
                    value={newWorkout.duration_minutes}
                    onChange={(e) => updateDuration(parseInt(e.target.value) || 0)}
                    className="input-scientific"
                    data-testid="workout-duration-input"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 mb-1 block">Calories Burned</label>
                  <Input
                    type="number"
                    value={newWorkout.calories_burned}
                    onChange={(e) => setNewWorkout({ ...newWorkout, calories_burned: parseInt(e.target.value) || 0 })}
                    className="input-scientific"
                    data-testid="workout-calories-input"
                  />
                </div>
              </div>

              <Input
                placeholder="Notes (optional)"
                value={newWorkout.notes}
                onChange={(e) => setNewWorkout({ ...newWorkout, notes: e.target.value })}
                className="input-scientific"
              />

              <Button onClick={addWorkout} className="btn-primary w-full" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log Workout'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      {workouts && (
        <div className="glass-card p-4 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="w-12 h-12 mx-auto rounded-lg bg-neon-purple/20 flex items-center justify-center mb-2">
                <Dumbbell className="w-6 h-6 text-neon-purple" />
              </div>
              <p className="font-mono font-bold text-2xl">{workouts.workouts?.length || 0}</p>
              <p className="text-xs text-neutral-500">Workouts</p>
            </div>
            <div>
              <div className="w-12 h-12 mx-auto rounded-lg bg-neon-gold/20 flex items-center justify-center mb-2">
                <Flame className="w-6 h-6 text-neon-gold" />
              </div>
              <p className="font-mono font-bold text-2xl">{workouts.total_calories_burned || 0}</p>
              <p className="text-xs text-neutral-500">Calories Burned</p>
            </div>
            <div>
              <div className="w-12 h-12 mx-auto rounded-lg bg-neon-cyan/20 flex items-center justify-center mb-2">
                <Clock className="w-6 h-6 text-neon-cyan" />
              </div>
              <p className="font-mono font-bold text-2xl">{workouts.total_duration_minutes || 0}</p>
              <p className="text-xs text-neutral-500">Minutes</p>
            </div>
          </div>
        </div>
      )}

      {/* Workouts List */}
      <div className="space-y-4">
        {loading ? (
          <div className="glass-card p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-neon-cyan mx-auto" />
          </div>
        ) : workouts?.workouts?.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-neon-purple/10 flex items-center justify-center mx-auto mb-4">
              <Dumbbell className="w-8 h-8 text-neon-purple/50" />
            </div>
            <h3 className="font-chivo font-bold text-xl text-neutral-400 mb-2">
              No Workouts Today
            </h3>
            <p className="text-neutral-500 mb-6">Log your first workout to track your activity</p>
            <Button onClick={() => setShowAddDialog(true)} className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              Log Workout
            </Button>
          </div>
        ) : (
          workouts?.workouts?.map((workout, i) => {
            const colorClass = getCategoryColor(workout.workout_type);
            return (
              <div 
                key={workout.workout_id || i}
                className="glass-card p-4 group"
                data-testid={`workout-entry-${i}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg bg-${colorClass}/20 flex items-center justify-center`}>
                      <Dumbbell className={`w-6 h-6 text-${colorClass}`} />
                    </div>
                    <div>
                      <p className="font-chivo font-bold">{workout.name}</p>
                      <p className="text-sm text-neutral-500 capitalize">{workout.workout_type}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-neon-red"
                    onClick={() => deleteWorkout(workout.workout_id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="mt-4 flex gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-neutral-500" />
                    <span className="font-mono">{workout.duration_minutes} min</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-neon-gold" />
                    <span className="font-mono">{workout.calories_burned} cal</span>
                  </div>
                </div>
                {workout.notes && (
                  <p className="mt-2 text-sm text-neutral-400 italic">{workout.notes}</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </AppLayout>
  );
}

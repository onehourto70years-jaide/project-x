import React, { useState, useEffect } from 'react';
import { API } from '@/App';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Calendar, Plus, Trash2, ChevronLeft, ChevronRight,
  Coffee, Sun, Moon, Cookie, Loader2
} from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', icon: Coffee, color: 'neon-gold' },
  { value: 'lunch', label: 'Lunch', icon: Sun, color: 'neon-cyan' },
  { value: 'dinner', label: 'Dinner', icon: Moon, color: 'neon-purple' },
  { value: 'snack', label: 'Snack', icon: Cookie, color: 'neon-green' },
];

export default function MealPlanner() {
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    return monday.toISOString().split('T')[0];
  });
  const [mealPlan, setMealPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedMeal, setSelectedMeal] = useState('breakfast');
  const [newMeal, setNewMeal] = useState({ food_name: '', calories: '' });

  useEffect(() => {
    fetchMealPlan();
  }, [weekStart]);

  const fetchMealPlan = async () => {
    try {
      const response = await fetch(`${API}/meal-plan?week_start=${weekStart}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setMealPlan(data);
      }
    } catch (error) {
      console.error('Failed to fetch meal plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const addMeal = async () => {
    if (!newMeal.food_name) {
      toast.error('Please enter a food name');
      return;
    }

    try {
      const response = await fetch(`${API}/meal-plan?week_start=${weekStart}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          day_of_week: selectedDay,
          meal_type: selectedMeal,
          food_name: newMeal.food_name,
          calories: parseInt(newMeal.calories) || null
        })
      });

      if (response.ok) {
        toast.success('Meal added to plan');
        fetchMealPlan();
        setShowAddDialog(false);
        setNewMeal({ food_name: '', calories: '' });
      }
    } catch (error) {
      toast.error('Failed to add meal');
    }
  };

  const deleteMeal = async (mealId) => {
    try {
      const response = await fetch(`${API}/meal-plan/${mealId}?week_start=${weekStart}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Meal removed');
        fetchMealPlan();
      }
    } catch (error) {
      toast.error('Failed to remove meal');
    }
  };

  const changeWeek = (weeks) => {
    const current = new Date(weekStart);
    current.setDate(current.getDate() + (weeks * 7));
    setWeekStart(current.toISOString().split('T')[0]);
  };

  const formatWeekRange = () => {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  const getMealsForDayAndType = (dayIndex, mealType) => {
    return (mealPlan?.meals || []).filter(
      m => m.day_of_week === dayIndex && m.meal_type === mealType
    );
  };

  const openAddDialog = (dayIndex, mealType) => {
    setSelectedDay(dayIndex);
    setSelectedMeal(mealType);
    setShowAddDialog(true);
  };

  if (loading) {
    return (
      <AppLayout title="Meal Planner">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-neon-cyan" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => changeWeek(-1)}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="text-center">
            <h1 className="font-chivo font-bold text-xl flex items-center gap-2">
              <Calendar className="w-5 h-5 text-neon-cyan" />
              {formatWeekRange()}
            </h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => changeWeek(1)}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Week Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Header Row */}
          <div className="grid grid-cols-8 gap-2 mb-2">
            <div className="p-3" /> {/* Empty corner */}
            {DAYS.map((day, i) => {
              const date = new Date(weekStart);
              date.setDate(date.getDate() + i);
              const isToday = date.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
              return (
                <div 
                  key={day}
                  className={`p-3 text-center rounded-lg ${isToday ? 'bg-neon-cyan/10 border border-neon-cyan/30' : 'bg-neutral-900/50'}`}
                >
                  <p className="font-chivo font-bold text-sm">{day}</p>
                  <p className="text-xs text-neutral-500">
                    {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Meal Rows */}
          {MEAL_TYPES.map(mealType => (
            <div key={mealType.value} className="grid grid-cols-8 gap-2 mb-2">
              {/* Meal Type Label */}
              <div className={`p-3 rounded-lg bg-${mealType.color}/10 flex items-center gap-2`}>
                <mealType.icon className={`w-4 h-4 text-${mealType.color}`} />
                <span className="text-sm font-medium">{mealType.label}</span>
              </div>

              {/* Day Cells */}
              {DAYS.map((_, dayIndex) => {
                const meals = getMealsForDayAndType(dayIndex, mealType.value);
                return (
                  <div 
                    key={dayIndex}
                    className="glass-card p-2 min-h-[100px] group"
                  >
                    {meals.length === 0 ? (
                      <button
                        onClick={() => openAddDialog(dayIndex, mealType.value)}
                        className="w-full h-full flex items-center justify-center text-neutral-600 hover:text-neon-cyan opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`add-meal-${dayIndex}-${mealType.value}`}
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    ) : (
                      <div className="space-y-2">
                        {meals.map((meal, i) => (
                          <div 
                            key={meal.meal_id || i}
                            className="p-2 rounded bg-black/30 text-xs group/meal"
                          >
                            <div className="flex items-start justify-between">
                              <p className="font-medium truncate flex-1">{meal.food_name}</p>
                              <button
                                onClick={() => deleteMeal(meal.meal_id)}
                                className="opacity-0 group-hover/meal:opacity-100 text-neutral-500 hover:text-neon-red"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            {meal.calories && (
                              <p className="text-neutral-500 font-mono">{meal.calories} cal</p>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => openAddDialog(dayIndex, mealType.value)}
                          className="w-full py-1 text-neutral-600 hover:text-neon-cyan text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Add Meal Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-surface-card border-white/10">
          <DialogHeader>
            <DialogTitle className="font-chivo">
              Add to {DAYS[selectedDay]} - {MEAL_TYPES.find(m => m.value === selectedMeal)?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Food name"
              value={newMeal.food_name}
              onChange={(e) => setNewMeal({ ...newMeal, food_name: e.target.value })}
              className="input-scientific"
              data-testid="meal-name-input"
            />
            <Input
              type="number"
              placeholder="Calories (optional)"
              value={newMeal.calories}
              onChange={(e) => setNewMeal({ ...newMeal, calories: e.target.value })}
              className="input-scientific"
              data-testid="meal-calories-input"
            />
            <Button onClick={addMeal} className="btn-primary w-full">
              Add to Plan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

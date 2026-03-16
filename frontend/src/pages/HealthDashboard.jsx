import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '@/App';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  Flame, Droplets, Footprints, Dumbbell, Scale, 
  Plus, TrendingUp, ChevronRight, Utensils, Target
} from 'lucide-react';

export default function HealthDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await fetch(`${API}/dashboard`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setDashboard(data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const quickAddWater = async () => {
    try {
      const response = await fetch(`${API}/water-log/quick?glasses=1`, {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        toast.success('+1 glass of water');
        fetchDashboard();
      }
    } catch (error) {
      toast.error('Failed to log water');
    }
  };

  if (loading) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex items-center justify-center py-20">
          <div className="text-neon-cyan animate-pulse font-mono">LOADING...</div>
        </div>
      </AppLayout>
    );
  }

  const { goals, nutrition, water, exercise, steps, net_calories, weight, meals } = dashboard || {};

  return (
    <AppLayout>
      {/* Header with Date */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-chivo font-bold text-2xl sm:text-3xl">Today's Overview</h1>
          <p className="text-neutral-400 text-sm">{dashboard?.date}</p>
        </div>
        <Button 
          onClick={() => navigate('/food-log')} 
          className="btn-primary flex items-center gap-2"
          data-testid="add-food-btn"
        >
          <Plus className="w-4 h-4" />
          Log Food
        </Button>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Calories Card */}
        <div className="glass-card p-5 col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-neon-gold/20 flex items-center justify-center">
                <Flame className="w-5 h-5 text-neon-gold" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 uppercase">Calories</p>
                <p className="font-chivo font-bold text-lg">
                  {Math.round(nutrition?.consumed?.calories || 0)} 
                  <span className="text-neutral-500 font-normal text-sm"> / {goals?.calories}</span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-neutral-500">Remaining</p>
              <p className={`font-mono font-bold ${nutrition?.remaining?.calories >= 0 ? 'text-neon-green' : 'text-neon-red'}`}>
                {Math.round(nutrition?.remaining?.calories || 0)}
              </p>
            </div>
          </div>
          <Progress 
            value={nutrition?.percentages?.calories || 0} 
            className="h-3 bg-neutral-800"
          />
          <div className="flex justify-between mt-2 text-xs text-neutral-500">
            <span>Eaten</span>
            <span>{Math.round(nutrition?.percentages?.calories || 0)}%</span>
          </div>
        </div>

        {/* Macros */}
        <div className="glass-card p-5">
          <p className="text-xs text-neutral-500 uppercase mb-3">Protein</p>
          <p className="font-mono font-bold text-2xl text-neon-cyan">
            {Math.round(nutrition?.consumed?.protein || 0)}g
          </p>
          <Progress value={nutrition?.percentages?.protein || 0} className="h-2 mt-2 bg-neutral-800" />
          <p className="text-xs text-neutral-500 mt-1">/ {goals?.protein}g</p>
        </div>

        <div className="glass-card p-5">
          <p className="text-xs text-neutral-500 uppercase mb-3">Carbs</p>
          <p className="font-mono font-bold text-2xl text-neon-gold">
            {Math.round(nutrition?.consumed?.carbs || 0)}g
          </p>
          <Progress value={nutrition?.percentages?.carbs || 0} className="h-2 mt-2 bg-neutral-800" />
          <p className="text-xs text-neutral-500 mt-1">/ {goals?.carbs}g</p>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Water */}
        <div 
          className="glass-card glass-card-hover p-5 cursor-pointer"
          onClick={quickAddWater}
          data-testid="water-card"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-neon-cyan/20 flex items-center justify-center">
              <Droplets className="w-5 h-5 text-neon-cyan" />
            </div>
            <Button variant="ghost" size="sm" className="text-neon-cyan">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <p className="font-mono font-bold text-2xl">{water?.glasses || 0}</p>
          <p className="text-xs text-neutral-500">/ {water?.goal} glasses</p>
          <Progress value={water?.percentage || 0} className="h-2 mt-2 bg-neutral-800" />
        </div>

        {/* Steps */}
        <div 
          className="glass-card glass-card-hover p-5 cursor-pointer"
          onClick={() => navigate('/progress')}
          data-testid="steps-card"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-neon-green/20 flex items-center justify-center">
              <Footprints className="w-5 h-5 text-neon-green" />
            </div>
            <ChevronRight className="w-4 h-4 text-neutral-500" />
          </div>
          <p className="font-mono font-bold text-2xl">{(steps?.count || 0).toLocaleString()}</p>
          <p className="text-xs text-neutral-500">/ {(steps?.goal || 10000).toLocaleString()} steps</p>
          <Progress value={steps?.percentage || 0} className="h-2 mt-2 bg-neutral-800" />
        </div>

        {/* Exercise */}
        <div 
          className="glass-card glass-card-hover p-5 cursor-pointer"
          onClick={() => navigate('/workouts')}
          data-testid="exercise-card"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-neon-purple/20 flex items-center justify-center">
              <Dumbbell className="w-5 h-5 text-neon-purple" />
            </div>
            <ChevronRight className="w-4 h-4 text-neutral-500" />
          </div>
          <p className="font-mono font-bold text-2xl">{exercise?.calories_burned || 0}</p>
          <p className="text-xs text-neutral-500">calories burned</p>
          <p className="text-xs text-neutral-400 mt-2">{exercise?.workouts_count || 0} workouts</p>
        </div>

        {/* Weight */}
        <div 
          className="glass-card glass-card-hover p-5 cursor-pointer"
          onClick={() => navigate('/progress')}
          data-testid="weight-card"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <ChevronRight className="w-4 h-4 text-neutral-500" />
          </div>
          <p className="font-mono font-bold text-2xl">{weight || '—'}</p>
          <p className="text-xs text-neutral-500">kg</p>
          <p className="text-xs text-neutral-400 mt-2">Last recorded</p>
        </div>
      </div>

      {/* Meals Summary */}
      <div className="glass-card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-chivo font-bold text-lg flex items-center gap-2">
            <Utensils className="w-5 h-5 text-neon-gold" />
            Today's Meals
          </h2>
          <Button 
            variant="ghost" 
            className="text-neon-cyan text-sm"
            onClick={() => navigate('/food-log')}
          >
            View All <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {['breakfast', 'lunch', 'dinner', 'snack'].map(meal => (
            <div 
              key={meal}
              className="p-3 rounded-lg bg-black/30 border border-white/5 text-center cursor-pointer hover:border-neon-cyan/30"
              onClick={() => navigate('/food-log')}
            >
              <p className="text-xs text-neutral-500 capitalize mb-1">{meal}</p>
              <p className="font-mono font-bold text-lg">
                {meals?.[meal] || 0}
              </p>
              <p className="text-[10px] text-neutral-600">items</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Button 
          variant="outline" 
          className="btn-secondary h-auto py-4 flex-col gap-2"
          onClick={() => navigate('/food-log')}
          data-testid="quick-log-food"
        >
          <Utensils className="w-5 h-5" />
          <span className="text-sm">Log Food</span>
        </Button>
        <Button 
          variant="outline" 
          className="btn-secondary h-auto py-4 flex-col gap-2"
          onClick={() => navigate('/workouts')}
          data-testid="quick-log-workout"
        >
          <Dumbbell className="w-5 h-5" />
          <span className="text-sm">Log Workout</span>
        </Button>
        <Button 
          variant="outline" 
          className="btn-secondary h-auto py-4 flex-col gap-2"
          onClick={() => navigate('/goals')}
          data-testid="quick-set-goals"
        >
          <Target className="w-5 h-5" />
          <span className="text-sm">Set Goals</span>
        </Button>
        <Button 
          variant="outline" 
          className="btn-secondary h-auto py-4 flex-col gap-2"
          onClick={() => navigate('/progress')}
          data-testid="quick-view-progress"
        >
          <TrendingUp className="w-5 h-5" />
          <span className="text-sm">Progress</span>
        </Button>
      </div>
    </AppLayout>
  );
}

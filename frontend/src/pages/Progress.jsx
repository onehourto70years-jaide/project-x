import React, { useState, useEffect } from 'react';
import { API } from '@/App';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { 
  TrendingUp, Scale, Flame, Droplets, Footprints, 
  Plus, Loader2, TrendingDown, Minus
} from 'lucide-react';

export default function Progress() {
  const [progressData, setProgressData] = useState(null);
  const [weightHistory, setWeightHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWeightDialog, setShowWeightDialog] = useState(false);
  const [showStepsDialog, setShowStepsDialog] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [newSteps, setNewSteps] = useState('');
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetchData();
  }, [days]);

  const fetchData = async () => {
    try {
      const [progressRes, weightRes] = await Promise.all([
        fetch(`${API}/progress?days=${days}`, { credentials: 'include' }),
        fetch(`${API}/weight?days=30`, { credentials: 'include' })
      ]);

      if (progressRes.ok) {
        const data = await progressRes.json();
        setProgressData(data);
      }
      if (weightRes.ok) {
        const data = await weightRes.json();
        setWeightHistory(data);
      }
    } catch (error) {
      console.error('Failed to fetch progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const logWeight = async () => {
    if (!newWeight) {
      toast.error('Please enter your weight');
      return;
    }

    try {
      const response = await fetch(`${API}/weight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ weight: parseFloat(newWeight), unit: 'kg' })
      });

      if (response.ok) {
        toast.success('Weight logged');
        fetchData();
        setShowWeightDialog(false);
        setNewWeight('');
      }
    } catch (error) {
      toast.error('Failed to log weight');
    }
  };

  const logSteps = async () => {
    if (!newSteps) {
      toast.error('Please enter your steps');
      return;
    }

    try {
      const response = await fetch(`${API}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ steps: parseInt(newSteps), source: 'manual' })
      });

      if (response.ok) {
        toast.success('Steps logged');
        fetchData();
        setShowStepsDialog(false);
        setNewSteps('');
      }
    } catch (error) {
      toast.error('Failed to log steps');
    }
  };

  if (loading) {
    return (
      <AppLayout title="Progress">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-neon-cyan" />
        </div>
      </AppLayout>
    );
  }

  const chartData = progressData?.daily_data || [];
  const weightTrend = weightHistory?.trend;

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-chivo font-bold text-2xl sm:text-3xl">Progress</h1>
        <div className="flex items-center gap-2">
          {[7, 14, 30].map(d => (
            <Button
              key={d}
              variant="ghost"
              size="sm"
              onClick={() => setDays(d)}
              className={days === d ? 'bg-neon-cyan/10 text-neon-cyan' : 'text-neutral-400'}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      {/* Quick Log Buttons */}
      <div className="flex gap-4 mb-6">
        <Dialog open={showWeightDialog} onOpenChange={setShowWeightDialog}>
          <DialogTrigger asChild>
            <Button className="btn-secondary" data-testid="log-weight-btn">
              <Scale className="w-4 h-4 mr-2" />
              Log Weight
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-surface-card border-white/10">
            <DialogHeader>
              <DialogTitle className="font-chivo">Log Weight</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Weight"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  className="input-scientific"
                  data-testid="weight-input"
                />
                <span className="text-neutral-400">kg</span>
              </div>
              <Button onClick={logWeight} className="btn-primary w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showStepsDialog} onOpenChange={setShowStepsDialog}>
          <DialogTrigger asChild>
            <Button className="btn-secondary" data-testid="log-steps-btn">
              <Footprints className="w-4 h-4 mr-2" />
              Log Steps
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-surface-card border-white/10">
            <DialogHeader>
              <DialogTitle className="font-chivo">Log Steps</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                type="number"
                placeholder="Steps"
                value={newSteps}
                onChange={(e) => setNewSteps(e.target.value)}
                className="input-scientific"
                data-testid="steps-input"
              />
              <Button onClick={logSteps} className="btn-primary w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Averages Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-4 h-4 text-neon-gold" />
            <span className="text-xs text-neutral-500">Avg Calories</span>
          </div>
          <p className="font-mono font-bold text-xl">{Math.round(progressData?.averages?.calories || 0)}</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-neon-cyan" />
            <span className="text-xs text-neutral-500">Avg Protein</span>
          </div>
          <p className="font-mono font-bold text-xl">{Math.round(progressData?.averages?.protein || 0)}g</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Droplets className="w-4 h-4 text-neon-cyan" />
            <span className="text-xs text-neutral-500">Avg Water</span>
          </div>
          <p className="font-mono font-bold text-xl">{progressData?.averages?.water?.toFixed(1) || 0}</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Footprints className="w-4 h-4 text-neon-green" />
            <span className="text-xs text-neutral-500">Avg Steps</span>
          </div>
          <p className="font-mono font-bold text-xl">{Math.round(progressData?.averages?.steps || 0).toLocaleString()}</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Scale className="w-4 h-4 text-white" />
            <span className="text-xs text-neutral-500">Weight Trend</span>
          </div>
          {weightTrend ? (
            <div className="flex items-center gap-2">
              <p className={`font-mono font-bold text-xl ${
                weightTrend.direction === 'down' ? 'text-neon-green' : 
                weightTrend.direction === 'up' ? 'text-neon-red' : 'text-neutral-400'
              }`}>
                {weightTrend.change > 0 ? '+' : ''}{weightTrend.change} kg
              </p>
              {weightTrend.direction === 'down' ? (
                <TrendingDown className="w-4 h-4 text-neon-green" />
              ) : weightTrend.direction === 'up' ? (
                <TrendingUp className="w-4 h-4 text-neon-red" />
              ) : (
                <Minus className="w-4 h-4 text-neutral-400" />
              )}
            </div>
          ) : (
            <p className="font-mono text-neutral-500">No data</p>
          )}
        </div>
      </div>

      {/* Calories Chart */}
      <div className="glass-card p-6 mb-6">
        <h2 className="font-chivo font-bold text-lg mb-4 flex items-center gap-2">
          <Flame className="w-5 h-5 text-neon-gold" />
          Calorie Intake
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis 
                dataKey="date" 
                stroke="#666"
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { weekday: 'short' })}
              />
              <YAxis stroke="#666" />
              <Tooltip 
                contentStyle={{ background: '#171717', border: '1px solid #333', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="calories" fill="#FFD600" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weight Chart */}
      {weightHistory?.entries?.length > 0 && (
        <div className="glass-card p-6 mb-6">
          <h2 className="font-chivo font-bold text-lg mb-4 flex items-center gap-2">
            <Scale className="w-5 h-5 text-white" />
            Weight History
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightHistory.entries.slice().reverse()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis 
                  dataKey="date" 
                  stroke="#666"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis stroke="#666" domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip 
                  contentStyle={{ background: '#171717', border: '1px solid #333', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="weight" 
                  stroke="#00F0FF" 
                  strokeWidth={2}
                  dot={{ fill: '#00F0FF', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Macros Chart */}
      <div className="glass-card p-6">
        <h2 className="font-chivo font-bold text-lg mb-4">Macronutrients</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis 
                dataKey="date" 
                stroke="#666"
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { weekday: 'short' })}
              />
              <YAxis stroke="#666" />
              <Tooltip 
                contentStyle={{ background: '#171717', border: '1px solid #333', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="protein" fill="#00F0FF" name="Protein" radius={[2, 2, 0, 0]} />
              <Bar dataKey="carbs" fill="#FFD600" name="Carbs" radius={[2, 2, 0, 0]} />
              <Bar dataKey="fat" fill="#7000FF" name="Fat" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AppLayout>
  );
}

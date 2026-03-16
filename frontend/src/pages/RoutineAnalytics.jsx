import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '@/App';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  BarChart3, Flame, Target, TrendingUp, ArrowLeft,
  Loader2, CheckCircle, XCircle, Clock, AlertTriangle,
  Calendar, ChevronUp, ChevronDown, Minus
} from 'lucide-react';

const CATEGORY_COLORS = {
  work: '#7000FF',
  health: '#00FF94',
  personal: '#00F0FF',
  sleep: '#6366F1',
  focus: '#FF0033',
  break: '#FFD600',
  exercise: '#00FF94',
  meal: '#FF6600',
  learning: '#00F0FF',
  social: '#CC00FF',
};

export default function RoutineAnalytics() {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [streak, setStreak] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7');

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, streakRes] = await Promise.all([
        fetch(`${API}/routines/analytics?days=${period}`, { credentials: 'include' }),
        fetch(`${API}/routines/streak`, { credentials: 'include' })
      ]);

      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (streakRes.ok) setStreak(await streakRes.json());
    } catch (error) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const summary = analytics?.summary || {};
  const dailyData = analytics?.daily_breakdown || [];
  const maxAdherence = Math.max(...dailyData.map(d => d.adherence), 1);

  if (loading) {
    return (
      <AppLayout>
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
          <Button variant="ghost" size="icon" onClick={() => navigate('/routines')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-chivo font-bold text-2xl sm:text-3xl flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-neon-purple" />
              Routine Analytics
            </h1>
            <p className="text-neutral-400 text-sm mt-1">Track your routine performance</p>
          </div>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-36 input-scientific" data-testid="period-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          title="Adherence Rate"
          value={`${summary.adherence_rate || 0}%`}
          icon={Target}
          color="#00F0FF"
          testId="adherence-rate-card"
        />
        <SummaryCard
          title="Current Streak"
          value={`${streak?.current_streak || 0} days`}
          icon={Flame}
          color="#FFD600"
          testId="streak-card"
        />
        <SummaryCard
          title="Completed"
          value={summary.completed || 0}
          subtitle={`of ${summary.total_activities || 0} total`}
          icon={CheckCircle}
          color="#00FF94"
          testId="completed-card"
        />
        <SummaryCard
          title="On-Time Rate"
          value={`${summary.on_time_rate || 0}%`}
          icon={Clock}
          color="#7000FF"
          testId="ontime-card"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Daily Adherence Chart */}
        <div className="lg:col-span-2 glass-card p-6">
          <h2 className="font-chivo font-bold text-lg mb-6 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-neon-cyan" />
            Daily Adherence
          </h2>

          {dailyData.length === 0 ? (
            <div className="text-center py-12 text-neutral-500">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No data for this period yet</p>
              <p className="text-sm mt-1">Complete some activities to see your stats</p>
            </div>
          ) : (
            <div className="space-y-0">
              {/* Bar Chart */}
              <div className="flex items-end gap-1.5 h-48 mb-4" data-testid="adherence-chart">
                {dailyData.map((day, i) => {
                  const height = maxAdherence > 0 ? (day.adherence / 100) * 100 : 0;
                  const isGood = day.adherence >= 80;
                  const isOk = day.adherence >= 50;

                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                      {/* Tooltip */}
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-surface-card border border-white/10 rounded-lg px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                        <p className="text-xs font-mono">{day.adherence}%</p>
                        <p className="text-xs text-neutral-500">{day.completed}/{day.total}</p>
                      </div>
                      {/* Bar */}
                      <div className="w-full flex items-end justify-center" style={{ height: '100%' }}>
                        <div
                          className="w-full max-w-10 rounded-t-md transition-all duration-300"
                          style={{
                            height: `${Math.max(height, 2)}%`,
                            backgroundColor: isGood ? '#00FF94' : isOk ? '#FFD600' : '#FF0033',
                            opacity: day.total === 0 ? 0.15 : 0.8,
                          }}
                        />
                      </div>
                      {/* Date label */}
                      <span className="text-xs text-neutral-600 font-mono">
                        {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs text-neutral-500 pt-3 border-t border-white/5">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-[#00FF94]" /> 80%+
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-[#FFD600]" /> 50-79%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-[#FF0033]" /> &lt;50%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Streak Card */}
          <div className="glass-card p-6 text-center">
            <Flame className="w-14 h-14 text-neon-gold mx-auto mb-3" />
            <p className="text-5xl font-mono font-bold text-neon-gold" data-testid="streak-value">
              {streak?.current_streak || 0}
            </p>
            <p className="text-sm text-neutral-500 mt-1">Day Streak</p>
            <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
              <div>
                <p className="text-lg font-mono font-bold">{streak?.longest_streak || 0}</p>
                <p className="text-xs text-neutral-500">Best Streak</p>
              </div>
              <div>
                <p className="text-lg font-mono font-bold">{streak?.total_completed || 0}</p>
                <p className="text-xs text-neutral-500">Total Done</p>
              </div>
            </div>
          </div>

          {/* Activity Breakdown */}
          <div className="glass-card p-6">
            <h2 className="font-chivo font-bold text-lg mb-4">Breakdown</h2>
            <div className="space-y-3">
              <StatRow label="Completed" value={summary.completed || 0} color="#00FF94" icon={CheckCircle} />
              <StatRow label="Skipped" value={summary.skipped || 0} color="#FFD600" icon={AlertTriangle} />
              <StatRow label="Late" value={summary.late || 0} color="#FF6600" icon={Clock} />
            </div>
            {(summary.total_activities || 0) > 0 && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <div className="flex h-3 rounded-full overflow-hidden bg-neutral-800">
                  {summary.completed > 0 && (
                    <div
                      className="h-full"
                      style={{
                        width: `${(summary.completed / summary.total_activities) * 100}%`,
                        backgroundColor: '#00FF94'
                      }}
                    />
                  )}
                  {summary.late > 0 && (
                    <div
                      className="h-full"
                      style={{
                        width: `${(summary.late / summary.total_activities) * 100}%`,
                        backgroundColor: '#FF6600'
                      }}
                    />
                  )}
                  {summary.skipped > 0 && (
                    <div
                      className="h-full"
                      style={{
                        width: `${(summary.skipped / summary.total_activities) * 100}%`,
                        backgroundColor: '#FFD600'
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Category Breakdown */}
          <div className="glass-card p-6">
            <h2 className="font-chivo font-bold text-lg mb-4">Categories</h2>
            <div className="space-y-2">
              {Object.entries(analytics?.categories || {}).map(([key, cat]) => (
                <div key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[key] || '#00F0FF' }}
                  />
                  <span className="text-sm flex-1">{cat.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Daily Detail Table */}
      {dailyData.length > 0 && (
        <div className="glass-card p-6 mt-6">
          <h2 className="font-chivo font-bold text-lg mb-4">Daily Details</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-neutral-500 font-medium">Date</th>
                  <th className="text-center py-3 px-4 text-neutral-500 font-medium">Completed</th>
                  <th className="text-center py-3 px-4 text-neutral-500 font-medium">Total</th>
                  <th className="text-center py-3 px-4 text-neutral-500 font-medium">Adherence</th>
                  <th className="text-right py-3 px-4 text-neutral-500 font-medium">Trend</th>
                </tr>
              </thead>
              <tbody>
                {dailyData.map((day, i) => {
                  const prevDay = dailyData[i - 1];
                  const trend = prevDay ? day.adherence - prevDay.adherence : 0;

                  return (
                    <tr key={day.date} className="border-b border-white/5 hover:bg-white/5" data-testid={`daily-row-${i}`}>
                      <td className="py-3 px-4 font-mono text-neutral-300">
                        {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric'
                        })}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-neon-green">{day.completed}</td>
                      <td className="py-3 px-4 text-center font-mono text-neutral-400">{day.total}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`font-mono font-bold ${
                          day.adherence >= 80 ? 'text-neon-green' :
                          day.adherence >= 50 ? 'text-neon-gold' :
                          day.total === 0 ? 'text-neutral-600' : 'text-neon-red'
                        }`}>
                          {day.total === 0 ? '-' : `${day.adherence}%`}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {trend > 0 ? <ChevronUp className="w-4 h-4 text-neon-green inline" /> :
                         trend < 0 ? <ChevronDown className="w-4 h-4 text-neon-red inline" /> :
                         <Minus className="w-4 h-4 text-neutral-600 inline" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function SummaryCard({ title, value, subtitle, icon: Icon, color, testId }) {
  return (
    <div className="glass-card p-5" data-testid={testId}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-mono font-bold" style={{ color }}>{value}</p>
      <p className="text-xs text-neutral-500 mt-1">{title}</p>
      {subtitle && <p className="text-xs text-neutral-600 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function StatRow({ label, value, color, icon: Icon }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4" style={{ color }} />
      <span className="text-sm flex-1 text-neutral-400">{label}</span>
      <span className="font-mono font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

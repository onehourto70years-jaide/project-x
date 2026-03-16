import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '@/App';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  Clock, Play, Pause, SkipForward, Check, Plus, Settings,
  ChevronRight, Flame, Target, Calendar, BarChart3, 
  Loader2, AlertCircle, Zap, Coffee
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

export default function RoutineDashboard() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [focusStatus, setFocusStatus] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const intervalRef = useRef(null);

  useEffect(() => {
    fetchStatus();
    fetchFocusStatus();
    
    // Update time every second
    intervalRef.current = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    // Refresh status every minute
    const statusInterval = setInterval(fetchStatus, 60000);
    
    return () => {
      clearInterval(intervalRef.current);
      clearInterval(statusInterval);
    };
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch(`${API}/routines/today/status`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFocusStatus = async () => {
    try {
      const response = await fetch(`${API}/routines/focus/status`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setFocusStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch focus status:', error);
    }
  };

  const startActivity = async (activityId) => {
    try {
      await fetch(`${API}/routines/activities/${activityId}/start`, {
        method: 'POST',
        credentials: 'include'
      });
      toast.success('Activity started');
      fetchStatus();
    } catch (error) {
      toast.error('Failed to start activity');
    }
  };

  const completeActivity = async (activityId) => {
    try {
      await fetch(`${API}/routines/activities/${activityId}/complete`, {
        method: 'POST',
        credentials: 'include'
      });
      toast.success('Activity completed!');
      fetchStatus();
    } catch (error) {
      toast.error('Failed to complete activity');
    }
  };

  const skipActivity = async (activityId) => {
    try {
      await fetch(`${API}/routines/activities/${activityId}/skip`, {
        method: 'POST',
        credentials: 'include'
      });
      toast.info('Activity skipped');
      fetchStatus();
    } catch (error) {
      toast.error('Failed to skip activity');
    }
  };

  const startFocusMode = async (activityId) => {
    try {
      await fetch(`${API}/routines/focus/start?activity_id=${activityId || ''}&duration_minutes=25`, {
        method: 'POST',
        credentials: 'include'
      });
      toast.success('Focus mode started - 25 minutes');
      fetchFocusStatus();
    } catch (error) {
      toast.error('Failed to start focus mode');
    }
  };

  const endFocusMode = async () => {
    try {
      await fetch(`${API}/routines/focus/end`, {
        method: 'POST',
        credentials: 'include'
      });
      toast.info('Focus mode ended');
      fetchFocusStatus();
    } catch (error) {
      toast.error('Failed to end focus mode');
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const getActivityStatus = (activityId) => {
    const log = status?.today_logs?.find(l => l.activity_id === activityId);
    return log?.status || null;
  };

  const isActivityCurrent = (activity) => {
    return status?.current_activity?.activity_id === activity.activity_id;
  };

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
        <div>
          <h1 className="font-chivo font-bold text-2xl sm:text-3xl flex items-center gap-3">
            <Clock className="w-8 h-8 text-neon-purple" />
            Routine Tracker
          </h1>
          <p className="text-neutral-400 text-sm mt-1">
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right mr-4">
            <p className="text-3xl font-mono font-bold text-neon-cyan">{formatTime(currentTime)}</p>
          </div>
          <Button 
            onClick={() => navigate('/routines/builder')}
            className="btn-primary"
            data-testid="create-routine-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Routine
          </Button>
        </div>
      </div>

      {/* Focus Mode Banner */}
      {focusStatus?.active && (
        <div className="glass-card p-4 mb-6 border-neon-red/30 bg-neon-red/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-neon-red/20 flex items-center justify-center animate-pulse">
                <Zap className="w-6 h-6 text-neon-red" />
              </div>
              <div>
                <p className="font-chivo font-bold text-lg text-neon-red">Focus Mode Active</p>
                <p className="text-sm text-neutral-400">{Math.ceil(focusStatus.remaining_minutes)} minutes remaining</p>
              </div>
            </div>
            <Button onClick={endFocusMode} variant="outline" className="border-neon-red/30 text-neon-red hover:bg-neon-red/10">
              End Focus
            </Button>
          </div>
        </div>
      )}

      {!status?.has_routine ? (
        /* No Routine State */
        <div className="glass-card p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-neon-purple/10 flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-neon-purple/50" />
          </div>
          <h2 className="font-chivo font-bold text-2xl mb-2">No Active Routine</h2>
          <p className="text-neutral-400 mb-6 max-w-md mx-auto">
            Create your first routine to start tracking your daily activities and build better habits.
          </p>
          <div className="flex justify-center gap-4">
            <Button onClick={() => navigate('/routines/builder')} className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              Create Routine
            </Button>
            <Button onClick={() => navigate('/routines/builder?template=true')} variant="outline" className="btn-secondary">
              Use Template
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Current Activity - Main Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Activity Card */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-chivo font-bold text-lg">Current Activity</h2>
                <span className="text-sm text-neutral-500">{status?.routine_name}</span>
              </div>

              {status?.current_activity ? (
                <div 
                  className="p-6 rounded-xl border-2"
                  style={{ 
                    borderColor: CATEGORY_COLORS[status.current_activity.category] || '#00F0FF',
                    backgroundColor: `${CATEGORY_COLORS[status.current_activity.category] || '#00F0FF'}10`
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-2xl font-chivo font-bold">{status.current_activity.title}</p>
                      <p className="text-sm text-neutral-400 capitalize mt-1">
                        {status.current_activity.category} • {status.current_activity.start_time} - {status.current_activity.end_time}
                      </p>
                    </div>
                    <div 
                      className="px-3 py-1 rounded-full text-xs font-bold uppercase"
                      style={{ 
                        backgroundColor: `${CATEGORY_COLORS[status.current_activity.category] || '#00F0FF'}30`,
                        color: CATEGORY_COLORS[status.current_activity.category] || '#00F0FF'
                      }}
                    >
                      {status.current_activity.priority}
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-neutral-400">Progress</span>
                      <span className="font-mono">{Math.round(status.current_progress)}%</span>
                    </div>
                    <Progress value={status.current_progress} className="h-3" />
                  </div>

                  {/* Time Remaining */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-center">
                      <p className="text-4xl font-mono font-bold" style={{ color: CATEGORY_COLORS[status.current_activity.category] || '#00F0FF' }}>
                        {status.time_remaining_minutes || 0}
                      </p>
                      <p className="text-xs text-neutral-500">minutes left</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    {getActivityStatus(status.current_activity.activity_id) !== 'completed' && (
                      <>
                        <Button 
                          onClick={() => completeActivity(status.current_activity.activity_id)}
                          className="btn-primary flex-1"
                          data-testid="complete-activity-btn"
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Complete
                        </Button>
                        <Button 
                          onClick={() => skipActivity(status.current_activity.activity_id)}
                          variant="outline"
                          className="btn-secondary"
                          data-testid="skip-activity-btn"
                        >
                          <SkipForward className="w-4 h-4 mr-2" />
                          Skip
                        </Button>
                        {!focusStatus?.active && (
                          <Button 
                            onClick={() => startFocusMode(status.current_activity.activity_id)}
                            variant="outline"
                            className="border-neon-red/30 text-neon-red hover:bg-neon-red/10"
                            data-testid="focus-mode-btn"
                          >
                            <Zap className="w-4 h-4" />
                          </Button>
                        )}
                      </>
                    )}
                    {getActivityStatus(status.current_activity.activity_id) === 'completed' && (
                      <div className="flex-1 text-center py-3 rounded-lg bg-neon-green/10 text-neon-green font-bold">
                        <Check className="w-5 h-5 inline mr-2" />
                        Completed
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-white/10 bg-black/20 text-center">
                  <Coffee className="w-12 h-12 text-neutral-500 mx-auto mb-3" />
                  <p className="text-neutral-400">No activity scheduled for this time</p>
                </div>
              )}

              {/* Next Up */}
              {status?.next_activity && (
                <div className="mt-4 p-4 rounded-lg bg-black/20 border border-white/5">
                  <p className="text-xs text-neutral-500 uppercase mb-2">Next Up</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[status.next_activity.category] || '#00F0FF' }}
                      />
                      <span className="font-medium">{status.next_activity.title}</span>
                    </div>
                    <span className="text-sm text-neutral-400">{status.next_activity.start_time}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="glass-card p-6">
              <h2 className="font-chivo font-bold text-lg mb-4">Today's Timeline</h2>
              <div className="space-y-2">
                {status?.activities?.map((activity, i) => {
                  const actStatus = getActivityStatus(activity.activity_id);
                  const isCurrent = isActivityCurrent(activity);
                  
                  return (
                    <div 
                      key={activity.activity_id}
                      className={`flex items-center gap-4 p-3 rounded-lg transition-all ${
                        isCurrent ? 'bg-white/5 border border-white/10' : 'hover:bg-white/5'
                      }`}
                      data-testid={`timeline-activity-${i}`}
                    >
                      {/* Time */}
                      <div className="w-20 text-sm font-mono text-neutral-400">
                        {activity.start_time}
                      </div>
                      
                      {/* Status Indicator */}
                      <div 
                        className={`w-4 h-4 rounded-full flex items-center justify-center ${
                          actStatus === 'completed' ? 'bg-neon-green' :
                          actStatus === 'skipped' ? 'bg-neutral-600' :
                          actStatus === 'in_progress' ? 'bg-neon-cyan animate-pulse' :
                          isCurrent ? 'bg-neon-purple animate-pulse' :
                          'bg-neutral-700'
                        }`}
                      >
                        {actStatus === 'completed' && <Check className="w-3 h-3 text-black" />}
                      </div>
                      
                      {/* Activity Info */}
                      <div className="flex-1">
                        <p className={`font-medium ${actStatus === 'skipped' ? 'line-through text-neutral-500' : ''}`}>
                          {activity.title}
                        </p>
                        <p className="text-xs text-neutral-500 capitalize">{activity.category}</p>
                      </div>
                      
                      {/* Duration */}
                      <div className="text-sm text-neutral-500">
                        {activity.end_time}
                      </div>
                      
                      {/* Category Color */}
                      <div 
                        className="w-2 h-8 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[activity.category] || '#00F0FF' }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Today's Progress */}
            <div className="glass-card p-6">
              <h2 className="font-chivo font-bold text-lg mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-neon-cyan" />
                Today's Progress
              </h2>
              <div className="text-center mb-4">
                <p className="text-5xl font-mono font-bold text-neon-cyan">
                  {Math.round(status?.today_progress || 0)}%
                </p>
                <p className="text-sm text-neutral-500 mt-1">
                  {status?.today_completed || 0} of {status?.today_total || 0} completed
                </p>
              </div>
              <Progress value={status?.today_progress || 0} className="h-3" />
            </div>

            {/* Quick Actions */}
            <div className="glass-card p-6">
              <h2 className="font-chivo font-bold text-lg mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <Button 
                  onClick={() => navigate('/routines/builder')}
                  variant="outline"
                  className="btn-secondary w-full justify-start"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Routine
                </Button>
                <Button 
                  onClick={() => navigate('/routines/analytics')}
                  variant="outline"
                  className="btn-secondary w-full justify-start"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  View Analytics
                </Button>
                <Button 
                  onClick={() => navigate(`/routines/builder/${status?.routine_id}`)}
                  variant="outline"
                  className="btn-secondary w-full justify-start"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Edit Routine
                </Button>
              </div>
            </div>

            {/* Streak */}
            <div className="glass-card p-6 text-center">
              <Flame className="w-12 h-12 text-neon-gold mx-auto mb-2" />
              <p className="text-3xl font-mono font-bold text-neon-gold">0</p>
              <p className="text-sm text-neutral-500">Day Streak</p>
              <Button 
                onClick={() => navigate('/routines/analytics')}
                variant="link"
                className="text-neon-cyan mt-2"
              >
                View Details <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

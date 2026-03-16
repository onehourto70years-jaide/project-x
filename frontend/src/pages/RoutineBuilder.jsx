import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { API } from '@/App';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Plus, Trash2, Clock, Save, ArrowLeft, GripVertical,
  Loader2, Briefcase, Heart, User, Moon, Target, Coffee,
  Dumbbell, Utensils, BookOpen, Users, Check
} from 'lucide-react';

const CATEGORIES = [
  { value: 'work', label: 'Work', icon: Briefcase, color: '#7000FF' },
  { value: 'health', label: 'Health', icon: Heart, color: '#00FF94' },
  { value: 'personal', label: 'Personal', icon: User, color: '#00F0FF' },
  { value: 'sleep', label: 'Sleep', icon: Moon, color: '#6366F1' },
  { value: 'focus', label: 'Focus', icon: Target, color: '#FF0033' },
  { value: 'break', label: 'Break', icon: Coffee, color: '#FFD600' },
  { value: 'exercise', label: 'Exercise', icon: Dumbbell, color: '#00FF94' },
  { value: 'meal', label: 'Meal', icon: Utensils, color: '#FF6600' },
  { value: 'learning', label: 'Learning', icon: BookOpen, color: '#00F0FF' },
  { value: 'social', label: 'Social', icon: Users, color: '#CC00FF' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: '#666' },
  { value: 'medium', label: 'Medium', color: '#FFD600' },
  { value: 'high', label: 'High', color: '#FF6600' },
  { value: 'critical', label: 'Critical', color: '#FF0033' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Mon' },
  { value: 1, label: 'Tue' },
  { value: 2, label: 'Wed' },
  { value: 3, label: 'Thu' },
  { value: 4, label: 'Fri' },
  { value: 5, label: 'Sat' },
  { value: 6, label: 'Sun' },
];

export default function RoutineBuilder() {
  const navigate = useNavigate();
  const { routineId } = useParams();
  const [searchParams] = useSearchParams();
  const showTemplates = searchParams.get('template') === 'true';

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [showTemplateDialog, setShowTemplateDialog] = useState(showTemplates);

  const [routine, setRoutine] = useState({
    name: '',
    description: '',
    schedule_type: 'daily',
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    activities: []
  });

  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [newActivity, setNewActivity] = useState({
    title: '',
    start_time: '09:00',
    end_time: '10:00',
    category: 'work',
    priority: 'medium',
    description: ''
  });

  useEffect(() => {
    if (routineId) {
      fetchRoutine();
    }
    fetchTemplates();
  }, [routineId]);

  const fetchRoutine = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API}/routines/${routineId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setRoutine(data);
      }
    } catch (error) {
      toast.error('Failed to load routine');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch(`${API}/routines/templates`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const applyTemplate = async (templateId) => {
    try {
      const response = await fetch(`${API}/routines/templates/${templateId}/apply`, {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        toast.success('Template applied! Routine created.');
        navigate('/routines');
      }
    } catch (error) {
      toast.error('Failed to apply template');
    }
  };

  const saveRoutine = async () => {
    if (!routine.name.trim()) {
      toast.error('Please enter a routine name');
      return;
    }

    if (routine.activities.length === 0) {
      toast.error('Please add at least one activity');
      return;
    }

    setSaving(true);
    try {
      const url = routineId ? `${API}/routines/${routineId}` : `${API}/routines`;
      const method = routineId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(routine)
      });

      if (response.ok) {
        toast.success(routineId ? 'Routine updated!' : 'Routine created!');
        navigate('/routines');
      } else {
        toast.error('Failed to save routine');
      }
    } catch (error) {
      toast.error('Failed to save routine');
    } finally {
      setSaving(false);
    }
  };

  const addActivity = () => {
    if (!newActivity.title.trim()) {
      toast.error('Please enter an activity title');
      return;
    }

    const activity = {
      activity_id: `temp_${Date.now()}`,
      ...newActivity,
      order: routine.activities.length
    };

    setRoutine({
      ...routine,
      activities: [...routine.activities, activity]
    });

    setNewActivity({
      title: '',
      start_time: newActivity.end_time,
      end_time: incrementTime(newActivity.end_time, 60),
      category: 'work',
      priority: 'medium',
      description: ''
    });

    setShowActivityDialog(false);
  };

  const updateActivity = () => {
    if (!editingActivity) return;

    setRoutine({
      ...routine,
      activities: routine.activities.map(a => 
        a.activity_id === editingActivity.activity_id ? editingActivity : a
      )
    });

    setEditingActivity(null);
    setShowActivityDialog(false);
  };

  const deleteActivity = (activityId) => {
    setRoutine({
      ...routine,
      activities: routine.activities.filter(a => a.activity_id !== activityId)
    });
  };

  const toggleDay = (day) => {
    const days = routine.days_of_week.includes(day)
      ? routine.days_of_week.filter(d => d !== day)
      : [...routine.days_of_week, day].sort();
    setRoutine({ ...routine, days_of_week: days });
  };

  const incrementTime = (time, minutes) => {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + minutes;
    const newH = Math.floor(total / 60) % 24;
    const newM = total % 60;
    return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
  };

  const getCategoryIcon = (category) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat ? cat.icon : Briefcase;
  };

  const getCategoryColor = (category) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat?.color || '#00F0FF';
  };

  const sortedActivities = [...routine.activities].sort((a, b) => {
    const timeA = a.start_time.split(':').map(Number);
    const timeB = b.start_time.split(':').map(Number);
    return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
  });

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
          <h1 className="font-chivo font-bold text-2xl">
            {routineId ? 'Edit Routine' : 'Create Routine'}
          </h1>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline"
            onClick={() => setShowTemplateDialog(true)}
            className="btn-secondary"
          >
            Use Template
          </Button>
          <Button onClick={saveRoutine} className="btn-primary" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Routine
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left - Routine Settings */}
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h2 className="font-chivo font-bold text-lg mb-4">Routine Details</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-neutral-400 mb-2 block">Name</label>
                <Input
                  placeholder="My Daily Routine"
                  value={routine.name}
                  onChange={(e) => setRoutine({ ...routine, name: e.target.value })}
                  className="input-scientific"
                  data-testid="routine-name-input"
                />
              </div>
              <div>
                <label className="text-sm text-neutral-400 mb-2 block">Description</label>
                <Input
                  placeholder="Optional description"
                  value={routine.description || ''}
                  onChange={(e) => setRoutine({ ...routine, description: e.target.value })}
                  className="input-scientific"
                />
              </div>
              <div>
                <label className="text-sm text-neutral-400 mb-2 block">Schedule Type</label>
                <Select 
                  value={routine.schedule_type} 
                  onValueChange={(v) => setRoutine({ ...routine, schedule_type: v })}
                >
                  <SelectTrigger className="input-scientific">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Active Days */}
          <div className="glass-card p-6">
            <h2 className="font-chivo font-bold text-lg mb-4">Active Days</h2>
            <div className="flex gap-2">
              {DAYS_OF_WEEK.map(day => (
                <button
                  key={day.value}
                  onClick={() => toggleDay(day.value)}
                  className={`w-10 h-10 rounded-lg font-bold text-sm transition-all ${
                    routine.days_of_week.includes(day.value)
                      ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30'
                      : 'bg-neutral-800 text-neutral-500 border border-transparent hover:border-white/20'
                  }`}
                  data-testid={`day-${day.label.toLowerCase()}`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Add Activity Button */}
          <Button 
            onClick={() => {
              setEditingActivity(null);
              setShowActivityDialog(true);
            }}
            className="btn-primary w-full"
            data-testid="add-activity-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Activity
          </Button>
        </div>

        {/* Right - Activities Timeline */}
        <div className="lg:col-span-2">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-chivo font-bold text-lg">Activities ({routine.activities.length})</h2>
              <span className="text-sm text-neutral-500">Drag to reorder</span>
            </div>

            {routine.activities.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-xl">
                <Clock className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                <p className="text-neutral-500">No activities yet</p>
                <p className="text-sm text-neutral-600 mt-1">Click "Add Activity" to start building your routine</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedActivities.map((activity, i) => {
                  const CategoryIcon = getCategoryIcon(activity.category);
                  const color = getCategoryColor(activity.category);
                  
                  return (
                    <div 
                      key={activity.activity_id}
                      className="flex items-center gap-4 p-4 rounded-xl bg-black/20 border border-white/5 group hover:border-white/10 transition-all"
                      data-testid={`activity-item-${i}`}
                    >
                      <GripVertical className="w-4 h-4 text-neutral-600 cursor-grab" />
                      
                      {/* Time */}
                      <div className="w-24 font-mono text-sm">
                        <span className="text-neutral-300">{activity.start_time}</span>
                        <span className="text-neutral-600 mx-1">-</span>
                        <span className="text-neutral-500">{activity.end_time}</span>
                      </div>
                      
                      {/* Category Icon */}
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${color}20` }}
                      >
                        <CategoryIcon className="w-5 h-5" style={{ color }} />
                      </div>
                      
                      {/* Activity Info */}
                      <div className="flex-1">
                        <p className="font-medium">{activity.title}</p>
                        <p className="text-xs text-neutral-500 capitalize">{activity.category} • {activity.priority}</p>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingActivity(activity);
                            setNewActivity(activity);
                            setShowActivityDialog(true);
                          }}
                        >
                          <Clock className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-neon-red"
                          onClick={() => deleteActivity(activity.activity_id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      {/* Priority Bar */}
                      <div 
                        className="w-1 h-10 rounded-full"
                        style={{ backgroundColor: PRIORITIES.find(p => p.value === activity.priority)?.color || '#666' }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Activity Dialog */}
      <Dialog open={showActivityDialog} onOpenChange={setShowActivityDialog}>
        <DialogContent className="bg-surface-card border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-chivo">
              {editingActivity ? 'Edit Activity' : 'Add Activity'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Activity title"
              value={editingActivity ? editingActivity.title : newActivity.title}
              onChange={(e) => editingActivity 
                ? setEditingActivity({ ...editingActivity, title: e.target.value })
                : setNewActivity({ ...newActivity, title: e.target.value })
              }
              className="input-scientific"
              data-testid="activity-title-input"
            />
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-neutral-500 mb-1 block">Start Time</label>
                <Input
                  type="time"
                  value={editingActivity ? editingActivity.start_time : newActivity.start_time}
                  onChange={(e) => editingActivity
                    ? setEditingActivity({ ...editingActivity, start_time: e.target.value })
                    : setNewActivity({ ...newActivity, start_time: e.target.value })
                  }
                  className="input-scientific"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500 mb-1 block">End Time</label>
                <Input
                  type="time"
                  value={editingActivity ? editingActivity.end_time : newActivity.end_time}
                  onChange={(e) => editingActivity
                    ? setEditingActivity({ ...editingActivity, end_time: e.target.value })
                    : setNewActivity({ ...newActivity, end_time: e.target.value })
                  }
                  className="input-scientific"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-neutral-500 mb-1 block">Category</label>
                <Select 
                  value={editingActivity ? editingActivity.category : newActivity.category}
                  onValueChange={(v) => editingActivity
                    ? setEditingActivity({ ...editingActivity, category: v })
                    : setNewActivity({ ...newActivity, category: v })
                  }
                >
                  <SelectTrigger className="input-scientific">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-neutral-500 mb-1 block">Priority</label>
                <Select 
                  value={editingActivity ? editingActivity.priority : newActivity.priority}
                  onValueChange={(v) => editingActivity
                    ? setEditingActivity({ ...editingActivity, priority: v })
                    : setNewActivity({ ...newActivity, priority: v })
                  }
                >
                  <SelectTrigger className="input-scientific">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                          {p.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Button 
              onClick={editingActivity ? updateActivity : addActivity} 
              className="btn-primary w-full"
            >
              {editingActivity ? 'Update Activity' : 'Add Activity'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Templates Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="bg-surface-card border-white/10 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-chivo">Choose a Template</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 mt-4">
            {templates.map(template => (
              <div 
                key={template.id}
                className="p-4 rounded-xl bg-black/20 border border-white/5 hover:border-neon-cyan/30 cursor-pointer transition-all"
                onClick={() => applyTemplate(template.id)}
                data-testid={`template-${template.id}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-chivo font-bold text-lg">{template.name}</h3>
                    <p className="text-sm text-neutral-400 mt-1">{template.description}</p>
                    <p className="text-xs text-neutral-500 mt-2">{template.activities.length} activities</p>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-neon-cyan/10 text-neon-cyan text-xs capitalize">
                    {template.category}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

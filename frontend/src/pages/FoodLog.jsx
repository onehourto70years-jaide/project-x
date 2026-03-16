import React, { useState, useEffect } from 'react';
import { API } from '@/App';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Plus, Search, Trash2, Utensils, Coffee, Sun, Moon, Cookie,
  Loader2, ScanBarcode, ChevronLeft, ChevronRight
} from 'lucide-react';

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', icon: Coffee },
  { value: 'lunch', label: 'Lunch', icon: Sun },
  { value: 'dinner', label: 'Dinner', icon: Moon },
  { value: 'snack', label: 'Snack', icon: Cookie },
];

export default function FoodLog() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [foodLog, setFoodLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState('snack');
  const [addingFood, setAddingFood] = useState(null);
  const [customEntry, setCustomEntry] = useState({
    name: '', calories: '', protein: '', carbs: '', fat: '', fiber: '', amount: 1
  });

  useEffect(() => {
    fetchFoodLog();
  }, [selectedDate]);

  const fetchFoodLog = async () => {
    try {
      const response = await fetch(`${API}/food-log?date=${selectedDate}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setFoodLog(data);
      }
    } catch (error) {
      console.error('Failed to fetch food log:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchFoods = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    try {
      const response = await fetch(`${API}/foods/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query: searchQuery, page_size: 10 })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.foods || []);
      }
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const addFoodFromSearch = async (food) => {
    setAddingFood(food.fdc_id);
    try {
      const entry = {
        name: food.description,
        calories: food.nutrients?.calories?.amount || 0,
        protein: food.nutrients?.protein?.amount || 0,
        carbs: food.nutrients?.carbohydrates?.amount || 0,
        fat: food.nutrients?.fat?.amount || 0,
        fiber: 0,
        amount: 1,
        unit: 'serving',
        meal_type: selectedMealType,
        fdc_id: food.fdc_id
      };

      const response = await fetch(`${API}/food-log?date=${selectedDate}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(entry)
      });

      if (response.ok) {
        toast.success('Food added');
        fetchFoodLog();
        setSearchResults([]);
        setSearchQuery('');
      }
    } catch (error) {
      toast.error('Failed to add food');
    } finally {
      setAddingFood(null);
    }
  };

  const addCustomFood = async () => {
    if (!customEntry.name || !customEntry.calories) {
      toast.error('Name and calories are required');
      return;
    }

    try {
      const entry = {
        name: customEntry.name,
        calories: parseFloat(customEntry.calories) || 0,
        protein: parseFloat(customEntry.protein) || 0,
        carbs: parseFloat(customEntry.carbs) || 0,
        fat: parseFloat(customEntry.fat) || 0,
        fiber: parseFloat(customEntry.fiber) || 0,
        amount: parseFloat(customEntry.amount) || 1,
        unit: 'serving',
        meal_type: selectedMealType
      };

      const response = await fetch(`${API}/food-log?date=${selectedDate}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(entry)
      });

      if (response.ok) {
        toast.success('Food added');
        fetchFoodLog();
        setShowAddDialog(false);
        setCustomEntry({ name: '', calories: '', protein: '', carbs: '', fat: '', fiber: '', amount: 1 });
      }
    } catch (error) {
      toast.error('Failed to add food');
    }
  };

  const deleteEntry = async (entryId) => {
    try {
      const response = await fetch(`${API}/food-log/${entryId}?date=${selectedDate}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Entry deleted');
        fetchFoodLog();
      }
    } catch (error) {
      toast.error('Failed to delete entry');
    }
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

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => changeDate(-1)} data-testid="prev-day">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="text-center">
            <h1 className="font-chivo font-bold text-xl">{formatDate(selectedDate)}</h1>
            <p className="text-xs text-neutral-500">{selectedDate}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => changeDate(1)} data-testid="next-day">
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="btn-primary" data-testid="add-custom-btn">
              <Plus className="w-4 h-4 mr-2" />
              Custom Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-surface-card border-white/10">
            <DialogHeader>
              <DialogTitle className="font-chivo">Add Custom Food</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Food name"
                value={customEntry.name}
                onChange={(e) => setCustomEntry({ ...customEntry, name: e.target.value })}
                className="input-scientific"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  placeholder="Calories"
                  value={customEntry.calories}
                  onChange={(e) => setCustomEntry({ ...customEntry, calories: e.target.value })}
                  className="input-scientific"
                />
                <Input
                  type="number"
                  placeholder="Protein (g)"
                  value={customEntry.protein}
                  onChange={(e) => setCustomEntry({ ...customEntry, protein: e.target.value })}
                  className="input-scientific"
                />
                <Input
                  type="number"
                  placeholder="Carbs (g)"
                  value={customEntry.carbs}
                  onChange={(e) => setCustomEntry({ ...customEntry, carbs: e.target.value })}
                  className="input-scientific"
                />
                <Input
                  type="number"
                  placeholder="Fat (g)"
                  value={customEntry.fat}
                  onChange={(e) => setCustomEntry({ ...customEntry, fat: e.target.value })}
                  className="input-scientific"
                />
              </div>
              <Select value={selectedMealType} onValueChange={setSelectedMealType}>
                <SelectTrigger className="input-scientific">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map(meal => (
                    <SelectItem key={meal.value} value={meal.value}>{meal.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={addCustomFood} className="btn-primary w-full">Add Food</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Totals Summary */}
      {foodLog && (
        <div className="glass-card p-4 mb-6">
          <div className="grid grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-xs text-neutral-500">Calories</p>
              <p className="font-mono font-bold text-lg text-neon-gold">
                {Math.round(foodLog.totals?.calories || 0)}
              </p>
              <p className="text-[10px] text-neutral-600">/ {foodLog.goals?.calories}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Protein</p>
              <p className="font-mono font-bold text-lg text-neon-cyan">
                {Math.round(foodLog.totals?.protein || 0)}g
              </p>
              <p className="text-[10px] text-neutral-600">/ {foodLog.goals?.protein}g</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Carbs</p>
              <p className="font-mono font-bold text-lg text-neon-gold">
                {Math.round(foodLog.totals?.carbs || 0)}g
              </p>
              <p className="text-[10px] text-neutral-600">/ {foodLog.goals?.carbs}g</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Fat</p>
              <p className="font-mono font-bold text-lg text-neon-purple">
                {Math.round(foodLog.totals?.fat || 0)}g
              </p>
              <p className="text-[10px] text-neutral-600">/ {foodLog.goals?.fat}g</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Net Carbs</p>
              <p className="font-mono font-bold text-lg text-neon-green">
                {Math.round(foodLog.totals?.net_carbs || 0)}g
              </p>
              <p className="text-[10px] text-neutral-600">keto mode</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Search & Add */}
        <div className="space-y-4">
          <div className="glass-card p-4">
            <h2 className="font-chivo font-bold text-sm mb-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-neon-cyan" />
              Search Foods
            </h2>
            <form onSubmit={searchFoods} className="space-y-3">
              <Input
                placeholder="Search USDA database..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-scientific"
                data-testid="food-search-input"
              />
              <Select value={selectedMealType} onValueChange={setSelectedMealType}>
                <SelectTrigger className="input-scientific">
                  <SelectValue placeholder="Meal type" />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map(meal => (
                    <SelectItem key={meal.value} value={meal.value}>
                      <div className="flex items-center gap-2">
                        <meal.icon className="w-4 h-4" />
                        {meal.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" className="btn-primary w-full" disabled={searching} data-testid="search-food-btn">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
              </Button>
            </form>

            {searchResults.length > 0 && (
              <ScrollArea className="mt-4 h-64">
                <div className="space-y-2">
                  {searchResults.map((food, i) => (
                    <div
                      key={food.fdc_id || i}
                      className="p-3 rounded-lg bg-black/30 border border-white/5 cursor-pointer hover:border-neon-cyan/50"
                      onClick={() => addFoodFromSearch(food)}
                      data-testid={`search-result-${i}`}
                    >
                      {addingFood === food.fdc_id ? (
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="w-4 h-4 animate-spin text-neon-cyan" />
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-medium truncate">{food.description}</p>
                          <div className="flex gap-3 mt-1 text-xs text-neutral-500 font-mono">
                            <span>{Math.round(food.nutrients?.calories?.amount || 0)} cal</span>
                            <span>P: {Math.round(food.nutrients?.protein?.amount || 0)}g</span>
                            <span>C: {Math.round(food.nutrients?.carbohydrates?.amount || 0)}g</span>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        {/* Food Log by Meal */}
        <div className="lg:col-span-2 space-y-4">
          {MEAL_TYPES.map(meal => {
            const entries = foodLog?.by_meal?.[meal.value] || [];
            const mealCalories = entries.reduce((sum, e) => sum + (e.calories || 0), 0);
            
            return (
              <div key={meal.value} className="glass-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      meal.value === 'breakfast' ? 'bg-neon-gold/20' :
                      meal.value === 'lunch' ? 'bg-neon-cyan/20' :
                      meal.value === 'dinner' ? 'bg-neon-purple/20' :
                      'bg-neon-green/20'
                    }`}>
                      <meal.icon className={`w-4 h-4 ${
                        meal.value === 'breakfast' ? 'text-neon-gold' :
                        meal.value === 'lunch' ? 'text-neon-cyan' :
                        meal.value === 'dinner' ? 'text-neon-purple' :
                        'text-neon-green'
                      }`} />
                    </div>
                    <span className="font-chivo font-bold">{meal.label}</span>
                  </div>
                  <span className="font-mono text-sm text-neutral-400">
                    {Math.round(mealCalories)} cal
                  </span>
                </div>

                {entries.length === 0 ? (
                  <p className="text-sm text-neutral-500 text-center py-4">
                    No items logged
                  </p>
                ) : (
                  <div className="space-y-2">
                    {entries.map((entry, i) => (
                      <div 
                        key={entry.entry_id || i}
                        className="flex items-center justify-between p-2 rounded bg-black/20 group"
                        data-testid={`food-entry-${meal.value}-${i}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{entry.name}</p>
                          <div className="flex gap-3 text-xs text-neutral-500 font-mono">
                            <span>{Math.round(entry.calories)} cal</span>
                            <span>P:{Math.round(entry.protein)}g</span>
                            <span>C:{Math.round(entry.carbs)}g</span>
                            <span>F:{Math.round(entry.fat)}g</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-neon-red"
                          onClick={() => deleteEntry(entry.entry_id)}
                          data-testid={`delete-entry-${entry.entry_id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}

import React, { useState, useEffect } from 'react';
import { API } from '@/App';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Search, Plus, Minus, Loader2, ScanBarcode, Atom, Beaker, 
  ShieldAlert, Thermometer, Flame, ChefHat, Utensils, Coffee,
  Sun, Moon, Cookie, Check, X, Info, Trash2, ChevronLeft, ChevronRight
} from 'lucide-react';
import ElementalDisplay from '@/components/ElementalDisplay';
import AllergenBadges from '@/components/AllergenBadges';
import SafeTemperatureCard from '@/components/SafeTemperatureCard';

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', icon: Coffee },
  { value: 'lunch', label: 'Lunch', icon: Sun },
  { value: 'dinner', label: 'Dinner', icon: Moon },
  { value: 'snack', label: 'Snack', icon: Cookie },
];

const COOKING_METHODS = [
  { id: 'raw', label: 'Raw' },
  { id: 'steamed', label: 'Steamed' },
  { id: 'boiled', label: 'Boiled' },
  { id: 'baked', label: 'Baked' },
  { id: 'grilled', label: 'Grilled' },
  { id: 'fried', label: 'Fried' },
];

export default function FoodLog() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [foodLog, setFoodLog] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Search & Analysis State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [foodDetails, setFoodDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Barcode State
  const [barcodeMode, setBarcodeMode] = useState(false);
  const [barcode, setBarcode] = useState('');
  
  // Add to Log State
  const [selectedMealType, setSelectedMealType] = useState('snack');
  const [amount, setAmount] = useState(100);
  const [cookingMethod, setCookingMethod] = useState('raw');
  const [addingToLog, setAddingToLog] = useState(false);

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
    setSelectedFood(null);
    setFoodDetails(null);
    
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

  const searchByBarcode = async (e) => {
    e?.preventDefault();
    if (!barcode.trim()) return;
    
    setSearching(true);
    setSelectedFood(null);
    setFoodDetails(null);
    
    try {
      const response = await fetch(`${API}/foods/barcode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ barcode: barcode.trim() })
      });
      
      if (response.ok) {
        const data = await response.json();
        setFoodDetails(data);
        setSelectedFood({ description: data.name, fdc_id: null, barcode: data.barcode });
        toast.success('Product found!');
      } else {
        toast.error('Product not found');
      }
    } catch (error) {
      toast.error('Barcode lookup failed');
    } finally {
      setSearching(false);
    }
  };

  const selectFood = async (food) => {
    setSelectedFood(food);
    setLoadingDetails(true);
    setAmount(100);
    setCookingMethod('raw');
    
    try {
      const response = await fetch(`${API}/foods/${food.fdc_id}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setFoodDetails(data);
      }
    } catch (error) {
      toast.error('Failed to load food details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const addToFoodLog = async () => {
    if (!selectedFood || !foodDetails) return;
    
    setAddingToLog(true);
    
    // Calculate scaled nutrients based on amount
    const scale = amount / 100;
    const macros = foodDetails.macros || {};
    
    const entry = {
      name: foodDetails.description || selectedFood.description,
      calories: (macros.protein || 0) * 4 * scale + (macros.carbohydrates || 0) * 4 * scale + (macros.fat || 0) * 9 * scale,
      protein: (macros.protein || 0) * scale,
      carbs: (macros.carbohydrates || 0) * scale,
      fat: (macros.fat || 0) * scale,
      fiber: 0,
      amount: amount,
      unit: 'g',
      meal_type: selectedMealType,
      fdc_id: selectedFood.fdc_id
    };

    // Get calories from nutrients if available
    const calorieNutrient = foodDetails.nutrients?.find(n => n.name.includes('Energy') && n.unit === 'kcal');
    if (calorieNutrient) {
      entry.calories = calorieNutrient.amount * scale;
    }

    try {
      const response = await fetch(`${API}/food-log?date=${selectedDate}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(entry)
      });

      if (response.ok) {
        toast.success(`Added ${entry.name} to ${selectedMealType}!`);
        fetchFoodLog();
        // Reset selection
        setSelectedFood(null);
        setFoodDetails(null);
        setSearchResults([]);
        setSearchQuery('');
        setBarcode('');
      } else {
        toast.error('Failed to add food');
      }
    } catch (error) {
      toast.error('Failed to add food');
    } finally {
      setAddingToLog(false);
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

  const clearSelection = () => {
    setSelectedFood(null);
    setFoodDetails(null);
  };

  return (
    <AppLayout>
      {/* Header with Date Navigation */}
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
      </div>

      {/* Daily Totals */}
      {foodLog && (
        <div className="glass-card p-4 mb-6">
          <div className="grid grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-xs text-neutral-500">Calories</p>
              <p className="font-mono font-bold text-xl text-neon-gold">
                {Math.round(foodLog.totals?.calories || 0)}
              </p>
              <p className="text-[10px] text-neutral-600">/ {foodLog.goals?.calories}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Protein</p>
              <p className="font-mono font-bold text-xl text-neon-cyan">
                {Math.round(foodLog.totals?.protein || 0)}g
              </p>
              <p className="text-[10px] text-neutral-600">/ {foodLog.goals?.protein}g</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Carbs</p>
              <p className="font-mono font-bold text-xl text-neon-gold">
                {Math.round(foodLog.totals?.carbs || 0)}g
              </p>
              <p className="text-[10px] text-neutral-600">/ {foodLog.goals?.carbs}g</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Fat</p>
              <p className="font-mono font-bold text-xl text-neon-purple">
                {Math.round(foodLog.totals?.fat || 0)}g
              </p>
              <p className="text-[10px] text-neutral-600">/ {foodLog.goals?.fat}g</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Net Carbs</p>
              <p className="font-mono font-bold text-xl text-neon-green">
                {Math.round(foodLog.totals?.net_carbs || 0)}g
              </p>
              <p className="text-[10px] text-neutral-600">keto</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Panel - Search & Analysis */}
        <div className="space-y-4">
          {/* Search Tabs */}
          <div className="glass-card p-4">
            <Tabs defaultValue="search" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-neutral-900/50">
                <TabsTrigger value="search" className="data-[state=active]:bg-neon-cyan/20 data-[state=active]:text-neon-cyan">
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </TabsTrigger>
                <TabsTrigger value="barcode" className="data-[state=active]:bg-neon-cyan/20 data-[state=active]:text-neon-cyan">
                  <ScanBarcode className="w-4 h-4 mr-2" />
                  Barcode
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="search" className="mt-4">
                <form onSubmit={searchFoods} className="space-y-3">
                  <Input
                    placeholder="Search foods (e.g., chicken breast, apple, rice)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-scientific"
                    data-testid="food-search-input"
                  />
                  <Button type="submit" className="btn-primary w-full" disabled={searching}>
                    {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search USDA Database'}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="barcode" className="mt-4">
                <form onSubmit={searchByBarcode} className="space-y-3">
                  <Input
                    placeholder="Enter barcode number"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="input-scientific"
                    data-testid="barcode-input"
                  />
                  <Button type="submit" className="btn-primary w-full" disabled={searching}>
                    {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Look Up Product'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {/* Search Results */}
            {searchResults.length > 0 && !selectedFood && (
              <div className="mt-4">
                <p className="text-xs text-neutral-500 mb-2">{searchResults.length} results</p>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {searchResults.map((food, i) => (
                      <div
                        key={food.fdc_id || i}
                        onClick={() => selectFood(food)}
                        className="p-3 rounded-lg bg-black/30 border border-white/5 cursor-pointer hover:border-neon-cyan/50 hover:bg-neon-cyan/5 transition-colors"
                        data-testid={`search-result-${i}`}
                      >
                        <p className="text-sm font-medium truncate">{food.description}</p>
                        <div className="flex gap-3 mt-1 text-xs text-neutral-500 font-mono">
                          {food.nutrients?.calories && <span>{Math.round(food.nutrients.calories.amount)} cal</span>}
                          {food.nutrients?.protein && <span>P: {Math.round(food.nutrients.protein.amount)}g</span>}
                          {food.nutrients?.carbohydrates && <span>C: {Math.round(food.nutrients.carbohydrates.amount)}g</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Selected Food Analysis */}
          {selectedFood && (
            <div className="space-y-4">
              {/* Food Header */}
              <div className="glass-card p-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h2 className="font-chivo font-bold text-lg">{foodDetails?.description || selectedFood.description}</h2>
                    <p className="text-xs text-neutral-500 mt-1">per 100g • USDA FoodData Central</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={clearSelection} className="text-neutral-500 hover:text-white">
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                {loadingDetails ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-neon-cyan" />
                  </div>
                ) : foodDetails && (
                  <>
                    {/* Macros */}
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      <div className="p-3 rounded-lg bg-neon-gold/10 border border-neon-gold/20 text-center">
                        <p className="text-[10px] text-neutral-400">Calories</p>
                        <p className="font-mono font-bold text-neon-gold">
                          {Math.round((foodDetails.macros?.protein || 0) * 4 + (foodDetails.macros?.carbohydrates || 0) * 4 + (foodDetails.macros?.fat || 0) * 9)}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-neon-cyan/10 border border-neon-cyan/20 text-center">
                        <p className="text-[10px] text-neutral-400">Protein</p>
                        <p className="font-mono font-bold text-neon-cyan">{Math.round(foodDetails.macros?.protein || 0)}g</p>
                      </div>
                      <div className="p-3 rounded-lg bg-neon-gold/10 border border-neon-gold/20 text-center">
                        <p className="text-[10px] text-neutral-400">Carbs</p>
                        <p className="font-mono font-bold text-neon-gold">{Math.round(foodDetails.macros?.carbohydrates || 0)}g</p>
                      </div>
                      <div className="p-3 rounded-lg bg-neon-purple/10 border border-neon-purple/20 text-center">
                        <p className="text-[10px] text-neutral-400">Fat</p>
                        <p className="font-mono font-bold text-neon-purple">{Math.round(foodDetails.macros?.fat || 0)}g</p>
                      </div>
                    </div>

                    {/* Add to Log Controls */}
                    <div className="p-4 rounded-lg bg-neon-cyan/5 border border-neon-cyan/20">
                      <h3 className="font-chivo font-bold text-sm mb-3 flex items-center gap-2">
                        <Plus className="w-4 h-4 text-neon-cyan" />
                        Add to Food Log
                      </h3>
                      
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="text-xs text-neutral-500 mb-1 block">Amount (g)</label>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAmount(Math.max(10, amount - 10))}>
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Input
                              type="number"
                              value={amount}
                              onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                              className="input-scientific h-8 text-center"
                            />
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAmount(amount + 10)}>
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-neutral-500 mb-1 block">Meal</label>
                          <Select value={selectedMealType} onValueChange={setSelectedMealType}>
                            <SelectTrigger className="input-scientific h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {MEAL_TYPES.map(meal => (
                                <SelectItem key={meal.value} value={meal.value}>{meal.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Scaled Values Preview */}
                      <div className="flex items-center justify-between p-2 rounded bg-black/30 mb-3 text-xs font-mono">
                        <span className="text-neutral-400">For {amount}g:</span>
                        <div className="flex gap-3">
                          <span className="text-neon-gold">{Math.round(((foodDetails.macros?.protein || 0) * 4 + (foodDetails.macros?.carbohydrates || 0) * 4 + (foodDetails.macros?.fat || 0) * 9) * amount / 100)} cal</span>
                          <span className="text-neon-cyan">P: {Math.round((foodDetails.macros?.protein || 0) * amount / 100)}g</span>
                          <span className="text-neon-purple">F: {Math.round((foodDetails.macros?.fat || 0) * amount / 100)}g</span>
                        </div>
                      </div>

                      <Button onClick={addToFoodLog} className="btn-primary w-full" disabled={addingToLog} data-testid="add-to-log-btn">
                        {addingToLog ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Add to {selectedMealType.charAt(0).toUpperCase() + selectedMealType.slice(1)}
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {/* Elemental Composition */}
              {foodDetails?.elemental_composition && (
                <ElementalDisplay composition={foodDetails.elemental_composition} />
              )}

              {/* Allergens */}
              {foodDetails?.allergens && foodDetails.allergens.length > 0 && (
                <AllergenBadges allergens={foodDetails.allergens} />
              )}

              {/* Safe Temperature */}
              {foodDetails?.safe_temperature && (
                <SafeTemperatureCard temperature={foodDetails.safe_temperature} />
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Today's Log */}
        <div className="space-y-4">
          <h2 className="font-chivo font-bold text-lg flex items-center gap-2">
            <Utensils className="w-5 h-5 text-neon-gold" />
            Today's Food Log
          </h2>

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
                  <p className="text-sm text-neutral-500 text-center py-3">
                    No items logged
                  </p>
                ) : (
                  <div className="space-y-2">
                    {entries.map((entry, i) => (
                      <div 
                        key={entry.entry_id || i}
                        className="flex items-center justify-between p-2 rounded bg-black/20 group"
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
                          className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-neon-red h-8 w-8"
                          onClick={() => deleteEntry(entry.entry_id)}
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

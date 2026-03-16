import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, API } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  Atom, Search, ScanBarcode, X, Plus, Minus, LogOut, 
  BookOpen, Thermometer, ShieldAlert, Beaker, FlaskConical,
  Flame, Droplets, Wind, ChefHat, Loader2, Info, Save
} from 'lucide-react';
import ElementalDisplay from '@/components/ElementalDisplay';
import NutrientList from '@/components/NutrientList';
import AllergenBadges from '@/components/AllergenBadges';
import CookingMethodSelector from '@/components/CookingMethodSelector';
import SafeTemperatureCard from '@/components/SafeTemperatureCard';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [cookingMethod, setCookingMethod] = useState('raw');
  const [servings, setServings] = useState(1);
  const [barcodeMode, setBarcodeMode] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [recipeName, setRecipeName] = useState('');
  const [savingRecipe, setSavingRecipe] = useState(false);

  // Search foods
  const handleSearch = async (e) => {
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
      } else {
        toast.error('Search failed');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search foods');
    } finally {
      setSearching(false);
    }
  };

  // Search by barcode
  const handleBarcodeSearch = async (e) => {
    e?.preventDefault();
    if (!barcode.trim()) return;
    
    setSearching(true);
    try {
      const response = await fetch(`${API}/foods/barcode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ barcode: barcode.trim() })
      });
      
      if (response.ok) {
        const data = await response.json();
        // Add directly to ingredients
        const ingredient = {
          fdc_id: null,
          name: data.name || `Product ${barcode}`,
          amount: 100,
          unit: 'g',
          barcode: data.barcode,
          nutrients: data.nutrients,
          macros: data.macros,
          allergens: data.allergens,
          source: 'Open Food Facts'
        };
        setSelectedIngredients(prev => [...prev, ingredient]);
        toast.success(`Added: ${ingredient.name}`);
        setBarcode('');
        setBarcodeMode(false);
      } else {
        toast.error('Product not found');
      }
    } catch (error) {
      console.error('Barcode search error:', error);
      toast.error('Failed to find product');
    } finally {
      setSearching(false);
    }
  };

  // Add ingredient
  const addIngredient = (food) => {
    const ingredient = {
      fdc_id: food.fdc_id,
      name: food.description,
      amount: 100,
      unit: 'g',
      nutrients: food.nutrients,
      source: food.source
    };
    setSelectedIngredients(prev => [...prev, ingredient]);
    setSearchResults([]);
    setSearchQuery('');
    toast.success(`Added: ${ingredient.name}`);
  };

  // Remove ingredient
  const removeIngredient = (index) => {
    setSelectedIngredients(prev => prev.filter((_, i) => i !== index));
  };

  // Update ingredient amount
  const updateIngredientAmount = (index, amount) => {
    setSelectedIngredients(prev => prev.map((ing, i) => 
      i === index ? { ...ing, amount: Math.max(1, amount) } : ing
    ));
  };

  // Analyze recipe
  const analyzeRecipe = async () => {
    if (selectedIngredients.length === 0) {
      toast.error('Add at least one ingredient');
      return;
    }
    
    setAnalyzing(true);
    try {
      const response = await fetch(`${API}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ingredients: selectedIngredients.map(ing => ({
            fdc_id: ing.fdc_id,
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit
          })),
          cooking_method: cookingMethod,
          servings: servings
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnalysisResult(data);
        toast.success('Analysis complete!');
      } else {
        toast.error('Analysis failed');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze recipe');
    } finally {
      setAnalyzing(false);
    }
  };

  // Save recipe
  const saveRecipe = async () => {
    if (!recipeName.trim()) {
      toast.error('Enter a recipe name');
      return;
    }
    
    setSavingRecipe(true);
    try {
      const response = await fetch(`${API}/recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: recipeName,
          ingredients: selectedIngredients,
          cooking_method: cookingMethod,
          servings: servings
        })
      });
      
      if (response.ok) {
        toast.success('Recipe saved!');
        setRecipeName('');
      } else {
        toast.error('Failed to save recipe');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save recipe');
    } finally {
      setSavingRecipe(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-primary grid-pattern">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background-primary/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 rounded-lg bg-neon-cyan/20 flex items-center justify-center">
              <Atom className="w-6 h-6 text-neon-cyan" strokeWidth={1.5} />
            </div>
            <span className="font-chivo font-bold text-xl tracking-tight">
              ELEMENT<span className="text-neon-cyan">EATS</span>
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              className="btn-ghost flex items-center gap-2"
              onClick={() => navigate('/recipes')}
              data-testid="nav-recipes-btn"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Saved Recipes</span>
            </Button>
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-neutral-900/50 border border-white/10">
              {user?.picture && (
                <img src={user.picture} alt="" className="w-6 h-6 rounded-full" />
              )}
              <span className="text-sm text-neutral-300 hidden sm:inline">{user?.name}</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={logout}
              className="text-neutral-400 hover:text-white"
              data-testid="logout-btn"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Panel - Input */}
          <div className="lg:col-span-1 space-y-6">
            {/* Search Section */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-chivo font-bold text-lg flex items-center gap-2">
                  <Search className="w-5 h-5 text-neon-cyan" />
                  {barcodeMode ? 'Scan Barcode' : 'Search Foods'}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBarcodeMode(!barcodeMode)}
                  className="text-neutral-400 hover:text-neon-cyan"
                  data-testid="toggle-barcode-btn"
                >
                  {barcodeMode ? <Search className="w-4 h-4" /> : <ScanBarcode className="w-4 h-4" />}
                </Button>
              </div>

              {barcodeMode ? (
                <form onSubmit={handleBarcodeSearch} className="space-y-4">
                  <Input
                    type="text"
                    placeholder="Enter barcode number..."
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="input-scientific"
                    data-testid="barcode-input"
                  />
                  <Button 
                    type="submit" 
                    className="btn-primary w-full"
                    disabled={searching}
                    data-testid="barcode-search-btn"
                  >
                    {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Look Up Product'}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleSearch} className="space-y-4">
                  <Input
                    type="text"
                    placeholder="Search ingredients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-scientific"
                    data-testid="search-input"
                  />
                  <Button 
                    type="submit" 
                    className="btn-primary w-full"
                    disabled={searching}
                    data-testid="search-btn"
                  >
                    {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search USDA Database'}
                  </Button>
                </form>
              )}

              {/* Search Results */}
              {searchResults.length > 0 && (
                <ScrollArea className="mt-4 h-64">
                  <div className="space-y-2">
                    {searchResults.map((food, i) => (
                      <div
                        key={food.fdc_id || i}
                        onClick={() => addIngredient(food)}
                        className="p-3 rounded-lg bg-black/30 border border-white/5 cursor-pointer hover:border-neon-cyan/50 hover:bg-neon-cyan/5 transition-colors"
                        data-testid={`search-result-${i}`}
                      >
                        <p className="text-sm font-medium truncate">{food.description}</p>
                        <div className="flex gap-4 mt-1 text-xs text-neutral-500 font-mono">
                          {food.nutrients?.protein && (
                            <span>P: {food.nutrients.protein.amount}g</span>
                          )}
                          {food.nutrients?.carbohydrates && (
                            <span>C: {food.nutrients.carbohydrates.amount}g</span>
                          )}
                          {food.nutrients?.fat && (
                            <span>F: {food.nutrients.fat.amount}g</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Selected Ingredients */}
            <div className="glass-card p-6">
              <h2 className="font-chivo font-bold text-lg flex items-center gap-2 mb-4">
                <FlaskConical className="w-5 h-5 text-neon-purple" />
                Ingredients ({selectedIngredients.length})
              </h2>

              {selectedIngredients.length === 0 ? (
                <p className="text-neutral-500 text-sm text-center py-8">
                  Search and add ingredients to analyze
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedIngredients.map((ing, i) => (
                    <div 
                      key={i} 
                      className="p-3 rounded-lg bg-black/30 border border-white/5"
                      data-testid={`ingredient-${i}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-medium flex-1">{ing.name}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-neutral-500 hover:text-neon-red"
                          onClick={() => removeIngredient(i)}
                          data-testid={`remove-ingredient-${i}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateIngredientAmount(i, ing.amount - 10)}
                          data-testid={`decrease-amount-${i}`}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <Input
                          type="number"
                          value={ing.amount}
                          onChange={(e) => updateIngredientAmount(i, parseInt(e.target.value) || 0)}
                          className="w-20 h-8 text-center input-scientific text-sm"
                          data-testid={`amount-input-${i}`}
                        />
                        <span className="text-xs text-neutral-500">{ing.unit}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateIngredientAmount(i, ing.amount + 10)}
                          data-testid={`increase-amount-${i}`}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cooking Method */}
            <CookingMethodSelector 
              selectedMethod={cookingMethod}
              onMethodChange={setCookingMethod}
            />

            {/* Servings & Analyze */}
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm text-neutral-400">Servings</label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setServings(Math.max(1, servings - 1))}
                    data-testid="decrease-servings"
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="font-mono text-lg w-8 text-center">{servings}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setServings(servings + 1)}
                    data-testid="increase-servings"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              
              <Button
                onClick={analyzeRecipe}
                disabled={selectedIngredients.length === 0 || analyzing}
                className="btn-primary w-full"
                data-testid="analyze-btn"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Beaker className="w-4 h-4 mr-2" />
                    Analyze Recipe
                  </>
                )}
              </Button>
            </div>

            {/* Save Recipe */}
            {selectedIngredients.length > 0 && (
              <div className="glass-card p-6 space-y-4">
                <Input
                  type="text"
                  placeholder="Recipe name..."
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  className="input-scientific"
                  data-testid="recipe-name-input"
                />
                <Button
                  onClick={saveRecipe}
                  disabled={!recipeName.trim() || savingRecipe}
                  className="btn-secondary w-full"
                  data-testid="save-recipe-btn"
                >
                  {savingRecipe ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Recipe
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Right Panel - Results */}
          <div className="lg:col-span-2 space-y-6">
            {!analysisResult ? (
              <div className="glass-card p-12 flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-20 h-20 rounded-full bg-neon-cyan/10 flex items-center justify-center mb-6">
                  <Atom className="w-10 h-10 text-neon-cyan/50" />
                </div>
                <h3 className="font-chivo font-bold text-xl text-neutral-400 mb-2">
                  No Analysis Yet
                </h3>
                <p className="text-neutral-500 text-center max-w-md">
                  Add ingredients and click "Analyze Recipe" to see elemental composition, 
                  nutrients, allergens, and cooking recommendations.
                </p>
              </div>
            ) : (
              <div className="space-y-6 stagger-fade-in">
                {/* Macros Summary */}
                <div className="glass-card p-6">
                  <h2 className="font-chivo font-bold text-lg mb-4 flex items-center gap-2">
                    <Beaker className="w-5 h-5 text-neon-green" />
                    Macronutrients (per serving)
                  </h2>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-neon-cyan/10 border border-neon-cyan/20">
                      <p className="text-xs text-neutral-400 mb-1">Protein</p>
                      <p className="text-2xl font-mono font-bold text-neon-cyan">
                        {analysisResult.per_serving_macros.protein.toFixed(1)}g
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-neon-gold/10 border border-neon-gold/20">
                      <p className="text-xs text-neutral-400 mb-1">Carbs</p>
                      <p className="text-2xl font-mono font-bold text-neon-gold">
                        {analysisResult.per_serving_macros.carbohydrates.toFixed(1)}g
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-neon-purple/10 border border-neon-purple/20">
                      <p className="text-xs text-neutral-400 mb-1">Fat</p>
                      <p className="text-2xl font-mono font-bold text-neon-purple">
                        {analysisResult.per_serving_macros.fat.toFixed(1)}g
                      </p>
                    </div>
                  </div>
                </div>

                {/* Elemental Composition */}
                <ElementalDisplay composition={analysisResult.elemental_composition} />

                {/* Allergens */}
                {analysisResult.allergens && analysisResult.allergens.length > 0 && (
                  <AllergenBadges allergens={analysisResult.allergens} />
                )}

                {/* Safe Temperature */}
                {analysisResult.safe_temperature && (
                  <SafeTemperatureCard temperature={analysisResult.safe_temperature} />
                )}

                {/* Nutrient Retention */}
                {cookingMethod !== 'raw' && (
                  <div className="glass-card p-6">
                    <h2 className="font-chivo font-bold text-lg mb-4 flex items-center gap-2">
                      <Flame className="w-5 h-5 text-neon-gold" />
                      Nutrient Retention ({cookingMethod})
                    </h2>
                    <div className="space-y-3">
                      {analysisResult.nutrients_cooked
                        .filter(n => n.retention_factor < 1)
                        .slice(0, 8)
                        .map((nutrient, i) => (
                          <div key={i} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-neutral-400">{nutrient.name}</span>
                              <span className="font-mono">
                                {(nutrient.retention_factor * 100).toFixed(0)}% retained
                              </span>
                            </div>
                            <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                              <div 
                                className="retention-bar bg-neon-cyan"
                                style={{ width: `${nutrient.retention_factor * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Cooking Recommendations */}
                {analysisResult.cooking_recommendations && (
                  <div className="glass-card p-6">
                    <h2 className="font-chivo font-bold text-lg mb-4 flex items-center gap-2">
                      <ChefHat className="w-5 h-5 text-neon-green" />
                      Cooking Recommendations
                    </h2>
                    <div className="space-y-4">
                      {analysisResult.cooking_recommendations.best_methods_for_nutrients?.length > 0 && (
                        <div>
                          <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">
                            Nutrient Tips
                          </p>
                          <ul className="space-y-2">
                            {analysisResult.cooking_recommendations.best_methods_for_nutrients.map((tip, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-neutral-300">
                                <Info className="w-4 h-4 text-neon-cyan shrink-0 mt-0.5" />
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Full Nutrient List */}
                <NutrientList 
                  nutrients={analysisResult.nutrients_cooked} 
                  cooking_method={cookingMethod}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

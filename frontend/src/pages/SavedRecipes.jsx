import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, API } from '@/App';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Atom, BookOpen, Trash2, ArrowLeft, Loader2, ChefHat, Users } from 'lucide-react';

export default function SavedRecipes() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    fetchRecipes();
  }, []);

  const fetchRecipes = async () => {
    try {
      const response = await fetch(`${API}/recipes`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setRecipes(data.recipes || []);
      }
    } catch (error) {
      console.error('Failed to fetch recipes:', error);
      toast.error('Failed to load recipes');
    } finally {
      setLoading(false);
    }
  };

  const deleteRecipe = async (recipeId) => {
    setDeleting(recipeId);
    try {
      const response = await fetch(`${API}/recipes/${recipeId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (response.ok) {
        setRecipes(prev => prev.filter(r => r.recipe_id !== recipeId));
        toast.success('Recipe deleted');
      } else {
        toast.error('Failed to delete recipe');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete recipe');
    } finally {
      setDeleting(null);
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
              onClick={() => navigate('/dashboard')}
              data-testid="back-to-dashboard-btn"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Analyzer
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <BookOpen className="w-8 h-8 text-neon-purple" />
          <h1 className="font-chivo font-bold text-2xl">Saved Recipes</h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-neon-cyan" />
          </div>
        ) : recipes.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-neon-purple/10 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-neon-purple/50" />
            </div>
            <h3 className="font-chivo font-bold text-xl text-neutral-400 mb-2">
              No Saved Recipes
            </h3>
            <p className="text-neutral-500 mb-6">
              Analyze a recipe and save it to access it here later.
            </p>
            <Button 
              onClick={() => navigate('/dashboard')}
              className="btn-primary"
              data-testid="create-recipe-btn"
            >
              Create Your First Recipe
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 stagger-fade-in">
            {recipes.map((recipe, i) => (
              <div 
                key={recipe.recipe_id}
                className="glass-card glass-card-hover p-6"
                data-testid={`recipe-card-${i}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-chivo font-bold text-lg mb-2">{recipe.name}</h3>
                    <div className="flex flex-wrap gap-4 text-sm text-neutral-400">
                      <span className="flex items-center gap-1">
                        <ChefHat className="w-4 h-4" />
                        {recipe.cooking_method}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {recipe.servings} servings
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {recipe.ingredients?.slice(0, 4).map((ing, j) => (
                        <span 
                          key={j}
                          className="px-2 py-1 text-xs rounded bg-neutral-800 text-neutral-300"
                        >
                          {ing.name?.substring(0, 30)}
                          {ing.name?.length > 30 && '...'}
                        </span>
                      ))}
                      {recipe.ingredients?.length > 4 && (
                        <span className="px-2 py-1 text-xs rounded bg-neutral-800 text-neutral-500">
                          +{recipe.ingredients.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-neutral-500 hover:text-neon-red"
                    onClick={() => deleteRecipe(recipe.recipe_id)}
                    disabled={deleting === recipe.recipe_id}
                    data-testid={`delete-recipe-${i}`}
                  >
                    {deleting === recipe.recipe_id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

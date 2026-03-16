import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/App';
import { 
  Atom, Home, Utensils, Dumbbell, TrendingUp, Target, 
  Calendar, BookOpen, LogOut, Droplets, Footprints
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/health', label: 'Dashboard', icon: Home },
  { path: '/food-log', label: 'Food Log', icon: Utensils },
  { path: '/workouts', label: 'Workouts', icon: Dumbbell },
  { path: '/progress', label: 'Progress', icon: TrendingUp },
  { path: '/goals', label: 'Goals', icon: Target },
  { path: '/meal-planner', label: 'Meal Plan', icon: Calendar },
  { path: '/dashboard', label: 'Food Analyzer', icon: Atom },
  { path: '/recipes', label: 'Recipes', icon: BookOpen },
];

export const AppLayout = ({ children, title }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background-primary grid-pattern">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-background-primary/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-9 h-9 rounded-lg bg-neon-cyan/20 flex items-center justify-center">
              <Atom className="w-5 h-5 text-neon-cyan" strokeWidth={1.5} />
            </div>
            <span className="font-chivo font-bold text-lg tracking-tight hidden sm:block">
              ELEMENT<span className="text-neon-cyan">EATS</span>
            </span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                  location.pathname === item.path 
                    ? 'bg-neon-cyan/10 text-neon-cyan' 
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {user?.picture && (
              <img src={user.picture} alt="" className="w-8 h-8 rounded-full" />
            )}
            <button
              onClick={logout}
              className="p-2 text-neutral-400 hover:text-white"
              data-testid="logout-btn"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        <nav className="lg:hidden flex items-center gap-1 px-4 pb-3 overflow-x-auto">
          {NAV_ITEMS.slice(0, 6).map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                location.pathname === item.path 
                  ? 'bg-neon-cyan/10 text-neon-cyan' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <item.icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Page Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {title && (
          <h1 className="font-chivo font-bold text-2xl sm:text-3xl mb-6">{title}</h1>
        )}
        {children}
      </main>
    </div>
  );
};

export default AppLayout;

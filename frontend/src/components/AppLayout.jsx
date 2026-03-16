import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/App';
import { 
  Atom, Home, Utensils, Dumbbell, TrendingUp, Target, 
  Calendar, BookOpen, LogOut, Clock
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/health', label: 'Dashboard', icon: Home, color: 'neon-cyan' },
  { path: '/food-log', label: 'Food & Analysis', icon: Utensils, color: 'neon-gold' },
  { path: '/routines', label: 'Routines', icon: Clock, color: 'neon-purple' },
  { path: '/workouts', label: 'Workouts', icon: Dumbbell, color: 'neon-green' },
  { path: '/progress', label: 'Progress', icon: TrendingUp, color: 'neon-cyan' },
  { path: '/goals', label: 'Goals', icon: Target, color: 'neon-red' },
  { path: '/meal-planner', label: 'Meal Plan', icon: Calendar, color: 'neon-gold' },
];

export const AppLayout = ({ children, title }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background-primary grid-pattern">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-background-primary/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
              <div className="w-9 h-9 rounded-lg bg-neon-cyan/20 flex items-center justify-center">
                <Atom className="w-5 h-5 text-neon-cyan" strokeWidth={1.5} />
              </div>
              <span className="font-chivo font-bold text-lg tracking-tight hidden sm:block">
                ELEMENT<span className="text-neon-cyan">EATS</span>
              </span>
            </div>

            <div className="flex items-center gap-3">
              {user?.picture && (
                <img src={user.picture} alt="" className="w-8 h-8 rounded-full border border-white/20" />
              )}
              {user?.name && (
                <span className="text-sm text-neutral-300 hidden sm:block">{user.name.split(' ')[0]}</span>
              )}
              <button
                onClick={logout}
                className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10"
                data-testid="logout-btn"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Desktop Nav - Full Width Bar */}
          <nav className="hidden lg:flex items-center justify-center gap-1 mt-3 p-1 bg-neutral-900/50 rounded-xl border border-white/5">
            {NAV_ITEMS.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
                    isActive 
                      ? 'bg-neon-cyan/20 text-neon-cyan shadow-neon-cyan' 
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                  data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                >
                  <item.icon className={`w-4 h-4 ${isActive ? 'text-neon-cyan' : ''}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Mobile Nav - Scrollable */}
        <nav className="lg:hidden flex items-center gap-1 px-4 pb-3 overflow-x-auto scrollbar-hide">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  isActive 
                    ? 'bg-neon-cyan/20 text-neon-cyan' 
                    : 'text-neutral-400 hover:text-white bg-neutral-900/30'
                }`}
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
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

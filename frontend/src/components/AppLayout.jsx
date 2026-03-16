import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/App';
import {
  Atom, Home, Utensils, Dumbbell, TrendingUp, Target,
  Calendar, LogOut, Clock, BarChart3
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

// Bottom tab items for mobile - subset of most important tabs
const MOBILE_TABS = [
  { path: '/health', label: 'Home', icon: Home },
  { path: '/food-log', label: 'Food', icon: Utensils },
  { path: '/routines', label: 'Routines', icon: Clock },
  { path: '/workouts', label: 'Workouts', icon: Dumbbell },
  { path: '/progress', label: 'Progress', icon: BarChart3 },
];

export const AppLayout = ({ children, title }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background-primary grid-pattern">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-background-primary/95 backdrop-blur-md border-b border-white/10 safe-top">
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
                className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 active:scale-95 transition-transform"
                data-testid="logout-btn"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Desktop Nav - Full Width Bar (hidden on mobile, replaced by bottom tabs) */}
          <nav className="hidden lg:flex items-center justify-center gap-1 mt-3 p-1 bg-neutral-900/50 rounded-xl border border-white/5">
            {NAV_ITEMS.map(item => {
              const isActive = location.pathname === item.path ||
                (item.path === '/routines' && location.pathname.startsWith('/routines'));
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
                    isActive
                      ? 'bg-neon-cyan/20 text-neon-cyan shadow-neon-cyan'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                  data-testid={`nav-${item.label.toLowerCase().replace(/[ &]/g, '-')}`}
                >
                  <item.icon className={`w-4 h-4 ${isActive ? 'text-neon-cyan' : ''}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Page Content - add bottom padding on mobile for bottom nav */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 lg:pb-6">
        {title && (
          <h1 className="font-chivo font-bold text-2xl sm:text-3xl mb-6">{title}</h1>
        )}
        {children}
      </main>

      {/* Mobile Bottom Tab Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background-primary/95 backdrop-blur-xl border-t border-white/10 safe-bottom" data-testid="mobile-bottom-nav">
        <div className="flex items-center justify-around px-2 py-1">
          {MOBILE_TABS.map(item => {
            const isActive = location.pathname === item.path ||
              (item.path === '/routines' && location.pathname.startsWith('/routines'));
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl min-w-[60px] transition-all active:scale-90 ${
                  isActive ? 'text-neon-cyan' : 'text-neutral-500'
                }`}
                data-testid={`mobile-tab-${item.label.toLowerCase()}`}
              >
                <div className={`relative ${isActive ? '' : ''}`}>
                  <item.icon className={`w-5 h-5 transition-all ${isActive ? 'text-neon-cyan' : ''}`} />
                  {isActive && (
                    <div className="absolute -inset-2 bg-neon-cyan/10 rounded-xl -z-10" />
                  )}
                </div>
                <span className={`text-[10px] font-medium leading-tight ${isActive ? 'text-neon-cyan' : ''}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default AppLayout;

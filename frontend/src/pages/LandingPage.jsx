import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { 
  Atom, Beaker, ShieldAlert, Thermometer, Search, ScanBarcode, ChevronRight,
  Flame, Droplets, Dumbbell, TrendingUp, Target, Calendar
} from 'lucide-react';

export default function LandingPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const handleGetStarted = () => {
    if (user) {
      navigate('/health');
    } else {
      login();
    }
  };

  const handleFoodAnalyzer = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      login();
    }
  };

  const features = [
    {
      icon: Atom,
      title: 'Elemental Breakdown',
      description: 'Decompose any food into its periodic elements: Carbon, Hydrogen, Oxygen, Nitrogen, and minerals.',
      color: 'neon-cyan'
    },
    {
      icon: Beaker,
      title: 'Nutrient Analysis',
      description: 'Detailed vitamin and mineral mapping from USDA FoodData Central database.',
      color: 'neon-purple'
    },
    {
      icon: ShieldAlert,
      title: 'Allergen Detection',
      description: 'Automatically flag the top 14 allergens including nuts, dairy, gluten, and more.',
      color: 'neon-red'
    },
    {
      icon: Thermometer,
      title: 'Cooking Optimization',
      description: 'Get safe temperatures and nutrient retention factors for different cooking methods.',
      color: 'neon-gold'
    }
  ];

  const healthFeatures = [
    {
      icon: Flame,
      title: 'Calorie & Macro Tracking',
      description: 'Log meals, track calories, protein, carbs, and fat with net carbs mode for keto.',
      color: 'neon-gold'
    },
    {
      icon: Droplets,
      title: 'Water Tracker',
      description: 'Stay hydrated with daily water intake goals and quick logging.',
      color: 'neon-cyan'
    },
    {
      icon: Dumbbell,
      title: 'Workout Logging',
      description: 'Track exercises, duration, and calories burned for all workout types.',
      color: 'neon-purple'
    },
    {
      icon: TrendingUp,
      title: 'Progress Charts',
      description: 'Visualize your journey with weight trends, macro breakdowns, and analytics.',
      color: 'neon-green'
    },
    {
      icon: Target,
      title: 'Custom Goals',
      description: 'Set personalized targets for weight loss, gain, maintenance, or muscle building.',
      color: 'neon-red'
    },
    {
      icon: Calendar,
      title: 'Meal Planner',
      description: 'Plan your weekly meals in advance with an easy-to-use grid interface.',
      color: 'neon-cyan'
    }
  ];

  const elements = [
    { symbol: 'C', name: 'Carbon', number: 6, color: 'periodic-nonmetal' },
    { symbol: 'H', name: 'Hydrogen', number: 1, color: 'periodic-nonmetal' },
    { symbol: 'O', name: 'Oxygen', number: 8, color: 'periodic-nonmetal' },
    { symbol: 'N', name: 'Nitrogen', number: 7, color: 'periodic-nonmetal' },
    { symbol: 'Ca', name: 'Calcium', number: 20, color: 'periodic-alkaline' },
    { symbol: 'Fe', name: 'Iron', number: 26, color: 'periodic-transition' },
  ];

  return (
    <div className="min-h-screen bg-background-primary grid-pattern">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background-primary/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-neon-cyan/20 flex items-center justify-center">
              <Atom className="w-6 h-6 text-neon-cyan" strokeWidth={1.5} />
            </div>
            <span className="font-chivo font-bold text-xl tracking-tight">
              ELEMENT<span className="text-neon-cyan">EATS</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Button 
                  variant="ghost"
                  onClick={() => navigate('/health')}
                  className="btn-ghost hidden sm:flex"
                  data-testid="nav-health-btn"
                >
                  Health Dashboard
                </Button>
                <Button 
                  onClick={() => navigate('/dashboard')}
                  className="btn-primary"
                  data-testid="nav-dashboard-btn"
                >
                  Food Analyzer
                </Button>
              </>
            ) : (
              <Button 
                onClick={login}
                className="btn-primary"
                data-testid="nav-login-btn"
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neon-cyan/10 border border-neon-cyan/20">
                <Beaker className="w-4 h-4 text-neon-cyan" />
                <span className="text-sm font-mono text-neon-cyan">FOOD SCIENCE + FITNESS</span>
              </div>
              
              <h1 className="font-chivo font-black text-5xl sm:text-6xl lg:text-7xl leading-tight">
                Track, Analyze
                <span className="block text-neon-cyan neon-text-cyan">& Transform</span>
              </h1>
              
              <p className="text-lg text-neutral-400 max-w-lg">
                Complete health platform: track calories & macros, log workouts, monitor hydration, 
                and analyze food at the molecular level. Your fitness journey, scientifically optimized.
              </p>
              
              <div className="flex flex-wrap gap-4">
                <Button 
                  onClick={handleGetStarted}
                  className="btn-primary flex items-center gap-2 text-lg"
                  data-testid="hero-get-started-btn"
                >
                  <Flame className="w-5 h-5" />
                  Start Tracking
                  <ChevronRight className="w-5 h-5" />
                </Button>
                <Button 
                  variant="outline"
                  className="btn-secondary flex items-center gap-2 text-lg"
                  data-testid="hero-analyzer-btn"
                  onClick={handleFoodAnalyzer}
                >
                  <Atom className="w-5 h-5" />
                  Food Analyzer
                </Button>
              </div>

              {/* Data Sources */}
              <div className="pt-8 border-t border-white/10">
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-4">Powered by</p>
                <div className="flex flex-wrap gap-6">
                  <span className="text-sm text-neutral-400 font-mono">USDA FoodData Central</span>
                  <span className="text-sm text-neutral-400 font-mono">Open Food Facts</span>
                  <span className="text-sm text-neutral-400 font-mono">FAO/INFOODS</span>
                </div>
              </div>
            </div>

            {/* Right - Periodic Table Preview */}
            <div className="relative">
              <div className="absolute inset-0 bg-neon-cyan/5 blur-3xl rounded-full" />
              <div className="relative glass-card p-8">
                <div className="grid grid-cols-3 gap-3 stagger-fade-in">
                  {elements.map((el, i) => (
                    <div 
                      key={el.symbol}
                      className="element-tile rounded-lg p-4"
                      style={{ animationDelay: `${i * 0.1}s` }}
                    >
                      <span className="text-xs text-neutral-500 font-mono">{el.number}</span>
                      <span className="text-3xl font-chivo font-black text-neon-cyan">{el.symbol}</span>
                      <span className="text-xs text-neutral-400 truncate">{el.name}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 rounded-lg bg-black/50 border border-white/5">
                  <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Sample Output</p>
                  <div className="font-mono text-sm">
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-neutral-400">Carbon (C)</span>
                      <span className="text-neon-cyan">50.2g</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-neutral-400">Hydrogen (H)</span>
                      <span className="text-neon-green">7.91g</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-neutral-400">Nitrogen (N)</span>
                      <span className="text-neon-purple">4.8g</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6 bg-background-secondary">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-chivo font-bold text-3xl sm:text-4xl mb-4">
              Scientific Food Analysis
            </h2>
            <p className="text-neutral-400 max-w-2xl mx-auto">
              Go beyond simple calorie counting. Understand your food at the molecular level.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 stagger-fade-in">
            {features.map((feature, i) => (
              <div 
                key={feature.title}
                className="glass-card glass-card-hover p-6 space-y-4"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className={`w-12 h-12 rounded-lg bg-${feature.color}/20 flex items-center justify-center`}>
                  <feature.icon className={`w-6 h-6 text-${feature.color}`} strokeWidth={1.5} />
                </div>
                <h3 className="font-chivo font-bold text-lg">{feature.title}</h3>
                <p className="text-sm text-neutral-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Health & Fitness Features */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neon-gold/10 border border-neon-gold/20 mb-6">
              <Flame className="w-4 h-4 text-neon-gold" />
              <span className="text-sm font-mono text-neon-gold">HEALTH & FITNESS TRACKING</span>
            </div>
            <h2 className="font-chivo font-bold text-3xl sm:text-4xl mb-4">
              Complete Fitness Platform
            </h2>
            <p className="text-neutral-400 max-w-2xl mx-auto">
              Track every aspect of your health journey — from calories and macros to workouts and hydration.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-fade-in">
            {healthFeatures.map((feature, i) => (
              <div 
                key={feature.title}
                className="glass-card glass-card-hover p-6 space-y-4"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className={`w-12 h-12 rounded-lg bg-${feature.color}/20 flex items-center justify-center`}>
                  <feature.icon className={`w-6 h-6 text-${feature.color}`} strokeWidth={1.5} />
                </div>
                <h3 className="font-chivo font-bold text-lg">{feature.title}</h3>
                <p className="text-sm text-neutral-400">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* CTA for Health Dashboard */}
          <div className="mt-12 text-center">
            <Button 
              onClick={handleGetStarted}
              className="btn-primary text-lg px-8"
              data-testid="health-cta-btn"
            >
              <Dumbbell className="w-5 h-5 mr-2" />
              Start Your Health Journey
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-background-secondary">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="font-chivo font-bold text-3xl sm:text-4xl mb-8">
                How It Works
              </h2>
              <div className="space-y-6">
                {[
                  { step: '01', title: 'Input Recipe', desc: 'Search ingredients or scan barcodes for packaged foods' },
                  { step: '02', title: 'Fetch Data', desc: 'We query USDA FoodData Central and Open Food Facts' },
                  { step: '03', title: 'Calculate Elements', desc: 'Convert macros to elemental composition using scientific formulas' },
                  { step: '04', title: 'Get Recommendations', desc: 'See allergens, safe temps, and best cooking methods' }
                ].map((item, i) => (
                  <div key={item.step} className="flex gap-4 items-start">
                    <div className="w-12 h-12 rounded-lg bg-neon-cyan/20 flex items-center justify-center shrink-0">
                      <span className="font-mono font-bold text-neon-cyan">{item.step}</span>
                    </div>
                    <div>
                      <h3 className="font-chivo font-bold text-lg">{item.title}</h3>
                      <p className="text-sm text-neutral-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Formula Preview */}
            <div className="glass-card p-8">
              <h3 className="font-chivo font-bold text-lg mb-6 flex items-center gap-2">
                <Beaker className="w-5 h-5 text-neon-cyan" />
                Elemental Calculation
              </h3>
              <div className="space-y-4 font-mono text-sm">
                <div className="p-4 rounded-lg bg-black/50 border border-white/5">
                  <p className="text-neutral-500 text-xs mb-2">// Protein → Elements</p>
                  <p className="text-neutral-300">
                    C = protein_g × <span className="text-neon-cyan">0.50</span>
                  </p>
                  <p className="text-neutral-300">
                    N = protein_g × <span className="text-neon-purple">0.16</span>
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-black/50 border border-white/5">
                  <p className="text-neutral-500 text-xs mb-2">// Carbs → Elements (CH₂O)</p>
                  <p className="text-neutral-300">
                    C = carbs_g × <span className="text-neon-cyan">0.40</span>
                  </p>
                  <p className="text-neutral-300">
                    O = carbs_g × <span className="text-neon-gold">0.533</span>
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-black/50 border border-white/5">
                  <p className="text-neutral-500 text-xs mb-2">// Fat → Elements</p>
                  <p className="text-neutral-300">
                    C = fat_g × <span className="text-neon-cyan">0.76</span>
                  </p>
                  <p className="text-neutral-300">
                    H = fat_g × <span className="text-neon-green">0.123</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-background-secondary">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-chivo font-bold text-3xl sm:text-4xl mb-6">
            Ready to Analyze Your Food?
          </h2>
          <p className="text-neutral-400 mb-8 max-w-2xl mx-auto">
            Start exploring the elemental composition of your meals. Free, scientific, transparent.
          </p>
          <Button 
            onClick={handleGetStarted}
            className="btn-primary text-lg px-8"
            data-testid="cta-get-started-btn"
          >
            Get Started Free
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neon-cyan/20 flex items-center justify-center">
              <Atom className="w-4 h-4 text-neon-cyan" strokeWidth={1.5} />
            </div>
            <span className="font-chivo font-bold">
              ELEMENT<span className="text-neon-cyan">EATS</span>
            </span>
          </div>
          <div className="flex gap-6 text-sm text-neutral-500">
            <span>Data: USDA FoodData Central</span>
            <span>•</span>
            <span>Open Food Facts</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

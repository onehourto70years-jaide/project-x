/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        chivo: ['Chivo', 'sans-serif'],
        manrope: ['Manrope', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        background: {
          primary: '#050505',
          secondary: '#0A0A0A',
          tertiary: '#121212',
        },
        surface: {
          card: '#171717',
          overlay: 'rgba(23, 23, 23, 0.8)',
        },
        neon: {
          cyan: '#00F0FF',
          purple: '#7000FF',
          green: '#00FF94',
          gold: '#FFD600',
          red: '#FF0033',
        },
        periodic: {
          alkali: '#FF0033',
          alkaline: '#FF6600',
          transition: '#FFD600',
          basic: '#00FF94',
          metalloid: '#00F0FF',
          nonmetal: '#0099FF',
          halogen: '#7000FF',
          noble: '#CC00FF',
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        glow: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulse: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.7 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        glow: 'glow 2s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
        pulse: 'pulse 2s ease-in-out infinite',
      },
      boxShadow: {
        'neon-cyan': '0 0 20px rgba(0, 240, 255, 0.3)',
        'neon-purple': '0 0 20px rgba(112, 0, 255, 0.3)',
        'neon-green': '0 0 20px rgba(0, 255, 148, 0.3)',
        'neon-gold': '0 0 20px rgba(255, 214, 0, 0.3)',
        'neon-red': '0 0 20px rgba(255, 0, 51, 0.3)',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

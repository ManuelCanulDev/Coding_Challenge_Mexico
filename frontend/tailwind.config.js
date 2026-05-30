/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          950: '#06080f',
          900: '#0a0e17',
          850: '#0d1220',
          800: '#111827',
          750: '#151d2e',
          700: '#1a2234',
          600: '#243049',
        },
        brand: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        jade: {
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          950: '#052e16',
        },
        obsidian: {
          900: '#0a0e0c',
        },
        accent: {
          green: '#22c55e',
          red: '#f87171',
          yellow: '#fbbf24',
          blue: '#60a5fa',
          gold: '#d4a853',
        },
      },
      boxShadow: {
        panel: '0 4px 24px -4px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255,255,255,0.04)',
        glow: '0 0 20px -5px rgba(16, 185, 129, 0.35)',
        'glow-red': '0 0 20px -5px rgba(248, 113, 113, 0.3)',
      },
      animation: {
        'pulse-soft': 'pulse-soft 2.5s ease-in-out infinite',
        'fade-in': 'fade-in 0.45s ease-out',
        'live-pulse': 'live-pulse 2s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(34, 197, 94, 0.15)' },
          '50%': { boxShadow: '0 0 0 6px rgba(34, 197, 94, 0)' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'live-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.55', transform: 'scale(0.92)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};

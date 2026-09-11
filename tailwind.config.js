/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Severity
        critical: {
          DEFAULT: '#DC2626',
          light: '#FEE2E2',
          dark: '#991B1B',
        },
        high: {
          DEFAULT: '#EA580C',
          light: '#FFEDD5',
          dark: '#9A3412',
        },
        moderate: {
          DEFAULT: '#CA8A04',
          light: '#FEF9C3',
          dark: '#854D0E',
        },
        low: {
          DEFAULT: '#16A34A',
          light: '#DCFCE7',
          dark: '#14532D',
        },
        // Verification
        corroborated: {
          DEFAULT: '#16A34A',
          light: '#DCFCE7',
        },
        developing: {
          DEFAULT: '#CA8A04',
          light: '#FEF9C3',
        },
        contradicted: {
          DEFAULT: '#DC2626',
          light: '#FEE2E2',
        },
        // Surface
        surface: {
          0: '#FFFFFF',
          1: '#F8FAFC',
          2: '#F1F5F9',
          3: '#E2E8F0',
        },
        // Text
        ink: {
          DEFAULT: '#0F172A',
          secondary: '#475569',
          tertiary: '#94A3B8',
          inverse: '#FFFFFF',
        },
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.07), 0 1px 2px -1px rgba(0,0,0,0.04)',
        panel: '0 4px 16px rgba(0,0,0,0.08)',
        drawer: '-4px 0 24px rgba(0,0,0,0.10)',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-in-right': 'slideInRight 0.2s ease-out',
        'slide-in-up': 'slideInUp 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
}

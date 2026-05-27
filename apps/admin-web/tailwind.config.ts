import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Magenta brand — matches resident/staff mobile apps (#821A52).
        primary: {
          50: '#FBE9F1',
          100: '#F4C7DB',
          200: '#E89BBC',
          300: '#D86F9C',
          400: '#C24E81',
          500: '#821A52',
          600: '#6E1645',
          700: '#581238',
          800: '#420D2A',
          900: '#2C091C',
        },
      },
      fontFamily: {
        // F3: Plus Jakarta Sans via next/font; falls back to the system stack
        // when the variable is unavailable (e.g. early server render).
        sans: ['var(--font-sans)', 'Plus Jakarta Sans', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-up': 'fade-up 0.3s ease-out',
        'slide-in': 'slide-in 0.2s ease-out',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(-6px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;

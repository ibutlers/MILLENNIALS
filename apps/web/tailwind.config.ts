import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#C9A44B',
          accent: '#B8926A',
          hover: '#D9BA66'
        },
        navy: '#0C1524',
        navyLight: '#141E30',
        cream: '#F7F3EC',
        amber: '#C9A44B',
        amberHover: '#D9BA66',
        tan: '#B8926A',
        forest: '#5B9A7C',
        border: '#2A3344',
        muted: '#8F9AA5',
        textLight: '#F0EBE0',
        textDark: '#1A202C',
        warning: '#D4A24E',
        danger: '#C75B5B',

        // Legacy aliases preserved for existing component class references
        carbon: '#0C1524',
        petroleum: '#141E30',
        ivory: '#F7F3EC',
        stone: '#F7F3EC',
        mineral: '#C9A44B',
        mineralHover: '#D9BA66',
        bronze: '#B8926A'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Cormorant Garamond', 'Georgia', 'serif']
      }
    }
  },
  plugins: []
} satisfies Config;

import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#143f3a',
          accent: '#9b5e3c'
        },
        carbon: '#070908',
        ivory: '#f4efe6',
        mineral: '#143f3a',
        copper: '#b66a43',
        stone: '#e7e1d6'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Cormorant Garamond', 'Georgia', 'serif']
      }
    }
  },
  plugins: []
} satisfies Config;

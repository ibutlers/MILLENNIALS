import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        electric: {
          DEFAULT: '#2D50EC',
          hover: '#2142C7',
        },
        lavender: '#F4F4FE',
        ink: '#050505',
        charcoal: '#303038',
        frost: '#E1E4ED',
        surface: '#FFFFFF',
        forest: '#5B9A7C',
        warning: '#D4A24E',
        danger: '#C75B5B',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Cormorant Garamond', 'Georgia', 'serif']
      }
    }
  },
  plugins: []
} satisfies Config;

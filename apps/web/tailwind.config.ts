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
        // Legacy private-area aliases kept intentionally so investor/auth pages
        // that still use the older semantic names render with real CSS classes.
        carbon: '#050505',
        petroleum: '#111522',
        mineral: '#93A4FF',
        mineralHover: '#B7C1FF',
        textLight: '#F4F4FE',
        textDark: '#050505',
        muted: '#AEB4C2',
        border: '#2B2F3A',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Cormorant Garamond', 'Georgia', 'serif']
      }
    }
  },
  plugins: []
} satisfies Config;

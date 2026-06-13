import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#7FA88C',
          accent: '#9A765A',
          hover: '#95B99F'
        },
        carbon: '#08191C',
        petroleum: '#10282C',
        ivory: '#F3EFE6',
        mineral: '#7FA88C',
        mineralHover: '#95B99F',
        bronze: '#9A765A',
        border: '#294247',
        muted: '#8FA1A4',
        textLight: '#F7F4EC',
        textDark: '#172126',
        warning: '#C69A4B',
        danger: '#B85C5C',
        stone: '#F3EFE6'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Cormorant Garamond', 'Georgia', 'serif']
      }
    }
  },
  plugins: []
} satisfies Config;

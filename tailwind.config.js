/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      },
      colors: {
        gold: {
          50: '#FCFBF4',
          100: '#F5E6C8',
          200: '#E8D5A5',
          300: '#D4AF37',
          400: '#B08D26',
          500: '#8C6E19',
          600: '#725914',
          700: '#594510',
          800: '#3f310b',
          900: '#261d06',
        },
        elegant: {
          black: '#1a1a1a',
          dark: '#2d2d2d',
          gray: '#4a4a4a',
        },
      },
      animation: {
        'spin-slow': 'spin 8s linear infinite',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        chord: {
          bg: '#070B12',
          card: '#0D1424',
          elevated: '#151E34',
          border: '#1E293B',
          cyan: '#38BDF8',
          violet: '#818CF8',
          emerald: '#34D399',
        },
        monad: {
          bg: '#090614',
          card: '#120B24',
          cardHover: '#1A1133',
          border: 'rgba(139, 92, 246, 0.15)',
          purple: '#8B5CF6',
          deepPurple: '#7C3AED',
          neonCyan: '#06B6D4',
        },
      },
    },
  },
  plugins: [],
};

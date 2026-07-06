/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'media',
  content: ['./*.html', './*.js'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#f97316',
          light: '#fdba74',
          glow: 'rgba(249, 115, 22, 0.22)'
        }
      },
      animation: {
        'slide-up':   'slideUp 0.28s cubic-bezier(.22,1,.36,1) both',
        'fade-in':    'fadeIn 0.2s ease both',
        'pop':        'pop 0.22s cubic-bezier(.34,1.56,.64,1) both',
        'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite'
      },
      keyframes: {
        slideUp: {
          '0%':   { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',     opacity: '1' }
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' }
        },
        pop: {
          '0%':   { transform: 'scale(0.88)', opacity: '0' },
          '100%': { transform: 'scale(1)',    opacity: '1' }
        },
        pulseGlow: {
          '0%,100%': { filter: 'drop-shadow(0 0 6px rgba(249,115,22,0.5))' },
          '50%':     { filter: 'drop-shadow(0 0 16px rgba(249,115,22,0.85))' }
        }
      }
    }
  },
  plugins: []
};

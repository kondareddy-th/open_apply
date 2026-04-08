/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#09090B',
        surface: {
          1: '#0F0F12',
          2: '#16161A',
          3: '#1C1C22',
          4: '#23232B',
        },
        'text-primary': '#EDEDEF',
        'text-secondary': '#A0A0AB',
        'text-tertiary': '#62626B',
        gain: '#00D395',
        loss: '#FF6B6B',
        accent: {
          DEFAULT: '#06B6D4',
          hover: '#22D3EE',
        },
        warning: '#F59E0B',
        info: '#3B82F6',
      },
      borderColor: {
        DEFAULT: 'rgba(255, 255, 255, 0.06)',
        strong: 'rgba(255, 255, 255, 0.14)',
        subtle: 'rgba(255, 255, 255, 0.04)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
      fontSize: {
        display: ['32px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '600' }],
        title:   ['20px', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
        heading: ['16px', { lineHeight: '1.4', letterSpacing: '-0.006em', fontWeight: '500' }],
        body:    ['14px', { lineHeight: '1.5', letterSpacing: '0',        fontWeight: '400' }],
        label:   ['13px', { lineHeight: '1.4', letterSpacing: '0.01em',   fontWeight: '500' }],
        caption: ['12px', { lineHeight: '1.4', letterSpacing: '0.02em',   fontWeight: '400' }],
      },
      borderRadius: { sm: '6px', md: '8px', lg: '12px', xl: '16px' },
      boxShadow: {
        'glow-accent': '0 0 20px rgba(6, 182, 212, 0.15)',
        'card':        '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
        'card-hover':  '0 4px 12px rgba(0,0,0,0.4)',
      },
      animation: {
        'fade-in':  'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'shimmer':  'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
}

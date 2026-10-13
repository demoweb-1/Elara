/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ivory: '#FAF8F5',
        surface: '#FFFFFF',
        burgundy: {
          DEFAULT: '#772D43',
          light: '#9B4760',
          dark: '#5A1F32',
          50: '#FDF4F6',
          100: '#FAE8EC',
          200: '#F4D1D9',
          300: '#E8A8B8',
          400: '#D67E96',
          500: '#B95A74',
          600: '#9B4760',
          700: '#772D43',
          800: '#5A1F32',
          900: '#3D1521',
        },
        ink: {
          DEFAULT: '#202020',
          secondary: '#6B6B6B',
          tertiary: '#9B9B9B',
        },
        'warm-grey': {
          50: '#F5F3F0',
          100: '#EAE7E2',
          200: '#D5D0C9',
          300: '#BFB9B0',
          400: '#A39E95',
          500: '#85807A',
          600: '#6B6B6B',
          700: '#525252',
        },
        success: {
          DEFAULT: '#4A7C59',
          light: '#E8F0EA',
        },
        warning: {
          DEFAULT: '#B8860B',
          light: '#FAF3E0',
        },
        error: {
          DEFAULT: '#B33A3A',
          light: '#FCEAEA',
        },
        accent: {
          DEFAULT: '#C9A87C',
          light: '#F5EFE6',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xs: '6px',
        sm: '10px',
        md: '14px',
        lg: '18px',
        xl: '24px',
        '2xl': '32px',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(32, 32, 32, 0.04)',
        sm: '0 2px 8px rgba(32, 32, 32, 0.06)',
        md: '0 4px 16px rgba(32, 32, 32, 0.08)',
        lg: '0 8px 32px rgba(32, 32, 32, 0.10)',
        burgundy: '0 4px 20px rgba(119, 45, 67, 0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
}

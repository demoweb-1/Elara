/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ivory: '#FFF8F9',
        surface: '#FFFFFF',
        burgundy: {
          DEFAULT: '#C8183F',
          light: '#E23558',
          dark: '#A50F33',
          50: '#FFF1F3',
          100: '#FFE1E6',
          200: '#FFC7D0',
          300: '#FF9DAD',
          400: '#F4647F',
          500: '#E23558',
          600: '#C8183F',
          700: '#A50F33',
          800: '#820C29',
          900: '#5C081D',
        },
        ink: {
          DEFAULT: '#1D1317',
          secondary: '#6A5A60',
          tertiary: '#7D6B72',
        },
        'warm-grey': {
          50: '#FBF3F4',
          100: '#F4E6E9',
          200: '#E6D3D7',
          300: '#CDB8BD',
          400: '#A8949A',
          500: '#85737A',
          600: '#6A5A60',
          700: '#4F4247',
        },
        success: {
          DEFAULT: '#1F7A3F',
          light: '#E8F5EC',
        },
        warning: {
          DEFAULT: '#8A5A00',
          light: '#FFF4DB',
        },
        error: {
          DEFAULT: '#9B1C1C',
          light: '#FDECEC',
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
        xs: '0 1px 2px rgba(120, 20, 45, 0.05)',
        sm: '0 2px 8px rgba(120, 20, 45, 0.08)',
        md: '0 4px 16px rgba(120, 20, 45, 0.10)',
        lg: '0 8px 32px rgba(120, 20, 45, 0.14)',
        burgundy: '0 4px 20px rgba(200, 24, 63, 0.22)',
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

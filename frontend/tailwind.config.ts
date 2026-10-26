/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F5F7FB',
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F0F3F8',
        },
        sidebar: {
          DEFAULT: '#101828',
          hover: '#1D2939',
        },
        ink: {
          primary: '#101828',
          secondary: '#475467',
          muted: '#667085',
        },
        border: {
          DEFAULT: '#E4E7EC',
          strong: '#D0D5DD',
        },
        primary: {
          DEFAULT: '#465FFF',
          hover: '#3641D9',
          soft: '#EEF0FF',
        },
        success: {
          DEFAULT: '#067647',
          bg: '#ECFDF3',
          border: '#ABEFC6',
        },
        warning: {
          DEFAULT: '#B54708',
          bg: '#FFFAEB',
          border: '#FEDF89',
        },
        danger: {
          DEFAULT: '#B42318',
          bg: '#FEF3F2',
          border: '#FECDCA',
        },
        info: {
          DEFAULT: '#175CD3',
          bg: '#EFF8FF',
          border: '#B2DDFF',
        },
      },
      fontFamily: {
        sans: [
          'Inter Variable',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
      },
      borderRadius: {
        card: '12px',
        field: '9px',
        badge: '999px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.04)',
        pop: '0 12px 24px -8px rgba(16, 24, 40, 0.18)',
      },
      fontSize: {
        '2xs': ['11px', '16px'],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'slide-in': 'slide-in 180ms ease-out',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
};

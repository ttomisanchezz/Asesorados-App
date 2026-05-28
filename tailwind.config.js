/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          900: '#0a0a0f',
          800: '#111118',
          700: '#1a1a24',
          600: '#222230',
          500: '#2a2a3a',
        },
        accent: {
          DEFAULT: '#6c63ff',
          light: '#8b85ff',
          dark: '#4d46cc',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.3)',
        glow: '0 0 24px rgba(108, 99, 255, 0.25)',
        'glow-strong': '0 0 40px rgba(108,99,255,0.35), 0 0 80px rgba(108,99,255,0.12)',
        'glow-card': '0 8px 40px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
}


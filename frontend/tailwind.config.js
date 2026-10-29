/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#0B1220', // Deep navy sidebar & statutory header
          900: '#111C30', // Secondary navy panel / elevated card
          850: '#16233B', // Hover state for navy items
          800: '#1E293B', // Navy border & divider
          accent: '#1D4ED8', // Active navigation / statutory blue
        },
        workspace: {
          DEFAULT: '#F4F7FB', // Main workspace background
          surface: '#FFFFFF', // High-contrast clean white card
          border: '#E2E8F0',  // Precise subtle border
        },
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        }
      }
    },
  },
  plugins: [],
}

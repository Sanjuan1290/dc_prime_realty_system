/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.1rem' }],
        sm: ['0.825rem', { lineHeight: '1.25rem' }],
        base: ['0.9rem', { lineHeight: '1.4rem' }],
        lg: ['1rem', { lineHeight: '1.5rem' }],
        xl: ['1.125rem', { lineHeight: '1.6rem' }],
        '2xl': ['1.3rem', { lineHeight: '1.75rem' }],
        '3xl': ['1.6rem', { lineHeight: '2rem' }],
      },
    },
  },
  plugins: [],
}

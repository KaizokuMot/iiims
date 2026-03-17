/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Match your existing dark theme colors
        gray: {
          800: '#293546',
          900: '#131a24',
        }
      }
    },
  },
  plugins: [],
}

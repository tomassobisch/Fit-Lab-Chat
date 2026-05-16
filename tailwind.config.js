/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tj: {
          dark: "#000000",
          panel: "#0A0A0A",
          accent: "#CCFF00",
        }
      }
    },
  },
  plugins: [],
}

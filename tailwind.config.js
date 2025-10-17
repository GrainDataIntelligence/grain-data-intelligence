/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gdiGold: "#FFD700", // or your preferred gold hex code
      },
    },
  },
  plugins: [],
};

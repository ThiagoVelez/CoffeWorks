/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        powerpoint: {
          DEFAULT: "#c43e1c",
          dark: "#a93217",
          darker: "#8c260f",
          light: "#fcebe6",
          lighter: "#fff5f2",
        },
        coffee: {
          DEFAULT: "#6f4e37",
          dark: "#3e2723",
          light: "#eeddd0",
          lighter: "#faf7f2",
        },
      },
      fontFamily: {
        sans: ["Segoe UI", "system-ui", "sans-serif"],
        display: ["Hanken Grotesk", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

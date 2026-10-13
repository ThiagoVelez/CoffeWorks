/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        excel: {
          DEFAULT: "#107c41",
          dark: "#0e6b37",
          darker: "#0a4d27",
          light: "#dff6dd",
          lighter: "#edf9ed",
          border: "#107c41",
          active: "#0c5e31",
        },
        coffee: {
          DEFAULT: "#6f4e37",
          dark: "#3e2723",
          light: "#eeddd0",
          lighter: "#faf7f2",
        },
        surface: {
          DEFAULT: "#ffffff",
          subtle: "#fbf9f6",
          muted: "#f3f2f1",
          header: "#e1dfdd",
        },
      },
      fontFamily: {
        display: ["'Hanken Grotesk'", "sans-serif"],
        body: ["'Hanken Grotesk'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};

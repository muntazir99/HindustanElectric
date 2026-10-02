import defaultTheme from "tailwindcss/defaultTheme.js";

export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      // Hind is made for Indian shop signs and forms: clear numbers, and Devanagari if Hindi is added later.
      fontFamily: {
        sans: ["Hind", "Segoe UI", ...defaultTheme.fontFamily.sans],
      },
      // The "middle ground" look (docs/PLAN.md §10): dark steel-blue bar and headings, light tints for the
      // "Home › page" line and box header strips.
      colors: {
        steel: {
          50: "#EAF0F6",
          100: "#E7EEF4",
          200: "#C9D8E6",
          300: "#A9BFD3",
          500: "#7FA0BE",
          700: "#3A5F80",
          800: "#264B6B",
          900: "#1E3D58",
        },
        line: "#D9DEE5",
      },
    },
  },
  plugins: [],
};

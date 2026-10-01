import defaultTheme from "tailwindcss/defaultTheme.js";

export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      // Hind is made for Indian shop signs and forms: clear numbers, and Devanagari if Hindi is added later.
      fontFamily: {
        sans: ["Hind", "Segoe UI", ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};

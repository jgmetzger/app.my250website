/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Match my250website.com palette.
        cream: "#FDFBF7",
        ink: "#0F172A",
        accent: "#ECEF4C",
        muted: "#5c5a52",
      },
      fontFamily: {
        serif: ['"DM Serif Display"', "serif"],
        sans: ['"Sora"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 0 rgba(15,23,42,0.04), 0 8px 24px -12px rgba(15,23,42,0.12)",
      },
    },
  },
  plugins: [],
};

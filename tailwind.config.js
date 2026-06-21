/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "Inter", "system-ui", "sans-serif"],
        display: ["Fraunces", "Georgia", "serif"],
      },
      colors: {
        ink: "#12100E",
        paper: "#FAF8F4",
        warm: "#F2EDE3",
        gold: "#C4852A",
        goldLight: "#EDD08A",
        rust: "#B5451E",
        sage: "#3A6647",
        muted: "#857D74",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(18, 16, 14, 0.12)",
      },
    },
  },
  plugins: [],
};

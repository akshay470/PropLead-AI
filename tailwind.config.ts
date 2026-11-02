import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#F6F6F5",
          100: "#E7E7E5",
          200: "#D1D0CC",
          300: "#AFAEA7",
          400: "#7A7973",
          500: "#575651",
          600: "#3E3D39",
          700: "#2A2926",
          800: "#1C1B19",
          900: "#121210",
          950: "#0B0B0A",
        },
        surface: {
          50: "#FFFFFF",
          100: "#FAF9F6",
          200: "#F4F2EC",
          300: "#EBE7DF",
          400: "#DED8CD",
        },
        brand: {
          50: "#FAF6F0",
          100: "#F4ECE0",
          200: "#E5D4BE",
          300: "#D4B999",
          400: "#C09B72",
          500: "#A77E52",
          600: "#8C653D",
          700: "#704E2D",
          800: "#553A22",
          900: "#3E2918",
        },
        accent: {
          DEFAULT: "#8C653D", // Warm architectural bronze
          muted: "#A77E52",
          subtle: "#F4ECE0",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.375rem",
        md: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgba(18, 18, 16, 0.04)",
        card: "0 2px 8px -2px rgba(18, 18, 16, 0.06), 0 1px 3px -1px rgba(18, 18, 16, 0.03)",
        elevated: "0 12px 24px -6px rgba(18, 18, 16, 0.08), 0 4px 8px -2px rgba(18, 18, 16, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;

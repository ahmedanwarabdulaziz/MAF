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
        background: {
          DEFAULT: "#F5F4EF", /* Matte off-white */
          secondary: "#F6F6F2",
        },
        primary: {
          DEFAULT: "#2F6FB3", /* Corporate Blue */
        },
        navy: {
          DEFAULT: "#16324F", /* Navy Blue */
        },
        border: {
          DEFAULT: "#D7DEE7", /* Border Neutral */
        },
        text: {
          primary: "#1F2A37",
          secondary: "#5F6B7A",
        },
        success: {
          DEFAULT: "#2E7D5A",
        },
        danger: {
          DEFAULT: "#B54747",
        },
      },
    },
  },
  plugins: [],
};
export default config;

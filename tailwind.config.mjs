/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./player.html",
    "./index.js",
    "./utils/**/*.js",
    "./constants/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        ipadbg: "#f5f5f7",
        ipadfg: "#1c1c1e",
        ipadaccent: "#0071e3",
        ipadsoftblue: "#58a6ff",
        ipadsoftgreen: "#34c759",
        ipadsoftpink: "#ff2d9e",
        ipadborder: "#e5e5e7",
        ipadsecondary: "#86868b",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Display", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
      borderRadius: {
        "ipad": "16px",
        "ipad-lg": "20px",
        "ipad-xl": "24px",
      },
      boxShadow: {
        "ipad": "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
        "ipad-md": "0 4px 12px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)",
        "ipad-lg": "0 8px 24px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)",
        "ipad-glass": "0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.6)",
      },
      backdropBlur: {
        ipad: "20px",
      }
    },
  },
};

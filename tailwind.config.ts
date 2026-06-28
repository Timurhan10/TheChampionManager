import type { Config } from "tailwindcss";

// Tasarım token'ları README.md handoff dosyasından alınmıştır.
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-base": "#0C1524",
        "bg-deep": "#0A1220",
        "bg-sidebar": "#0B1422",
        panel: "#1A2A3E",
        "panel-inset": "#15263C",
        "border-cm": "#2A3F5A",
        "border-soft": "#21344C",
        emerald: {
          DEFAULT: "#10B981",
          bright: "#34D399",
          ink: "#06231A",
        },
        amber: { DEFAULT: "#F59E0B" },
        danger: { DEFAULT: "#EF4444" },
        "blue-cm": { DEFAULT: "#3B82F6", bright: "#60A5FA" },
        "text-cm": "#F1F5F9",
        "text-2": "#CBD5E1",
        "text-muted": "#94A3B8",
        "text-faint": "#64748B",
      },
      fontFamily: {
        display: ["var(--font-saira)", "system-ui", "sans-serif"],
        body: ["var(--font-plex)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        frame: "0 18px 50px rgba(0,0,0,0.45)",
        card: "0 3px 10px rgba(0,0,0,0.4)",
      },
      borderRadius: {
        card: "13px",
        pill: "20px",
      },
    },
  },
  plugins: [],
};

export default config;

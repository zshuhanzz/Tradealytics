/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background:  "var(--background)",
        foreground:  "var(--foreground)",
        card:        "var(--card)",
        border:      "var(--border)",
        muted:       "var(--muted)",
        primary:     "var(--primary)",
        success:     "var(--success)",
        danger:      "var(--danger)",
        sidebar:     "var(--sidebar-bg)",
      },
      borderRadius: {
        DEFAULT: "6px",
      },
    },
  },
  plugins: [],
};

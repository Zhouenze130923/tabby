import { create } from "zustand";

interface ThemeState {
  accentColor: string; // CSS color value (e.g., "#3b82f6" for blue)
  setAccentColor: (color: string) => void;
  resetAccentColor: () => void;
}

// Default accent colors
const DEFAULT_ACCENT = "#3b82f6";

// Apply accent color to CSS custom properties
function applyAccent(color: string) {
  const root = document.documentElement;
  root.style.setProperty("--pivot-accent", color);
  root.style.setProperty("--pivot-accent-light", color + "33"); // 20% opacity
  root.style.setProperty("--pivot-accent-ring", color + "80"); // 50% opacity
}

// Load saved accent color
function loadAccent(): string {
  try {
    const saved = localStorage.getItem("pivot-accent-color");
    if (saved) {
      applyAccent(saved);
      return saved;
    }
  } catch {}
  applyAccent(DEFAULT_ACCENT);
  return DEFAULT_ACCENT;
}

export const useThemeStore = create<ThemeState>((set) => {
  const initial = loadAccent();
  return {
    accentColor: initial,
    setAccentColor: (color) => {
      applyAccent(color);
      try { localStorage.setItem("pivot-accent-color", color); } catch {}
      set({ accentColor: color });
    },
    resetAccentColor: () => {
      applyAccent(DEFAULT_ACCENT);
      try { localStorage.setItem("pivot-accent-color", DEFAULT_ACCENT); } catch {}
      set({ accentColor: DEFAULT_ACCENT });
    },
  };
});

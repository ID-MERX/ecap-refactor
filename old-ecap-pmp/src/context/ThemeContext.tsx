import React, { createContext, useContext, useState, useEffect } from "react";

type ThemeConfig = {
  banner: string;
  sidebar: string;
  header: string;
  background: string;
  button: string;
  card: string;
  text: string;
  theme: string;
};

const defaultConfig: ThemeConfig = {
  banner: "",
  sidebar: "",
  header: "",
  background: "",
  button: "",
  card: "",
  text: "",
  theme: "",
};

type ThemeContextType = {
  config: ThemeConfig;
  updateColor: (target: keyof ThemeConfig, value: string) => void;
  resetTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<ThemeConfig>(() => {
    const saved = localStorage.getItem("ecap.ui_theme");
    return saved ? JSON.parse(saved) : defaultConfig;
  });

  useEffect(() => {
    localStorage.setItem("ecap.ui_theme", JSON.stringify(config));
    applyTheme(config);
  }, [config]);

  const applyTheme = (theme: ThemeConfig) => {
    const root = document.documentElement;

    // Helper to apply HSL values
    const setVar = (name: string, value: string) => {
      if (!value) return;
      // If the value is hex, we might need to convert it, 
      // but for simplicity and following Tailwind's pattern, 
      // we'll expect/enforce HSL or use a generic variable.
      root.style.setProperty(name, value);
    };

    if (theme.theme) {
      // For Tailwind variables, we might need HSL. 
      // If the AI gives us a color like "red" or "#ff0000", 
      // we can't easily convert to raw HSL digits here without a library.
      // However, we can override the utilities by setting the variable to the full color 
      // if the utility supports it, or by using a less restrictive approach.
      // For ECAP+, we'll apply them as is to these custom-friendly handles.
      setVar("--primary", theme.theme.includes(' ') ? theme.theme : theme.theme);
      setVar("--accent", theme.theme);
      setVar("--ring", theme.theme);
    }
    // We'll use more robust variable names for overriding standard ones if needed, 
    // but for now let's stick to the ones used in styles.
    if (theme.background) setVar("--background", theme.background);
    if (theme.card) setVar("--card", theme.card);
    if (theme.text) setVar("--foreground", theme.text);
    if (theme.sidebar) setVar("--sidebar-background", theme.sidebar);

    // Custom variables for banner and header
    if (theme.banner) root.style.setProperty("--banner-color", theme.banner);
    if (theme.header) root.style.setProperty("--header-color", theme.header);
    if (theme.button) root.style.setProperty("--button-color", theme.button);
  };

  const updateColor = (target: keyof ThemeConfig, value: string) => {
    setConfig(prev => ({ ...prev, [target]: value }));
  };

  const resetTheme = () => {
    setConfig(defaultConfig);
    // Remove inline styles from root
    const root = document.documentElement;
    [
      "--primary", "--accent", "--ring", "--background", "--card",
      "--foreground", "--sidebar-background", "--banner-color",
      "--header-color", "--button-color"
    ].forEach(prop => root.style.removeProperty(prop));
  };

  return (
    <ThemeContext.Provider value={{ config, updateColor, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
};

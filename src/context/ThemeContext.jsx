import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext({ theme: 'hi', toggleTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('dd-theme');
    // Если ранее было 'dark' (старое значение) — конвертируем в 'classic'
    if (saved === 'dark') return 'classic';
    return saved || 'hi';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dd-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'hi' ? 'classic' : 'hi');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

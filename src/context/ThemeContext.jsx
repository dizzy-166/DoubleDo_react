import React, { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext({ theme: 'hi', toggleTheme: () => {} });

export function ThemeProvider({ children }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'hi');
    localStorage.setItem('dd-theme', 'hi');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: 'hi', toggleTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

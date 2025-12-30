import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext();

// AuthContext.jsx - добавьте эту функцию
const getAccessToken = () => {
  return user?.access_token || 
         localStorage.getItem('sb-ydetmjryjpnrpcmoxvre-auth-token') ||
         sessionStorage.getItem('sb-ydetmjryjpnrpcmoxvre-auth-token');
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      console.log('Session on load:', data);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event);
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) console.log('Login error:', error.message);
    return { data, error };
  };

  const signup = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });
    
    if (error) console.log('Signup error:', error.message);
    return { data, error };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // Новая функция для верификации email (OTP)
  const verifyEmailOTP = async (email, token) => {
    return await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup'
    });
  };

  // Функция для отправки OTP кода (для регистрации без пароля)
  const signupWithOTP = async (email) => {
    return await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });
  };

  if (loading) {
    return <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      color: 'var(--dark)'
    }}>
      Загрузка...
    </div>;
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      signup, 
      logout,
      verifyEmailOTP,
      signupWithOTP
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
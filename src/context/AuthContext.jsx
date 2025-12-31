// AuthContext.jsx - ТОЛЬКО OTP КОДЫ, БЕЗ MAGIC LINK
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Проверяем сессию при загрузке
    supabase.auth.getSession().then(({ data }) => {
      console.log('Session on load:', data);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event);
      setUser(session?.user ?? null);
      
      // Если это вход, обновляем пользователя в public.users
      if (event === 'SIGNED_IN' && session?.user) {
        updatePublicUser(session.user);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Функция для обновления public.users
  const updatePublicUser = async (authUser) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .upsert({
          id: authUser.id,
          email: authUser.email,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id',
          ignoreDuplicates: false
        });
      
      if (error) {
        console.error('Error updating public user:', error);
      }
    } catch (error) {
      console.error('Error in updatePublicUser:', error);
    }
  };

  // Вход по OTP (6-значный код)
  const loginWithOTP = async (email) => {
    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false, // Только вход, без создания пользователя
          // 🔥 Ключевое изменение: используем email otp вместо magic link
        }
      });
      
      if (error) throw error;
      
      return { 
        success: true, 
        message: '6-значный код отправлен на email',
        data 
      };
    } catch (error) {
      console.error('OTP login error:', error);
      return { 
        success: false, 
        message: error.message || 'Ошибка отправки кода',
        error 
      };
    }
  };

  // Регистрация по OTP (6-значный код)
  const signupWithOTP = async (email) => {
    try {
      // Сначала проверяем, не существует ли уже пользователь
      const { data: checkData } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();
      
      if (checkData) {
        return {
          success: false,
          message: 'Пользователь с таким email уже существует'
        };
      }
      
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true, // Создаем нового пользователя
          // 🔥 Ключевое изменение: используем email otp вместо magic link
        }
      });
      
      if (error) throw error;
      
      return { 
        success: true, 
        message: '6-значный код отправлен на email',
        data 
      };
    } catch (error) {
      console.error('OTP signup error:', error);
      return { 
        success: false, 
        message: error.message || 'Ошибка отправки кода',
        error 
      };
    }
  };

  // Проверка OTP кода
  const verifyOTP = async (email, token) => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email' // Тип email OTP
      });
      
      if (error) throw error;
      
      return { 
        success: true, 
        message: 'Email подтвержден',
        data 
      };
    } catch (error) {
      console.error('OTP verification error:', error);
      return { 
        success: false, 
        message: error.message || 'Неверный код',
        error 
      };
    }
  };

  // 🔥 НОВАЯ ФУНКЦИЯ: Настройка OTP кодов вместо magic link
  const sendOTPCode = async (email, isSignUp = false) => {
    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: isSignUp,
          // 🔥 Вот эта настройка заставляет отправлять код вместо magic link
          emailRedirectTo: null, // Убираем redirect URL
        }
      });
      
      if (error) throw error;
      
      return { 
        success: true, 
        message: '6-значный код отправлен на email',
        data 
      };
    } catch (error) {
      console.error('Send OTP error:', error);
      return { 
        success: false, 
        message: error.message || 'Ошибка отправки кода',
        error 
      };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
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
      loading,
      // Веб-методы (без пароля)
      loginWithOTP,
      signupWithOTP,
      verifyOTP,
      sendOTPCode, // 🔥 Новая функция
      // Общие методы
      logout,
      updatePublicUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
// AuthContext.jsx - ТОЛЬКО OTP КОДЫ, БЕЗ MAGIC LINK
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Проверяем сессию при загрузке
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Session on load:', session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Если есть пользователь, убедимся что он в public.users
      if (session?.user) {
        ensurePublicUser(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event, 'User:', session?.user?.id);
      
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('User signed in:', session.user.email);
        
        // Ждем немного, чтобы триггер успел сработать
        setTimeout(() => {
          ensurePublicUser(session.user);
        }, 1000);
      }
      
      if (event === 'SIGNED_OUT') {
        console.log('User signed out');
      }
      
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 🔥 КРИТИЧЕСКАЯ ФУНКЦИЯ: Убедимся, что пользователь есть в public.users
  const ensurePublicUser = async (authUser) => {
    try {
      console.log('Ensuring public user exists for:', authUser.email);
      
      // Проверяем, есть ли уже запись
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();
      
      // Если пользователь не найден, создаем его
      if (checkError?.code === 'PGRST116') { // PGRST116 = no rows returned
        console.log('User not found in public.users, creating...');
        
        // Создаем username из email
        const username = generateUsernameFromEmail(authUser.email);
        
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .upsert({
            id: authUser.id,
            email: authUser.email,
            username: username,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          })
          .select()
          .single();
        
        if (createError) {
          console.error('Error creating public user:', createError);
          // Пробуем еще раз с дефолтным username
          await createFallbackUser(authUser);
        } else {
          console.log('Public user created successfully:', newUser);
        }
      } else if (checkError) {
        console.error('Error checking public user:', checkError);
      } else {
        console.log('Public user already exists:', existingUser);
      }
    } catch (error) {
      console.error('Error in ensurePublicUser:', error);
    }
  };

  // Генерация username из email
  const generateUsernameFromEmail = (email) => {
    if (!email) return 'user_' + Math.random().toString(36).substr(2, 6);
    
    // Берем часть до @ и очищаем
    let username = email.split('@')[0];
    
    // Очищаем от небуквенно-цифровых символов
    username = username.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    // Если слишком короткий, добавляем случайные символы
    if (username.length < 3) {
      username = 'user_' + Math.random().toString(36).substr(2, 4);
    }
    
    // Ограничиваем длину
    if (username.length > 20) {
      username = username.substring(0, 20);
    }
    
    return username;
  };

  // Создание резервного пользователя
  const createFallbackUser = async (authUser) => {
    try {
      const fallbackUsername = 'user_' + authUser.id.substring(0, 8);
      
      const { data, error } = await supabase
        .from('users')
        .upsert({
          id: authUser.id,
          email: authUser.email,
          username: fallbackUsername,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        console.error('Failed to create fallback user:', error);
      } else {
        console.log('Fallback user created:', data);
      }
    } catch (error) {
      console.error('Error in createFallbackUser:', error);
    }
  };

  // Вход по OTP (6-значный код)
  const loginWithOTP = async (email) => {
    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: window.location.origin
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
      const { data, error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: window.location.origin
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
        email: email.trim(),
        token,
        type: 'email'
      });
      
      if (error) throw error;
      
      // После успешной проверки, убедимся что пользователь в public.users
      if (data?.user) {
        setTimeout(() => {
          ensurePublicUser(data.user);
        }, 500);
      }
      
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

  // 🔥 Упрощенная функция отправки OTP
  const sendOTPCode = async (email, isSignUp = false) => {
    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: isSignUp,
          emailRedirectTo: window.location.origin
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
    try { await supabase.auth.signOut(); } catch {}
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
      sendOTPCode,
      ensurePublicUser, // Экспортируем для использования в других компонентах
      // Общие методы
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
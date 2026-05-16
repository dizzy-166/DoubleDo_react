import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { supabase } from './services/supabase';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import OneSignal from 'react-onesignal';

let oneSignalAttempted = false;
let oneSignalReady = false;

// Вызывается из ProfilePage по клику пользователя
export async function enablePushNotifications(userId) {
  try {
    if (!oneSignalReady) return false;
    const granted = await OneSignal.Notifications.requestPermission();
    if (granted) await OneSignal.login(userId);
    return granted;
  } catch {
    return false;
  }
}
import HabitsPage from './pages/HabitsPage.jsx';
import CompetitionsPage from './pages/CompetitionsPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import InvitePage from './pages/InvitePage.jsx';
import StatsPage from './pages/StatsPage.jsx';
import Onboarding from './components/Onboarding.jsx';
import MissedNotificationOverlay from './components/MissedNotificationOverlay.jsx';
import './App.css';

// Функция для извлечения username из email
const extractUsernameFromEmail = (email) => {
  if (!email) return '';
  
  // Берем часть до @ и очищаем от спецсимволов
  const emailPart = email.split('@')[0];
  
  // Удаляем все небуквенные и нецифровые символы, кроме точки
  let username = emailPart.toLowerCase().replace(/[^a-z0-9.]/g, '');
  
  // Заменяем точки на подчеркивания
  username = username.replace(/\./g, '_');
  
  // Если после очистки username пустой, используем часть email
  if (!username || username.length < 3) {
    // Берем первые 8 символов из email (без @)
    const cleanEmail = email.toLowerCase().replace(/[^a-z0-9]/g, '');
    username = 'user_' + (cleanEmail.substring(0, 6) || 'user');
  }
  
  // Ограничиваем длину
  if (username.length > 20) {
    username = username.substring(0, 20);
  }
  
  return username;
};

// Функция отправки OTP кода
const sendOTPCode = async (email, shouldCreateUser, isLoginFlag) => { // Добавляем третий параметр
  try {
    console.log('Sending OTP to:', email, 'shouldCreateUser:', shouldCreateUser, 'isLoginFlag:', isLoginFlag);
    
    const cleanEmail = email.trim().toLowerCase();
    
    // 🔥 ВАЖНО: Всегда сначала проверяем существование пользователя
    try {
      // Проверяем через вашу БД
      const { data: checkResult, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', cleanEmail)
        .single();
      
      // Если пользователь не найден И мы пытаемся войти (не регистрироваться)
      if (isLoginFlag && (checkError || !checkResult)) { // Используем isLoginFlag
        return {
          success: false,
          message: 'Пользователь не зарегистрирован в системе'
        };
      }
      
      // Если пользователь найден И мы пытаемся зарегистрироваться
      if (!isLoginFlag && checkResult) { // Используем isLoginFlag
        return {
          success: false,
          message: 'Пользователь с таким email уже зарегистрирован'
        };
      }
    } catch (checkErr) {
      console.error('Check email error:', checkErr);
      // Если не удалось проверить, продолжаем
    }
    
    // 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Правильно настраиваем shouldCreateUser
    const authOptions = {
      email: cleanEmail,
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: shouldCreateUser // Используем переданный параметр
      }
    };

    const { data, error } = await supabase.auth.signInWithOtp(authOptions);

    if (error) {
      console.error('OTP send error:', error);
      
      // 🔥 Переводим ошибки на русский
      let userMessage = error.message || 'Не удалось отправить код';
      
      if (error.message?.includes('Signups not allowed')) {
        userMessage = 'Пользователь не зарегистрирован в системе';
      } else if (error.message?.includes('rate limit')) {
        userMessage = 'Слишком много запросов. Попробуйте позже.';
      } else if (error.message?.includes('invalid email')) {
        userMessage = 'Некорректный email адрес';
      } else if (error.message?.includes('email link is valid')) {
        userMessage = 'Ссылка для подтверждения email уже отправлена';
      }
      
      return {
        success: false,
        message: userMessage
      };
    }

    return {
      success: true
    };
  } catch (err) {
    console.error('OTP error:', err);
    return {
      success: false,
      message: 'Произошла ошибка при отправке кода'
    };
  }
};

// Функция проверки OTP кода
const verifyOTPCode = async (email, token) => {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });
    
    if (error) {
      console.error('OTP verification error:', error);
      return {
        success: false,
        message: error.message || 'Неверный код или истек срок действия'
      };
    }
    
    return {
      success: true,
      message: 'Email успешно подтвержден',
      data
    };
  } catch (err) {
    console.error('Verify OTP error:', err);
    return {
      success: false,
      message: 'Произошла ошибка при проверке кода'
    };
  }
};

function App() {
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(
    user && !localStorage.getItem('onboarding_done')
  );
  const [notifQueue, setNotifQueue] = useState([]);
  const [email, setEmail] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [resendCountdown, setResendCountdown] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const otpRefs = useRef([]);

  useEffect(() => {
    otpRefs.current = otpRefs.current.slice(0, 6);
  }, []);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  useEffect(() => {
    if (confirmationCode.length === 6 && !loading && needsConfirmation) {
      doVerifyOTP();
    }
  }, [confirmationCode]);

  // OneSignal: инициализация + запрос разрешения + привязка пользователя
  useEffect(() => {
    if (!user?.id) return;

    // Если init уже прошёл успешно — только логиним
    if (oneSignalReady) {
      OneSignal.login(user.id).catch(() => {});
      return;
    }

    // Если уже пытались (даже неудачно) — не повторяем
    if (oneSignalAttempted) return;
    oneSignalAttempted = true; // фиксируем ДО async, чтобы второй вызов не прошёл

    const setup = async () => {
      try {
        if (!('PushManager' in window) || !('serviceWorker' in navigator)) return;

        await OneSignal.init({
          appId: '1d084c89-fe5e-43e2-9a91-fee2f37ed467',
          allowLocalhostAsSecureOrigin: true,
          notifyButton: { enable: false },
          serviceWorkerParam: { scope: '/' },
        });

        oneSignalReady = true;

        // Если разрешение уже дано ранее — сразу логиним
        if (OneSignal.Notifications.permission) {
          await OneSignal.login(user.id).catch(() => {});
        }
      } catch (e) {
        // Ошибка получения существующей подписки (Firefox/испорченная подписка):
        // SDK инициализировался, просто старая подписка слетела — помечаем как готовый,
        // чтобы пользователь мог нажать кнопку и подписаться заново.
        if (e instanceof DOMException || String(e).includes('push subscription')) {
          oneSignalReady = true;
        }
      }
    };
    setup();
  }, [user?.id]);

  // Проверяем, что пользователь имеет username
  useEffect(() => {
    const checkUserProfile = async () => {
      if (!user?.id) return;
      
      try {
        // Получаем информацию о пользователе из public.users
        const { data, error } = await supabase
          .from('users')
          .select('username')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error('Error fetching user profile:', error);
        } else if (data) {
          console.log('User has username:', data.username);
          // Username уже установлен автоматически через триггер
        }
      } catch (err) {
        console.error('Error checking user profile:', err);
      }
    };
    
    checkUserProfile();
  }, [user]);

  // Проверяем уведомления о пропущенных днях соперника
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(async () => {
      if (localStorage.getItem('ddo_reactions_disabled') === '1') return;
      try {
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const yesterdayDay = yesterday.getDate();
        const yesterdayMonth = yesterday.getMonth() + 1;
        const yesterdayYear = yesterday.getFullYear();

        const { data: comps, error } = await supabase.rpc('get_user_competitions');
        if (error || !comps) return;

        // Загружаем уже просмотренные ключи из БД (синхронизируется между устройствами)
        const { data: seenRows } = await supabase
          .from('notification_seen')
          .select('key')
          .eq('user_id', user.id);
        const seen = new Set((seenRows || []).map(r => r.key));

        const isSeen = (key) => seen.has(key);
        const markSeen = async (keys) => {
          await supabase.from('notification_seen').upsert(
            keys.map(key => ({ user_id: user.id, key })),
            { onConflict: 'user_id,key' }
          );
          keys.forEach(k => seen.add(k));
        };

        const queue = [];
        const newKeys = [];

        for (const comp of comps.filter(c => c.status === 'active')) {
          const compStartStr = comp.start_date?.split('T')[0];
          if (!compStartStr || yesterdayStr < compStartStr) continue;

          // Уведомление отправителя: соперник пропустил вчера
          const sKey = `ddo_s_${comp.competition_id}_${today}`;
          if (!isSeen(sKey)) {
            try {
              const { data: cal } = await supabase.rpc('get_competition_calendar_data_fixed', {
                p_competition_id: comp.competition_id,
                p_year: yesterdayYear,
                p_month: yesterdayMonth,
              });
              const done = cal?.[0]?.friend_completed_days?.includes(yesterdayDay);
              if (!done) {
                queue.push({ type: 'sender', competition: comp, key: sKey });
                newKeys.push(sKey);
              }
            } catch {}
          }

          // Уведомление получателя: соперник отправил мне реакцию сегодня
          const rKey = `ddo_r_${comp.competition_id}_${today}`;
          if (!isSeen(rKey)) {
            try {
              const { data: rxns } = await supabase
                .from('competition_reactions')
                .select('*')
                .eq('competition_id', comp.competition_id)
                .gte('created_at', `${today}T00:00:00`);

              const incoming = (rxns || []).filter(r => {
                const sid = r.sender_user_id ?? r.user_id;
                return sid && sid !== user.id;
              });

              if (incoming.length > 0) {
                queue.push({
                  type: 'receiver',
                  competition: comp,
                  emoji: incoming[0].emoji,
                  key: rKey,
                });
                newKeys.push(rKey);
              }
            } catch {}
          }
        }

        if (newKeys.length > 0) await markSeen(newKeys);
        if (queue.length > 0) setNotifQueue(queue);

        // Если я сам пропустил вчера — оповещаем соперника пушем
        const pushNewKeys = [];
        for (const comp of comps.filter(c => c.status === 'active')) {
          const compStartStr = comp.start_date?.split('T')[0];
          if (!compStartStr || yesterdayStr < compStartStr) continue;
          const pushKey = `ddo_push_${comp.competition_id}_${yesterdayStr}`;
          if (isSeen(pushKey)) continue;
          try {
            const { data: cal } = await supabase.rpc('get_competition_calendar_data_fixed', {
              p_competition_id: comp.competition_id,
              p_year: yesterdayYear,
              p_month: yesterdayMonth,
            });
            const iMissed = !cal?.[0]?.my_completed_days?.includes(yesterdayDay);
            if (iMissed) {
              pushNewKeys.push(pushKey);
              await supabase.rpc('notify_missed_day_push', {
                p_competition_id: comp.competition_id,
              });
            }
          } catch {}
        }
        if (pushNewKeys.length > 0) await markSeen(pushNewKeys);
      } catch {}
    }, 1500);

    return () => clearTimeout(timer);
  }, [user]);

  const handleNotifClose = () => {
    setNotifQueue(prev => {
      if (prev[0]) localStorage.setItem(prev[0].key, '1');
      return prev.slice(1);
    });
  };

  const handleNotifSendEmoji = async (emoji) => {
    const current = notifQueue[0];
    if (!current) return;
    try {
      await supabase.rpc('send_competition_reaction', {
        p_competition_id: current.competition.competition_id,
        p_emoji: emoji,
      });
    } catch {}
  };

  const validateEmail = (email) => {
    if (!email) return 'Email обязателен';
    if (!/\S+@\S+\.\S+/.test(email)) return 'Некорректный email';
    return null;
  };

  // Функция для переключения режима аутентификации
  const toggleAuthMode = () => {
    setTransitioning(true);
    setTimeout(() => {
      setIsLogin(!isLogin);
      setFormErrors({});
      setEmail('');
      setTransitioning(false);
    }, 300);
  };

  // Обработчик отправки формы (регистрация/вход)
const handleSubmit = async (e) => {
  e.preventDefault();
  
  const emailError = validateEmail(email);
  if (emailError) {
    setFormErrors({ email: emailError });
    return;
  }
  
  setLoading(true);
  setFormErrors({});
  
  try {
    // 🔥 Проверка существования пользователя
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .limit(1);
    
    if (checkError) {
      console.error('Error checking user:', checkError);
    }
    
    // Если пытаемся войти, но пользователь не найден
    if (isLogin && (!existingUsers || existingUsers.length === 0)) {
      setFormErrors({ general: 'Пользователь не зарегистрирован в системе' });
      setLoading(false);
      return;
    }
    
    // Если пытаемся зарегистрироваться, но пользователь уже существует
    if (!isLogin && existingUsers && existingUsers.length > 0) {
      setFormErrors({ general: 'Пользователь с таким email уже зарегистрирован' });
      setLoading(false);
      return;
    }
    
    // Отправляем OTP с правильным shouldCreateUser
    // !isLogin = true для регистрации, false для входа
    const result = await sendOTPCode(email, !isLogin, isLogin); // Добавляем третий параметр
    
    if (result.success) {
      setNeedsConfirmation(true);
      setPendingEmail(email);
      setResendCountdown(60);
    } else {
      setFormErrors({ general: result.message });
    }
  } catch (err) {
    setFormErrors({ general: 'Произошла ошибка. Попробуйте снова.' });
    console.error('OTP error:', err);
  } finally {
    setLoading(false);
  }
};

  const doVerifyOTP = async () => {
    if (loading) return;
    setLoading(true);
    setFormErrors({});
    try {
      const result = await verifyOTPCode(pendingEmail, confirmationCode);
      if (result.success) {
        setNeedsConfirmation(false);
        setConfirmationCode('');
        if (!isLogin) {
          const generatedUsername = extractUsernameFromEmail(pendingEmail);
          const { error } = await supabase.rpc('set_username_atomic', { new_username: generatedUsername });
          if (error) console.error('Error setting username:', error);
          toast.success(`Добро пожаловать! Никнейм: ${generatedUsername}`);
        }
      } else {
        setFormErrors({ confirmation: result.message });
      }
    } catch (err) {
      setFormErrors({ confirmation: 'Неверный код или произошла ошибка' });
      console.error('Verify error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (confirmationCode.length !== 6) {
      setFormErrors({ confirmation: 'Введите 6-значный код' });
      return;
    }
    await doVerifyOTP();
  };

  // Функция для обработки ввода OTP
  const handleOTPInput = (value, index) => {
    const newCode = confirmationCode.split('');
    
    if (value === '') {
      // Удаляем цифру
      newCode[index] = '';
    } else {
      // Вставляем новую цифру
      newCode[index] = value;
    }
    
    const finalCode = newCode.join('');
    setConfirmationCode(finalCode);
  };

  // Обработчик клавиш для OTP полей
  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      
      // Если поле пустое, переходим к предыдущему полю
      if (!confirmationCode[index] && index > 0) {
        // Удаляем цифру из предыдущего поля
        const newCode = confirmationCode.split('');
        newCode[index - 1] = '';
        setConfirmationCode(newCode.join(''));
        
        // Фокусируемся на предыдущем поле
        setTimeout(() => {
          if (otpRefs.current[index - 1]) {
            otpRefs.current[index - 1].focus();
          }
        }, 0);
      } else if (confirmationCode[index]) {
        // Если в текущем поле есть цифра, очищаем его
        handleOTPInput('', index);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      if (otpRefs.current[index - 1]) {
        otpRefs.current[index - 1].focus();
      }
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      if (otpRefs.current[index + 1]) {
        otpRefs.current[index + 1].focus();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      // Разрешаем вставку из буфера
      e.preventDefault();
      
      // Получаем текст из буфера обмена
      navigator.clipboard.readText()
        .then(text => {
          const cleanedText = text.replace(/\D/g, '').slice(0, 6);
          if (cleanedText.length > 0) {
            setConfirmationCode(cleanedText);
            
            // Фокусируемся на последнем заполненном поле
            setTimeout(() => {
              const lastIndex = Math.min(5, cleanedText.length - 1);
              if (otpRefs.current[lastIndex]) {
                otpRefs.current[lastIndex].focus();
              }
            }, 0);
          }
        })
        .catch(err => {
          console.error('Ошибка при чтении из буфера обмена:', err);
        });
    }
  };

  // Обработчик изменения OTP поля
  const handleOTPChange = (e, index) => {
    const value = e.target.value.replace(/\D/g, '');
    
    if (value) {
      handleOTPInput(value[0], index);
      
      // Автопереход к следующему полю
      if (index < 5) {
        setTimeout(() => {
          if (otpRefs.current[index + 1]) {
            otpRefs.current[index + 1].focus();
          }
        }, 0);
      }
    } else {
      // Если значение пустое
      handleOTPInput('', index);
    }
  };

  // Обработчик вставки из буфера обмена для OTP
  const handleOTPPaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const cleanedText = pastedText.replace(/\D/g, '').slice(0, 6);
    
    if (cleanedText.length > 0) {
      setConfirmationCode(cleanedText);
      
      // Фокусируемся на последнем заполненном поле
      setTimeout(() => {
        const lastIndex = Math.min(5, cleanedText.length - 1);
        if (otpRefs.current[lastIndex]) {
          otpRefs.current[lastIndex].focus();
        }
      }, 0);
    }
  };

  const handleResendCode = async () => {
    if (resendCountdown > 0 || loading) return;
    setLoading(true);
    setFormErrors({});
    try {
      const result = await sendOTPCode(pendingEmail, !isLogin, isLogin);
      if (result.success) {
        setResendCountdown(60);
        toast.success('Код отправлен повторно');
      } else {
        setFormErrors({ general: result.message });
      }
    } catch {
      setFormErrors({ general: 'Не удалось отправить код' });
    } finally {
      setLoading(false);
    }
  };

  // Функция для рендеринга аутентификационных экранов
  const renderAuthScreen = () => {
    if (needsConfirmation) {
      return (
        <div className="app">
          <div className="auth-container">
            <div className="auth-logo">
              <img src="/icon-192.png" className="auth-logo-img" alt="DoubleDo" />
              <span className="auth-logo-text">DoubleDo</span>
            </div>

            <div className="otp-header">
              <div className="otp-title">Введите код</div>
              <div className="otp-desc">
                Мы отправили 6-значный код на <strong>{pendingEmail}</strong>
              </div>
            </div>

            {formErrors.general && (
              <div className="error-message" style={{ marginBottom: '16px' }}>
                {formErrors.general}
              </div>
            )}

            <form onSubmit={handleVerifyOTP} className="auth-form">
              <div className="otp-container" onPaste={handleOTPPaste}>
                {[...Array(6)].map((_, index) => (
                  <input
                    key={index}
                    ref={el => otpRefs.current[index] = el}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength="1"
                    className={`otp-input ${confirmationCode[index] ? 'filled' : ''} ${formErrors.confirmation ? 'error' : ''}`}
                    value={confirmationCode[index] || ''}
                    onChange={(e) => handleOTPChange(e, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    onFocus={(e) => e.target.select()}
                    disabled={loading}
                    autoFocus={index === 0}
                  />
                ))}
              </div>
              {formErrors.confirmation && (
                <div className="error-message" style={{ marginTop: '8px' }}>{formErrors.confirmation}</div>
              )}

              <button
                type="submit"
                className="auth-button"
                disabled={loading || confirmationCode.length !== 6}
              >
                {loading ? <div className="loading-spinner"></div> : (isLogin ? 'Войти' : 'Зарегистрироваться')}
              </button>
            </form>

            <div className="resend-section">
              {resendCountdown > 0 ? (
                <span className="resend-timer">Отправить повторно через {resendCountdown} с</span>
              ) : (
                <button type="button" className="resend-btn" onClick={handleResendCode} disabled={loading}>
                  Отправить код повторно
                </button>
              )}
            </div>

            <div className="back-container">
              <button
                type="button"
                className="back-button"
                onClick={() => {
                  setNeedsConfirmation(false);
                  setFormErrors({});
                  setConfirmationCode('');
                  setEmail(pendingEmail);
                }}
              >
                ← Назад
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="app">
        <div className={`auth-container ${transitioning ? 'fade-out' : 'fade-in'}`}>
          <div className="auth-logo">
            <img src="/icon-192.png" className="auth-logo-img" alt="DoubleDo" />
            <span className="auth-logo-text">DoubleDo</span>
          </div>

          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${isLogin ? 'active' : ''}`}
              onClick={() => !isLogin && toggleAuthMode()}
              disabled={loading}
            >
              Войти
            </button>
            <button
              type="button"
              className={`auth-tab ${!isLogin ? 'active' : ''}`}
              onClick={() => isLogin && toggleAuthMode()}
              disabled={loading}
            >
              Регистрация
            </button>
          </div>

          <p className="auth-subtitle">
            {isLogin
              ? 'Введите email — мы пришлём код для входа'
              : 'Введите email — мы пришлём код для регистрации'}
          </p>

          {formErrors.general && (
            <div className="error-message" style={{ marginBottom: '16px' }}>
              {formErrors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className={`form-input ${formErrors.email ? 'error' : ''}`}
                placeholder="your@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (formErrors.email) setFormErrors({ ...formErrors, email: '' });
                }}
                disabled={loading}
                autoFocus
              />
              {formErrors.email && (
                <div className="error-message">{formErrors.email}</div>
              )}
            </div>

            <button
              type="submit"
              className="auth-button"
              disabled={loading || !email.trim()}
            >
              {loading ? <div className="loading-spinner"></div> : (isLogin ? 'Войти' : 'Зарегистрироваться')}
            </button>
          </form>
        </div>
      </div>
    );
  };

  // Основной рендеринг
  return (
    <ThemeProvider>
    <Router>
      {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: { borderRadius: '12px', fontFamily: 'inherit', fontSize: '14px' }
        }}
      />
      <Routes>
        {/* Invite page is always accessible regardless of auth state */}
        <Route path="/invite/:token" element={<InvitePage />} />
        {user && !needsConfirmation ? (
          <>
            <Route path="/habits" element={<HabitsPage />} />
            <Route path="/competitions" element={<CompetitionsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/" element={<Navigate to="/competitions" replace />} />
            <Route path="*" element={<Navigate to="/competitions" replace />} />
          </>
        ) : (
          <Route path="*" element={renderAuthScreen()} />
        )}
      </Routes>
      {notifQueue.length > 0 && (
        <MissedNotificationOverlay
          key={notifQueue[0].key}
          notification={{
            type: notifQueue[0].type,
            friendUsername: notifQueue[0].competition.friend_username,
            habitTitle: notifQueue[0].competition.habit_title,
            emoji: notifQueue[0].emoji,
          }}
          onClose={handleNotifClose}
          onSendEmoji={handleNotifSendEmoji}
        />
      )}
    </Router>
    </ThemeProvider>
  );
}

export default App;
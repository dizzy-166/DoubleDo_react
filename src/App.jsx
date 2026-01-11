import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { supabase } from './services/supabase';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HabitsPage from './pages/HabitsPage.jsx';
import CompetitionsPage from './pages/CompetitionsPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
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
const sendOTPCode = async (email, isSignup = false) => {
  try {
    console.log('Sending OTP to:', email, 'isSignup:', isSignup);
    
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
      if (isLogin && (checkError || !checkResult)) {
        return {
          success: false,
          message: 'Пользователь не зарегистрирован в системе'
        };
      }
      
      // Если пользователь найден И мы пытаемся зарегистрироваться
      if (!isLogin && checkResult) {
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
        shouldCreateUser: !isLogin // 🔥 Это ключевое изменение!
        // false для входа (не создавать пользователя)
        // true для регистрации (создать пользователя)
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
  const [email, setEmail] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [canResend, setCanResend] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const otpRefs = useRef([]);

  // Инициализируем рефы для OTP полей
  useEffect(() => {
    otpRefs.current = otpRefs.current.slice(0, 6);
  }, []);

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
    const result = await sendOTPCode(email, !isLogin);
    
    if (result.success) {
      setNeedsConfirmation(true);
      setPendingEmail(email);
      setCanResend(false);
      
      setTimeout(() => setCanResend(true), 60000);
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

  // Обработчик подтверждения OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    
    if (!confirmationCode.trim()) {
      setFormErrors({ confirmation: 'Введите код подтверждения' });
      return;
    }

    if (confirmationCode.length !== 6) {
      setFormErrors({ confirmation: 'Код должен содержать 6 цифр' });
      return;
    }

    setLoading(true);
    setFormErrors({});

     try {
    const result = await verifyOTPCode(pendingEmail, confirmationCode);
    
    if (result.success) {
      console.log('OTP verified successfully');
      setNeedsConfirmation(false);
      setConfirmationCode('');
      
      // ✅ ДОБАВИТЬ: Устанавливаем username из email
      if (!isLogin) {
        const generatedUsername = extractUsernameFromEmail(pendingEmail);
        
        // Вызываем функцию для установки username в БД
        const { data, error } = await supabase.rpc('set_username_atomic', {
          new_username: generatedUsername
        });
        
        if (error) {
          console.error('Error setting username:', error);
          // Можно показать сообщение, но не блокировать вход
        }
        
        alert(`Регистрация успешна! Ваш никнейм: ${generatedUsername}`);
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
    if (!canResend) {
      setFormErrors({ general: 'Подождите 60 секунд перед повторной отправкой' });
      return;
    }
    
    setLoading(true);
    setFormErrors({});

    try {
      const result = await sendOTPCode(pendingEmail, !isLogin);
      
      if (result.success) {
        setCanResend(false);
        setTimeout(() => setCanResend(true), 60000);
        alert('Код подтверждения отправлен повторно');
      } else {
        setFormErrors({ general: result.message });
      }
    } catch (err) {
      setFormErrors({ general: 'Не удалось отправить код' });
    } finally {
      setLoading(false);
    }
  };

  // Функция для рендеринга аутентификационных экранов
  const renderAuthScreen = () => {
    // Экран подтверждения email
    if (needsConfirmation) {
      return (
        <div className="app">
          <div className="auth-container">
            <div className="auth-progress">
              <div className="progress-step">
                <div className="step-number">1</div>
                <span className="step-label">email</span>
              </div>
              <div className="progress-line"></div>
              <div className="progress-step active">
                <div className="step-number">2</div>
                <span className="step-label">Подтверждение</span>
              </div>
            </div>

            <div className="auth-header">
              <div className="logo">
                <div className="logo-icon">DD</div>
                <div className="logo-text">DoubleDo</div>
              </div>
              <div className="auth-welcome">
                <h1 className="auth-title">Подтверждение email</h1>
              </div>
              <p className="auth-subtitle">Завершите вход в ваш аккаунт</p>
            </div>

            <div className="otp-info">
              <p className="otp-email">{pendingEmail}</p>
              <p className="otp-text">
                Мы отправили 6-значный код подтверждения на вашу почту
              </p>
              <div className="paste-hint" style={{
                fontSize: '13px',
                color: 'var(--gray)',
                marginTop: '8px',
                fontStyle: 'italic'
              }}>
                {/* Можно вставить код через Ctrl+V или правой кнопкой → Вставить */}
              </div>
            </div>

            {/* {!isLogin && (
              <div className="username-notice">
                <p className="username-notice-text">
                  После регистрации ваш никнейм будет создан автоматически
                </p>
              </div>
            )} */}

            {formErrors.general && (
              <div className="error-message" style={{ marginBottom: '16px' }}>
                {formErrors.general}
              </div>
            )}

            <form onSubmit={handleVerifyOTP} className="auth-form">
              <div className="form-group">
                <label className="form-label">Код из email</label>
                <div 
                  className="otp-container"
                  onPaste={handleOTPPaste}
                >
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
                  <div className="error-message">{formErrors.confirmation}</div>
                )}
              </div>

              <button 
  type="submit" 
  className={`auth-button ${loading ? 'loading' : ''}`}
  disabled={loading || !email.trim()}
>
  <span className="button-content">
    {loading ? (
      <>
        <div className="loading-spinner-small"></div>
        <span>{isLogin ? 'Вход...' : 'Регистрация...'}</span>
      </>
    ) : (
      <>
        <span>{isLogin ? 'Войти с помощью OTP' : 'Зарегистрироваться с помощью OTP'}</span>
        <svg className="button-icon" width="20" height="20" viewBox="0 0 24 24">
          <path fill="currentColor" d="M10 17l5-5-5-5v10z"/>
        </svg>
      </>
    )}
  </span>
</button>
            </form>

            {/* <div className="auth-toggle">
              <span className="toggle-text">
                Не пришел код?
              </span>
              <button
                type="button"
                className="toggle-button"
                onClick={handleResendCode}
                disabled={!canResend || loading}
              >
                {canResend ? 'Отправить снова' : 'Подождите 60 сек'}
              </button>
            </div> */}

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
                ← Вернуться к {isLogin ? 'входу' : 'регистрации'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Основная форма (регистрация/вход)
    return (
      <div className="app">
        <div className={`auth-container ${transitioning ? 'fade-out' : 'fade-in'}`}>
          <div className="auth-progress">
            <div className="progress-step active">
              <div className="step-number">1</div>
              <span className="step-label"> email</span>
            </div>
            <div className="progress-line"></div>
            <div className="progress-step">
              <div className="step-number">2</div>
              <span className="step-label">Подтверждение</span>
            </div>
          </div>

          <div className="auth-header">
            <div className="logo">
              <div className="logo-icon">DD</div>
              <div className="logo-text">DoubleDo</div>
            </div>
            <div className="auth-welcome">
              <h1 className="auth-title">
                {isLogin ? 'С возвращением!' : 'Присоединяйтесь к сообществу'}
              </h1>
            </div>
            <p className="auth-subtitle">
              {isLogin 
                ? 'Становитесь лучше вместе с друзьями'
                : 'Создайте аккаунт и начните свой путь'
              }
            </p>
          </div>

          {formErrors.general && (
            <div className="error-message" style={{ marginBottom: '16px' }}>
              {formErrors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">Email</label>
              <div className="input-with-icon">
                <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z" 
                    fill="var(--gray)"/>
                </svg>
                <input
                  type="email" 
                  className={`form-input ${formErrors.email ? 'error' : ''}`}
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (formErrors.email) {
                      setFormErrors({ ...formErrors, email: '' });
                    }
                  }}
                  disabled={loading}
                  autoFocus
                />
              </div>
              {formErrors.email && (
                <div className="error-message">{formErrors.email}</div>
              )}
            </div>

            <button 
              type="submit" 
              className={`auth-button ${loading ? 'loading' : ''}`}
              disabled={loading || !email.trim()}
            >
              <span className="button-content">
                {loading ? (
                  <>
                    <div className="loading-spinner-small"></div>
                    <span>Отправка...</span>
                  </>
                ) : (
                  <>
                    <span>{isLogin ? 'Войти' : 'Зарегистрироваться'}</span>
                    <svg className="button-icon" width="20" height="20" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M10 17l5-5-5-5v10z"/>
                    </svg>
                  </>
                )}
              </span>
            </button>
          </form>

          <div className="auth-toggle">
            <span className="toggle-text">
              {isLogin ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
            </span>
            <button
              type="button"
              className="toggle-button"
              onClick={toggleAuthMode}
              disabled={loading}
            >
              {isLogin ? 'Создать аккаунт' : 'Войти'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Основной рендеринг
  return (
    <Router>
      <Routes>
        {user && !needsConfirmation ? (
          <>
            <Route path="/habits" element={<HabitsPage />} />
            <Route path="/competitions" element={<CompetitionsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/" element={<Navigate to="/competitions" replace />} />
            <Route path="*" element={<Navigate to="/competitions" replace />} />
          </>
        ) : (
          <Route path="*" element={renderAuthScreen()} />
        )}
      </Routes>
    </Router>
  );
}

export default App;
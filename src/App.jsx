import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { supabase } from './services/supabase';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HabitsPage from './pages/HabitsPage.jsx';
import CompetitionsPage from './pages/CompetitionsPage.jsx';
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
    
    const authOptions = {
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: isSignup
      }
    };

    const { data, error } = await supabase.auth.signInWithOtp(authOptions);

    if (error) {
      console.error('OTP send error:', error);
      return {
        success: false,
        message: error.message || 'Не удалось отправить код'
      };
    }

    return {
      success: true,
      message: '6-значный код отправлен на email. Проверьте почту.'
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
      const result = await sendOTPCode(email, !isLogin);
      
      if (result.success) {
        setNeedsConfirmation(true);
        setPendingEmail(email);
        setCanResend(false);
        
        setTimeout(() => setCanResend(true), 60000);
        
        alert(result.message);
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
        
        // При успешной аутентификации показываем уведомление
        if (!isLogin) {
          const generatedUsername = extractUsernameFromEmail(pendingEmail);
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
            <div className="auth-header">
              <div className="logo">
                <div className="logo-icon">DD</div>
                <div className="logo-text">DoubleDo</div>
              </div>
              <p className="auth-subtitle">Подтверждение email</p>
            </div>

            <div style={{
              textAlign: 'center',
              marginBottom: '32px',
              color: 'var(--dark)'
            }}>
              <p style={{ 
                fontSize: '18px', 
                fontWeight: '500',
                marginBottom: '8px',
                wordBreak: 'break-all'
              }}>
                {pendingEmail}
              </p>
              <p style={{ 
                color: 'var(--dark-gray)',
                lineHeight: '1.5',
                marginBottom: '8px'
              }}>
                Мы отправили 6-значный код подтверждения на вашу почту
              </p>
              {!isLogin && (
                <p style={{ 
                  color: 'var(--primary)',
                  fontSize: '14px',
                  marginTop: '12px',
                  padding: '8px',
                  backgroundColor: 'rgba(0, 150, 255, 0.1)',
                  borderRadius: '8px'
                }}>
                  После регистрации ваш никнейм будет создан автоматически
                </p>
              )}
            </div>

            {formErrors.general && (
              <div className="error-message" style={{ marginBottom: '16px' }}>
                {formErrors.general}
              </div>
            )}

            <form onSubmit={handleVerifyOTP} className="auth-form">
              <div className="form-group">
                <label className="form-label">Код из email</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={`form-input ${formErrors.confirmation ? 'error' : ''}`}
                  placeholder="Введите 6-значный код"
                  value={confirmationCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setConfirmationCode(value);
                  }}
                  disabled={loading}
                  style={{
                    letterSpacing: '8px',
                    fontSize: '24px',
                    textAlign: 'center',
                    fontWeight: '600',
                    padding: '15px'
                  }}
                  autoFocus
                />
                {formErrors.confirmation && (
                  <div className="error-message">{formErrors.confirmation}</div>
                )}
              </div>

              <button 
                type="submit" 
                className="auth-button"
                disabled={loading || confirmationCode.length !== 6}
                style={{
                  opacity: confirmationCode.length !== 6 ? 0.5 : 1
                }}
              >
                {loading ? (
                  <div className="loading-spinner"></div>
                ) : 'Подтвердить'}
              </button>
            </form>

            <div className="auth-toggle">
              <span className="toggle-text">
                Не пришел код?
              </span>
              <button
                type="button"
                className="toggle-button"
                onClick={handleResendCode}
                disabled={!canResend || loading}
                style={{
                  opacity: !canResend ? 0.5 : 1
                }}
              >
                {canResend ? 'Отправить снова' : 'Подождите 60 сек'}
              </button>
            </div>

            <div style={{
              textAlign: 'center',
              marginTop: '24px',
              paddingTop: '24px',
              borderTop: '1px solid var(--light-gray)'
            }}>
              <button
                type="button"
                className="toggle-button"
                onClick={() => {
                  setNeedsConfirmation(false);
                  setFormErrors({});
                  setConfirmationCode('');
                  setEmail(pendingEmail);
                }}
                style={{
                  fontSize: '14px',
                  color: 'var(--dark-gray)'
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
        <div className="auth-container">
          <div className="auth-header">
            <div className="logo">
              <div className="logo-icon">DD</div>
              <div className="logo-text">DoubleDo</div>
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
              {formErrors.email && (
                <div className="error-message">{formErrors.email}</div>
              )}
            </div>

            {/* {!isLogin && (
              <div style={{
                marginBottom: '16px',
                padding: '12px',
                backgroundColor: 'rgba(0, 150, 255, 0.1)',
                borderRadius: '8px',
                fontSize: '14px',
                color: 'var(--dark)',
                textAlign: 'center'
              }}>
                <p style={{ margin: 0 }}>
                  Ваш никнейм будет автоматически создан из вашего email
                </p>
                <p style={{ 
                  margin: '4px 0 0 0',
                  fontSize: '12px',
                  color: 'var(--dark-gray)'
                }}>
                  Например: obeme22864@gmail.com → obeme22864
                </p>
              </div>
            )} */}

            <button 
              type="submit" 
              className="auth-button"
              disabled={loading || !email.trim()}
              style={{
                opacity: !email.trim() ? 0.5 : 1,
                marginTop: '20px'
              }}
            >
              {loading ? (
                <div className="loading-spinner"></div>
              ) : isLogin ? 'Войти' : 'Зарегистрироваться'}
            </button>

            <div style={{
              fontSize: '12px',
              color: 'var(--gray)',
              marginTop: '12px',
              textAlign: 'center',
              padding: '8px',
              backgroundColor: 'var(--light)',
              borderRadius: '8px',
              border: '1px solid var(--light-gray)'
            }}>
              <span>Безопасный вход по email (без пароля)</span>
            </div>
          </form>

          <div className="auth-toggle">
            <span className="toggle-text">
              {isLogin ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
            </span>
            <button
              type="button"
              className="toggle-button"
              onClick={() => {
                setIsLogin(!isLogin);
                setFormErrors({});
                setEmail('');
              }}
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
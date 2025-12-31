// App.jsx (без пароля - только OTP)
import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { supabase } from './services/supabase';
import HabitsPage from './pages/HabitsPage.jsx';
import './App.css';

function App() {
  const { user, loginWithOTP, signupWithOTP, verifyOTP, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [username, setUsername] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [canResend, setCanResend] = useState(true);
  const [existingUser, setExistingUser] = useState(null);

  // Проверяем при загрузке, нужен ли пользователю никнейм
  useEffect(() => {
    if (user && user.id && !needsConfirmation) {
      checkIfUsernameNeeded();
    }
  }, [user, needsConfirmation]);

  const checkIfUsernameNeeded = async () => {
    if (!user || !user.id) return;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('username')
        .eq('id', user.id)
        .single();
      
      if (!error && data) {
        const currentUsername = data.username;
        console.log('Current username:', currentUsername);
        
        // Проверяем, является ли ник временным
        if (currentUsername && (currentUsername.startsWith('temp_') || currentUsername.startsWith('user_'))) {
          setNeedsUsername(true);
        }
      }
    } catch (err) {
      console.log('Error checking username:', err);
    }
  };

  // Проверка существования пользователя
  const checkUserExists = async (email) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username')
        .eq('email', email)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        console.log('Check user error:', error);
        return null;
      }
      
      return data;
    } catch (err) {
      console.log('Error checking user:', err);
      return null;
    }
  };

  const validateEmail = (email) => {
    if (!email) return 'Email обязателен';
    if (!/\S+@\S+\.\S+/.test(email)) return 'Некорректный email';
    return null;
  };

  const validateUsername = () => {
    const errors = {};
    
    if (!username.trim()) {
      errors.username = 'Никнейм обязателен';
    } else if (username.length < 3) {
      errors.username = 'Минимум 3 символа';
    } else if (username.length > 20) {
      errors.username = 'Максимум 20 символов';
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      errors.username = 'Только буквы, цифры и нижнее подчеркивание';
    }
    
    return errors;
  };

  // Обработка отправки OTP
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
      // Проверяем, существует ли пользователь
      const existingUserData = await checkUserExists(email);
      setExistingUser(existingUserData);
      
      let result;
      
      if (isLogin) {
        // Вход - только для существующих пользователей
        if (!existingUserData) {
          setFormErrors({ 
            email: 'Пользователь с таким email не найден. Зарегистрируйтесь.' 
          });
          setLoading(false);
          return;
        }
        
        result = await sendOTPCode(email, false); // false = вход
      } else {
        // Регистрация - только для новых пользователей
        if (existingUserData) {
          setFormErrors({ 
            email: 'Пользователь с таким email уже существует. Войдите в систему.' 
          });
          setLoading(false);
          return;
        }
        
        result = await sendOTPCode(email, true); // true = регистрация
      }
      
      if (result.success) {
        setNeedsConfirmation(true);
        setPendingEmail(email);
        setCanResend(false);
        
        // Через 60 секунд разрешаем повторную отправку
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

  // Подтверждение OTP кода
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
      const result = await verifyOTP(pendingEmail, confirmationCode);
      
      if (result.success) {
        setNeedsConfirmation(false);
        setConfirmationCode('');
        
        // Проверяем, нужно ли установить никнейм
        if (existingUser) {
          // Существующий пользователь - проверяем ник
          await checkIfUsernameNeeded();
        } else {
          // Новый пользователь - всегда нужно установить ник
          setNeedsUsername(true);
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

  // Установка никнейма
  const handleSetUsername = async (e) => {
    e.preventDefault();
    
    const errors = validateUsername();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setUsernameLoading(true);
    setFormErrors({});

    try {
      // Используем RPC функцию для установки никнейма
      const { data, error } = await supabase.rpc('set_username_atomic', {
        new_username: username.trim()
      });
      
      if (error) throw error;
      
      if (data && data.success) {
        setNeedsUsername(false);
        setUsername('');
        
        // Обновляем сессию
        await supabase.auth.refreshSession();
        
        alert('Никнейм успешно сохранен! Регистрация завершена.');
        
        // Перезагружаем страницу для обновления данных пользователя
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setFormErrors({ 
          username: data?.message || 'Ошибка при установке никнейма',
          error_code: data?.error
        });
      }
    } catch (err) {
      console.error('Error setting username:', err);
      
      let errorMessage = 'Произошла ошибка при сохранении никнейма';
      if (err.message.includes('409') || err.message.includes('USERNAME_TAKEN')) {
        errorMessage = 'Этот никнейм уже занят';
      } else if (err.message.includes('401') || err.message.includes('токен')) {
        errorMessage = 'Ошибка авторизации. Пожалуйста, войдите заново.';
      }
      
      setFormErrors({ 
        username: errorMessage,
        general: err.message
      });
    } finally {
      setUsernameLoading(false);
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
      // Повторно отправляем OTP код
      let result;
      if (existingUser) {
        result = await loginWithOTP(pendingEmail);
      } else {
        result = await signupWithOTP(pendingEmail);
      }
      
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

  const checkUsernameAvailability = async () => {
    if (!username.trim() || username.length < 3) return false;

    try {
      const { data, error } = await supabase.rpc('check_username_available', {
        check_username: username.trim()
      });
      
      if (error) {
        console.log('Username availability check failed:', error);
        return false;
      }
      
      return data;
    } catch (err) {
      console.log('Error checking username availability:', err);
      return false;
    }
  };

  // Если пользователь авторизован и имеет нормальный никнейм
  if (user && user.id && !needsConfirmation && !needsUsername) {
    return <HabitsPage />;
  }

  // Экран создания никнейма
  if (needsUsername) {
    return (
      <div className="app">
        <div className="auth-container">
          <div className="auth-header">
            <div className="logo">
              <div className="logo-icon">DD</div>
              <div className="logo-text">DoubleDo</div>
            </div>
            <p className="auth-subtitle">Придумайте никнейм и начните свой путь</p>
          </div>

          <div style={{
            textAlign: 'center',
            marginBottom: '32px',
            color: 'var(--dark)'
          }}>
            <p style={{ 
              color: 'var(--dark-gray)',
              lineHeight: '1.5',
              fontSize: '15px'
            }}>
              Ваш никнейм будет использоваться во всем приложении.<br />
              Друзья будут искать вас по этому никнейму.
            </p>
          </div>

          {formErrors.general && (
            <div className="error-message" style={{ marginBottom: '16px' }}>
              {formErrors.general}
            </div>
          )}

          <form onSubmit={handleSetUsername} className="auth-form">
            <div className="form-group">
              <label className="form-label">Ваш никнейм</label>
              <input
                type="text"
                className={`form-input ${formErrors.username ? 'error' : ''}`}
                placeholder="например, super_user123"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  // Очищаем ошибку при вводе
                  if (formErrors.username) {
                    setFormErrors({ ...formErrors, username: '' });
                  }
                }}
                disabled={usernameLoading}
                style={{
                  textAlign: 'center',
                  fontSize: '18px',
                  fontWeight: '500'
                }}
                onBlur={async () => {
                  if (username.length >= 3 && !formErrors.username) {
                    try {
                      const isAvailable = await checkUsernameAvailability();
                      console.log('Username available check result:', isAvailable);
                      if (isAvailable === false) {
                        setFormErrors(prev => ({ 
                          ...prev, 
                          username: 'Этот никнейм уже занят' 
                        }));
                      }
                    } catch (err) {
                      console.log('Availability check error:', err);
                    }
                  }
                }}
              />
              {formErrors.username && (
                <div className="error-message">
                  {formErrors.username}
                  {formErrors.error_code === 'USERNAME_TAKEN' && ' (попробуйте другой)'}
                  {formErrors.error_code === 'USERNAME_TOO_SHORT' && ' (минимум 3 символа)'}
                  {formErrors.error_code === 'USERNAME_TOO_LONG' && ' (максимум 20 символов)'}
                  {formErrors.error_code === 'USERNAME_INVALID_FORMAT' && ' (только буквы, цифры и _)'}
                </div>
              )}
              <div style={{
                fontSize: '12px',
                color: 'var(--gray)',
                marginTop: '8px',
                textAlign: 'center'
              }}>
                <div>• От 3 до 20 символов</div>
                <div>• Можно использовать буквы, цифры и _</div>
                <div>• Регистр не учитывается (SuperUser = superuser)</div>
              </div>
            </div>

            <button 
              type="submit" 
              className="auth-button"
              disabled={usernameLoading || !username.trim() || username.length < 3}
              style={{
                opacity: (!username.trim() || username.length < 3) ? 0.5 : 1
              }}
            >
              {usernameLoading ? (
                <div className="loading-spinner"></div>
              ) : 'Сохранить'}
            </button>
          </form>

          <div style={{
            textAlign: 'center',
            marginTop: '32px',
            paddingTop: '24px',
            borderTop: '1px solid var(--light-gray)'
          }}>
            <p style={{ 
              color: 'var(--gray)',
              fontSize: '14px'
            }}>
              Никнейм можно изменить только 1 раз в месяц.<br />
              Выберите внимательно!
            </p>
          </div>
        </div>
      </div>
    );
  }

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
            <p style={{ 
              color: 'var(--gray)',
              fontSize: '14px',
              fontStyle: 'italic'
            }}>
              Проверьте папку "Спам", если не видите письмо
            </p>
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
                setIsLogin(true);
              }}
              style={{
                fontSize: '14px',
                color: 'var(--dark-gray)'
              }}
            >
              ← Вернуться к входу
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Основная форма (вход/регистрация)
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
            />
            {formErrors.email && (
              <div className="error-message">{formErrors.email}</div>
            )}
          </div>

          <button 
            type="submit" 
            className="auth-button"
            disabled={loading || !email.trim()}
            style={{
              opacity: !email.trim() ? 0.5 : 1
            }}
          >
            {loading ? (
              <div className="loading-spinner"></div>
            ) : isLogin ? 'Получить код для входа' : 'Зарегистрироваться'}
          </button>
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
            {isLogin ? 'Регистрация' : 'Войти'}
          </button>
        </div>

        <div style={{
          textAlign: 'center',
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: '1px solid var(--light-gray)',
          fontSize: '14px',
          color: 'var(--gray)'
        }}>
          <p>
            <strong>Как это работает:</strong>
          </p>
          <p style={{ marginTop: '8px', lineHeight: '1.5' }}>
            1. Введите email<br/>
            2. Получите код на почту<br/>
            3. Введите код для входа
          </p>
          <p style={{ marginTop: '12px', fontSize: '13px', fontStyle: 'italic' }}>
            Пароль не нужен! Безопасно и удобно.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
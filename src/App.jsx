import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { supabase } from './services/supabase';
import './App.css';

function App() {
  const { user, login, signup, logout, verifyEmailOTP, signupWithOTP } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

  // Проверяем при загрузке, нужен ли пользователю никнейм
  useEffect(() => {
    if (user && user.id && !needsConfirmation) {
      checkIfUsernameNeeded();
    }
  }, [user, needsConfirmation]);

  const checkIfUsernameNeeded = async () => {
  if (!user || !user.id) return;
  
  try {
    // Используем полный URL вместо относительного
    const fullUrl = `https://ydetmjryjpnrpcmoxvre.supabase.co/rest/v1/users?id=eq.${user.id}&select=username`;
    
    const response = await fetch(fullUrl, {
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${user.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Проверяем статус ответа
    if (!response.ok) {
      const text = await response.text();
      console.error('Server error:', response.status, text);
      return;
    }
    
    const userData = await response.json();
    
    if (userData && userData[0]) {
      const currentUsername = userData[0].username;
      if (currentUsername && (currentUsername.startsWith('temp_') || currentUsername.startsWith('user_'))) {
        setNeedsUsername(true);
      }
    }
  } catch (err) {
    console.error('Error checking username:', err);
  }
};

  const validateForm = () => {
    const errors = {};

    if (!email) {
      errors.email = 'Email обязателен';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Некорректный email';
    }

    if (isLogin) {
      if (!password) {
        errors.password = 'Пароль обязателен';
      }
    } else {
      if (!password) {
        errors.password = 'Пароль обязателен';
      } else if (password.length < 6) {
        errors.password = 'Минимум 6 символов';
      }
      
      if (!confirmPassword) {
        errors.confirmPassword = 'Повторите пароль';
      } else if (password !== confirmPassword) {
        errors.confirmPassword = 'Пароли не совпадают';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
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

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setFormErrors({});

    try {
      if (isLogin) {
        // Вход по паролю
        const { data, error: authError } = await login(email, password);
        if (authError) {
          setFormErrors({ general: authError.message });
        }
      } else {
        // Регистрация через OTP (без пароля)
        const { data, error: authError } = await signupWithOTP(email);
        
        if (authError) {
          if (authError.message.includes('rate limit') || authError.status === 429) {
            setFormErrors({ 
              general: 'Слишком много запросов. Пожалуйста, подождите 60 секунд.'
            });
          } else {
            setFormErrors({ general: authError.message });
          }
        } else {
          // Успешно отправлен OTP для регистрации
          setNeedsConfirmation(true);
          setPendingEmail(email);
          setCanResend(false);
          
          // Через 60 секунд разрешаем повторную отправку
          setTimeout(() => setCanResend(true), 60000);
          
          alert(`Код подтверждения отправлен на ${email}. Проверьте вашу почту.`);
        }
      }
    } catch (err) {
      setFormErrors({ general: 'Произошла ошибка. Попробуйте снова.' });
      console.error('Auth error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
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
      // Верифицируем OTP код для регистрации
      const { data, error } = await verifyEmailOTP(pendingEmail, confirmationCode);
      
      if (error) {
        setFormErrors({ confirmation: error.message || 'Неверный код' });
      } else if (data?.user) {
        // Успешная верификация регистрации
        setNeedsConfirmation(false);
        setConfirmationCode('');
        
        // Получаем обновленную сессию
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          // Пользователь создан через OTP, теперь нужно установить никнейм
          setNeedsUsername(true);
        }
      }
    } catch (err) {
      setFormErrors({ confirmation: 'Неверный код или произошла ошибка' });
      console.error('Verify error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSetUsername = async (e) => {
    e.preventDefault();
    
    if (!validateUsername()) {
      return;
    }

    setUsernameLoading(true);
    setFormErrors({});

    try {
      const response = await fetch('/rest/v1/rpc/set_username_atomic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${user?.access_token || ''}`
        },
        body: JSON.stringify({
          new_username: username.trim()
        })
      });

      const result = await response.json();

      if (result.success) {
        setNeedsUsername(false);
        setUsername('');
        
        alert('Регистрация завершена! Теперь вы можете войти с вашим email и паролем.');
      } else {
        setFormErrors({ 
          username: result.message || 'Ошибка при установке никнейма',
          error_code: result.error
        });
      }
    } catch (err) {
      setFormErrors({ username: 'Произошла ошибка при сохранении никнейма' });
      console.error('Error setting username:', err);
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
      // Повторно отправляем OTP код для регистрации
      const { data, error } = await signupWithOTP(pendingEmail);
      
      if (error) {
        setFormErrors({ general: error.message });
      } else {
        setCanResend(false);
        setTimeout(() => setCanResend(true), 60000);
        alert('Код подтверждения отправлен повторно');
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
    const response = await fetch('https://ydetmjryjpnrpcmoxvre.supabase.co/rest/v1/rpc/check_username_available', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${user?.access_token || ''}`
      },
      body: JSON.stringify({
        check_username: username.trim()
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Server error:', response.status, text);
      return false;
    }

    const result = await response.json();
    return result;
  } catch (err) {
    console.error('Error checking username:', err);
    return false;
  }
};

  // Если пользователь авторизован и имеет нормальный никнейм
  if (user && user.id && !needsConfirmation && !needsUsername) {
    return (
      <div className="app">
        <div className="dashboard">
          <div className="welcome-section">
            <div className="welcome-header">
              <div className="user-info">
                <h1>Добро пожаловать!</h1>
                <p className="user-email">{user.email}</p>
              </div>
              <button onClick={logout} className="logout-button">
                Выйти
              </button>
            </div>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <h3>🎯 Создавайте привычки</h3>
              <p>Начните отслеживать свои ежедневные привычки.</p>
            </div>
            <div className="feature-card">
              <h3>👥 Соревнуйтесь с друзьями</h3>
              <p>Бросайте вызов друзьям в соревнованиях по привычкам.</p>
            </div>
            <div className="feature-card">
              <h3>📈 Отслеживайте прогресс</h3>
              <p>Смотрите свою статистику и улучшайте результаты.</p>
            </div>
          </div>
        </div>
      </div>
    );
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
                onChange={(e) => setUsername(e.target.value)}
                disabled={usernameLoading}
                style={{
                  textAlign: 'center',
                  fontSize: '18px',
                  fontWeight: '500'
                }}
                onBlur={async () => {
                  if (username.length >= 3) {
                    const isAvailable = await checkUsernameAvailability();
                    if (!isAvailable && !formErrors.username) {
                      setFormErrors({ username: 'Этот никнейм уже занят' });
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

  // Экран подтверждения email (для регистрации через OTP)
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

          <form onSubmit={handleVerifyCode} className="auth-form">
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
              ) : 'Подтвердить регистрацию'}
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
                setIsLogin(true); // Переключаем на вход
              }}
              style={{
                fontSize: '14px',
                color: 'var(--dark-gray)'
              }}
            >
              ← Войти в существующий аккаунт
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
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            {formErrors.email && (
              <div className="error-message">{formErrors.email}</div>
            )}
          </div>

          {isLogin && (
            <div className="form-group">
              <label className="form-label">Пароль</label>
              <input
                type="password"
                className={`form-input ${formErrors.password ? 'error' : ''}`}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              {formErrors.password && (
                <div className="error-message">{formErrors.password}</div>
              )}
            </div>
          )}

          {!isLogin && (
            <>
              <div className="form-group">
                <label className="form-label">Пароль</label>
                <input
                  type="password"
                  className={`form-input ${formErrors.password ? 'error' : ''}`}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                {formErrors.password && (
                  <div className="error-message">{formErrors.password}</div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Повторите пароль</label>
                <input
                  type="password"
                  className={`form-input ${formErrors.confirmPassword ? 'error' : ''}`}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
                {formErrors.confirmPassword && (
                  <div className="error-message">{formErrors.confirmPassword}</div>
                )}
              </div>
            </>
          )}

          <button 
            type="submit" 
            className="auth-button"
            disabled={loading}
          >
            {loading ? (
              <div className="loading-spinner"></div>
            ) : isLogin ? 'Войти' : 'Зарегистрироваться'}
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
              setConfirmPassword('');
              setPassword('');
            }}
            disabled={loading}
          >
            {isLogin ? 'Регистрация' : 'Войти'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
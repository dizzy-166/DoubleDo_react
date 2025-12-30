import React, { useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import './App.css';

function App() {
  const { user, login, signup, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const validateForm = () => {
    const errors = {};

    if (!email) {
      errors.email = 'Email обязателен';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Некорректный email';
    }

    if (!password) {
      errors.password = 'Пароль обязателен';
    } else if (password.length < 6) {
      errors.password = 'Минимум 6 символов';
    }

    if (!isLogin) {
      if (!confirmPassword) {
        errors.confirmPassword = 'Повторите пароль';
      } else if (password !== confirmPassword) {
        errors.confirmPassword = 'Пароли не совпадают';
      }
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
      const { error: authError } = isLogin 
        ? await login(email, password)
        : await signup(email, password);

      if (authError) {
        setFormErrors({ general: authError.message });
      }
    } catch (err) {
      setFormErrors({ general: 'Произошла ошибка. Попробуйте снова.' });
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return (
      <div className="app">
        <div className="dashboard">
          <div className="welcome-section">
            <div className="welcome-header">
              <div className="user-info">
                <h1>Welcome, {user.email?.split('@')[0]}!</h1>
                <p className="user-email">{user.email}</p>
              </div>
              <button onClick={logout} className="logout-button">
                Выйти
              </button>
            </div>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <h3>🎯 Ставьте цели</h3>
              <p>Создавайте цели на день, неделю или месяц.</p>
            </div>
            <div className="feature-card">
              <h3>👥 Приглашайте друзей</h3>
              <p>Делитесь целями и поддерживайте друг друга.</p>
            </div>
            <div className="feature-card">
              <h3>📈 Отслеживайте прогресс</h3>
              <p>Наглядная статистика покажет ваш прогресс.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

          {!isLogin && (
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
          )}

          <button 
            type="submit" 
            className="auth-button"
            disabled={loading}
          >
            {loading ? (
              <div className="loading-spinner"></div>
            ) : isLogin ? 'Войти' : 'Создать'}
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
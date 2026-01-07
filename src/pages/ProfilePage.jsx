import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../services/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import './ProfilePage.css';

function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  // Определение активной вкладки
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/competitions')) return 'competitions';
    if (path.includes('/profile')) return 'profile';
    return 'habits';
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Ошибка при выходе:', error);
        alert('Не удалось выйти. Попробуйте снова.');
      } else {
        console.log('Успешный выход');
        navigate('/login');
      }
    } catch (err) {
      console.error('Ошибка:', err);
      alert('Произошла ошибка при выходе');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="profile-page">
      {/* Заголовок как в HabitsPage */}
      <header className="profile-header">
        <div className="header-content">
          <h1>DoubleDo</h1>
          <div className="user-avatar">
            <span>{user.email?.charAt(0).toUpperCase()}</span>
          </div>
        </div>
      </header>

      <main className="profile-main">
        <div className="profile-info-card">
          <div className="avatar-section">
            <div className="avatar-large">
              {user.email?.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <h2 className="user-email">{user.email}</h2>
              <p className="user-id">ID: {user.id.substring(0, 8)}...</p>
            </div>
          </div>

          <div className="profile-stats">
            <div className="stat-item">
              <span className="stat-label">Дата регистрации:</span>
              <span className="stat-value">
                {new Date(user.created_at).toLocaleDateString('ru-RU')}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Почта подтверждена:</span>
              <span className="stat-value">
                {user.email_confirmed_at ? 'Да' : 'Нет'}
              </span>
            </div>
          </div>

          <div className="logout-section">
            <button
              onClick={handleLogout}
              disabled={loading}
              className="logout-btn"
            >
              {loading ? 'Выход...' : 'Выйти из аккаунта'}
            </button>
            
            <div className="logout-note">
              При выходе все данные сохранятся. Вы сможете войти снова по email.
            </div>
          </div>
        </div>

        <div className="app-info-section">
          <p className="app-info">
            DoubleDo — приложение для отслеживания привычек и соревнований
          </p>
          <p className="version">Версия 1.0.0</p>
        </div>
      </main>

      {/* Навигация как в HabitsPage */}
      <nav className="bottom-nav">
        <button 
          className={`nav-item ${getActiveTab() === 'competitions' ? 'active' : ''}`}
          onClick={() => navigate('/competitions')}
        >
          <span className="nav-icon">🏆</span>
          {/* <span className="nav-text">Соревнования</span> */}
        </button>
        
        <button 
          className={`nav-item ${getActiveTab() === 'habits' ? 'active' : ''}`}
          onClick={() => navigate('/habits')}
        >
          <span className="nav-icon">✅</span>
          {/* <span className="nav-text">Привычки</span> */}
        </button>
        
        <button 
          className={`nav-item ${getActiveTab() === 'profile' ? 'active' : ''}`}
          onClick={() => navigate('/profile')}
        >
          <span className="nav-icon">👤</span>
          {/* <span className="nav-text">Профиль</span> */}
        </button>
      </nav>
    </div>
  );
}

export default ProfilePage;
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import './ProfilePage.css';

function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Ошибка при выходе:', error);
        alert('Не удалось выйти. Попробуйте снова.');
      } else {
        // Автоматически перенаправит на страницу входа через контекст AuthContext
        console.log('Успешный выход');
      }
    } catch (err) {
      console.error('Ошибка:', err);
      alert('Произошла ошибка при выходе');
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    navigate('/competitions');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <button 
          onClick={handleGoBack}
          className="back-button"
        >
          ← Назад
        </button>
        <h1>Профиль</h1>
      </div>

      <div className="profile-content">
        <div className="profile-info">
          <div className="avatar-section">
            <div className="avatar-placeholder">
              {user.email?.charAt(0).toUpperCase()}
            </div>
            <div className="user-email">
              {user.email}
            </div>
          </div>

          <div className="profile-stats">
            <div className="stat-item">
              <span className="stat-label">ID пользователя:</span>
              <span className="stat-value">{user.id.substring(0, 8)}...</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Дата регистрации:</span>
              <span className="stat-value">
                {new Date(user.created_at).toLocaleDateString('ru-RU')}
              </span>
            </div>
          </div>
        </div>

        <div className="profile-actions">
          <button
            onClick={handleLogout}
            disabled={loading}
            className="logout-button"
          >
            {loading ? 'Выход...' : 'Выйти из аккаунта'}
          </button>
          
          <div className="logout-note">
            При выходе все данные сохранятся. Вы сможете войти снова по email.
          </div>
        </div>

        <div className="profile-footer">
          <p className="app-info">
            DoubleDo — приложение для отслеживания привычек и соревнований
          </p>
          <p className="version">Версия 1.0.0</p>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../services/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import './ProfilePage.css';

function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [username, setUsername] = useState('');
  const [initialUsername, setInitialUsername] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [usernameError, setUsernameError] = useState('');

  // Определение активной вкладки
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/competitions')) return 'competitions';
    if (path.includes('/profile')) return 'profile';
    return 'habits';
  };

  // Загрузка данных пользователя
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      try {
        // Загружаем данные из таблицы users (с username)
        const { data, error } = await supabase
          .from('users')
          .select('username, avatar_url')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Ошибка при загрузке данных пользователя:', error);
        }

        if (data) {
          setUsername(data.username || '');
          setInitialUsername(data.username || '');
          setAvatarUrl(data.avatar_url || '');
        } else {
          // Если записи нет (маловероятно), создаем временный username
          const tempUsername = `user_${user.id.substring(0, 8)}`;
          setUsername(tempUsername);
          setInitialUsername(tempUsername);
        }
      } catch (err) {
        console.error('Ошибка:', err);
      }
    };

    fetchUserData();
  }, [user]);

  // Обработка выхода
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

  // Проверка доступности username
  const checkUsernameAvailable = async (usernameToCheck) => {
    try {
      const { data, error } = await supabase.rpc('check_username_available', {
        check_username: usernameToCheck
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Ошибка при проверке username:', error);
      return false;
    }
  };

  // Сохранение username
  const handleSaveUsername = async () => {
    if (!user) return;
    
    // Сброс ошибок
    setUsernameError('');
    
    // Проверка на пустой username
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setUsernameError('Никнейм не может быть пустым');
      return;
    }

    // Проверка на длину username
    if (trimmedUsername.length < 3) {
      setUsernameError('Никнейм должен быть не менее 3 символов');
      return;
    }
    
    if (trimmedUsername.length > 20) {
      setUsernameError('Никнейм должен быть не более 20 символов');
      return;
    }

    // Проверка формата
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      setUsernameError('Никнейм может содержать только буквы, цифры и подчеркивания');
      return;
    }

    // Проверка доступности
    try {
      setUsernameLoading(true);
      
      const isAvailable = await checkUsernameAvailable(trimmedUsername);
      
      if (!isAvailable) {
        setUsernameError('Этот никнейм уже занят');
        return;
      }

      // Обновление username через RPC функцию
      const { data, error } = await supabase.rpc('set_username_atomic', {
        new_username: trimmedUsername
      });

      if (error) {
        // Парсим JSON ошибки
        let errorMessage = 'Не удалось обновить никнейм';
        try {
          const errorData = JSON.parse(error.message);
          switch (errorData.error) {
            case 'USERNAME_TOO_SHORT':
              errorMessage = 'Никнейм должен быть не менее 3 символов';
              break;
            case 'USERNAME_TOO_LONG':
              errorMessage = 'Никнейм должен быть не более 20 символов';
              break;
            case 'USERNAME_INVALID_FORMAT':
              errorMessage = 'Никнейм может содержать только буквы, цифры и подчеркивания';
              break;
            case 'USERNAME_TAKEN':
              errorMessage = 'Этот никнейм уже занят';
              break;
            default:
              errorMessage = errorData.message || errorMessage;
          }
        } catch (e) {
          // Если не JSON, используем оригинальное сообщение
          errorMessage = error.message;
        }
        setUsernameError(errorMessage);
        return;
      }

      // Проверяем успешность
      if (data && data.success) {
        setInitialUsername(trimmedUsername);
        setEditingUsername(false);
        alert(data.message || 'Никнейм успешно обновлен!');
      } else {
        setUsernameError(data?.message || 'Не удалось обновить никнейм');
      }
    } catch (error) {
      console.error('Ошибка при сохранении никнейма:', error);
      setUsernameError('Произошла ошибка при сохранении');
    } finally {
      setUsernameLoading(false);
    }
  };

  // Отмена редактирования
  const handleCancelEdit = () => {
    setUsername(initialUsername);
    setUsernameError('');
    setEditingUsername(false);
  };

  // Получение инициалов для аватара
  const getAvatarInitials = () => {
    if (username && username.trim()) {
      return username.trim().charAt(0).toUpperCase();
    }
    return user?.email?.charAt(0).toUpperCase() || 'U';
  };

  // Получение отображаемого имени
  const getDisplayName = () => {
    if (username && username.trim()) {
      return username.trim();
    }
    return user?.email || '';
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
            <span>{getAvatarInitials()}</span>
          </div>
        </div>
      </header>

      <main className="profile-main">
        <div className="profile-info-card">
          <div className="avatar-section">
            <div className="avatar-large">
              {avatarUrl ? (
                <img src={avatarUrl} alt={getDisplayName()} className="avatar-image" />
              ) : (
                <span>{getAvatarInitials()}</span>
              )}
            </div>
            <div className="user-details">
              {editingUsername ? (
                <div className="username-edit-container">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setUsernameError('');
                    }}
                    placeholder="Введите ваш никнейм"
                    className={`username-input ${usernameError ? 'error' : ''}`}
                    maxLength={20}
                    autoFocus
                    disabled={usernameLoading}
                  />
                  {usernameError && (
                    <div className="username-error">{usernameError}</div>
                  )}
                  <div className="username-edit-actions">
                    <button
                      onClick={handleSaveUsername}
                      disabled={usernameLoading || !username.trim()}
                      className="save-username-btn"
                    >
                      {usernameLoading ? 'Сохранение...' : 'Сохранить'}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={usernameLoading}
                      className="cancel-username-btn"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="user-username">{getDisplayName()}</h2>
                  <p className="user-email">{user.email}</p>
                  <button
                    onClick={() => setEditingUsername(true)}
                    className="edit-username-btn"
                  >
                    Изменить никнейм
                  </button>
                </>
              )}
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
            {/* <div className="stat-item">
              <span className="stat-label">Почта подтверждена:</span>
              <span className="stat-value">
                {user.email_confirmed_at ? 'Да' : 'Нет'}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Никнейм:</span>
              <span className="stat-value">
                {username || 'Не установлен'}
              </span>
            </div> */}
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
        </button>
        
        <button 
          className={`nav-item ${getActiveTab() === 'habits' ? 'active' : ''}`}
          onClick={() => navigate('/habits')}
        >
          <span className="nav-icon">✅</span>
        </button>
        
        <button 
          className={`nav-item ${getActiveTab() === 'profile' ? 'active' : ''}`}
          onClick={() => navigate('/profile')}
        >
          <span className="nav-icon">👤</span>
        </button>
      </nav>
    </div>
  );
}

export default ProfilePage;
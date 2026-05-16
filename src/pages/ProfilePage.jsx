import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { supabase } from '../services/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { enablePushNotifications } from '../App.jsx';
import './ProfilePage.css';

function ProfilePage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [username, setUsername] = useState('');
  const [initialUsername, setInitialUsername] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notifChannel, setNotifChannel] = useState('email'); // 'email' | 'push'
  const [pushPermission, setPushPermission] = useState(() => ('Notification' in window ? Notification.permission : 'denied'));
  const [reactionsEnabled, setReactionsEnabled] = useState(
    () => localStorage.getItem('ddo_reactions_disabled') !== '1'
  );
  const [notifLoading, setNotifLoading] = useState(false);
  const [reminderTime, setReminderTime] = useState('');
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderUpdatedAt, setReminderUpdatedAt] = useState(null);
  const [activeSection, setActiveSection] = useState('profile');

  // Определение активной вкладки
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/competitions')) return 'competitions';
    if (path.includes('/profile')) return 'profile';
    if (path.includes('/stats')) return 'stats';
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
          .select('username, avatar_url, notifications_enabled, notification_channel, reminder_time, reminder_time_updated_at')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Ошибка при загрузке данных пользователя:', error);
        }

        if (data) {
          setUsername(data.username || '');
          setInitialUsername(data.username || '');
          setAvatarUrl(data.avatar_url || '');
          setNotificationsEnabled(data.notifications_enabled !== false);
          setNotifChannel(data.notification_channel || 'email');
          setReminderTime(data.reminder_time ? data.reminder_time.substring(0, 5) : '');
          setReminderUpdatedAt(data.reminder_time_updated_at || null);
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
        toast.error('Не удалось выйти. Попробуйте снова.');
      } else {
        console.log('Успешный выход');
        navigate('/login');
      }
    } catch (err) {
      console.error('Ошибка:', err);
      toast.error('Произошла ошибка при выходе');
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
        toast.success('Никнейм обновлён!');
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

  // Переключение уведомлений
  const handleToggleNotifications = async () => {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    setNotifLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ notifications_enabled: newValue })
        .eq('id', user.id);
      if (error) throw error;
      toast.success(newValue ? 'Уведомления включены' : 'Уведомления отключены');
    } catch (err) {
      setNotificationsEnabled(!newValue);
      toast.error('Не удалось сохранить настройку');
    } finally {
      setNotifLoading(false);
    }
  };

  // Смена канала уведомлений
  const handleChannelChange = async (channel) => {
    setNotifChannel(channel);
    try {
      await supabase.from('users').update({ notification_channel: channel }).eq('id', user.id);
      toast.success(channel === 'push' ? 'Включены push-уведомления' : 'Включены email-уведомления');
    } catch {
      toast.error('Не удалось сохранить настройку');
    }
  };

  // Сохранение времени напоминания
  const handleSaveReminderTime = async (timeValue) => {
    setReminderLoading(true);
    try {
      const { data, error } = await supabase.rpc('set_reminder_time', {
        p_time: timeValue || null
      });
      if (error) throw error;
      if (data?.error === 'ALREADY_UPDATED_TODAY') {
        toast.error('Время напоминания можно изменить только раз в сутки');
        return;
      }
      setReminderTime(timeValue);
      setReminderUpdatedAt(new Date().toISOString());
      toast.success(timeValue ? `Напоминание установлено на ${timeValue}` : 'Напоминание отключено');
    } catch (err) {
      toast.error('Не удалось сохранить время напоминания');
    } finally {
      setReminderLoading(false);
    }
  };

  const canChangeReminder = notifChannel === 'push' || !reminderUpdatedAt || (() => {
    const offset = 3 * 60 * 60 * 1000;
    const nowDate = new Date(Date.now() + offset).toISOString().split('T')[0];
    const updatedDate = new Date(new Date(reminderUpdatedAt).getTime() + offset).toISOString().split('T')[0];
    return nowDate !== updatedDate;
  })();

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
          <div className="profile-tabs">
            <button
              className={`profile-tab ${activeSection === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveSection('profile')}
            >
              Профиль
            </button>
            <button
              className={`profile-tab ${activeSection === 'notifications' ? 'active' : ''}`}
              onClick={() => setActiveSection('notifications')}
            >
              Уведомления
            </button>
          </div>

          {activeSection === 'profile' && (
            <>
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
              </div>

              <div className="settings-section">
                <h3 className="settings-title">Настройки</h3>
                <div className="setting-row">
                  <div className="setting-info">
                    <span className="setting-label">Тёмная тема</span>
                    <span className="setting-desc">Переключить между светлой и тёмной темой</span>
                  </div>
                  <button
                    className={`toggle-switch ${theme === 'dark' ? 'on' : ''}`}
                    onClick={toggleTheme}
                    aria-label="Переключить тему"
                  />
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
            </>
          )}

          {activeSection === 'notifications' && (
            <div className="settings-section" style={{ marginBottom: 0 }}>
              <div className="setting-row">
                <div className="setting-info">
                  <span className="setting-label">Уведомления</span>
                  <span className="setting-desc">Напоминания о привычках и соревнованиях</span>
                </div>
                <button
                  className={`toggle-switch ${notificationsEnabled ? 'on' : ''}`}
                  onClick={handleToggleNotifications}
                  disabled={notifLoading}
                  aria-label="Переключить уведомления"
                />
              </div>

              {notificationsEnabled && (
                <div className="notif-channel-selector">
                  <span className="setting-label" style={{ fontSize: '13px', color: 'var(--text-secondary, #888)', marginBottom: '8px', display: 'block' }}>Способ уведомлений</span>
                  <div className="channel-toggle">
                    <button
                      className={`channel-btn ${notifChannel === 'email' ? 'active' : ''}`}
                      onClick={() => handleChannelChange('email')}
                    >
                      ✉️ Email
                    </button>
                    <button
                      className={`channel-btn ${notifChannel === 'push' ? 'active' : ''}`}
                      onClick={() => handleChannelChange('push')}
                    >
                      🔔 Push
                    </button>
                  </div>
                  {notifChannel === 'push' && pushPermission !== 'granted' && (
                    <>
                      <button
                        className="push-enable-btn"
                        onClick={async () => {
                          const granted = await enablePushNotifications(user.id);
                          setPushPermission(granted ? 'granted' : 'denied');
                          if (granted) toast.success('Push-уведомления включены!');
                          else toast.error('Браузер заблокировал уведомления. Разреши их в настройках браузера.');
                        }}
                      >
                        🔔 Включить push-уведомления
                      </button>
                      <div className="push-ios-guide">
                        <p className="push-ios-guide-title">📱 Как включить на iPhone</p>
                        <ol className="push-ios-steps">
                          <li><span className="step-icon">🧭</span><span>Открой сайт в <b>Safari</b> (не Chrome)</span></li>
                          <li><span className="step-icon">📤</span><span>Нажми кнопку <b>«Поделиться»</b> внизу экрана</span></li>
                          <li><span className="step-icon">🏠</span><span>Выбери <b>«На экран «Домой»»</b></span></li>
                          <li><span className="step-icon">📲</span><span>Открой <b>DoubleDo</b> с рабочего стола</span></li>
                          <li><span className="step-icon">🔔</span><span>Вернись сюда и нажми кнопку выше</span></li>
                        </ol>
                      </div>
                    </>
                  )}
                  {notifChannel === 'push' && pushPermission === 'granted' && (
                    <p className="push-active-note">✓ Push-уведомления активны</p>
                  )}
                </div>
              )}

              <div className="setting-row" style={{ marginTop: '12px' }}>
                <div className="setting-info">
                  <span className="setting-label">Реакции на пропуски</span>
                  <span className="setting-desc">Показывать уведомление, если соперник пропустил вчера</span>
                </div>
                <button
                  className={`toggle-switch ${reactionsEnabled ? 'on' : ''}`}
                  onClick={() => {
                    const next = !reactionsEnabled;
                    setReactionsEnabled(next);
                    if (next) {
                      localStorage.removeItem('ddo_reactions_disabled');
                    } else {
                      localStorage.setItem('ddo_reactions_disabled', '1');
                    }
                  }}
                  aria-label="Переключить реакции на пропуски"
                />
              </div>

              <div className="reminder-block">
                <div className="reminder-block-header">
                  <span className="reminder-bell">🔔</span>
                  <div className="reminder-block-info">
                    <span className="reminder-block-title">Ежедневное напоминание</span>
                    <span className="reminder-block-desc">{notifChannel === 'push' ? 'Пуш придёт если есть невыполненные привычки' : 'Письмо придёт если есть невыполненные привычки'}</span>
                  </div>
                </div>
                <div className="reminder-block-body">
                  <input
                    type="time"
                    className="reminder-time-input"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    disabled={reminderLoading || !canChangeReminder}
                  />
                  {canChangeReminder ? (
                    <>
                      <button
                        className="reminder-save-btn"
                        onClick={() => handleSaveReminderTime(reminderTime)}
                        disabled={reminderLoading || !reminderTime}
                      >
                        {reminderLoading ? '...' : 'Сохранить'}
                      </button>
                      {reminderTime && (
                        <button
                          className="reminder-clear-btn"
                          onClick={() => handleSaveReminderTime('')}
                          disabled={reminderLoading}
                          title="Отключить напоминание"
                        >
                          ✕
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="reminder-locked">🔒 До завтра</span>
                  )}
                </div>
                {!canChangeReminder && (
                  <p className="reminder-limit-note">Можно изменить раз в сутки</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="app-info-section">
          <p className="app-info">
            DoubleDo — приложение для отслеживания привычек и соревнований
          </p>
          <p className="version">Версия 1.0.0</p>
        </div>
      </main>

      <nav className="bottom-nav">
        <button
          className={`nav-item ${getActiveTab() === 'competitions' ? 'active' : ''}`}
          onClick={() => navigate('/competitions')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
            <path d="M4 22h16"/>
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
          </svg>
          <span className="nav-label">Соревнования</span>
        </button>

        <button
          className={`nav-item ${getActiveTab() === 'habits' ? 'active' : ''}`}
          onClick={() => navigate('/habits')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
          <span className="nav-label">Привычки</span>
        </button>

        <button
          className={`nav-item ${getActiveTab() === 'stats' ? 'active' : ''}`}
          onClick={() => navigate('/stats')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <span className="nav-label">Статистика</span>
        </button>

        <button
          className={`nav-item ${getActiveTab() === 'profile' ? 'active' : ''}`}
          onClick={() => navigate('/profile')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/>
            <path d="M20 21a8 8 0 1 0-16 0"/>
          </svg>
          <span className="nav-label">Профиль</span>
        </button>
      </nav>
    </div>
  );
}

export default ProfilePage;
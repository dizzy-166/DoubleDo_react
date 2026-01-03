// src/pages/CompetitionsPage.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import './CompetitionsPage.css';

function CompetitionsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [competitions, setCompetitions] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeTab, setActiveTab] = useState('competitions');
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [friendsTab, setFriendsTab] = useState('friends');

  // Загрузка пользователя
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    
    checkUser();
  }, []);

  // Загрузка друзей
  useEffect(() => {
    const loadFriends = async () => {
      if (!user) return;
      
      try {
        // Здесь будет загрузка друзей из базы данных
        // Временные данные для демонстрации
        setFriends([
          { id: 1, username: 'obeme', status: 'online', last_active: '5 мин назад' },
          { id: 2, username: 'alex', status: 'offline', last_active: '2 часа назад' },
          { id: 3, username: 'mary', status: 'online', last_active: 'только что' }
        ]);
        
        setFriendRequests([
          { id: 1, username: 'john', sent_at: '2026-01-02T10:00:00Z' }
        ]);
      } catch (error) {
        console.error('Error loading friends:', error);
      }
    };
    
    if (user) loadFriends();
  }, [user]);

  // Статические данные для демонстрации
  useEffect(() => {
    if (user && !loading) {
      setCompetitions([
        {
          id: 1,
          title: "read",
          friend_username: "obeme",
          my_score: 0,
          friend_score: 1,
          days_remaining: 7,
          my_calendar: [
            { day: 5, completed: false }, { day: 6, completed: false }, { day: 7, completed: true },
            { day: 8, completed: true }, { day: 9, completed: false }, { day: 10, completed: false },
            { day: 11, completed: false }, { day: 12, completed: false }, { day: 13, completed: false },
            { day: 14, completed: false }, { day: 15, completed: false }, { day: 16, completed: false },
            { day: 17, completed: false }, { day: 18, completed: false }, { day: 19, completed: false },
            { day: 20, completed: false }, { day: 21, completed: false }, { day: 22, completed: false },
            { day: 23, completed: false }, { day: 24, completed: false }, { day: 25, completed: false },
            { day: 26, completed: false }, { day: 27, completed: false }, { day: 28, completed: false },
            { day: 29, completed: false }, { day: 30, completed: false }, { day: 31, completed: false }
          ],
          friend_calendar: [
            { day: 5, completed: false }, { day: 6, completed: false }, { day: 7, completed: true },
            { day: 8, completed: true }, { day: 9, completed: true }, { day: 10, completed: false },
            { day: 11, completed: false }, { day: 12, completed: false }, { day: 13, completed: false },
            { day: 14, completed: false }, { day: 15, completed: false }, { day: 16, completed: false },
            { day: 17, completed: false }, { day: 18, completed: false }, { day: 19, completed: false },
            { day: 20, completed: false }, { day: 21, completed: false }, { day: 22, completed: false },
            { day: 23, completed: false }, { day: 24, completed: false }, { day: 25, completed: false },
            { day: 26, completed: false }, { day: 27, completed: false }, { day: 28, completed: false },
            { day: 29, completed: false }, { day: 30, completed: false }, { day: 31, completed: false }
          ]
        }
      ]);
    }
  }, [user, loading]);

  // Если загрузка
  if (loading) {
    return (
      <div className="competitions-page">
        <header className="competitions-header">
          <div className="header-content">
            <h1>DoubleDo</h1>
            <div className="user-avatar">
              <span>👤</span>
            </div>
          </div>
        </header>
        
        <div className="empty-competitions-container">
          <div className="loading-spinner"></div>
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  // Если пользователь не авторизован
  if (!user) {
    return (
      <div className="competitions-page">
        <header className="competitions-header">
          <div className="header-content">
            <h1>DoubleDo</h1>
            <div className="user-avatar">
              <span>👤</span>
            </div>
          </div>
        </header>
        
        <div className="empty-competitions-container">
          <h2>Пожалуйста, войдите в систему</h2>
          <p>Для доступа к соревнованиям необходимо авторизоваться</p>
        </div>
      </div>
    );
  }

  const handleCreateCompetitionWithFriend = (friendUsername) => {
    setShowCreateForm(true);
    // Можно предзаполнить поле друга в форме
  };

  return (
    <div className="competitions-page">
      <header className="competitions-header">
        <div className="header-content">
          <h1>DoubleDo</h1>
          <div className="user-avatar">
            <span>{user?.email?.charAt(0).toUpperCase() || '👤'}</span>
          </div>
        </div>
      </header>

      {/* Вкладки */}
      <div className="main-tabs">
        <button 
          className={`tab-button ${activeTab === 'competitions' ? 'active' : ''}`}
          onClick={() => setActiveTab('competitions')}
        >
          🏆 Соревнования
        </button>
        <button 
          className={`tab-button ${activeTab === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveTab('friends')}
        >
          👥 Друзья
          {friendRequests.length > 0 && (
            <span className="badge">{friendRequests.length}</span>
          )}
        </button>
      </div>

      <main className="competitions-main">
        {activeTab === 'competitions' ? (
          <>
            <div className="competitions-list-header">
              <h2>Соревнования</h2>
              <button 
                className="add-competition-btn"
                onClick={() => setShowCreateForm(true)}
                disabled={loading}
              >
                {loading ? '...' : '+ Создать соревнование'}
              </button>
            </div>

            {competitions.length === 0 ? (
              <div className="empty-competitions-container">
                <div className="empty-competitions-content">
                  <div className="empty-competitions-icon">
                    <span className="icon-circle">🏆</span>
                  </div>
                  <h2 className="empty-competitions-title">
                    У вас пока нет соревнований
                  </h2>
                  <p className="empty-competitions-description">
                    Создайте соревнование с другом и следите за прогрессом вместе!
                  </p>
                  
                  <button 
                    className="create-first-competition-btn"
                    onClick={() => setShowCreateForm(true)}
                  >
                    + Создать соревнование
                  </button>
                </div>
              </div>
            ) : (
              <div className="competitions-list">
                {competitions.map(competition => (
                  <CompetitionCard 
                    key={competition.id} 
                    competition={competition} 
                    user={user}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="friends-container">
            <div className="friends-header">
              <h2>Друзья</h2>
              <button className="add-friend-btn">
                + Добавить друга
              </button>
            </div>

            <div className="friends-tabs">
              <button 
                className={`friends-tab ${friendsTab === 'friends' ? 'active' : ''}`}
                onClick={() => setFriendsTab('friends')}
              >
                Друзья ({friends.length})
              </button>
              <button 
                className={`friends-tab ${friendsTab === 'requests' ? 'active' : ''}`}
                onClick={() => setFriendsTab('requests')}
              >
                Запросы ({friendRequests.length})
              </button>
            </div>

            {friendsTab === 'friends' ? (
              <div className="friends-list">
                {friends.map(friend => (
                  <FriendItem 
                    key={friend.id} 
                    friend={friend} 
                    onCreateCompetition={() => handleCreateCompetitionWithFriend(friend.username)}
                  />
                ))}
                
                {friends.length === 0 && (
                  <div className="no-friends">
                    <p>У вас пока нет друзей</p>
                    <button className="find-friends-btn">
                      Найти друзей
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="friend-requests-list">
                {friendRequests.map(request => (
                  <FriendRequestItem key={request.id} request={request} />
                ))}
                
                {friendRequests.length === 0 && (
                  <div className="no-requests">
                    <p>Нет новых запросов в друзья</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {showCreateForm && (
          <CreateCompetitionModal
            setShowCreateForm={setShowCreateForm}
          />
        )}
      </main>

      <nav className="bottom-nav">
        <button 
          className={`nav-item ${activeTab === 'competitions' ? 'active' : ''}`}
          onClick={() => setActiveTab('competitions')}
        >
          <span className="nav-icon">🏆</span>
          <span className="nav-text">Соревнования</span>
        </button>
        
        <button 
          className={`nav-item`}
          onClick={() => window.location.href = '/habits'}
        >
          <span className="nav-icon">✅</span>
          <span className="nav-text">Привычки</span>
        </button>
        
        <button 
          className={`nav-item`}
          onClick={() => window.location.href = '/profile'}
        >
          <span className="nav-icon">👤</span>
          <span className="nav-text">Профиль</span>
        </button>
      </nav>
    </div>
  );
}

// Компонент карточки соревнования
function CompetitionCard({ competition, user }) {
  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  
  // Генерация календаря для текущего месяца
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  // Создаем сетку дней (1-31)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  
  // Находим первый день месяца для правильного смещения
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  
  // Разбиваем на недели
  const weeks = [];
  let week = Array(startOffset).fill(null);
  
  days.forEach(day => {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  });
  
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  return (
    <div className="competition-card">
      <div className="competition-header">
        <div className="competition-title-section">
          <h3 className="competition-title">{competition.title}</h3>
          <div className="competition-subtitle">
            Соревнуетесь с <span className="friend-name">{competition.friend_username}</span>
          </div>
        </div>
      </div>

      <div className="competition-score">
        <div className="score-section you-section">
          <div className="score-label">Вы</div>
          <div className="score-value">{competition.my_score}</div>
        </div>
        
        <div className="vs-section">
          <div className="vs-text">VS</div>
        </div>
        
        <div className="score-section friend-section">
          <div className="score-label">{competition.friend_username}</div>
          <div className="score-value">{competition.friend_score}</div>
        </div>
        
        <div className="days-remaining">
          <div className="days-label">Дней</div>
          <div className="days-value">{competition.days_remaining}</div>
        </div>
      </div>

      <div className="competition-calendars">
        <div className="calendar-section">
          <div className="calendar-title">● Ваш календарь</div>
          <div className="calendar-grid">
            <div className="weekdays-row">
              {dayNames.map((dayName, index) => (
                <div key={index} className="weekday-cell">
                  {dayName}
                </div>
              ))}
            </div>
            
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="calendar-week">
                {week.map((day, dayIndex) => {
                  if (day === null) {
                    return <div key={dayIndex} className="calendar-day empty"></div>;
                  }
                  
                  const completed = competition.my_calendar.find(d => d.day === day)?.completed || false;
                  const isToday = day === new Date().getDate();
                  
                  return (
                    <div 
                      key={dayIndex} 
                      className={`calendar-day ${completed ? 'completed' : 'empty'} ${isToday ? 'today' : ''}`}
                    >
                      <span className="day-number">{day}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="calendar-section">
          <div className="calendar-title">● Календарь {competition.friend_username}</div>
          <div className="calendar-grid">
            <div className="weekdays-row">
              {dayNames.map((dayName, index) => (
                <div key={index} className="weekday-cell">
                  {dayName}
                </div>
              ))}
            </div>
            
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="calendar-week">
                {week.map((day, dayIndex) => {
                  if (day === null) {
                    return <div key={dayIndex} className="calendar-day empty"></div>;
                  }
                  
                  const completed = competition.friend_calendar.find(d => d.day === day)?.completed || false;
                  const isToday = day === new Date().getDate();
                  
                  return (
                    <div 
                      key={dayIndex} 
                      className={`calendar-day ${completed ? 'completed' : 'empty'} ${isToday ? 'today' : ''}`}
                    >
                      <span className="day-number">{day}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="competition-actions">
        <button className="action-btn secondary">
          Подробнее
        </button>
        <button className="action-btn primary">
          Выполнить сегодня
        </button>
      </div>
    </div>
  );
}

// Компонент элемента списка друзей
function FriendItem({ friend, onCreateCompetition }) {
  return (
    <div className="friend-item">
      <div className="friend-avatar">
        <span>{friend.username.charAt(0).toUpperCase()}</span>
        <div className={`status-indicator ${friend.status}`}></div>
      </div>
      
      <div className="friend-info">
        <h4 className="friend-name">{friend.username}</h4>
        <p className="friend-status">
          {friend.status === 'online' ? 'В сети' : `Был(а) ${friend.last_active}`}
        </p>
      </div>
      
      <div className="friend-actions">
        <button 
          className="friend-action-btn" 
          title="Создать соревнование"
          onClick={onCreateCompetition}
        >
          🏆
        </button>
        <button className="friend-action-btn" title="Написать сообщение">
          💬
        </button>
        <button className="friend-action-btn" title="Удалить из друзей">
          🗑️
        </button>
      </div>
    </div>
  );
}

// Компонент запроса в друзья
function FriendRequestItem({ request }) {
  return (
    <div className="friend-request-item">
      <div className="friend-avatar">
        <span>{request.username.charAt(0).toUpperCase()}</span>
      </div>
      
      <div className="friend-request-info">
        <h4 className="friend-name">{request.username}</h4>
        <p className="request-time">
          Отправлен {new Date(request.sent_at).toLocaleDateString('ru-RU')}
        </p>
      </div>
      
      <div className="friend-request-actions">
        <button className="accept-btn" title="Принять запрос">✓</button>
        <button className="decline-btn" title="Отклонить запрос">✕</button>
      </div>
    </div>
  );
}

// Модальное окно создания соревнования
function CreateCompetitionModal({ setShowCreateForm }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    title: '',
    friendUsername: '',
    duration: 30,
    startDate: new Date(),
    stake: ''
  });

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      // Здесь будет логика создания соревнования
      console.log('Создание соревнования:', formData);
      setShowCreateForm(false);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      setShowCreateForm(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content create-competition-modal">
        <div className="modal-header">
          <h3>Создать соревнование</h3>
          <button 
            className="modal-close"
            onClick={() => setShowCreateForm(false)}
          >
            ×
          </button>
        </div>
        
        <div className="modal-steps">
          <div className={`step-indicator ${step >= 1 ? 'active' : ''}`}>1</div>
          <div className={`step-indicator ${step >= 2 ? 'active' : ''}`}>2</div>
          <div className={`step-indicator ${step >= 3 ? 'active' : ''}`}>3</div>
        </div>
        
        <div className="modal-body">
          {step === 1 && (
            <div className="step-content">
              <h4>Основная информация</h4>
              <div className="form-group">
                <label className="form-label">Название привычки</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="например, читать 30 минут в день"
                  className="form-input"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Никнейм друга</label>
                <input
                  type="text"
                  value={formData.friendUsername}
                  onChange={(e) => handleChange('friendUsername', e.target.value)}
                  placeholder="введите никнейм друга"
                  className="form-input"
                />
              </div>
            </div>
          )}
          
          {step === 2 && (
            <div className="step-content">
              <h4>Настройки соревнования</h4>
              <div className="form-group">
                <label className="form-label">Длительность (дней)</label>
                <div className="duration-options">
                  {[7, 14, 21, 30, 60].map(days => (
                    <button
                      key={days}
                      type="button"
                      className={`duration-option ${formData.duration === days ? 'selected' : ''}`}
                      onClick={() => handleChange('duration', days)}
                    >
                      {days} дней
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Дата начала</label>
                <input
                  type="date"
                  value={formData.startDate.toISOString().split('T')[0]}
                  onChange={(e) => handleChange('startDate', new Date(e.target.value))}
                  className="form-input"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
          )}
          
          {step === 3 && (
            <div className="step-content">
              <h4>Создание ставки (опционально)</h4>
              <div className="form-group">
                <label className="form-label">Ставка для проигравшего</label>
                <input
                  type="text"
                  value={formData.stake}
                  onChange={(e) => handleChange('stake', e.target.value)}
                  placeholder="например, 'угостить кофе' или 'помыть посуду'"
                  className="form-input"
                />
                <p className="form-hint">Ставка добавляет мотивации и делает игру интереснее</p>
              </div>
              
              <div className="summary">
                <h5>Сводка:</h5>
                <ul>
                  <li><strong>Привычка:</strong> {formData.title}</li>
                  <li><strong>Соперник:</strong> {formData.friendUsername}</li>
                  <li><strong>Длительность:</strong> {formData.duration} дней</li>
                  <li><strong>Начинаем:</strong> {formData.startDate.toLocaleDateString('ru-RU')}</li>
                  {formData.stake && <li><strong>Ставка:</strong> {formData.stake}</li>}
                </ul>
              </div>
            </div>
          )}
        </div>
        
        <div className="modal-actions">
          <button 
            type="button"
            className="btn-secondary"
            onClick={handleBack}
          >
            {step === 1 ? 'Отмена' : 'Назад'}
          </button>
          <button 
            type="button"
            className="btn-primary"
            onClick={handleNext}
            disabled={step === 1 && (!formData.title || !formData.friendUsername)}
          >
            {step === 3 ? 'Создать соревнование' : 'Далее'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CompetitionsPage;
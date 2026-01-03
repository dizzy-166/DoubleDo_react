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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

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
        // Загрузка списка друзей
        const { data: friendsData, error: friendsError } = await supabase.rpc('get_friends', {
          status_filter: 'accepted'
        });
        
        if (friendsError) throw friendsError;
        setFriends(friendsData || []);
        
        // Загрузка входящих запросов в друзья
        const { data: requestsData, error: requestsError } = await supabase.rpc('get_pending_friend_requests');
        
        if (requestsError) throw requestsError;
        setFriendRequests(requestsData || []);
      } catch (error) {
        console.error('Error loading friends:', error);
        setFriends([]);
        setFriendRequests([]);
      }
    };
    
    if (user) loadFriends();
  }, [user]);

  // Загрузка соревнований
  useEffect(() => {
    const loadCompetitions = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase.rpc('get_user_competitions');
        
        if (error) throw error;
        setCompetitions(data || []);
      } catch (error) {
        console.error('Error loading competitions:', error);
        setCompetitions([]);
      }
    };
    
    if (user) loadCompetitions();
  }, [user]);

  // Функция поиска пользователей
  const handleSearchUsers = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    try {
      const { data, error } = await supabase.rpc('search_users', {
        search_query: searchQuery,
        limit_count: 10,
        offset_count: 0
      });
      
      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Функция отправки запроса в друзья
  const handleSendFriendRequest = async (friendUsername) => {
    try {
      const { data, error } = await supabase.rpc('send_friend_request', {
        friend_username: friendUsername
      });
      
      if (error) throw error;
      
      if (data.success) {
        alert('Запрос в друзья отправлен!');
        // Обновляем список друзей
        const { data: friendsData } = await supabase.rpc('get_friends', {
          status_filter: 'accepted'
        });
        setFriends(friendsData || []);
      } else {
        alert(`Ошибка: ${data.message}`);
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      alert('Ошибка при отправке запроса');
    }
  };

  // Функция принятия запроса в друзья
  const handleAcceptFriendRequest = async (friendshipId) => {
    try {
      const { data, error } = await supabase.rpc('respond_to_friend_request', {
        friendship_id: friendshipId,
        response_action: 'accept'
      });
      
      if (error) throw error;
      
      if (data.success) {
        alert('Запрос в друзья принят!');
        // Обновляем списки
        const { data: friendsData } = await supabase.rpc('get_friends', {
          status_filter: 'accepted'
        });
        setFriends(friendsData || []);
        
        const { data: requestsData } = await supabase.rpc('get_pending_friend_requests');
        setFriendRequests(requestsData || []);
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
      alert('Ошибка при принятии запроса');
    }
  };

  // Функция отклонения запроса в друзья
  const handleDeclineFriendRequest = async (friendshipId) => {
    try {
      const { data, error } = await supabase.rpc('respond_to_friend_request', {
        friendship_id: friendshipId,
        response_action: 'decline'
      });
      
      if (error) throw error;
      
      if (data.success) {
        alert('Запрос в друзья отклонен');
        // Обновляем список запросов
        const { data: requestsData } = await supabase.rpc('get_pending_friend_requests');
        setFriendRequests(requestsData || []);
      }
    } catch (error) {
      console.error('Error declining friend request:', error);
      alert('Ошибка при отклонении запроса');
    }
  };

  // Функция удаления друга
  const handleRemoveFriend = async (friendshipId) => {
    if (!confirm('Вы уверены, что хотите удалить этого друга?')) return;
    
    try {
      const { data, error } = await supabase.rpc('remove_friend', {
        friendship_id: friendshipId
      });
      
      if (error) throw error;
      
      if (data.success) {
        alert('Друг удален');
        // Обновляем список друзей
        const { data: friendsData } = await supabase.rpc('get_friends', {
          status_filter: 'accepted'
        });
        setFriends(friendsData || []);
      }
    } catch (error) {
      console.error('Error removing friend:', error);
      alert('Ошибка при удалении друга');
    }
  };

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
                    key={competition.competition_id} 
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
              
              {/* Поиск пользователей */}
              <div className="friend-search-container">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по username..."
                  className="friend-search-input"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchUsers()}
                />
                <button 
                  className="search-btn"
                  onClick={handleSearchUsers}
                  disabled={searching}
                >
                  {searching ? 'Поиск...' : 'Найти'}
                </button>
              </div>
            </div>

            {/* Результаты поиска */}
            {searchResults.length > 0 && (
              <div className="search-results">
                <h3>Результаты поиска:</h3>
                {searchResults.map(user => (
                  <div key={user.id} className="search-result-item">
                    <div className="search-result-info">
                      <div className="friend-avatar">
                        <span>{user.username?.charAt(0).toUpperCase() || '👤'}</span>
                      </div>
                      <div>
                        <h4>{user.username}</h4>
                        <p className="friend-status-info">
                          {user.is_friend ? 'Уже в друзьях' : 
                           user.friendship_status === 'pending' ? 'Запрос отправлен' : 
                           'Не в друзьях'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="search-result-actions">
                      {!user.is_friend && user.friendship_status !== 'pending' ? (
                        <button 
                          className="add-friend-btn-small"
                          onClick={() => handleSendFriendRequest(user.username)}
                        >
                          Добавить в друзья
                        </button>
                      ) : user.friendship_status === 'pending' ? (
                        <span className="pending-badge">Ожидание</span>
                      ) : (
                        <span className="already-friend">✓ Друг</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

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
                    key={friend.friendship_id} 
                    friend={friend} 
                    onCreateCompetition={() => handleCreateCompetitionWithFriend(friend.username)}
                    onRemoveFriend={() => handleRemoveFriend(friend.friendship_id)}
                  />
                ))}
                
                {friends.length === 0 && (
                  <div className="no-friends">
                    <p>У вас пока нет друзей</p>
                    <p className="hint">Используйте поиск выше, чтобы найти друзей</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="friend-requests-list">
                {friendRequests.map(request => (
                  <FriendRequestItem 
                    key={request.friendship_id} 
                    request={request} 
                    onAccept={() => handleAcceptFriendRequest(request.friendship_id)}
                    onDecline={() => handleDeclineFriendRequest(request.friendship_id)}
                  />
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
            friends={friends}
            onCompetitionCreated={() => {
              // Обновляем список соревнований после создания
              supabase.rpc('get_user_competitions').then(({ data }) => {
                setCompetitions(data || []);
              });
            }}
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
  const [calendarData, setCalendarData] = useState(null);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  
  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  
  // Расчет дней, оставшихся до конца соревнования
  const calculateDaysRemaining = () => {
    if (!competition.start_date) return 0;
    
    const startDate = new Date(competition.start_date);
    const totalDays = competition.total_days || 30;
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + totalDays);
    
    const now = new Date();
    const remaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));
    
    return remaining;
  };

  // Загрузка данных календаря
  useEffect(() => {
    const loadCalendarData = async () => {
      if (!competition.competition_id) return;
      
      setLoadingCalendar(true);
      try {
        const { data, error } = await supabase.rpc('get_competition_calendar_data_fixed', {
          p_competition_id: competition.competition_id
        });
        
        if (error) throw error;
        setCalendarData(data?.[0] || null);
      } catch (error) {
        console.error('Error loading calendar data:', error);
      } finally {
        setLoadingCalendar(false);
      }
    };
    
    loadCalendarData();
  }, [competition.competition_id]);

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

  // Функция отметки выполнения привычки
  const handleMarkComplete = async () => {
    if (!competition.habit_id) return;
    
    try {
      const { data, error } = await supabase.rpc('mark_competition_habit_complete', {
        p_habit_id: competition.habit_id
      });
      
      if (error) throw error;
      
      if (data.success) {
        alert('Привычка отмечена как выполненная!');
        // Можно обновить данные соревнования
      }
    } catch (error) {
      console.error('Error marking habit complete:', error);
      alert('Ошибка при отметке привычки');
    }
  };

  // Проверяем, можно ли отметить сегодня
  const canMarkToday = () => {
    const today = new Date().getDate();
    const myCompletedDays = calendarData?.my_completed_days || [];
    return !myCompletedDays.includes(today);
  };

  return (
    <div className="competition-card">
      <div className="competition-header">
        <div className="competition-title-section">
          <h3 className="competition-title">{competition.habit_title}</h3>
          <div className="competition-subtitle">
            Соревнуетесь с <span className="friend-name">{competition.friend_username}</span>
            {competition.status === 'pending' && (
              <span className="invite-status-pending"> (Ожидание подтверждения)</span>
            )}
          </div>
        </div>
      </div>

      <div className="competition-score">
        <div className="score-section you-section">
          <div className="score-label">Вы</div>
          <div className="score-value">{competition.my_score || 0}</div>
        </div>
        
        <div className="vs-section">
          <div className="vs-text">VS</div>
        </div>
        
        <div className="score-section friend-section">
          <div className="score-label">{competition.friend_username}</div>
          <div className="score-value">{competition.friend_score || 0}</div>
        </div>
        
        <div className="days-remaining">
          <div className="days-label">Дней</div>
          <div className="days-value">{calculateDaysRemaining()}</div>
        </div>
      </div>

      {!loadingCalendar && calendarData && (
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
                    
                    const completed = calendarData.my_completed_days?.includes(day) || false;
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
                    
                    const completed = calendarData.friend_completed_days?.includes(day) || false;
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
      )}

      <div className="competition-actions">
        <button className="action-btn secondary">
          Подробнее
        </button>
        
        {competition.status === 'active' && canMarkToday() && (
          <button className="action-btn primary" onClick={handleMarkComplete}>
            Выполнить сегодня
          </button>
        )}
        
        {competition.status === 'pending' && (
          <span className="pending-notice">Ожидает подтверждения друга</span>
        )}
      </div>
    </div>
  );
}

// Компонент элемента списка друзей
function FriendItem({ friend, onCreateCompetition, onRemoveFriend }) {
  return (
    <div className="friend-item">
      <div className="friend-avatar">
        <span>{friend.username?.charAt(0).toUpperCase() || '👤'}</span>
      </div>
      
      <div className="friend-info">
        <h4 className="friend-name">{friend.username}</h4>
        <p className="friend-status">
          Друг с {new Date(friend.friendship_created_at).toLocaleDateString('ru-RU')}
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
        <button 
          className="friend-action-btn danger" 
          title="Удалить из друзей"
          onClick={onRemoveFriend}
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

// Компонент запроса в друзья
function FriendRequestItem({ request, onAccept, onDecline }) {
  return (
    <div className="friend-request-item">
      <div className="friend-avatar">
        <span>{request.username?.charAt(0).toUpperCase() || '👤'}</span>
      </div>
      
      <div className="friend-request-info">
        <h4 className="friend-name">{request.username}</h4>
        <p className="request-time">
          Запрос отправлен {new Date(request.created_at).toLocaleDateString('ru-RU')}
        </p>
      </div>
      
      <div className="friend-request-actions">
        <button 
          className="accept-btn" 
          title="Принять запрос"
          onClick={onAccept}
        >
          ✓
        </button>
        <button 
          className="decline-btn" 
          title="Отклонить запрос"
          onClick={onDecline}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// Модальное окно создания соревнования
function CreateCompetitionModal({ setShowCreateForm, friends, onCompetitionCreated }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    title: '',
    friendUsername: '',
    duration: 30,
    startDate: new Date().toISOString().split('T')[0],
    stake: ''
  });
  const [userHabits, setUserHabits] = useState([]);
  const [loadingHabits, setLoadingHabits] = useState(false);
  const [creating, setCreating] = useState(false);

  // Загрузка привычек пользователя
  useEffect(() => {
    const loadUserHabits = async () => {
      setLoadingHabits(true);
      try {
        const { data, error } = await supabase.rpc('get_all_user_habits');
        
        if (error) throw error;
        
        // Фильтруем привычки, которые не являются частью соревнования
        const availableHabits = (data || []).filter(habit => 
          !habit.competition_id || habit.competition_status !== 'active'
        );
        
        setUserHabits(availableHabits);
        
        if (availableHabits.length > 0 && !formData.title) {
          setFormData(prev => ({
            ...prev,
            title: availableHabits[0].habit_title
          }));
        }
      } catch (error) {
        console.error('Error loading habits:', error);
        setUserHabits([]);
      } finally {
        setLoadingHabits(false);
      }
    };
    
    loadUserHabits();
  }, []);

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleCreateCompetition();
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

  // Функция создания соревнования
  const handleCreateCompetition = async () => {
    if (!formData.title || !formData.friendUsername) {
      alert('Пожалуйста, заполните все обязательные поля');
      return;
    }

    setCreating(true);
    try {
      // Находим ID привычки по названию
      const selectedHabit = userHabits.find(h => h.habit_title === formData.title);
      
      if (!selectedHabit) {
        alert('Привычка не найдена');
        return;
      }

      // Создаем соревнование
      const { data, error } = await supabase.rpc('create_competition', {
        p_habit_id: selectedHabit.habit_id,
        p_friend_username: formData.friendUsername,
        p_total_days: formData.duration
      });

      if (error) throw error;

      if (data.success) {
        alert('Соревнование создано успешно!');
        setShowCreateForm(false);
        if (onCompetitionCreated) {
          onCompetitionCreated();
        }
      } else {
        alert(`Ошибка: ${data.message}`);
      }
    } catch (error) {
      console.error('Error creating competition:', error);
      alert('Ошибка при создании соревнования');
    } finally {
      setCreating(false);
    }
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
              <h4>Выберите привычку</h4>
              
              {loadingHabits ? (
                <div className="loading-habits">
                  <p>Загрузка ваших привычек...</p>
                </div>
              ) : userHabits.length === 0 ? (
                <div className="no-habits">
                  <p>У вас нет доступных привычек для соревнования.</p>
                  <p>Сначала создайте привычку в разделе "Привычки".</p>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Выберите привычку для соревнования</label>
                  <select
                    value={formData.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    className="form-select"
                  >
                    {userHabits.map(habit => (
                      <option key={habit.habit_id} value={habit.habit_title}>
                        {habit.habit_title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="form-group">
                <label className="form-label">Выберите друга</label>
                <select
                  value={formData.friendUsername}
                  onChange={(e) => handleChange('friendUsername', e.target.value)}
                  className="form-select"
                  disabled={friends.length === 0}
                >
                  <option value="">Выберите друга</option>
                  {friends.map(friend => (
                    <option key={friend.friendship_id} value={friend.username}>
                      {friend.username}
                    </option>
                  ))}
                </select>
                {friends.length === 0 && (
                  <p className="form-hint">У вас пока нет друзей. Добавьте друзей во вкладке "Друзья".</p>
                )}
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
                  value={formData.startDate}
                  onChange={(e) => handleChange('startDate', e.target.value)}
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
                  <li><strong>Начинаем:</strong> {new Date(formData.startDate).toLocaleDateString('ru-RU')}</li>
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
            disabled={creating}
          >
            {step === 1 ? 'Отмена' : 'Назад'}
          </button>
          <button 
            type="button"
            className="btn-primary"
            onClick={handleNext}
            disabled={
              creating || 
              (step === 1 && (!formData.title || !formData.friendUsername)) ||
              (step === 1 && userHabits.length === 0)
            }
          >
            {creating ? 'Создание...' : step === 3 ? 'Создать соревнование' : 'Далее'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CompetitionsPage;
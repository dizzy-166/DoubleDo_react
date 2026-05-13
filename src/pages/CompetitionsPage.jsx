// src/pages/CompetitionsPage.jsx
import React, { useState, useEffect, useRef } from 'react';
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
  const [sentFriendRequests, setSentFriendRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [recommendedUsers, setRecommendedUsers] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(true); // Управление видимостью рекомендаций

  // Загрузка пользователя
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    
    checkUser();
  }, []);

  // Функция загрузки рекомендованных пользователей
  const loadRecommendedUsers = async () => {
    if (!user) return;
    
    setLoadingRecommendations(true);
    try {
      const { data, error } = await supabase.rpc('get_recommended_users', {
        limit_count: 10
      });
      
      if (error) {
        console.error('Error loading recommended users:', error);
        // Если функция не существует, используем запасной вариант
        const fallbackData = await loadFallbackRecommendations();
        setRecommendedUsers(fallbackData || []);
      } else {
        setRecommendedUsers(data || []);
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
      setRecommendedUsers([]);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  // Запасная функция для получения рекомендаций, если RPC функция не существует
  const loadFallbackRecommendations = async () => {
    try {
      // Получаем случайных пользователей, которые не в друзьях
      const { data: allUsers, error } = await supabase
        .from('profiles')
        .select('id, username, created_at')
        .neq('id', user.id)
        .limit(20);
      
      if (error) throw error;
      
      // Получаем список ID друзей и отправленных запросов
      const friendIds = friends.map(f => f.id);
      const requestIds = [...friendRequests, ...sentFriendRequests].map(r => r.id);
      const excludedIds = [...friendIds, ...requestIds];
      
      // Фильтруем пользователей, исключая друзей и тех, кому уже отправлены запросы
      const recommended = allUsers.filter(u => !excludedIds.includes(u.id));
      
      // Сортируем по дате создания (новые пользователи)
      return recommended.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
    } catch (error) {
      console.error('Error in fallback recommendations:', error);
      return [];
    }
  };

  // Загрузка друзей и запросов
  const loadFriendsAndRequests = async () => {
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
      
      // Загрузка исходящих запросов в друзья
      const { data: sentRequestsData, error: sentRequestsError } = await supabase.rpc('get_sent_friend_requests');
      
      if (sentRequestsError) throw sentRequestsError;
      setSentFriendRequests(sentRequestsData || []);
    } catch (error) {
      console.error('Error loading friends:', error);
      setFriends([]);
      setFriendRequests([]);
      setSentFriendRequests([]);
    }
  };

  useEffect(() => {
    if (user) {
      loadFriendsAndRequests();
      loadRecommendedUsers();
    }
  }, [user]);

  // Загрузка соревнований
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

  useEffect(() => {
    if (user) {
      loadCompetitions();
    }
  }, [user]);

  // Подписка на изменения в прогрессии привычек
  useEffect(() => {
    if (!user) return;

    let channels = [];

    const userChannel = supabase
      .channel('user_habit_progress_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'habit_progress',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('User progress changed:', payload);
          loadCompetitions();
        }
      )
      .subscribe();
    channels.push(userChannel);

    const competitionChannel = supabase
      .channel('competitions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'competitions'
        },
        (payload) => {
          console.log('Competition changed:', payload);
          loadCompetitions();
        }
      )
      .subscribe();
    channels.push(competitionChannel);

    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
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
        // Обновляем списки
        await loadFriendsAndRequests();
        await loadRecommendedUsers();
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
        await loadFriendsAndRequests();
        await loadRecommendedUsers();
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
        await loadFriendsAndRequests();
        await loadRecommendedUsers();
      }
    } catch (error) {
      console.error('Error declining friend request:', error);
      alert('Ошибка при отклонении запроса');
    }
  };

  // Функция отмены отправленного запроса
  const handleCancelSentRequest = async (friendshipId) => {
    if (!confirm('Вы уверены, что хотите отменить запрос в друзья?')) return;
    
    try {
      const { data, error } = await supabase.rpc('cancel_friend_request', {
        friendship_id: friendshipId
      });
      
      if (error) throw error;
      
      if (data.success) {
        alert('Запрос отменен');
        // Обновляем списки
        await loadFriendsAndRequests();
        await loadRecommendedUsers();
      }
    } catch (error) {
      console.error('Error canceling friend request:', error);
      alert('Ошибка при отмене запроса');
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
        await loadFriendsAndRequests();
        await loadRecommendedUsers();
      }
    } catch (error) {
      console.error('Error removing friend:', error);
      alert('Ошибка при удалении друга');
    }
  };

  // Общее количество запросов для бейджа
  const totalRequestsCount = friendRequests.length + sentFriendRequests.length;

  // Объединенные запросы для отображения в одной вкладке
  const allRequests = [
    ...friendRequests.map(req => ({ ...req, type: 'incoming' })),
    ...sentFriendRequests.map(req => ({ ...req, type: 'outgoing' }))
  ];

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

      {/* Скрываем вкладки при открытой форме создания соревнования */}
      {!showCreateForm && (
        <>
          {/* Вкладки */}
          <div className="tabs-on-gradient">
            <div className="gradient-tabs">
              <button 
                className={`gradient-tab ${activeTab === 'competitions' ? 'active' : ''}`}
                onClick={() => setActiveTab('competitions')}
              >
                <span className="tab-icon">🏆</span>
                <span className="tab-text">Соревнования</span>
              </button>
              <button 
                className={`gradient-tab ${activeTab === 'friends' ? 'active' : ''}`}
                onClick={() => setActiveTab('friends')}
              >
                <span className="tab-icon">👥</span>
                <span className="tab-text">Друзья</span>
                {totalRequestsCount > 0 && (
                  <span className="tab-badge">{totalRequestsCount}</span>
                )}
              </button>
            </div>
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
                    {loading ? '...' : '+'}
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
                        onRefresh={loadCompetitions}
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

                {/* Входящие запросы в друзья */}
                {friendRequests.length > 0 && (
                  <div className="section-container">
                    <div className="section-header">
                      <h3>Входящие запросы ({friendRequests.length})</h3>
                    </div>
                    <div className="friend-requests-list">
                      {friendRequests.map(request => (
                        <FriendRequestItem 
                          key={request.friendship_id} 
                          request={request} 
                          type="incoming"
                          onAccept={() => handleAcceptFriendRequest(request.friendship_id)}
                          onDecline={() => handleDeclineFriendRequest(request.friendship_id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Исходящие запросы в друзья */}
                {sentFriendRequests.length > 0 && (
                  <div className="section-container">
                    <div className="section-header">
                      <h3>Исходящие запросы ({sentFriendRequests.length})</h3>
                    </div>
                    <div className="friend-requests-list">
                      {sentFriendRequests.map(request => (
                        <FriendRequestItem 
                          key={request.friendship_id} 
                          request={request} 
                          type="outgoing"
                          onCancel={() => handleCancelSentRequest(request.friendship_id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Список друзей */}
                <div className="section-container">
                  <div className="section-header">
                    <h3>Мои друзья ({friends.length})</h3>
                  </div>
                  
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
                        <div className="no-friends-icon">👤</div>
                        <p><strong>У вас пока нет друзей</strong></p>
                        <p className="hint">Используйте поиск выше, чтобы найти друзей</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Рекомендации друзей - показываем если мало друзей или есть рекомендации */}
                {(friends.length < 3 || recommendedUsers.length > 0) && showRecommendations && (
                  <div className="section-container recommendations-section">
                    <div className="section-header">
                      <h3>Возможно, вы знакомы</h3>
                      <div className="section-header-actions">
                        <button 
                          className="refresh-recommendations-btn"
                          onClick={loadRecommendedUsers}
                          disabled={loadingRecommendations}
                          title="Обновить рекомендации"
                        >
                          {loadingRecommendations ? '🔄' : '🔄'}
                        </button>
                        <button 
                          className="hide-recommendations-btn"
                          onClick={() => setShowRecommendations(false)}
                          title="Скрыть рекомендации"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    
                    {loadingRecommendations ? (
                      <div className="loading-recommendations">
                        <div className="loading-spinner-small"></div>
                        <p>Загрузка рекомендаций...</p>
                      </div>
                    ) : recommendedUsers.length === 0 ? (
                      <div className="no-recommendations">
                        <p>Нет доступных рекомендаций</p>
                        <p className="hint">Попробуйте обновить позже</p>
                      </div>
                    ) : (
                      <div className="recommendations-grid">
                        {recommendedUsers.map(user => (
                          <RecommendedUserItem 
                            key={user.id} 
                            user={user} 
                            onSendRequest={() => handleSendFriendRequest(user.username)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Кнопка показа рекомендаций, если они скрыты */}
                {!showRecommendations && (
                  <div className="show-recommendations-container">
                    <button 
                      className="show-recommendations-btn"
                      onClick={() => setShowRecommendations(true)}
                    >
                      Показать рекомендации друзей
                    </button>
                  </div>
                )}
              </div>
            )}
          </main>
        </>
      )}

      {showCreateForm && (
        <CreateCompetitionModal
          setShowCreateForm={setShowCreateForm}
          friends={friends}
          onCompetitionCreated={() => {
            loadCompetitions();
          }}
        />
      )}

      <nav className="bottom-nav">
        <button
          className="nav-item active"
          onClick={() => setActiveTab('competitions')}
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
          className="nav-item"
          onClick={() => window.location.href = '/habits'}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
          <span className="nav-label">Привычки</span>
        </button>

        <button
          className="nav-item"
          onClick={() => window.location.href = '/profile'}
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

// Компонент карточки соревнования
function CompetitionCard({ competition, user, onRefresh }) {
  const [calendarData, setCalendarData] = useState(null);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [myCompletedDays, setMyCompletedDays] = useState([]);
  const [friendCompletedDays, setFriendCompletedDays] = useState([]);
  
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

  // Функция для загрузки данных календаря
  const loadCalendarData = async () => {
    if (!competition.competition_id) return;
    
    setLoadingCalendar(true);
    try {
      const { data, error } = await supabase.rpc('get_competition_calendar_data_fixed', {
        p_competition_id: competition.competition_id
      });
      
      if (error) throw error;
      
      const calendarData = data?.[0];
      if (calendarData) {
        setCalendarData(calendarData);
        setMyCompletedDays(calendarData.my_completed_days || []);
        setFriendCompletedDays(calendarData.friend_completed_days || []);
      }
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoadingCalendar(false);
    }
  };

  // Загрузка данных календаря
  useEffect(() => {
    loadCalendarData();
    
    // Подписка на изменения привычек для этого соревнования
    const channel = supabase
      .channel(`competition-${competition.competition_id}-progress`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'habit_progress',
          filter: `habit_id=eq.${competition.habit_id}`
        },
        (payload) => {
          console.log('Habit progress updated:', payload);
          setTimeout(() => {
            loadCalendarData();
          }, 500);
        }
      )
      .subscribe();
    
    const interval = setInterval(() => {
      if (competition.status === 'active') {
        loadCalendarData();
      }
    }, 30000);
    
    const handleHabitCompleted = () => {
      loadCalendarData();
    };
    
    window.addEventListener('habit-completed', handleHabitCompleted);
    
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      window.removeEventListener('habit-completed', handleHabitCompleted);
    };
  }, [competition.competition_id, competition.habit_id, competition.status, lastUpdate]);

  // Генерация календаря для текущего месяца
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date().getDate();
  
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

  // Функция для принудительного обновления
  const handleRefreshCalendar = () => {
    setLastUpdate(Date.now());
    loadCalendarData();
    if (onRefresh) onRefresh();
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
                  
                  const completed = myCompletedDays.includes(day);
                  const isToday = day === today;
                  
                  return (
                    <div 
                      key={dayIndex} 
                      className={`calendar-day ${completed ? 'completed' : ''} ${isToday ? 'today' : ''}`}
                      title={`${day} ${currentMonth + 1}.${currentYear} - ${completed ? 'Выполнено' : 'Не выполнено'}`}
                    >
                      <span className="day-number">{day}</span>
                      {completed && <div className="completion-check"></div>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="calendar-stats">
            Выполнено дней в этом месяце: {myCompletedDays.length}
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
                  
                  const completed = friendCompletedDays.includes(day);
                  const isToday = day === today;
                  
                  return (
                    <div 
                      key={dayIndex} 
                      className={`calendar-day ${completed ? 'completed' : ''} ${isToday ? 'today' : ''}`}
                      title={`${day} ${currentMonth + 1}.${currentYear} - ${completed ? 'Выполнено' : 'Не выполнено'}`}
                    >
                      <span className="day-number">{day}</span>
                      {completed && <div className="completion-check"></div>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="calendar-stats">
            Выполнено дней в этом месяце: {friendCompletedDays.length}
          </div>
        </div>
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

// Компонент запроса в друзья (объединенный для входящих и исходящих)
function FriendRequestItem({ request, type = "incoming", onAccept, onDecline, onCancel }) {
  return (
    <div className="friend-request-item">
      <div className="friend-avatar">
        <span>{request.username?.charAt(0).toUpperCase() || '👤'}</span>
      </div>
      
      <div className="friend-request-info">
        <div className="request-header">
          <h4 className="friend-name">{request.username}</h4>
          {type === 'incoming' ? (
            <span className="request-type-icon" title="Входящий запрос">⬇️</span>
          ) : (
            <span className="request-type-icon" title="Исходящий запрос">⬆️</span>
          )}
        </div>
        <p className="request-time">
          {type === 'incoming' ? 'Получен' : 'Отправлен'} {new Date(request.created_at).toLocaleDateString('ru-RU')}
        </p>
      </div>
      
      <div className="friend-request-actions">
        {type === "incoming" ? (
          <>
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
          </>
        ) : (
          <button 
            className="cancel-btn" 
            title="Отменить запрос"
            onClick={onCancel}
          >
            Отменить
          </button>
        )}
      </div>
    </div>
  );
}

// Компонент: Рекомендуемый пользователь
function RecommendedUserItem({ user, onSendRequest }) {
  const [sendingRequest, setSendingRequest] = useState(false);
  
  const handleSendRequest = async () => {
    setSendingRequest(true);
    try {
      await onSendRequest();
    } finally {
      setSendingRequest(false);
    }
  };
  
  return (
    <div className="recommended-user-item">
      <div className="recommended-user-avatar">
        <span>{user.username?.charAt(0).toUpperCase() || '👤'}</span>
      </div>
      
      <div className="recommended-user-info">
        <h4 className="recommended-user-name">{user.username}</h4>
        {user.common_habits && user.common_habits > 0 && (
          <p className="common-interests">
            <span className="common-icon">✨</span> Общие привычки: {user.common_habits}
          </p>
        )}
        {user.recommendation_reason && (
          <p className="recommendation-reason">
            {user.recommendation_reason}
          </p>
        )}
      </div>
      
      <div className="recommended-user-actions">
        <button 
          className="add-friend-recommended-btn"
          onClick={handleSendRequest}
          disabled={sendingRequest}
        >
          {sendingRequest ? 'Отправка...' : 'Добавить в друзья'}
        </button>
      </div>
    </div>
  );
}

// Модальное окно создания соревнования
function CreateCompetitionModal({ setShowCreateForm, friends, onCompetitionCreated }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    habitId: '',
    habitTitle: '',
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
        
        console.log('Привычки получены:', data);
        
        const availableHabits = (data || []).filter(habit => {
          const isOwner = habit.role === 'owner';
          const hasActiveCompetition = habit.competition_id && 
                                      habit.competition_status === 'active';
          
          return isOwner && !hasActiveCompetition;
        });
        
        console.log('Доступные привычки для соревнования:', availableHabits);
        setUserHabits(availableHabits);
        
        if (availableHabits.length > 0 && !formData.habitId) {
          setFormData(prev => ({
            ...prev,
            habitId: availableHabits[0].habit_id,
            habitTitle: availableHabits[0].title || availableHabits[0].habit_title
          }));
        }
      } catch (error) {
        console.error('Ошибка загрузки привычек:', error);
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

  const handleChangeHabit = (e) => {
    const selectedHabitId = e.target.value;
    const selectedHabit = userHabits.find(h => h.habit_id === selectedHabitId);
    
    if (selectedHabit) {
      setFormData(prev => ({
        ...prev,
        habitId: selectedHabit.habit_id,
        habitTitle: selectedHabit.title || selectedHabit.habit_title
      }));
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
    console.log('Создание соревнования с данными:', formData);
    
    if (!formData.habitId || !formData.friendUsername) {
      alert('Пожалуйста, заполните все обязательные поля');
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.rpc('create_competition', {
        p_habit_id: formData.habitId,
        p_friend_username: formData.friendUsername,
        p_total_days: formData.duration
      });

      console.log('Результат создания соревнования:', { data, error });

      if (error) {
        console.error('Ошибка RPC:', error);
        throw error;
      }

      if (data && data.success) {
        alert('✅ Соревнование создано успешно!');
        setShowCreateForm(false);
        if (onCompetitionCreated) {
          onCompetitionCreated();
        }
        
        window.dispatchEvent(new CustomEvent('competition-created'));
      } else {
        const errorMessage = data?.message || 'Неизвестная ошибка';
        console.error('Ошибка создания:', errorMessage);
        alert(`Ошибка: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Ошибка при создании соревнования:', error);
      alert(`Ошибка: ${error.message || 'Неизвестная ошибка'}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => !creating && setShowCreateForm(false)}>
      <div className="modal-content create-competition-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Создать соревнование</h3>
          <button 
            className="modal-close"
            onClick={() => setShowCreateForm(false)}
            disabled={creating}
          >
            ×
          </button>
        </div>
        
        <div className="modal-steps">
          <div className={`step-indicator ${step >= 1 ? 'active' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">Привычка</span>
          </div>
          <div className={`step-indicator ${step >= 2 ? 'active' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">Настройки</span>
          </div>
          <div className={`step-indicator ${step >= 3 ? 'active' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-label">Подтверждение</span>
          </div>
        </div>
        
        <div className="modal-body">
          {step === 1 && (
            <div className="step-content">
              <h4>Выберите привычку</h4>
              
              {loadingHabits ? (
                <div className="loading-habits">
                  <div className="loading-spinner-small"></div>
                  <p>Загрузка ваших привычек...</p>
                </div>
              ) : userHabits.length === 0 ? (
                <div className="no-habits">
                  <div className="no-habits-icon">📋</div>
                  <p><strong>У вас нет доступных привычек для соревнования.</strong></p>
                  <p>Причины:</p>
                  <ul className="no-habits-reasons">
                    <li>У вас нет привычек, где вы являетесь владельцем</li>
                    <li>Все ваши привычки уже участвуют в активных соревнованиях</li>
                    <li>Вы еще не создали ни одной привычки</li>
                  </ul>
                  <p className="hint">Сначала создайте привычку в разделе "Привычки".</p>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Выберите привычку для соревнования *</label>
                  <select
                    value={formData.habitId}
                    onChange={handleChangeHabit}
                    className="form-select"
                    required
                  >
                    {/* <option value="">-- Выберите привычку --</option> */}
                    {userHabits.map(habit => (
                      <option key={habit.habit_id} value={habit.habit_id}>
                        {habit.title || habit.habit_title} (с {new Date(habit.start_date).toLocaleDateString('ru-RU')})
                      </option>
                    ))}
                  </select>
                  
                  {formData.habitId && (
                    <div className="selected-habit-info">
                      <p><strong>Выбрано:</strong> {formData.habitTitle}</p>
                      <p className="habit-hint">
                        Эта привычка будет использоваться для соревнования. 
                        Оба участника будут отслеживать её выполнение.
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              <div className="form-group">
                <label className="form-label">Выберите друга *</label>
                {friends.length === 0 ? (
                  <div className="no-friends-warning">
                    <p><strong>У вас пока нет друзей.</strong></p>
                    <p>Добавьте друзей во вкладке "Друзья", чтобы создавать соревнования.</p>
                  </div>
                ) : (
                  <select
                    value={formData.friendUsername}
                    onChange={(e) => handleChange('friendUsername', e.target.value)}
                    className="form-select"
                    required
                  >
                    <option value="">-- Выберите друга --</option>
                    {friends.map(friend => (
                      <option key={friend.friendship_id} value={friend.username}>
                        {friend.username}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}
          
          {step === 2 && (
            <div className="step-content">
              <h4>Настройки соревнования</h4>
              <div className="form-group">
                <label className="form-label">Длительность соревнования *</label>
                <div className="duration-options">
                  {[
                    { days: 7, label: '1 неделя' },
                    { days: 14, label: '2 недели' },
                    { days: 21, label: '3 недели' },
                    { days: 30, label: '1 месяц' },
                    { days: 60, label: '2 месяца' }
                  ].map(option => (
                    <button
                      key={option.days}
                      type="button"
                      className={`duration-option ${formData.duration === option.days ? 'selected' : ''}`}
                      onClick={() => handleChange('duration', option.days)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="form-hint">Соревнование завершится, когда один из участников выполнит привычку заданное количество дней</p>
              </div>
              
              <div className="form-group">
                <label className="form-label">Дата начала *</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleChange('startDate', e.target.value)}
                  className="form-input"
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
                <p className="form-hint">Соревнование начнется с этой даты. Нельзя выбрать прошедшую дату.</p>
              </div>
            </div>
          )}
          
          {step === 3 && (
            <div className="step-content">
              <h4>Подтверждение</h4>
              
              <div className="form-group">
                <label className="form-label">Ставка для проигравшего (опционально)</label>
                <input
                  type="text"
                  value={formData.stake}
                  onChange={(e) => handleChange('stake', e.target.value)}
                  placeholder="например, 'угостить кофе', 'помыть посуду', 'сделать массаж'"
                  className="form-input"
                />
                <p className="form-hint">Добавьте ставку, чтобы сделать соревнование более интересным и мотивирующим.</p>
              </div>
              
              <div className="competition-summary">
                <h5>Сводка соревнования:</h5>
                <div className="summary-card">
                  <div className="summary-row">
                    <span className="summary-label">Привычка:</span>
                    <span className="summary-value">{formData.habitTitle || 'Не выбрана'}</span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Соперник:</span>
                    <span className="summary-value">{formData.friendUsername || 'Не выбран'}</span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Длительность:</span>
                    <span className="summary-value">{formData.duration} дней</span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Дата начала:</span>
                    <span className="summary-value">
                      {formData.startDate ? new Date(formData.startDate).toLocaleDateString('ru-RU') : 'Не указана'}
                    </span>
                  </div>
                  {formData.stake && (
                    <div className="summary-row">
                      <span className="summary-label">Ставка:</span>
                      <span className="summary-value stake-value">«{formData.stake}»</span>
                    </div>
                  )}
                </div>
                
                <div className="summary-note">
                  <p><strong>Как это работает:</strong></p>
                  <ul className="summary-list">
                    <li>Вы и ваш друг будете ежедневно отмечать выполнение привычки</li>
                    <li>Тот, кто выполнит привычку больше дней, побеждает</li>
                    <li>Соревнование автоматически завершится через {formData.duration} дней</li>
                    <li>Вы можете видеть прогресс друг друга в реальном времени</li>
                    <li>Привычку нужно отмечать в разделе "Привычки"</li>
                  </ul>
                </div>
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
              (step === 1 && (!formData.habitId || !formData.friendUsername || friends.length === 0)) ||
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
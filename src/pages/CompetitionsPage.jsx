// src/pages/CompetitionsPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import './CompetitionsPage.css';

function CompetitionsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [competitions, setCompetitions] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [preSelectedFriend, setPreSelectedFriend] = useState('');
  const [activeTab, setActiveTab] = useState('competitions');
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [sentFriendRequests, setSentFriendRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [recommendedUsers, setRecommendedUsers] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [showInviteLinkModal, setShowInviteLinkModal] = useState(false);

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
        toast.success('Запрос в друзья отправлен!');
        await loadFriendsAndRequests();
        await loadRecommendedUsers();
      } else {
        toast.error(data.message || 'Ошибка при отправке запроса');
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast.error('Ошибка при отправке запроса');
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
        toast.success('Запрос в друзья принят!');
        await loadFriendsAndRequests();
        await loadRecommendedUsers();
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
      toast.error('Ошибка при принятии запроса');
    }
  };

  const handleDeclineFriendRequest = async (friendshipId) => {
    try {
      const { data, error } = await supabase.rpc('respond_to_friend_request', {
        friendship_id: friendshipId,
        response_action: 'decline'
      });
      if (error) throw error;
      if (data.success) {
        toast('Запрос отклонён', { icon: '✕' });
        await loadFriendsAndRequests();
        await loadRecommendedUsers();
      }
    } catch (error) {
      console.error('Error declining friend request:', error);
      toast.error('Ошибка при отклонении запроса');
    }
  };

  const handleCancelSentRequest = (friendshipId) => {
    setConfirmDialog({
      title: 'Отменить запрос?',
      text: 'Запрос в друзья будет отозван.',
      onConfirm: async () => {
        try {
          const { data, error } = await supabase.rpc('cancel_friend_request', { friendship_id: friendshipId });
          if (error) throw error;
          if (data.success) {
            toast('Запрос отменён', { icon: '✕' });
            await loadFriendsAndRequests();
            await loadRecommendedUsers();
          }
        } catch (error) {
          toast.error('Ошибка при отмене запроса');
        }
        setConfirmDialog(null);
      }
    });
  };

  const handleRemoveFriend = (friendshipId, username) => {
    setConfirmDialog({
      title: 'Удалить из друзей?',
      text: `${username} будет удалён из вашего списка друзей.`,
      onConfirm: async () => {
        try {
          const { data, error } = await supabase.rpc('remove_friend', { friendship_id: friendshipId });
          if (error) throw error;
          if (data.success) {
            toast.success('Друг удалён');
            await loadFriendsAndRequests();
            await loadRecommendedUsers();
          }
        } catch (error) {
          toast.error('Ошибка при удалении друга');
        }
        setConfirmDialog(null);
      }
    });
  };

  // Общее количество запросов для бейджа
  const totalRequestsCount = friendRequests.length + sentFriendRequests.length;

  // Объединенные запросы для отображения в одной вкладке
  const allRequests = [
    ...friendRequests.map(req => ({ ...req, type: 'incoming' })),
    ...sentFriendRequests.map(req => ({ ...req, type: 'outgoing' }))
  ];

  if (loading) {
    return (
      <div className="competitions-page">
        <header className="competitions-header">
          <div className="header-content">
            <h1>DoubleDo</h1>
            <div className="user-avatar" onClick={() => navigate('/profile')}>
              <span>{user?.email?.charAt(0).toUpperCase() || 'U'}</span>
            </div>
          </div>
        </header>
        <div className="empty-competitions-container">
          <div className="loading-spinner" />
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="competitions-page">
        <header className="competitions-header">
          <div className="header-content"><h1>DoubleDo</h1></div>
        </header>
        <div className="empty-competitions-container">
          <h2>Пожалуйста, войдите в систему</h2>
        </div>
      </div>
    );
  }

  const handleCreateCompetitionWithFriend = (friendUsername) => {
    setPreSelectedFriend(friendUsername);
    setShowCreateForm(true);
  };

  const handleDeleteCompetition = (competitionId, habitTitle) => {
    setConfirmDialog({
      title: 'Удалить соревнование?',
      text: `Соревнование по привычке «${habitTitle}» будет удалено безвозвратно.`,
      onConfirm: async () => {
        try {
          const { data, error } = await supabase.rpc('delete_competition', {
            p_competition_id: competitionId
          });
          if (error) throw error;
          if (data?.success) {
            toast.success('Соревнование удалено');
            await loadCompetitions();
          } else {
            toast.error(data?.message || 'Не удалось удалить соревнование');
          }
        } catch (error) {
          toast.error('Ошибка при удалении соревнования');
        }
        setConfirmDialog(null);
      }
    });
  };

  return (
    <div className="competitions-page">
      {/* Диалог подтверждения */}
      {confirmDialog && (
        <div className="confirm-overlay" onClick={() => setConfirmDialog(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <p className="confirm-title">{confirmDialog.title}</p>
            <p className="confirm-text">{confirmDialog.text}</p>
            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={() => setConfirmDialog(null)}>Отмена</button>
              <button className="confirm-delete" onClick={confirmDialog.onConfirm}>Подтвердить</button>
            </div>
          </div>
        </div>
      )}

      <header className="competitions-header">
        <div className="header-content">
          <h1>DoubleDo</h1>
          <div className="user-avatar" onClick={() => navigate('/profile')}>
            <span>{user?.email?.charAt(0).toUpperCase() || 'U'}</span>
          </div>
        </div>
      </header>

      {!showCreateForm && (
        <>
          <div className="tabs-on-gradient">
            <div className="gradient-tabs">
              <button
                className={`gradient-tab ${activeTab === 'competitions' ? 'active' : ''}`}
                onClick={() => setActiveTab('competitions')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                  <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
                </svg>
                <span className="tab-text">Соревнования</span>
              </button>
              <button
                className={`gradient-tab ${activeTab === 'friends' ? 'active' : ''}`}
                onClick={() => setActiveTab('friends')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/>
                </svg>
                <span className="tab-text">Друзья</span>
                {totalRequestsCount > 0 && (
                  <span className="tab-badge">{totalRequestsCount}</span>
                )}
              </button>
              <button
                className={`gradient-tab ${activeTab === 'archive' ? 'active' : ''}`}
                onClick={() => setActiveTab('archive')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/>
                  <line x1="10" y1="12" x2="14" y2="12"/>
                </svg>
                <span className="tab-text">Архив</span>
                {competitions.filter(c => c.status === 'completed').length > 0 && (
                  <span className="tab-badge">{competitions.filter(c => c.status === 'completed').length}</span>
                )}
              </button>
            </div>
          </div>

          <main className="competitions-main">
            {activeTab === 'competitions' ? (
              <>
                <div className="competitions-list-header">
                  <h2>Соревнования</h2>
                  <div className="competitions-header-actions">
                    <button
                      className="invite-link-btn"
                      onClick={() => setShowInviteLinkModal(true)}
                      title="Пригласить по ссылке"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                      </svg>
                    </button>
                    <button
                      className="add-competition-btn"
                      onClick={() => setShowCreateForm(true)}
                      disabled={loading}
                    >
                      {loading ? '...' : '+'}
                    </button>
                  </div>
                </div>

                {competitions.filter(c => c.status !== 'completed').length === 0 ? (
                  <div className="empty-competitions-container">
                    <div className="empty-competitions-content">
                      <div className="empty-competitions-icon">
                        <span className="icon-circle">
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                            <path d="M4 22h16"/>
                            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                            <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
                          </svg>
                        </span>
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
                    {competitions.filter(c => c.status !== 'completed').map(competition => (
                      <CompetitionCard
                        key={competition.competition_id}
                        competition={competition}
                        user={user}
                        onRefresh={loadCompetitions}
                        onDelete={() => handleDeleteCompetition(competition.competition_id, competition.habit_title)}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : activeTab === 'archive' ? (
              <div className="archive-container">
                {competitions.filter(c => c.status === 'completed').length === 0 ? (
                  <div className="empty-archive">
                    <div className="empty-archive-icon">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/>
                        <line x1="10" y1="12" x2="14" y2="12"/>
                      </svg>
                    </div>
                    <p className="empty-archive-text">Завершённых соревнований пока нет</p>
                    <p className="empty-archive-hint">Здесь будут появляться соревнования после их завершения</p>
                  </div>
                ) : (
                  <div className="archive-list">
                    {competitions.filter(c => c.status === 'completed').map(competition => (
                      <ArchiveCard
                        key={competition.competition_id}
                        competition={competition}
                        onDelete={() => handleDeleteCompetition(competition.competition_id, competition.habit_title)}
                      />
                    ))}
                  </div>
                )}
              </div>
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
                        onRemoveFriend={() => handleRemoveFriend(friend.friendship_id, friend.username)}
                      />
                    ))}
                    
                    {friends.length === 0 && (
                      <div className="no-friends">
                        <div className="no-friends-icon">
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="8" r="4"/>
                            <path d="M20 21a8 8 0 1 0-16 0"/>
                          </svg>
                        </div>
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

      {showInviteLinkModal && (
        <InviteLinkModal
          setShowModal={setShowInviteLinkModal}
        />
      )}

      {showCreateForm && (
        <CreateCompetitionModal
          setShowCreateForm={(v) => { setShowCreateForm(v); if (!v) setPreSelectedFriend(''); }}
          friends={friends}
          preSelectedFriend={preSelectedFriend}
          onCompetitionCreated={() => {
            loadCompetitions();
            setPreSelectedFriend('');
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
          onClick={() => navigate('/habits')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
          <span className="nav-label">Привычки</span>
        </button>

        <button
          className="nav-item"
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
          className="nav-item"
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

// Компонент карточки соревнования
function CompetitionCard({ competition, user, onRefresh, onDelete }) {
  const [calendarData, setCalendarData] = useState(null);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [myCompletedDays, setMyCompletedDays] = useState([]);
  const [friendCompletedDays, setFriendCompletedDays] = useState([]);
  const [respondingToInvite, setRespondingToInvite] = useState(false);
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState({ totalMyDays: 0, totalFriendDays: 0, myStreak: 0, friendStreak: 0 });
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'heatmap'
  const [heatmapData, setHeatmapData] = useState(null);
  const [loadingHeatmap, setLoadingHeatmap] = useState(false);
  const [reactions, setReactions] = useState([]);
  const [sendingReaction, setSendingReaction] = useState(null);
  const viewMonthRef = useRef(new Date().getMonth());
  const viewYearRef = useRef(new Date().getFullYear());

  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const isInfinite = competition.total_days === 9999;

  const calculateDaysRemaining = () => {
    if (isInfinite || !competition.start_date) return null;
    const startDate = new Date(competition.start_date);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + (competition.total_days || 30));
    const now = new Date();
    return Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));
  };

  const loadCalendarData = async () => {
    if (!competition.competition_id) return;
    setLoadingCalendar(true);
    try {
      const { data, error } = await supabase.rpc('get_competition_calendar_data_fixed', {
        p_competition_id: competition.competition_id,
        p_year: viewYearRef.current,
        p_month: viewMonthRef.current + 1
      });
      if (error) throw error;
      const cd = data?.[0];
      if (cd) {
        setCalendarData(cd);
        setMyCompletedDays(cd.my_completed_days || []);
        setFriendCompletedDays(cd.friend_completed_days || []);
        setStats({
          totalMyDays: Number(cd.total_my_days) || 0,
          totalFriendDays: Number(cd.total_friend_days) || 0,
          myStreak: cd.my_streak || 0,
          friendStreak: cd.friend_streak || 0
        });
      }
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoadingCalendar(false);
    }
  };

  const loadHeatmapData = async () => {
    if (!competition.competition_id) return;
    setLoadingHeatmap(true);
    try {
      const { data, error } = await supabase.rpc('get_competition_heatmap', {
        p_competition_id: competition.competition_id
      });
      if (error) throw error;
      setHeatmapData(data?.[0] || null);
    } catch (error) {
      console.error('Error loading heatmap data:', error);
    } finally {
      setLoadingHeatmap(false);
    }
  };

  // Перезагружаем при смене месяца/года
  useEffect(() => {
    viewMonthRef.current = viewMonth;
    viewYearRef.current = viewYear;
    loadCalendarData();
  }, [viewMonth, viewYear]);

  const loadReactions = async () => {
    if (!competition.competition_id) return;
    try {
      const { data, error } = await supabase.rpc('get_competition_reactions', {
        p_competition_id: competition.competition_id
      });
      if (!error) setReactions(data || []);
    } catch {}
  };

  const handleSendReaction = async (emoji) => {
    setSendingReaction(emoji);
    try {
      const { data, error } = await supabase.rpc('send_competition_reaction', {
        p_competition_id: competition.competition_id,
        p_emoji: emoji
      });
      if (!error && data?.success) {
        await loadReactions();
        toast.success(`Реакция ${emoji} отправлена!`);
      } else {
        toast.error(data?.message || 'Не удалось отправить реакцию');
      }
    } catch {
      toast.error('Ошибка при отправке реакции');
    } finally {
      setSendingReaction(null);
    }
  };

  // Загружаем тепловую карту при переключении на неё
  useEffect(() => {
    if (viewMode === 'heatmap' && !heatmapData) {
      loadHeatmapData();
    }
  }, [viewMode]);

  // Реалтайм-подписка
  useEffect(() => {
    loadCalendarData();
    loadReactions();

    const channel = supabase
      .channel(`competition-${competition.competition_id}-progress`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'habit_progress',
        filter: `user_id=eq.${competition.user1_id}`
      }, () => { setTimeout(loadCalendarData, 500); })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'habit_progress',
        filter: `user_id=eq.${competition.user2_id}`
      }, () => { setTimeout(loadCalendarData, 500); })
      .subscribe();

    const interval = setInterval(() => {
      if (competition.status === 'active') loadCalendarData();
    }, 30000);

    const handleHabitCompleted = () => loadCalendarData();
    window.addEventListener('habit-completed', handleHabitCompleted);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      window.removeEventListener('habit-completed', handleHabitCompleted);
    };
  }, [competition.competition_id, competition.habit_id, competition.status, lastUpdate]);

  // Навигация по месяцам
  const now = new Date();
  const isCurrentMonth = viewMonth === now.getMonth() && viewYear === now.getFullYear();
  const competitionStart = competition.start_date ? new Date(competition.start_date) : null;
  const canGoPrev = !competitionStart ||
    viewYear > competitionStart.getFullYear() ||
    (viewYear === competitionStart.getFullYear() && viewMonth > competitionStart.getMonth());
  const canGoNext = !isCurrentMonth;

  const goToPrevMonth = () => {
    if (!canGoPrev) return;
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    viewMonthRef.current = m;
    viewYearRef.current = y;
    setViewMonth(m);
    setViewYear(y);
  };

  const goToNextMonth = () => {
    if (!canGoNext) return;
    const m = viewMonth === 11 ? 0 : viewMonth + 1;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    viewMonthRef.current = m;
    viewYearRef.current = y;
    setViewMonth(m);
    setViewYear(y);
  };

  // Генерация сетки календаря
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayDay = isCurrentMonth ? now.getDate() : -1;
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const weeks = [];
  let week = Array(startOffset).fill(null);
  days.forEach(day => {
    week.push(day);
    if (week.length === 7) { weeks.push(week); week = []; }
  });
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const handleRespondToInvite = async (action) => {
    setRespondingToInvite(true);
    try {
      const { data, error } = await supabase.rpc('respond_to_competition_invite', {
        p_competition_id: competition.competition_id,
        p_action: action
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(action === 'accept' ? 'Соревнование принято! 🏆' : 'Соревнование отклонено');
        if (onRefresh) onRefresh();
      } else {
        toast.error(data?.message || 'Ошибка');
      }
    } catch (error) {
      toast.error('Ошибка при ответе на приглашение');
    } finally {
      setRespondingToInvite(false);
    }
  };

  const myScore = competition.my_score || 0;
  const friendScore = competition.friend_score || 0;
  const isCompleted = competition.status === 'completed';
  const isPending = competition.status === 'pending';
  const iWon = isCompleted && myScore > friendScore;
  const friendWon = isCompleted && friendScore > myScore;
  const isDraw = isCompleted && myScore === friendScore;

  return (
    <div className={`competition-card${isCompleted ? ' completed-card' : ''}`}>
      <div className="competition-header">
        <div className="competition-title-section">
          <h3 className="competition-title">{competition.habit_title}</h3>
          <div className="competition-subtitle">
            Соревнование с <span className="friend-name">{competition.friend_username}</span>
          </div>
        </div>
        <div className="competition-title-badges">
          {isPending && <span className="status-badge pending">Ожидание</span>}
          {isCompleted && (
            <span className={`status-badge ${iWon ? 'won' : friendWon ? 'lost' : 'draw'}`}>
              {iWon ? '🥇 Победа!' : friendWon ? '🥈 Поражение' : '🤝 Ничья'}
            </span>
          )}
          <button className="delete-competition-btn" title="Удалить соревнование" onClick={onDelete}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>

      {isPending && (
        <div className="invite-actions">
          <p className="invite-text">Вас пригласили в соревнование по привычке «{competition.habit_title}»</p>
          <div className="invite-buttons">
            <button className="invite-accept-btn" onClick={() => handleRespondToInvite('accept')} disabled={respondingToInvite}>
              {respondingToInvite ? '...' : 'Принять'}
            </button>
            <button className="invite-decline-btn" onClick={() => handleRespondToInvite('decline')} disabled={respondingToInvite}>
              Отклонить
            </button>
          </div>
        </div>
      )}

      <div className="competition-score">
        <div className={`score-section you-section${iWon ? ' winner' : ''}`}>
          <div className="score-label">Вы</div>
          <div className="score-value">{myScore}</div>
        </div>
        <div className="vs-section">
          <div className="vs-text">VS</div>
        </div>
        <div className={`score-section friend-section${friendWon ? ' winner' : ''}`}>
          <div className="score-label">{competition.friend_username}</div>
          <div className="score-value">{friendScore}</div>
        </div>
        {!isCompleted && (
          <div className="days-remaining">
            <div className="days-label">{isInfinite ? 'Режим' : 'Дней'}</div>
            <div className="days-value">{isInfinite ? '∞' : calculateDaysRemaining()}</div>
          </div>
        )}
      </div>

      <div className="competition-calendars">
        <div className="calendar-view-toggle">
          <button
            className={`view-toggle-btn${viewMode === 'calendar' ? ' active' : ''}`}
            onClick={() => setViewMode('calendar')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Календарь
          </button>
          <button
            className={`view-toggle-btn${viewMode === 'heatmap' ? ' active' : ''}`}
            onClick={() => setViewMode('heatmap')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
            Тепловая карта
          </button>
        </div>

        {viewMode === 'heatmap' ? (
          <HeatmapView
            heatmapData={heatmapData}
            loading={loadingHeatmap}
            friendUsername={competition.friend_username}
            competition={competition}
          />
        ) : (<>

        <div className="calendar-month-nav">
          <button className="cal-nav-btn" onClick={goToPrevMonth} disabled={!canGoPrev} title="Предыдущий месяц">
            ‹
          </button>
          <span className="cal-month-label">{monthNames[viewMonth]} {viewYear}</span>
          <button className="cal-nav-btn" onClick={goToNextMonth} disabled={!canGoNext} title="Следующий месяц">
            ›
          </button>
        </div>

        <div className="calendar-section">
          <div className="calendar-title">● Ваш календарь</div>
          <div className="calendar-grid">
            <div className="weekdays-row">
              {dayNames.map((d, i) => <div key={i} className="weekday-cell">{d}</div>)}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="calendar-week">
                {week.map((day, di) => {
                  if (day === null) return <div key={di} className="calendar-day empty"></div>;
                  const completed = myCompletedDays.includes(day);
                  const isToday = day === todayDay;
                  return (
                    <div key={di} className={`calendar-day${completed ? ' completed' : ''}${isToday ? ' today' : ''}`}
                      title={`${day} ${viewMonth + 1}.${viewYear} — ${completed ? 'Выполнено' : 'Не выполнено'}`}>
                      <span className="day-number">{day}</span>
                      {completed && <div className="completion-check"></div>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="calendar-stats">
            {monthNames[viewMonth]}: {myCompletedDays.length} дн.
          </div>
        </div>

        <div className="calendar-section">
          <div className="calendar-title">● Календарь {competition.friend_username}</div>
          <div className="calendar-grid">
            <div className="weekdays-row">
              {dayNames.map((d, i) => <div key={i} className="weekday-cell">{d}</div>)}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="calendar-week">
                {week.map((day, di) => {
                  if (day === null) return <div key={di} className="calendar-day empty"></div>;
                  const completed = friendCompletedDays.includes(day);
                  const isToday = day === todayDay;
                  return (
                    <div key={di} className={`calendar-day${completed ? ' completed' : ''}${isToday ? ' today' : ''}`}
                      title={`${day} ${viewMonth + 1}.${viewYear} — ${completed ? 'Выполнено' : 'Не выполнено'}`}>
                      <span className="day-number">{day}</span>
                      {completed && <div className="completion-check"></div>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="calendar-stats">
            {monthNames[viewMonth]}: {friendCompletedDays.length} дн.
          </div>

          <div className="reactions-section">
            <div className="reactions-buttons">
              {['🔥', '👏', '💪', '😎'].map(emoji => {
                const count = reactions.filter(r => r.emoji === emoji).length;
                return (
                  <button
                    key={emoji}
                    className={`reaction-btn${count > 0 ? ' has-reactions' : ''}`}
                    onClick={() => handleSendReaction(emoji)}
                    disabled={sendingReaction !== null}
                    title={`Отправить ${emoji}`}
                  >
                    {emoji}
                    {count > 0 && <span className="reaction-count">{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        </>)}
      </div>
    </div>
  );
}

// Компонент тепловой карты
function HeatmapView({ heatmapData, loading, friendUsername, competition }) {
  if (loading) {
    return (
      <div className="heatmap-loading">
        <div className="loading-spinner-small" />
        <p>Загрузка...</p>
      </div>
    );
  }

  if (!heatmapData) {
    return <div className="heatmap-empty">Нет данных для отображения</div>;
  }

  const myDates = new Set(heatmapData.my_completed_dates || []);
  const friendDates = new Set(heatmapData.friend_completed_dates || []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Range: competition start → today (capped at end date)
  let rangeStart = competition?.start_date ? new Date(competition.start_date) : new Date(today);
  rangeStart.setHours(0, 0, 0, 0);

  let rangeEnd = new Date(today);
  if (competition?.total_days && competition.total_days !== 9999 && competition?.start_date) {
    const endDate = new Date(rangeStart);
    endDate.setDate(rangeStart.getDate() + competition.total_days - 1);
    if (endDate < today) rangeEnd = endDate;
  }

  // Align grid start to Monday
  const gridStart = new Date(rangeStart);
  const dow = gridStart.getDay();
  gridStart.setDate(gridStart.getDate() - (dow === 0 ? 6 : dow - 1));

  const weeks = [];
  let current = new Date(gridStart);
  while (current <= rangeEnd) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = current.toISOString().split('T')[0];
      const inRange = current >= rangeStart && current <= rangeEnd;
      week.push({ date: dateStr, inRange });
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  const CELL = 16; // px
  const GAP = 3;   // px
  const COL_STEP = CELL + GAP;

  const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
                      'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

  const monthLabels = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const m = new Date(week[0].date).getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ wi, label: monthNames[m] });
      lastMonth = m;
    }
  });

  const gridWidth = weeks.length * COL_STEP - GAP;

  const renderGrid = (dates, label) => (
    <div className="heatmap-section">
      <div className="heatmap-label">{label}</div>
      <div className="heatmap-scroll">
        <div className="heatmap-month-row" style={{ width: gridWidth, position: 'relative', height: 16, marginBottom: 4 }}>
          {monthLabels.map(({ wi, label: ml }) => (
            <span key={wi} className="heatmap-month-label" style={{ left: wi * COL_STEP }}>{ml}</span>
          ))}
        </div>
        <div className="heatmap-grid" style={{ gap: GAP }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="heatmap-col" style={{ gap: GAP }}>
              {week.map(({ date, inRange }) => {
                const filled = inRange && dates.has(date);
                return (
                  <div
                    key={date}
                    className={`heatmap-cell${filled ? ' filled' : ''}${inRange ? '' : ' out-of-range'}`}
                    style={{ width: CELL, height: CELL }}
                    title={inRange ? date : ''}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="heatmap-legend">
        <span className="heatmap-legend-empty" style={{ width: CELL, height: CELL }} />
        <span className="heatmap-legend-filled" style={{ width: CELL, height: CELL }} />
        <span className="heatmap-legend-text">Выполнено</span>
      </div>
    </div>
  );

  return (
    <div className="heatmap-container">
      {renderGrid(myDates, 'Вы')}
      {renderGrid(friendDates, friendUsername)}
    </div>
  );
}

// Компонент карточки архива
function ArchiveCard({ competition, onDelete }) {
  const myScore = competition.my_score || 0;
  const friendScore = competition.friend_score || 0;
  const iWon = myScore > friendScore;
  const friendWon = friendScore > myScore;
  const isInfinite = competition.total_days === 9999;

  const startDate = competition.start_date
    ? new Date(competition.start_date).toLocaleDateString('ru-RU')
    : '';
  const endDate = competition.start_date && !isInfinite
    ? new Date(new Date(competition.start_date).getTime() + competition.total_days * 86400000).toLocaleDateString('ru-RU')
    : '';

  return (
    <div className="archive-card">
      <div className="archive-card-header">
        <div className="archive-card-title-section">
          <h3 className="archive-habit-title">{competition.habit_title}</h3>
          <p className="archive-vs">vs. {competition.friend_username}</p>
        </div>
        <div className="archive-card-badges">
          <span className={`status-badge ${iWon ? 'won' : friendWon ? 'lost' : 'draw'}`}>
            {iWon ? '🥇 Победа' : friendWon ? '🥈 Поражение' : '🤝 Ничья'}
          </span>
          <button className="delete-competition-btn" title="Удалить из архива" onClick={onDelete}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="archive-card-score">
        <span className={`archive-score-you${iWon ? ' winner' : ''}`}>{myScore}</span>
        <span className="archive-score-sep">:</span>
        <span className={`archive-score-friend${friendWon ? ' winner' : ''}`}>{friendScore}</span>
      </div>

      <div className="archive-card-meta">
        {startDate && (
          <span className="archive-meta-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {startDate}{endDate ? ` — ${endDate}` : ''}
          </span>
        )}
        <span className="archive-meta-item">
          {isInfinite ? '∞ Бесконечное' : `${competition.total_days} дн.`}
        </span>
      </div>
    </div>
  );
}

// Компонент элемента списка друзей
function FriendItem({ friend, onCreateCompetition, onRemoveFriend }) {
  return (
    <div className="friend-item">
      <div className="friend-avatar">
        <span>{friend.username?.charAt(0).toUpperCase() || 'U'}</span>
      </div>

      <div className="friend-info">
        <h4 className="friend-name">{friend.username}</h4>
        <p className="friend-status">
          Друг с {new Date(friend.friendship_created_at).toLocaleDateString('ru-RU')}
        </p>
      </div>

      <div className="friend-actions">
        <button className="friend-action-btn" title="Создать соревнование" onClick={onCreateCompetition}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
            <path d="M4 22h16"/>
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
          </svg>
        </button>
        <button className="friend-action-btn danger" title="Удалить из друзей" onClick={onRemoveFriend}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
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
          <span className={`request-type-badge ${type}`}>
            {type === 'incoming' ? 'Входящий' : 'Исходящий'}
          </span>
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
function CreateCompetitionModal({ setShowCreateForm, friends, preSelectedFriend, onCompetitionCreated }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    habitId: '',
    habitTitle: '',
    friendUsername: preSelectedFriend || '',
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
    if (!formData.habitId || !formData.friendUsername) {
      toast.error('Заполните все обязательные поля');
      return;
    }

    setCreating(true);
    try {
      const rpcParams = {
        p_habit_id: formData.habitId,
        p_friend_username: formData.friendUsername,
        p_total_days: formData.duration
      };
      if (formData.stake) rpcParams.p_stake = formData.stake;

      const { data, error } = await supabase.rpc('create_competition', rpcParams);

      if (error) throw error;

      if (data && data.success) {
        toast.success('Соревнование создано! Ожидайте подтверждения от друга.');
        setShowCreateForm(false);
        if (onCompetitionCreated) onCompetitionCreated();
        window.dispatchEvent(new CustomEvent('competition-created'));
      } else {
        toast.error(data?.message || 'Неизвестная ошибка');
      }
    } catch (error) {
      console.error('Ошибка при создании соревнования:', error);
      toast.error(error.message || 'Ошибка при создании соревнования');
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
                    { days: 60, label: '2 месяца' },
                    { days: 9999, label: '∞ Бесконечное' }
                  ].map(option => (
                    <button
                      key={option.days}
                      type="button"
                      className={`duration-option ${formData.duration === option.days ? 'selected' : ''}${option.days === 9999 ? ' infinite' : ''}`}
                      onClick={() => handleChange('duration', option.days)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="form-hint">
                  {formData.duration === 9999
                    ? 'Соревнование не имеет конечной даты — оно будет продолжаться до тех пор, пока его не удалят'
                    : 'Соревнование завершится через указанное количество дней'}
                </p>
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
                    <span className="summary-value">
                      {formData.duration === 9999 ? '∞ Бесконечное' : `${formData.duration} дней`}
                    </span>
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
                    <li>{formData.duration === 9999 ? 'Соревнование бессрочное — без автоматического завершения' : `Соревнование автоматически завершится через ${formData.duration} дней`}</li>
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

// Модальное окно генерации ссылки-приглашения
function InviteLinkModal({ setShowModal }) {
  const [userHabits, setUserHabits] = useState([]);
  const [loadingHabits, setLoadingHabits] = useState(false);
  const [formData, setFormData] = useState({ habitId: '', habitTitle: '', duration: 30, stake: '' });
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoadingHabits(true);
      try {
        const { data, error } = await supabase.rpc('get_all_user_habits');
        if (error) throw error;
        const available = (data || []).filter(h => h.role === 'owner');
        setUserHabits(available);
        if (available.length > 0) {
          setFormData(prev => ({
            ...prev,
            habitId: available[0].habit_id,
            habitTitle: available[0].title || available[0].habit_title
          }));
        }
      } catch {
        setUserHabits([]);
      } finally {
        setLoadingHabits(false);
      }
    };
    load();
  }, []);

  const handleGenerate = async () => {
    if (!formData.habitId) { toast.error('Выберите привычку'); return; }
    setGenerating(true);
    try {
      const params = {
        p_habit_id: formData.habitId,
        p_total_days: formData.duration
      };
      if (formData.stake) params.p_stake = formData.stake;

      const { data, error } = await supabase.rpc('generate_competition_invite', params);
      if (error) throw error;
      if (data?.success) {
        const link = `${window.location.origin}/invite/${data.token}`;
        setGeneratedLink(link);
      } else {
        toast.error(data?.message || 'Не удалось создать ссылку');
      }
    } catch (err) {
      toast.error(err.message || 'Ошибка при создании ссылки');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    const text = `Вас приглашают в соревнование по привычке «${formData.habitTitle}» на ${formData.duration} дней в приложении DoubleDo!\n\nПерейдите по ссылке, чтобы принять вызов:\n${generatedLink}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success('Ссылка скопирована!');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="modal-overlay" onClick={() => setShowModal(false)}>
      <div className="modal-content create-competition-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Пригласить по ссылке</h3>
          <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
        </div>

        <div className="modal-body">
          {!generatedLink ? (
            <div className="step-content">
              <p className="invite-modal-desc">
                Создайте ссылку-приглашение и отправьте её любому человеку. Ему не нужно быть вашим другом — достаточно зарегистрироваться и соревнование начнётся автоматически.
              </p>

              {loadingHabits ? (
                <div className="loading-habits">
                  <div className="loading-spinner-small" />
                  <p>Загрузка привычек...</p>
                </div>
              ) : userHabits.length === 0 ? (
                <div className="no-habits">
                  <p><strong>Нет доступных привычек.</strong></p>
                  <p className="hint">Сначала создайте привычку в разделе «Привычки».</p>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Привычка *</label>
                    <select
                      className="form-select"
                      value={formData.habitId}
                      onChange={e => {
                        const h = userHabits.find(h => h.habit_id === e.target.value);
                        if (h) setFormData(prev => ({ ...prev, habitId: h.habit_id, habitTitle: h.title || h.habit_title }));
                      }}
                    >
                      {userHabits.map(h => (
                        <option key={h.habit_id} value={h.habit_id}>
                          {h.title || h.habit_title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Длительность *</label>
                    <div className="duration-options">
                      {[
                        { days: 7, label: '1 неделя' },
                        { days: 14, label: '2 недели' },
                        { days: 21, label: '3 недели' },
                        { days: 30, label: '1 месяц' },
                        { days: 9999, label: '∞ Бесконечное' }
                      ].map(o => (
                        <button
                          key={o.days}
                          type="button"
                          className={`duration-option${formData.duration === o.days ? ' selected' : ''}${o.days === 9999 ? ' infinite' : ''}`}
                          onClick={() => setFormData(prev => ({ ...prev, duration: o.days }))}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Ставка (опционально)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="например, 'угостить кофе'"
                      value={formData.stake}
                      onChange={e => setFormData(prev => ({ ...prev, stake: e.target.value }))}
                    />
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="step-content">
              <div className="invite-link-success">
                <div className="invite-link-check">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>
                  </svg>
                </div>
                <p className="invite-link-success-text">Ссылка создана! Действует 7 дней.</p>
              </div>

              <div className="invite-link-box">
                <input
                  type="text"
                  className="invite-link-input"
                  value={generatedLink}
                  readOnly
                  onClick={e => e.target.select()}
                />
                <button className="invite-link-copy-btn" onClick={handleCopy}>
                  {copied ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  )}
                </button>
              </div>

              <p className="invite-link-hint">
                Отправьте эту ссылку другу. Он перейдёт по ней, зарегистрируется (или войдёт) — и соревнование начнётся автоматически.
              </p>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={() => setShowModal(false)}>
            {generatedLink ? 'Закрыть' : 'Отмена'}
          </button>
          {!generatedLink && (
            <button
              className="btn-primary"
              onClick={handleGenerate}
              disabled={generating || !formData.habitId || userHabits.length === 0}
            >
              {generating ? 'Создание...' : 'Создать ссылку'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CompetitionsPage;
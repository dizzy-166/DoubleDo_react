import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import './StatsPage.css';

function StatsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/competitions')) return 'competitions';
    if (path.includes('/profile')) return 'profile';
    if (path.includes('/stats')) return 'stats';
    return 'habits';
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      try {
        const { data, error } = await supabase.rpc('get_user_stats');
        if (error) throw error;
        setStats(data);
      } catch (err) {
        console.error('Error loading stats:', err);
        setStats(null);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
                      'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

  const renderMonthlyChart = () => {
    if (!stats?.monthly_data || stats.monthly_data.length === 0) return null;

    const data = stats.monthly_data.slice(-6);
    const maxVal = Math.max(...data.map(d => d.count), 1);

    return (
      <div className="stats-chart-section">
        <h3 className="stats-section-title">Активность за 6 месяцев</h3>
        <div className="bar-chart">
          {data.map((d, i) => {
            const pct = Math.max(Math.round((d.count / maxVal) * 100), 4);
            return (
              <div key={i} className="bar-col">
                <div className="bar-value">{d.count}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ height: `${pct}%` }} />
                </div>
                <div className="bar-label">{monthNames[d.month - 1]}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="stats-page">
      <header className="stats-header">
        <div className="header-content">
          <h1>DoubleDo</h1>
          <div className="user-avatar-stats" onClick={() => navigate('/profile')}>
            <span>{user?.email?.charAt(0).toUpperCase() || 'U'}</span>
          </div>
        </div>
      </header>

      <main className="stats-main">
        <h2 className="stats-page-title">Моя статистика</h2>

        {loading ? (
          <div className="stats-loading">
            <div className="loading-spinner" />
            <p>Загрузка...</p>
          </div>
        ) : !stats ? (
          <div className="stats-error">
            <p>Не удалось загрузить статистику</p>
          </div>
        ) : (
          <>
            <div className="stats-grid">
              <div className="stat-card accent">
                <div className="stat-card-icon">🔥</div>
                <div className="stat-card-value">{stats.best_streak ?? 0}</div>
                <div className="stat-card-label">Стрик</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-icon">✅</div>
                <div className="stat-card-value">{stats.total_tracked ?? 0}</div>
                <div className="stat-card-label">Выполнено дней</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-icon">📋</div>
                <div className="stat-card-value">{stats.habits_count ?? 0}</div>
                <div className="stat-card-label">Привычек</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-icon">🏆</div>
                <div className="stat-card-value">{stats.competitions_won ?? 0}</div>
                <div className="stat-card-label">Побед</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-icon">⚔️</div>
                <div className="stat-card-value">{stats.competitions_played ?? 0}</div>
                <div className="stat-card-label">Турниров</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-icon">📊</div>
                <div className="stat-card-value">
                  {(stats.competitions_played ?? 0) > 0
                    ? `${Math.round(((stats.competitions_won ?? 0) / stats.competitions_played) * 100)}%`
                    : '—'}
                </div>
                <div className="stat-card-label">Побед %</div>
              </div>
            </div>

            {renderMonthlyChart()}
          </>
        )}
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

export default StatsPage;

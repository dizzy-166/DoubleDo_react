import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import './StatsPage.css';

function StatsPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [allProgress, setAllProgress] = useState([]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      try {
        const [{ data, error }, { data: progress }] = await Promise.all([
          supabase.rpc('get_user_stats'),
          supabase
            .from('habit_progress')
            .select('habit_id, completed_date')
            .eq('user_id', user.id)
            .eq('is_completed', true)
            .order('completed_date', { ascending: true }),
        ]);
        if (error) throw error;

        // Compute best streak per-habit and take the max.
        // The backend value can be wrong when habits have gaps.
        const byHabit = {};
        (progress || []).forEach(p => {
          (byHabit[p.habit_id] = byHabit[p.habit_id] || []).push(p.completed_date);
        });
        let bestStreak = 0;
        Object.values(byHabit).forEach(dates => {
          let cur = 1, max = 1;
          for (let i = 1; i < dates.length; i++) {
            const prev = new Date(dates[i - 1]);
            prev.setUTCDate(prev.getUTCDate() + 1);
            if (prev.toISOString().split('T')[0] === dates[i]) {
              cur++;
              if (cur > max) max = cur;
            } else {
              cur = 1;
            }
          }
          if (dates.length > 0 && max > bestStreak) bestStreak = max;
        });

        setStats({ ...data, best_streak: bestStreak });
        setAllProgress(progress || []);
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

  const renderHeatmap = () => {
    if (!allProgress.length) return null;

    // Подсчёт выполнений по датам
    const completionCount = {};
    allProgress.forEach(p => {
      if (p.completed_date) {
        completionCount[p.completed_date] = (completionCount[p.completed_date] || 0) + 1;
      }
    });

    // Строим сетку: 52 недели заканчивающихся сегодня
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    // Находим ближайший понедельник, чтобы начать сетку
    const dayOfWeek = todayUTC.getUTCDay(); // 0=Вс
    const daysToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const mondayThisWeek = new Date(todayUTC);
    mondayThisWeek.setUTCDate(mondayThisWeek.getUTCDate() - daysToMon);

    const startMonday = new Date(mondayThisWeek);
    startMonday.setUTCDate(startMonday.getUTCDate() - 51 * 7);

    const weeks = [];
    const cursor = new Date(startMonday);

    while (cursor <= todayUTC) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const isFuture = cursor > todayUTC;
        const dateStr = cursor.toISOString().split('T')[0];
        week.push({ date: dateStr, count: isFuture ? -1 : (completionCount[dateStr] || 0) });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      weeks.push(week);
    }

    // Метки месяцев над сеткой
    const monthLabels = [];
    let lastMonth = -1;
    weeks.forEach((week, wi) => {
      const m = new Date(week[0].date).getUTCMonth();
      if (m !== lastMonth) {
        monthLabels.push({ wi, label: monthNames[m] });
        lastMonth = m;
      }
    });

    const getHeatClass = (count) => {
      if (count < 0) return 'hm-future';
      if (count === 0) return 'hm-0';
      if (count <= 2) return 'hm-1';
      if (count <= 4) return 'hm-2';
      return 'hm-3';
    };

    return (
      <div className="stats-chart-section heatmap-section">
        <h3 className="stats-section-title">Активность за год</h3>
        <div className="heatmap-scroll">
          <div className="heatmap-wrap">
            {/* Метки месяцев */}
            <div className="heatmap-month-row">
              {weeks.map((week, wi) => {
                const ml = monthLabels.find(l => l.wi === wi);
                return (
                  <div key={wi} className="heatmap-month-col">
                    {ml ? <span className="heatmap-month-label">{ml.label}</span> : null}
                  </div>
                );
              })}
            </div>
            {/* Сетка */}
            <div className="heatmap-grid">
              {weeks.map((week, wi) => (
                <div key={wi} className="heatmap-col">
                  {week.map((day, di) => (
                    <div
                      key={di}
                      className={`heatmap-cell ${getHeatClass(day.count)}`}
                      title={day.count >= 0 ? `${day.date}: ${day.count} выпол.` : ''}
                    />
                  ))}
                </div>
              ))}
            </div>
            {/* Легенда */}
            <div className="heatmap-legend">
              <span className="heatmap-legend-label">Меньше</span>
              <div className="heatmap-cell hm-0" />
              <div className="heatmap-cell hm-1" />
              <div className="heatmap-cell hm-2" />
              <div className="heatmap-cell hm-3" />
              <span className="heatmap-legend-label">Больше</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

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
      <main className="stats-main">
        <div className="stats-title-row">
          <h2 className="stats-page-title">Статистика</h2>
          <div className="user-avatar-stats" onClick={() => navigate('/profile')}>
            <span>{user?.email?.charAt(0).toUpperCase() || 'U'}</span>
          </div>
        </div>

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

            {renderHeatmap()}
            {renderMonthlyChart()}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

export default StatsPage;

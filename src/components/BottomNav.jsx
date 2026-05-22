import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useLang } from '../context/LangContext';
import './BottomNav.css';

function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLang();
  const [pendingCount, setPendingCount] = useState(0);

  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/competitions')) return 'competitions';
    if (path.includes('/profile')) return 'profile';
    if (path.includes('/stats')) return 'stats';
    return 'habits';
  };

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const { data } = await supabase.rpc('get_pending_friend_requests');
        setPendingCount((data || []).length);
      } catch {
        // не критично
      }
    };
    fetchPending();
  }, [location.pathname]);

  const active = getActiveTab();

  return (
    <nav className="bottom-nav">
      <button
        className={`nav-item ${active === 'competitions' ? 'active' : ''}`}
        onClick={() => navigate('/competitions')}
      >
        <div className="nav-icon-wrapper">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
            <path d="M4 22h16"/>
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
          </svg>
          {pendingCount > 0 && (
            <span className="nav-badge">{pendingCount > 9 ? '9+' : pendingCount}</span>
          )}
        </div>
        <span className="nav-label">{t('navCompetitions')}</span>
      </button>

      <button
        className={`nav-item ${active === 'habits' ? 'active' : ''}`}
        onClick={() => navigate('/habits')}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="m9 12 2 2 4-4"/>
        </svg>
        <span className="nav-label">{t('navHabits')}</span>
      </button>

      <button
        className={`nav-item ${active === 'stats' ? 'active' : ''}`}
        onClick={() => navigate('/stats')}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
        <span className="nav-label">{t('navStats')}</span>
      </button>

      <button
        className={`nav-item ${active === 'profile' ? 'active' : ''}`}
        onClick={() => navigate('/profile')}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4"/>
          <path d="M20 21a8 8 0 1 0-16 0"/>
        </svg>
        <span className="nav-label">{t('navProfile')}</span>
      </button>
    </nav>
  );
}

export default BottomNav;

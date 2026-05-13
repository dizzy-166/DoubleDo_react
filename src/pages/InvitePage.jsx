// src/pages/InvitePage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';
import './InvitePage.css';

const extractUsername = (email) => {
  if (!email) return 'user';
  let u = email.split('@')[0].toLowerCase().replace(/[^a-z0-9.]/g, '').replace(/\./g, '_');
  if (!u || u.length < 3) u = 'user_' + email.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 6);
  return u.substring(0, 20);
};

export default function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();

  // undefined = still checking, null = not logged in, object = logged in
  const [currentUser, setCurrentUser] = useState(undefined);

  const [inviteInfo, setInviteInfo] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [inviteError, setInviteError] = useState('');

  const [authStep, setAuthStep] = useState('email'); // 'email' | 'otp'
  const [isRegister, setIsRegister] = useState(true);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const otpRefs = useRef([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setCurrentUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const load = async () => {
      setInviteLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_competition_invite_info', { p_token: token });
        if (error) throw error;
        if (data?.success) {
          setInviteInfo(data);
        } else {
          setInviteError(data?.message || 'Приглашение недействительно');
        }
      } catch {
        setInviteError('Не удалось загрузить приглашение');
      } finally {
        setInviteLoading(false);
      }
    };
    load();
  }, [token]);

  const acceptInvite = async () => {
    setAccepting(true);
    try {
      const { data, error } = await supabase.rpc('accept_competition_invite', { p_token: token });
      if (error) throw error;
      if (data?.success) {
        setAccepted(true);
        toast.success('Соревнование принято! 🏆');
        setTimeout(() => navigate('/competitions'), 1800);
      } else {
        toast.error(data?.message || 'Не удалось принять приглашение');
      }
    } catch {
      toast.error('Ошибка при принятии приглашения');
    } finally {
      setAccepting(false);
    }
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .limit(1);
      const userExists = existing && existing.length > 0;

      if (!isRegister && !userExists) {
        setAuthError('Пользователь не зарегистрирован');
        return;
      }
      if (isRegister && userExists) {
        setAuthError('Email уже зарегистрирован — войдите');
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: isRegister }
      });
      if (error) throw error;
      setAuthStep('otp');
    } catch (err) {
      setAuthError(err.message || 'Не удалось отправить код');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp,
        type: 'email'
      });
      if (verifyError) throw verifyError;

      if (isRegister) {
        await supabase.rpc('set_username_atomic', { new_username: extractUsername(email) });
      }

      // Session is now established — accept the invite directly
      const { data, error: acceptError } = await supabase.rpc('accept_competition_invite', { p_token: token });
      if (acceptError) throw acceptError;

      if (data?.success) {
        setAccepted(true);
        toast.success('Регистрация завершена и соревнование принято! 🏆');
        setTimeout(() => navigate('/competitions'), 1800);
      } else {
        toast.error(data?.message || 'Не удалось принять приглашение');
      }
    } catch (err) {
      setAuthError(err.message || 'Неверный код или ошибка');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleOTPChange = (e, index) => {
    const value = e.target.value.replace(/\D/g, '');
    const chars = otp.padEnd(6, ' ').split('');
    chars[index] = value ? value[0] : '';
    setOtp(chars.join('').trimEnd());
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOTPKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const chars = otp.padEnd(6, ' ').split('');
      chars[index - 1] = '';
      setOtp(chars.join('').trimEnd());
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOTPPaste = (e) => {
    e.preventDefault();
    const cleaned = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (cleaned) {
      setOtp(cleaned);
      otpRefs.current[Math.min(5, cleaned.length - 1)]?.focus();
    }
  };

  const InviteInfoCard = () => (
    <div className="invite-info-card">
      <div className="invite-trophy-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
          <path d="M4 22h16"/>
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
        </svg>
      </div>
      <div className="invite-info-text">
        <p className="invite-from">
          <strong>{inviteInfo.creator_username}</strong> приглашает вас в соревнование
        </p>
        <p className="invite-habit">«{inviteInfo.habit_title}»</p>
        <div className="invite-meta">
          <span className="invite-meta-item">{inviteInfo.total_days} дней</span>
          {inviteInfo.stake && (
            <span className="invite-meta-item invite-stake">Ставка: «{inviteInfo.stake}»</span>
          )}
        </div>
      </div>
    </div>
  );

  if (currentUser === undefined || inviteLoading) {
    return (
      <div className="invite-page">
        <div className="invite-loading">
          <div className="invite-spinner" />
          <p>Загрузка приглашения...</p>
        </div>
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="invite-page">
        <div className="invite-card">
          <div className="invite-logo">
            <div className="invite-logo-icon">DD</div>
            <div className="invite-logo-text">DoubleDo</div>
          </div>
          <div className="invite-error-block">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <h2>Приглашение недействительно</h2>
            <p>{inviteError}</p>
          </div>
          <button className="invite-action-btn" onClick={() => navigate(currentUser ? '/competitions' : '/')}>
            {currentUser ? 'Перейти к соревнованиям' : 'На главную'}
          </button>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="invite-page">
        <div className="invite-card invite-card-success">
          <div className="invite-success-icon">🏆</div>
          <h2>Соревнование принято!</h2>
          <p>Переходим к соревнованиям...</p>
        </div>
      </div>
    );
  }

  // Logged in — show accept button
  if (currentUser) {
    return (
      <div className="invite-page">
        <div className="invite-card">
          <div className="invite-logo">
            <div className="invite-logo-icon">DD</div>
            <div className="invite-logo-text">DoubleDo</div>
          </div>
          <InviteInfoCard />
          <button className="invite-action-btn" onClick={acceptInvite} disabled={accepting}>
            {accepting ? 'Принятие...' : 'Принять соревнование'}
          </button>
          <button className="invite-skip-btn" onClick={() => navigate('/competitions')}>
            Отмена
          </button>
        </div>
      </div>
    );
  }

  // Not logged in — inline auth form
  return (
    <div className="invite-page">
      <div className="invite-card">
        <div className="invite-logo">
          <div className="invite-logo-icon">DD</div>
          <div className="invite-logo-text">DoubleDo</div>
        </div>

        <InviteInfoCard />

        <p className="invite-auth-prompt">
          {authStep === 'email'
            ? 'Войдите или зарегистрируйтесь, чтобы принять соревнование'
            : `Введите код, отправленный на ${email}`}
        </p>

        {authError && <div className="invite-error-msg">{authError}</div>}

        {authStep === 'email' ? (
          <form onSubmit={handleSendOTP} className="invite-auth-form">
            <input
              type="email"
              className="invite-input"
              placeholder="your@email.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setAuthError(''); }}
              autoFocus
              required
            />
            <button type="submit" className="invite-action-btn" disabled={authLoading || !email.trim()}>
              {authLoading ? 'Отправка...' : 'Получить код подтверждения'}
            </button>
            <div className="invite-auth-toggle">
              <span>{isRegister ? 'Уже есть аккаунт?' : 'Нет аккаунта?'}</span>
              <button type="button" onClick={() => { setIsRegister(!isRegister); setAuthError(''); }}>
                {isRegister ? 'Войти' : 'Зарегистрироваться'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="invite-auth-form">
            <div className="invite-otp-row" onPaste={handleOTPPaste}>
              {[...Array(6)].map((_, i) => (
                <input
                  key={i}
                  ref={el => otpRefs.current[i] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength="1"
                  className={`invite-otp-input${otp[i] ? ' filled' : ''}`}
                  value={otp[i] || ''}
                  onChange={e => handleOTPChange(e, i)}
                  onKeyDown={e => handleOTPKeyDown(e, i)}
                  autoFocus={i === 0}
                />
              ))}
            </div>
            <button
              type="submit"
              className="invite-action-btn"
              disabled={authLoading || otp.replace(/\s/g, '').length !== 6}
            >
              {authLoading ? 'Проверка...' : 'Подтвердить и принять'}
            </button>
            <button
              type="button"
              className="invite-skip-btn"
              onClick={() => { setAuthStep('email'); setOtp(''); setAuthError(''); }}
            >
              ← Назад
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

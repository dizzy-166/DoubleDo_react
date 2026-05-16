import React, { useEffect, useState } from 'react';
import './MissedNotificationOverlay.css';

const EMOJIS = ['🔥', '👏', '💪', '😎'];

export default function MissedNotificationOverlay({ notification, onClose, onSendEmoji }) {
  const [visible, setVisible] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const close = () => {
    setVisible(false);
    setTimeout(onClose, 320);
  };

  const handleSend = async (emoji) => {
    if (sending) return;
    setSending(true);
    await onSendEmoji(emoji);
    setSending(false);
    close();
  };

  const isSender = notification.type === 'sender';

  return (
    <div className={`mno-overlay${visible ? ' visible' : ''}`} onClick={close}>
      <div className={`mno-card${visible ? ' visible' : ''}`} onClick={e => e.stopPropagation()}>
        {isSender ? (
          <>
            <div className="mno-icon">😤</div>
            <h2 className="mno-title">Соперник пропустил!</h2>
            <p className="mno-sub">
              <span className="mno-name">@{notification.friendUsername}</span>
              {' '}не выполнил задание вчера
            </p>
            <p className="mno-hint">Отправь реакцию:</p>
            <div className="mno-emoji-row">
              {EMOJIS.map(e => (
                <button
                  key={e}
                  className="mno-emoji-btn"
                  onClick={() => handleSend(e)}
                  disabled={sending}
                >
                  {e}
                </button>
              ))}
            </div>
            <button className="mno-skip" onClick={close}>Пропустить</button>
          </>
        ) : (
          <>
            <div className="mno-big-emoji">{notification.emoji}</div>
            <h2 className="mno-title">Тебе прилетело! 🎯</h2>
            <p className="mno-sub">
              <span className="mno-name">@{notification.friendUsername}</span>
              {' '}отправил тебе реакцию
            </p>
            {notification.habitTitle && (
              <p className="mno-habit">«{notification.habitTitle}»</p>
            )}
            <button className="mno-close-btn" onClick={close}>Закрыть</button>
          </>
        )}
      </div>
    </div>
  );
}

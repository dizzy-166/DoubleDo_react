import React, { useState } from 'react';
import './Onboarding.css';

const slides = [
  {
    icon: (
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
        <path d="m9 16 2 2 4-4"/>
      </svg>
    ),
    title: 'Отслеживай привычки',
    text: 'Создай привычки и отмечай их выполнение каждый день. Следи за прогрессом в календаре.',
  },
  {
    icon: (
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
        <path d="M4 22h16"/>
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
      </svg>
    ),
    title: 'Соревнуйся с друзьями',
    text: 'Создавай соревнования с друзьями. Кто выполнит привычку больше дней — побеждает!',
  },
  {
    icon: (
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    ),
    title: 'Формируй серии',
    text: 'Не прерывай серию выполнений. Чем длиннее цепочка — тем сильнее привычка!',
  },
];

export default function Onboarding({ onDone }) {
  const [index, setIndex] = useState(0);

  const next = () => {
    if (index < slides.length - 1) {
      setIndex(index + 1);
    } else {
      localStorage.setItem('onboarding_done', '1');
      onDone();
    }
  };

  const skip = () => {
    localStorage.setItem('onboarding_done', '1');
    onDone();
  };

  const slide = slides[index];

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <button className="onboarding-skip" onClick={skip}>Пропустить</button>

        <div className="onboarding-icon">{slide.icon}</div>
        <h2 className="onboarding-title">{slide.title}</h2>
        <p className="onboarding-text">{slide.text}</p>

        <div className="onboarding-dots">
          {slides.map((_, i) => (
            <span key={i} className={`onboarding-dot ${i === index ? 'active' : ''}`} />
          ))}
        </div>

        <button className="onboarding-next" onClick={next}>
          {index < slides.length - 1 ? 'Далее' : 'Начать'}
        </button>
      </div>
    </div>
  );
}

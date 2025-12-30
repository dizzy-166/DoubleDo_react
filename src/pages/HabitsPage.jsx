import React, { useState, useEffect, useRef } from 'react';
import './HabitsPage.css';

function HabitsPage() {
  const [habits, setHabits] = useState([
    {
      id: 1,
      title: 'walk',
      completed: false,
      streak: 0,
      createdAt: new Date('2025-12-30'),
      completedDates: []
    },
    {
      id: 2,
      title: 'read',
      completed: false,
      streak: 0,
      createdAt: new Date('2025-12-30'),
      completedDates: []
    }
  ]);

  const [newHabit, setNewHabit] = useState({
    title: '',
    startDate: new Date()
  });

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('habits');
  const [datePickerMonth, setDatePickerMonth] = useState(new Date().getMonth());
  const [datePickerYear, setDatePickerYear] = useState(new Date().getFullYear());
  
  const datePickerRef = useRef(null);

  // Обработчик клика вне date picker
  useEffect(() => {
    function handleClickOutside(event) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setShowDatePicker(false);
      }
    }
    
    if (showDatePicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showDatePicker]);

  // Текущая дата
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const currentDay = today.getDate();

  // Генерация календаря для date picker
  const generateDatePickerCalendar = () => {
    const firstDayOfMonth = new Date(datePickerYear, datePickerMonth, 1);
    const lastDayOfMonth = new Date(datePickerYear, datePickerMonth + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    
    const firstDayOfWeek = firstDayOfMonth.getDay();
    const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    const weeks = [];
    let week = [];
    
    for (let i = 0; i < startOffset; i++) {
      week.push(null);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      week.push(day);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    
    return weeks;
  };

  // Календарь для отображения привычек
  const generateHabitCalendar = () => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    
    const firstDayOfWeek = firstDayOfMonth.getDay();
    const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    const weeks = [];
    let week = [];
    
    for (let i = 0; i < startOffset; i++) {
      week.push(null);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      week.push(day);
      
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    
    return weeks;
  };

  const calendarWeeks = generateHabitCalendar();
  const datePickerWeeks = generateDatePickerCalendar();
  
  // Названия дней недели
  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  // Форматирование даты
  const formatDisplayDate = (date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // Навигация по месяцу в date picker
  const handlePrevMonth = () => {
    if (datePickerMonth === 0) {
      setDatePickerMonth(11);
      setDatePickerYear(datePickerYear - 1);
    } else {
      setDatePickerMonth(datePickerMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (datePickerMonth === 11) {
      setDatePickerMonth(0);
      setDatePickerYear(datePickerYear + 1);
    } else {
      setDatePickerMonth(datePickerMonth + 1);
    }
  };

  // Выбор даты
  const handleDateSelect = (day) => {
    const selectedDate = new Date(datePickerYear, datePickerMonth, day);
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    if (selectedDate >= todayDate) {
      setNewHabit({...newHabit, startDate: selectedDate});
      setShowDatePicker(false);
    }
  };

  // Проверка, является ли день сегодняшним в date picker
  const isTodayInDatePicker = (day) => {
    return (
      day === today.getDate() &&
      datePickerMonth === today.getMonth() &&
      datePickerYear === today.getFullYear()
    );
  };

  // Проверка, выбран ли день в date picker
  const isSelectedInDatePicker = (day) => {
    return (
      day === newHabit.startDate.getDate() &&
      datePickerMonth === newHabit.startDate.getMonth() &&
      datePickerYear === newHabit.startDate.getFullYear()
    );
  };

  // Проверка, является ли день в date picker прошедшим
  const isPastDayInDatePicker = (day) => {
    const date = new Date(datePickerYear, datePickerMonth, day);
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return date < todayDate;
  };

  // Проверка состояния дня для привычки
  const getDayStatus = (habit, day) => {
    if (!day || !habit) return 'empty';
    
    const dayDate = new Date(currentYear, currentMonth, day);
    const habitStartDate = new Date(habit.createdAt.toDateString());
    
    if (dayDate < habitStartDate) {
      return 'before-start';
    }
    
    if (day === currentDay) {
      return habit.completed ? 'today-completed' : 'today';
    }
    
    if (habit.completedDates && habit.completedDates.some(d => 
      new Date(d).toDateString() === dayDate.toDateString()
    )) {
      return 'completed';
    }
    
    if (dayDate < today && dayDate >= habitStartDate) {
      return 'missed';
    }
    
    return 'future';
  };

  const handleCreateHabit = async (e) => {
    e.preventDefault();
    if (!newHabit.title.trim()) return;

    setLoading(true);
    
    setTimeout(() => {
      const newHabitObj = {
        id: habits.length + 1,
        title: newHabit.title.trim(),
        completed: false,
        streak: 0,
        createdAt: new Date(newHabit.startDate),
        completedDates: []
      };

      setHabits([...habits, newHabitObj]);
      setNewHabit({ 
        title: '', 
        startDate: new Date()
      });
      setShowCreateForm(false);
      setShowDatePicker(false);
      setLoading(false);
    }, 500);
  };

  const toggleHabitCompletion = (habitId) => {
    const updatedHabits = habits.map(habit => {
      if (habit.id === habitId) {
        const isNowCompleted = !habit.completed;
        const todayStr = today.toISOString().split('T')[0];
        const isAlreadyCompleted = habit.completedDates.some(d => 
          d.split('T')[0] === todayStr
        );
        
        let updatedCompletedDates;
        if (isNowCompleted && !isAlreadyCompleted) {
          updatedCompletedDates = [...habit.completedDates, today.toISOString()];
        } else if (!isNowCompleted && isAlreadyCompleted) {
          updatedCompletedDates = habit.completedDates.filter(d => 
            d.split('T')[0] !== todayStr
          );
        } else {
          updatedCompletedDates = habit.completedDates;
        }
        
        return {
          ...habit,
          completed: isNowCompleted,
          completedDates: updatedCompletedDates,
          streak: isNowCompleted ? habit.streak + 1 : Math.max(0, habit.streak - 1)
        };
      }
      return habit;
    });
    
    setHabits(updatedHabits);
  };

  const deleteHabit = (id) => {
    setHabits(habits.filter(habit => habit.id !== id));
  };

  // Если привычек нет
  if (habits.length === 0) {
    return (
      <div className="habits-page">
        <header className="habits-header">
          <div className="header-content">
            <h1>DoubleDo</h1>
            <div className="user-avatar">
              <span>👤</span>
            </div>
          </div>
        </header>

        <div className="empty-habits-container">
          <div className="empty-habits-content">
            <div className="empty-habits-icon">
              <span className="icon-circle">📅</span>
            </div>
            <h2 className="empty-habits-title">
              Создайте первую привычку!
            </h2>
            <p className="empty-habits-description">
              Начните с малого. Выберите одну привычку, которую хотите развивать каждый день.
            </p>
            
            <button 
              className="create-first-habit-btn"
              onClick={() => setShowCreateForm(true)}
            >
              Создать привычку
            </button>
          </div>
        </div>

        <nav className="bottom-nav">
          <button 
            className={`nav-item ${activeTab === 'competitions' ? 'active' : ''}`}
            onClick={() => setActiveTab('competitions')}
          >
            <span className="nav-icon">🏆</span>
            <span className="nav-text">Соревнования</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'habits' ? 'active' : ''}`}
            onClick={() => setActiveTab('habits')}
          >
            <span className="nav-icon">✅</span>
            <span className="nav-text">Привычки</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <span className="nav-icon">👤</span>
            <span className="nav-text">Профиль</span>
          </button>
        </nav>

        {showCreateForm && (
          <CreateHabitModal
            newHabit={newHabit}
            setNewHabit={setNewHabit}
            handleCreateHabit={handleCreateHabit}
            setShowCreateForm={setShowCreateForm}
            loading={loading}
            showDatePicker={showDatePicker}
            setShowDatePicker={setShowDatePicker}
            datePickerRef={datePickerRef}
            datePickerMonth={datePickerMonth}
            datePickerYear={datePickerYear}
            handlePrevMonth={handlePrevMonth}
            handleNextMonth={handleNextMonth}
            datePickerWeeks={datePickerWeeks}
            handleDateSelect={handleDateSelect}
            isTodayInDatePicker={isTodayInDatePicker}
            isSelectedInDatePicker={isSelectedInDatePicker}
            isPastDayInDatePicker={isPastDayInDatePicker}
            dayNames={dayNames}
          />
        )}
      </div>
    );
  }

  return (
    <div className="habits-page">
      <header className="habits-header">
        <div className="header-content">
          <h1>DoubleDo</h1>
          <div className="user-avatar">
            <span>👤</span>
          </div>
        </div>
      </header>

      <main className="habits-main">
        <div className="habits-list-header">
          <h2>Мои привычки</h2>
          <button 
            className="add-habit-btn"
            onClick={() => setShowCreateForm(true)}
          >
            + Добавить
          </button>
        </div>

        <div className="habits-grid">
          {habits.map(habit => (
            <div key={habit.id} className="habit-card">
              <div className="habit-card-header">
                <div className="habit-title-section">
                  <h3 className="habit-card-title">{habit.title}</h3>
                  <div className="habit-created-date">
                    C {formatDisplayDate(habit.createdAt)}
                  </div>
                </div>
              </div>

              <div className="habit-calendar-small">
                <div className="calendar-grid-small">
                  <div className="weekdays-row-small">
                    {dayNames.map((dayName, index) => (
                      <div key={index} className="weekday-cell-small">
                        {dayName}
                      </div>
                    ))}
                  </div>
                  
                  {calendarWeeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="calendar-week-small">
                      {week.map((day, dayIndex) => {
                        if (day === null) {
                          return <div key={dayIndex} className="calendar-day-small empty"></div>;
                        }
                        
                        const status = getDayStatus(habit, day);
                        const isToday = day === currentDay;
                        
                        return (
                          <div 
                            key={dayIndex} 
                            className={`calendar-day-small ${status} ${isToday ? 'today-highlight' : ''}`}
                          >
                            <span className="day-number-small">{day}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="habit-card-footer">
                <button 
                  className={`complete-habit-btn-small ${habit.completed ? 'completed' : ''}`}
                  onClick={() => toggleHabitCompletion(habit.id)}
                >
                  {habit.completed ? '✓ ВЫПОЛНЕНО' : 'ВЫПОЛНИТЬ'}
                </button>
                
                <div className="habit-actions">
                  <span className="streak-badge">
                    🔥 {habit.streak} дней
                  </span>
                  <button 
                    className="delete-habit-btn"
                    onClick={() => deleteHabit(habit.id)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="add-habit-card" onClick={() => setShowCreateForm(true)}>
          <div className="add-habit-content">
            <span className="add-icon">+</span>
            <span className="add-text">Добавить новую привычку</span>
          </div>
        </div>
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
          className={`nav-item ${activeTab === 'habits' ? 'active' : ''}`}
          onClick={() => setActiveTab('habits')}
        >
          <span className="nav-icon">✅</span>
          <span className="nav-text">Привычки</span>
        </button>
        
        <button 
          className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <span className="nav-icon">👤</span>
            <span className="nav-text">Профиль</span>
        </button>
      </nav>

      {showCreateForm && (
        <CreateHabitModal
          newHabit={newHabit}
          setNewHabit={setNewHabit}
          handleCreateHabit={handleCreateHabit}
          setShowCreateForm={setShowCreateForm}
          loading={loading}
          showDatePicker={showDatePicker}
          setShowDatePicker={setShowDatePicker}
          datePickerRef={datePickerRef}
          datePickerMonth={datePickerMonth}
          datePickerYear={datePickerYear}
          handlePrevMonth={handlePrevMonth}
          handleNextMonth={handleNextMonth}
          datePickerWeeks={datePickerWeeks}
          handleDateSelect={handleDateSelect}
          isTodayInDatePicker={isTodayInDatePicker}
          isSelectedInDatePicker={isSelectedInDatePicker}
          isPastDayInDatePicker={isPastDayInDatePicker}
          dayNames={dayNames}
        />
      )}
    </div>
  );
}

// Компонент модального окна создания привычки
function CreateHabitModal({
  newHabit,
  setNewHabit,
  handleCreateHabit,
  setShowCreateForm,
  loading,
  showDatePicker,
  setShowDatePicker,
  datePickerRef,
  datePickerMonth,
  datePickerYear,
  handlePrevMonth,
  handleNextMonth,
  datePickerWeeks,
  handleDateSelect,
  isTodayInDatePicker,
  isSelectedInDatePicker,
  isPastDayInDatePicker,
  dayNames
}) {
  const monthNamesEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-content create-habit-modal">
        <div className="modal-header">
          <h3>Создать привычку</h3>
          <button 
            className="modal-close"
            onClick={() => setShowCreateForm(false)}
          >
            ×
          </button>
        </div>
        
        <form onSubmit={handleCreateHabit} className="create-habit-form">
          <div className="form-group">
            <label className="form-label">Название привычки</label>
            <input
              type="text"
              value={newHabit.title}
              onChange={(e) => setNewHabit({...newHabit, title: e.target.value})}
              placeholder="Введите название привычки"
              required
              autoFocus
              className="form-input"
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Дата начала</label>
            <div className="date-picker-container">
              <div 
                className="date-picker-input"
                onClick={() => setShowDatePicker(!showDatePicker)}
              >
                <span className="date-value">
                  {newHabit.startDate.toLocaleDateString('ru-RU')}
                </span>
                <span className="date-icon">📅</span>
              </div>
              
              {showDatePicker && (
                <div className="custom-date-picker" ref={datePickerRef}>
                  <div className="custom-datepicker-header">
                    <button 
                      type="button"
                      className="nav-button prev"
                      onClick={handlePrevMonth}
                    >
                      ‹
                    </button>
                    <div className="current-month-year">
                      <div className="current-month">
                        {monthNamesEn[datePickerMonth]} {datePickerYear}
                      </div>
                    </div>
                    <button 
                      type="button"
                      className="nav-button next"
                      onClick={handleNextMonth}
                    >
                      ›
                    </button>
                  </div>
                  
                  <div className="datepicker-calendar">
                    <div className="datepicker-weekdays">
                      {dayNames.map((dayName, index) => (
                        <div key={index} className="weekday-name">
                          {dayName}
                        </div>
                      ))}
                    </div>
                    
                    <div className="datepicker-days">
                      {datePickerWeeks.map((week, weekIndex) => (
                        <div key={weekIndex} className="datepicker-week">
                          {week.map((day, dayIndex) => {
                            if (day === null) {
                              return (
                                <button
                                  key={dayIndex}
                                  type="button"
                                  className="datepicker-day outside-month"
                                  disabled
                                >
                                  {day}
                                </button>
                              );
                            }
                            
                            const isToday = isTodayInDatePicker(day);
                            const isSelected = isSelectedInDatePicker(day);
                            const isPast = isPastDayInDatePicker(day);
                            
                            return (
                              <button
                                key={dayIndex}
                                type="button"
                                className={`datepicker-day ${isSelected ? 'selected' : ''} ${isPast ? 'disabled' : ''} ${isToday ? 'today' : ''}`}
                                onClick={() => !isPast && handleDateSelect(day)}
                                disabled={isPast}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="date-note">
              <p>Привычку можно будет выполнять только с этой даты.</p>
              <p>Минимальная дата - сегодня.</p>
            </div>
          </div>
          
          <div className="modal-actions">
            <button 
              type="button"
              className="btn-secondary"
              onClick={() => setShowCreateForm(false)}
              disabled={loading}
            >
              Отмена
            </button>
            <button 
              type="submit"
              className="btn-primary"
              disabled={loading || !newHabit.title.trim()}
            >
              {loading ? 'Создание...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default HabitsPage;
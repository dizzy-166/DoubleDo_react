import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import './HabitsPage.css';

function HabitsPage() {
  const [habits, setHabits] = useState([]);
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
  const [user, setUser] = useState(null);
  const [progressData, setProgressData] = useState({});
  const [isInitialized, setIsInitialized] = useState(false);
  
  const datePickerRef = useRef(null);

  // Текущая дата
const today = new Date();
const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
const currentMonth = todayUTC.getMonth();
const currentYear = todayUTC.getFullYear();
const currentDay = todayUTC.getDate();

  // Загрузка пользователя
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setIsInitialized(true);
    };
    
    checkUser();
  }, []);

  // Загрузка привычек после получения пользователя
  useEffect(() => {
    if (user && isInitialized) {
      loadHabits();
    }
  }, [user, isInitialized]);

  // Загрузка привычек пользователя
  const loadHabits = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Используем функцию get_all_user_habits из базы
      const { data, error } = await supabase.rpc('get_all_user_habits');
      
      if (error) {
        console.error('Ошибка RPC get_all_user_habits:', error);
        // Fallback
        await loadHabitsFallback();
        return;
      }
      
      if (data) {
        // Преобразуем данные в нужный формат
        const formattedHabits = data.map(habit => ({
          id: habit.habit_id,
          title: habit.title,
          frequency_type: habit.frequency_type,
          startDate: new Date(habit.start_date),
          created_at: new Date(habit.created_at),
          role: habit.role,
          status: habit.status,
          source_type: habit.source_type,
          competition_id: habit.competition_id,
          competition_status: habit.competition_status,
          friend_id: habit.friend_id,
          friend_username: habit.friend_username,
          my_score: habit.my_score,
          friend_score: habit.friend_score
        }));
        
        setHabits(formattedHabits);
        
        // Загружаем прогресс для всех привычек
        await loadAllProgress(formattedHabits);
      }
    } catch (error) {
      console.error('Ошибка загрузки привычек:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fallback загрузка привычек
  const loadHabitsFallback = async () => {
    try {
      // Получаем привычки через привычные запросы
      const { data: members, error } = await supabase
        .from('habit_members')
        .select(`
          habit_id,
          role,
          status,
          source_type,
          competition_id,
          habits (
            id,
            title,
            frequency_type,
            start_date,
            created_at,
            created_by
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'accepted');
      
      if (error) throw error;
      
      if (members) {
        const formattedHabits = members.map(member => ({
          id: member.habits.id,
          title: member.habits.title,
          frequency_type: member.habits.frequency_type,
          startDate: new Date(member.habits.start_date),
          created_at: new Date(member.habits.created_at),
          role: member.role,
          status: member.status,
          source_type: member.source_type || 'direct',
          competition_id: member.competition_id
        }));
        
        setHabits(formattedHabits);
        await loadAllProgress(formattedHabits);
      }
    } catch (error) {
      console.error('Ошибка fallback загрузки:', error);
    }
  };

  // Загрузка прогресса для всех привычек
  const loadAllProgress = async (habitsList) => {
    if (!user || !habitsList || habitsList.length === 0) return;
    
    try {
      const progressCache = {};
      
      // Получаем прогресс за текущий месяц для всех привычек
      const startOfMonth = new Date(currentYear, currentMonth, 1);
      const endOfMonth = new Date(currentYear, currentMonth + 1, 0);
      
      const { data, error } = await supabase
        .from('habit_progress')
        .select('*')
        .eq('user_id', user.id)
        .gte('completed_date', startOfMonth.toISOString().split('T')[0])
        .lte('completed_date', endOfMonth.toISOString().split('T')[0]);
      
      if (error) throw error;
      
      // Группируем прогресс по habit_id
      if (data) {
        data.forEach(progress => {
          if (!progressCache[progress.habit_id]) {
            progressCache[progress.habit_id] = [];
          }
          progressCache[progress.habit_id].push(progress);
        });
      }
      
      setProgressData(progressCache);
    } catch (error) {
      console.error('Ошибка загрузки прогресса:', error);
    }
  };

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
    if (!date) return '';
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
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  return (
    day === todayUTC.getDate() &&
    datePickerMonth === todayUTC.getMonth() &&
    datePickerYear === todayUTC.getFullYear()
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
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const date = new Date(Date.UTC(datePickerYear, datePickerMonth, day));
  return date < todayUTC;
};

  // Проверка состояния дня для привычки
  const getDayStatus = (habit, day, progress) => {
  if (!day || !habit) return 'empty';
  
  // ✅ Используем UTC дату
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayDate = new Date(Date.UTC(currentYear, currentMonth, day));
  const habitStartDate = new Date(habit.startDate);
  
  // Приводим к YYYY-MM-DD для сравнения
  const dayStr = dayDate.toISOString().split('T')[0];
  const habitStartStr = habitStartDate.toISOString().split('T')[0];
  const todayStr = todayUTC.toISOString().split('T')[0];
  
  // Дни до начала привычки
  if (dayStr < habitStartStr) {
    return 'before-start';
  }
  
  // Ищем прогресс для этой даты
  const progressForDate = progress?.find(p => {
    const progressDate = new Date(p.completed_date);
    const progressStr = progressDate.toISOString().split('T')[0];
    return progressStr === dayStr;
  });
  
  // Сегодняшний день
  if (dayStr === todayStr) {
    // Привычка уже началась
    return progressForDate?.is_completed ? 'today-completed' : 'today';
  }
  
  // Выполненные дни
  if (progressForDate?.is_completed) {
    return 'completed';
  }
  
  // Пропущенные дни (прошедшие дни после начала привычки)
  if (dayStr < todayStr && dayStr >= habitStartStr) {
    return 'missed';
  }
  
  // Будущие дни
  return 'future';
};

  // Создание привычки
  const handleCreateHabit = async (e) => {
  e.preventDefault();
  if (!newHabit.title.trim()) return;

  setLoading(true);
  
  try {
    const formattedDate = newHabit.startDate.toISOString().split('T')[0];
    
    const { data, error } = await supabase.rpc('create_habit', {
      p_title: newHabit.title.trim(),
      p_start_date: formattedDate
    });
    
    if (error) throw error;
    
    if (data) {
      // ✅ ПОЛНАЯ перезагрузка привычек с сервера
      await loadHabits();
      
      setNewHabit({ 
        title: '', 
        startDate: new Date()
      });
      setShowCreateForm(false);
      setShowDatePicker(false);
    }
  } catch (error) {
    console.error('Ошибка создания привычки:', error);
    alert(`Ошибка: ${error.message}`);
  } finally {
    setLoading(false);
  }
};

  // Отметить привычку выполненной
  const toggleHabitCompletion = async (habitId) => {
  try {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    
    // ✅ Используем UTC дату для сравнения
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const todayStr = todayUTC.toISOString().split('T')[0];
    
    const habitStartStr = new Date(habit.startDate).toISOString().split('T')[0];
    
    if (habitStartStr > todayStr) {
      alert('Привычку можно выполнять только начиная с ' + formatDisplayDate(habit.startDate));
      return;
    }
    
    // Проверяем, выполнена ли привычка сегодня
    const { data: existingProgress } = await supabase
      .from('habit_progress')
      .select('*')
      .eq('habit_id', habitId)
      .eq('user_id', user.id)
      .eq('completed_date', todayStr)
      .maybeSingle();
    
    if (existingProgress?.is_completed) {
      // Уже выполнена - отменяем
      const { error } = await supabase
        .from('habit_progress')
        .update({ is_completed: false })
        .eq('id', existingProgress.id);
      
      if (error) throw error;
    } else {
      // Не выполнена - отмечаем
      if (habit.source_type === 'competition' && habit.competition_id) {
        const { error } = await supabase.rpc('mark_competition_habit_complete', {
          p_habit_id: habitId
        });
        
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc('mark_habit_completed', {
          p_habit_id: habitId,
          p_date: todayStr
        });
        
        if (error) throw error;
      }
    }
    
    // Обновляем прогресс
    await loadHabits();
    
  } catch (error) {
    console.error('Ошибка отметки выполнения:', error);
    alert(`Ошибка: ${error.message}`);
  }
};

  // Удаление привычки
  const deleteHabit = async (id) => {
    if (!confirm('Вы уверены, что хотите удалить эту привычку?')) return;
    
    try {
      const { error } = await supabase.rpc('delete_habit', {
        p_habit_id: id
      });
      
      if (error) throw error;
      
      // Обновляем список привычек
      setHabits(habits.filter(habit => habit.id !== id));
    } catch (error) {
      console.error('Ошибка удаления привычки:', error);
      alert(`Ошибка: ${error.message}`);
    }
  };

  // Если загрузка данных
  if (!isInitialized || (user && loading && habits.length === 0)) {
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
            <div className="loading-spinner"></div>
            <p>Загрузка...</p>
          </div>
        </div>
      </div>
    );
  }

  // Если пользователь не авторизован
  if (!user) {
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
            <h2>Пожалуйста, войдите в систему</h2>
            <p>Для доступа к привычкам необходимо авторизоваться</p>
          </div>
        </div>
      </div>
    );
  }

  // Если привычек нет
  if (habits.length === 0 && !loading) {
    return (
      <div className="habits-page">
        <header className="habits-header">
          <div className="header-content">
            <h1>DoubleDo</h1>
            <div className="user-avatar">
              <span>{user?.email?.charAt(0).toUpperCase() || '👤'}</span>
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
            <span>{user?.email?.charAt(0).toUpperCase() || '👤'}</span>
          </div>
        </div>
      </header>

      <main className="habits-main">
        <div className="habits-list-header">
          <h2>Мои привычки</h2>
          <button 
            className="add-habit-btn"
            onClick={() => setShowCreateForm(true)}
            disabled={loading}
          >
            {loading ? '...' : '+ Добавить'}
          </button>
        </div>

        <div className="habits-grid">
          {habits.map(habit => (
            <HabitCard
              key={habit.id}
              habit={habit}
              user={user}
              today={today}
              currentDay={currentDay}
              currentMonth={currentMonth}
              currentYear={currentYear}
              calendarWeeks={calendarWeeks}
              dayNames={dayNames}
              formatDisplayDate={formatDisplayDate}
              toggleHabitCompletion={toggleHabitCompletion}
              deleteHabit={deleteHabit}
              progressData={progressData}
              getDayStatus={getDayStatus}
            />
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

// Компонент карточки привычки
function HabitCard({ 
  habit, 
  user, 
  today, 
  currentDay, 
  currentMonth, 
  currentYear,
  calendarWeeks,
  dayNames,
  formatDisplayDate,
  toggleHabitCompletion,
  deleteHabit,
  progressData,
  getDayStatus
}) {
  const [isLoading, setIsLoading] = useState(false);
  const progress = progressData[habit.id] || [];

  const now = new Date();
const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
const todayStr = todayUTC.toISOString().split('T')[0];
const habitStartStr = new Date(habit.startDate).toISOString().split('T')[0];
const isTodayActive = habitStartStr <= todayStr;

// Проверяем, выполнена ли привычка сегодня
const isTodayCompleted = progress.find(p => {
  const progressDate = new Date(p.completed_date);
  const progressStr = progressDate.toISOString().split('T')[0];
  return progressStr === todayStr && p.is_completed;
});

  const handleComplete = async () => {
    if (!isTodayActive) {
      alert(`Привычку можно выполнять только с ${formatDisplayDate(habit.startDate)}`);
      return;
    }
    
    setIsLoading(true);
    try {
      await toggleHabitCompletion(habit.id);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div key={habit.id} className="habit-card">
      <div className="habit-card-header">
        <div className="habit-title-section">
          <h3 className="habit-card-title">{habit.title}</h3>
          <div className="habit-created-date">
            C {formatDisplayDate(habit.startDate)}
            {habit.source_type === 'competition' && habit.friend_username && (
              <span className="competition-badge">
                vs {habit.friend_username}
              </span>
            )}
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
                
                const status = getDayStatus(habit, day, progress);
                const isToday = day === currentDay;
                
                return (
                  <div 
                    key={dayIndex} 
                    className={`calendar-day-small ${status} ${isToday ? 'today-highlight' : ''}`}
                    title={`${day}.${currentMonth + 1}.${currentYear}`}
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
          className={`complete-habit-btn-small ${isTodayCompleted ? 'completed' : ''} ${!isTodayActive ? 'disabled' : ''}`}
          onClick={handleComplete}
          disabled={isLoading || !isTodayActive}
        >
          {isLoading ? '...' : (isTodayCompleted ? '✓ ВЫПОЛНЕНО' : 'ВЫПОЛНИТЬ')}
        </button>
        
        <div className="habit-actions">
          {habit.source_type === 'competition' && (
            <span className="streak-badge">
              🏆 {habit.my_score || 0} : {habit.friend_score || 0}
            </span>
          )}
          {habit.role === 'owner' && (
            <button 
              className="delete-habit-btn"
              onClick={() => deleteHabit(habit.id)}
            >
              ✕
            </button>
          )}
        </div>
      </div>
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
            disabled={loading}
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
              disabled={loading}
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
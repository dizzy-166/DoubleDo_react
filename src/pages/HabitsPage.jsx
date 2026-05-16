import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import './HabitsPage.css';

function HabitsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [habits, setHabits] = useState([]);
  const [newHabit, setNewHabit] = useState({
    title: '',
    startDate: new Date()
  });
  const [editingHabit, setEditingHabit] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    startDate: null
  });

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editDatePicker, setEditDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(new Date().getMonth());
  const [datePickerYear, setDatePickerYear] = useState(new Date().getFullYear());
  const [user, setUser] = useState(null);
  const [progressData, setProgressData] = useState({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [creatingHabit, setCreatingHabit] = useState(false);
  const [updatingHabit, setUpdatingHabit] = useState(false);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [competitionScores, setCompetitionScores] = useState({});
  const pullStartY = useRef(null);
  const mainRef = useRef(null);

  const datePickerRef = useRef(null);
  const editDatePickerRef = useRef(null);

  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/competitions')) return 'competitions';
    if (path.includes('/profile')) return 'profile';
    if (path.includes('/stats')) return 'stats';
    return 'habits';
  };

  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const currentDay = today.getDate();

  // Загрузка пользователя
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
          console.error('❌ Ошибка получения пользователя:', error);
          setUser(null);
        } else {
          console.log('✅ Пользователь получен:', user?.id);
          setUser(user);
        }
      } catch (err) {
        console.error('❌ Исключение при получении пользователя:', err);
        setUser(null);
      } finally {
        setIsInitialized(true);
      }
    };
    
    checkUser();
  }, []);

  // Загрузка привычек после получения пользователя
  useEffect(() => {
    console.log('🔍 Проверка условий для загрузки привычек', {
      user: !!user,
      isInitialized,
      loading
    });
    
    if (user && isInitialized && !loading) {
      console.log('✅ Условия выполнены, запуск loadHabits');
      loadHabits();
    }
  }, [user, isInitialized]);

  // Pull-to-refresh
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      if (el.scrollTop === 0) pullStartY.current = e.touches[0].clientY;
    };
    const onTouchMove = (e) => {
      if (pullStartY.current === null) return;
      const delta = e.touches[0].clientY - pullStartY.current;
      if (delta > 0 && el.scrollTop === 0) {
        setPullY(Math.min(delta * 0.4, 70));
      }
    };
    const onTouchEnd = async () => {
      if (pullY >= 60 && !pullRefreshing) {
        setPullRefreshing(true);
        await loadHabits();
        setPullRefreshing(false);
      }
      setPullY(0);
      pullStartY.current = null;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [pullY, pullRefreshing]);

  // Загрузка привычек пользователя
  const loadHabits = async () => {
    console.log('🚀 Начало загрузки привычек');
    if (!user) {
      console.error('❌ Пользователь не определен');
      return;
    }

    setLoading(true);

    try {
      // Сбрасываем стрики для пропущенных дней перед загрузкой
      supabase.rpc('reset_missed_streaks').then(null, () => {});

      console.log('📥 Вызов loadHabitsSafe');
      const habitsData = await loadHabitsSafe();
      console.log('✅ Данные привычек получены:', {
        count: habitsData?.length || 0,
        data: habitsData
      });
      
      setHabits(habitsData || []);
      console.log('✅ Привычки установлены в состояние');
      
      if (habitsData && habitsData.length > 0) {
        console.log('📊 Загрузка прогресса для привычек');
        await loadAllProgress(habitsData);
        await loadCompetitionScores();
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки привычек:', error);
    } finally {
      setLoading(false);
    }
  };

  // Упрощенная загрузка привычек
  const loadHabitsSafe = async () => {
    console.log('🔍 Загрузка привычек для пользователя:', user?.id);
    
    try {
      // 1. Пробуем RPC функцию
      console.log('📞 Вызов get_all_user_habits');
      const { data: habitsData, error } = await supabase
        .rpc('get_all_user_habits');

      if (error) {
        console.error('❌ RPC ошибка:', error);
        throw error;
      }
      
      console.log('✅ RPC успешен, привычек:', habitsData?.length || 0);
      
      if (habitsData && habitsData.length > 0) {
        return habitsData.map(habit => ({
          id: habit.habit_id,
          title: habit.title,
          frequency_type: habit.frequency_type,
          startDate: new Date(habit.start_date),
          created_at: new Date(habit.created_at),
          role: habit.role,
          status: habit.status,
          source_type: habit.source_type || 'direct',
          competition_id: habit.competition_id,
          competition_status: habit.competition_status,
          friend_id: habit.friend_id,
          friend_username: habit.friend_username,
          my_score: habit.my_score || 0,
          friend_score: habit.friend_score || 0
        }));
      }
      
      // 2. Если RPC вернул 0, пробуем прямой запрос
      console.log('🔄 Прямой запрос к habit_members');
      const { data: membersData, error: membersError } = await supabase
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
            created_at
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'accepted');
      
      if (membersError) {
        console.error('❌ Ошибка запроса habit_members:', membersError);
        throw membersError;
      }
      
      console.log('✅ Прямой запрос успешен, записей:', membersData?.length || 0);
      
      const formattedHabits = (membersData || []).map(member => ({
        id: member.habits.id,
        title: member.habits.title,
        frequency_type: member.habits.frequency_type,
        startDate: new Date(member.habits.start_date),
        created_at: new Date(member.habits.created_at),
        role: member.role,
        status: member.status,
        source_type: member.source_type || 'direct',
        competition_id: member.competition_id,
        competition_status: null,
        friend_id: null,
        friend_username: null,
        my_score: 0,
        friend_score: 0
      }));
      
      console.log('📝 Отформатировано привычек:', formattedHabits.length);
      return formattedHabits;
      
    } catch (error) {
      console.error('❌ Все методы не сработали:', error);
      
      // 3. Последняя попытка: ручной запрос
      try {
        console.log('🔍 Ручной запрос к привычкам');
        const { data: directHabits, error: directError } = await supabase
          .from('habits')
          .select('*')
          .eq('created_by', user.id);
        
        if (directError) {
          console.error('❌ Ошибка прямого запроса привычек:', directError);
          return [];
        }
        
        console.log('✅ Найдено привычек созданных пользователем:', directHabits?.length || 0);
        
        return (directHabits || []).map(habit => ({
          id: habit.id,
          title: habit.title,
          frequency_type: habit.frequency_type,
          startDate: new Date(habit.start_date),
          created_at: new Date(habit.created_at),
          role: 'owner',
          status: 'accepted',
          source_type: 'direct',
          competition_id: null,
          competition_status: null,
          friend_id: null,
          friend_username: null,
          my_score: 0,
          friend_score: 0
        }));
        
      } catch (finalError) {
        console.error('❌ Финальная ошибка:', finalError);
        return [];
      }
    }
  };

  // Загрузка прогресса для всех привычек
  const loadAllProgress = async (habitsList) => {
    console.log('📊 Загрузка прогресса для', habitsList?.length, 'привычек');
    
    if (!user || !habitsList || habitsList.length === 0) {
      return;
    }

    try {
      const progressCache = {};
      const habitIds = habitsList.map(h => h.id);

      // Текущий месяц
      const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1));
      const endOfMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0));

      const { data, error } = await supabase
        .from('habit_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('habit_id', habitIds)
        .gte('completed_date', startOfMonth.toISOString().split('T')[0])
        .lte('completed_date', endOfMonth.toISOString().split('T')[0]);

      if (error) {
        console.error('❌ Ошибка запроса прогресса:', error);
        return;
      }

      console.log('✅ Прогресс получен:', data?.length || 0, 'записей');

      if (data) {
        data.forEach(progress => {
          const dateStr = new Date(progress.completed_date).toISOString().split('T')[0];
          if (!progressCache[progress.habit_id]) progressCache[progress.habit_id] = [];
          progressCache[progress.habit_id].push({ ...progress, completed_date: dateStr });
        });
      }

      setProgressData(progressCache);
    } catch (error) {
      console.error('❌ Ошибка загрузки прогресса:', error);
    }
  };

  // Загрузка актуальных очков соревнований из get_user_competitions
  const loadCompetitionScores = async () => {
    try {
      const { data, error } = await supabase.rpc('get_user_competitions');
      if (error) return;
      const map = {};
      (data || []).forEach(c => {
        map[c.competition_id] = {
          my_score: c.my_score || 0,
          friend_score: c.friend_score || 0
        };
      });
      setCompetitionScores(map);
    } catch {
      // не критично, бейдж просто покажет 0:0
    }
  };

  // Обработчик клика вне date picker
  useEffect(() => {
    function handleClickOutside(event) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setShowDatePicker(false);
      }
      if (editDatePickerRef.current && !editDatePickerRef.current.contains(event.target)) {
        setEditDatePicker(false);
      }
    }
    
    if (showDatePicker || editDatePicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showDatePicker, editDatePicker]);

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

  // Выбор даты для создания
  const handleDateSelect = (day) => {
    const selectedDate = new Date(Date.UTC(datePickerYear, datePickerMonth, day));
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    
    if (selectedDate >= todayUTC) {
      setNewHabit({...newHabit, startDate: selectedDate});
      setShowDatePicker(false);
    } else {
      toast.error('Нельзя выбрать прошедшую дату');
    }
  };

  // Выбор даты для редактирования
  const handleEditDateSelect = (day) => {
    const selectedDate = new Date(Date.UTC(datePickerYear, datePickerMonth, day));
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    
    if (selectedDate >= todayUTC) {
      setEditForm({...editForm, startDate: selectedDate});
      setEditDatePicker(false);
    } else {
      toast.error('Нельзя выбрать прошедшую дату');
    }
  };

  // Открытие формы редактирования
  const handleEditClick = (habit) => {
    setEditingHabit(habit);
    setEditForm({
      title: habit.title,
      startDate: new Date(habit.startDate)
    });
    setShowEditForm(true);
  };

  // Сохранение изменений привычки
  const handleUpdateHabit = async (e) => {
    e.preventDefault();
    
    if (!editForm.title.trim()) {
      toast.error('Введите название привычки');
      return;
    }

    if (!editingHabit) {
      toast.error('Привычка не выбрана для редактирования');
      return;
    }

    setUpdatingHabit(true);
    
    try {
      const formattedDate = editForm.startDate.toISOString().split('T')[0];
      
      // Обновляем привычку в базе данных
      const { data, error } = await supabase
        .from('habits')
        .update({
          title: editForm.title.trim(),
          start_date: formattedDate,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingHabit.id)
        .select();
      
      if (error) {
        console.error('Ошибка обновления привычки:', error);
        throw error;
      }
      
      console.log('✅ Привычка обновлена:', data);
      
      // Обновляем локально
      setHabits(habits.map(habit => 
        habit.id === editingHabit.id 
          ? { 
              ...habit, 
              title: editForm.title.trim(),
              startDate: editForm.startDate
            }
          : habit
      ));
      
      // Закрываем форму
      setShowEditForm(false);
      setEditingHabit(null);
      setEditForm({ title: '', startDate: null });
      
      toast.success('Привычка обновлена!');

    } catch (error) {
      console.error('🔥 ОШИБКА ОБНОВЛЕНИЯ ПРИВЫЧКИ:', error);
      toast.error(`Ошибка: ${error.message}`);
    } finally {
      setUpdatingHabit(false);
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

  // Проверка, выбран ли день в date picker для создания
  const isSelectedInDatePicker = (day) => {
    if (!newHabit.startDate) return false;
    
    const selectedDate = new Date(newHabit.startDate);
    const selectedUTC = new Date(Date.UTC(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate()
    ));
    
    return (
      day === selectedUTC.getDate() &&
      datePickerMonth === selectedUTC.getMonth() &&
      datePickerYear === selectedUTC.getFullYear()
    );
  };

  // Проверка, выбран ли день в date picker для редактирования
  const isSelectedInEditDatePicker = (day) => {
    if (!editForm.startDate) return false;
    
    const selectedDate = new Date(editForm.startDate);
    const selectedUTC = new Date(Date.UTC(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate()
    ));
    
    return (
      day === selectedUTC.getDate() &&
      datePickerMonth === selectedUTC.getMonth() &&
      datePickerYear === selectedUTC.getFullYear()
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

    const dayDate = new Date(Date.UTC(currentYear, currentMonth, day));
    const dayStr = dayDate.toISOString().split('T')[0];

    const habitStartDate = new Date(habit.startDate);
    const habitStartStr = new Date(Date.UTC(
      habitStartDate.getFullYear(),
      habitStartDate.getMonth(),
      habitStartDate.getDate()
    )).toISOString().split('T')[0];

    const todayUTC = new Date(Date.UTC(currentYear, currentMonth, currentDay));
    const todayStr = todayUTC.toISOString().split('T')[0];

    // Дни до начала привычки
    if (dayStr < habitStartStr) return 'before-start';

    // Найти прогресс для этой даты
    const progressForDate = progress?.find(p => p.completed_date === dayStr);

    if (dayStr === todayStr) return progressForDate?.is_completed ? 'today-completed' : 'today';
    if (progressForDate?.is_completed) return 'completed';
    if (dayStr < todayStr && dayStr >= habitStartStr) return 'missed';
    return 'future';
  };

  // 🔥 ИСПРАВЛЕННАЯ ФУНКЦИЯ: Создание привычки
  const handleCreateHabit = async (e) => {
    e.preventDefault();
    console.log('🎯 СОЗДАНИЕ ПРИВЫЧКИ');
    
    if (!newHabit.title.trim()) {
      toast.error('Введите название привычки');
      return;
    }

    if (!user) {
      toast.error('Пользователь не авторизован');
      return;
    }

    setCreatingHabit(true);
    
    try {
      console.log('1. Текущий пользователь:', user?.id);
      
      const formattedDate = newHabit.startDate.toISOString().split('T')[0];
      
      console.log('2. Данные для создания:', {
        title: newHabit.title.trim(),
        start_date: formattedDate,
        user_id: user?.id
      });
      
      // 🔥 ПРЯМОЙ ЗАПРОС вместо RPC
      console.log('3. Создаем привычку напрямую...');
      
      // 1. Создаем запись в habits
      const { data: habitData, error: habitError } = await supabase
        .from('habits')
        .insert({
          title: newHabit.title.trim(),
          created_by: user.id,
          start_date: formattedDate,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (habitError) {
        console.error('❌ Ошибка создания привычки:', habitError);
        throw habitError;
      }
      
      console.log('✅ Привычка создана:', habitData);
      
      // 2. Добавляем пользователя как владельца в habit_members
      const { error: memberError } = await supabase
        .from('habit_members')
        .insert({
          habit_id: habitData.id,
          user_id: user.id,
          role: 'owner',
          status: 'accepted',
          invited_at: new Date().toISOString(),
          accepted_at: new Date().toISOString()
        });
      
      if (memberError) {
        console.error('❌ Ошибка добавления в habit_members:', memberError);
        throw memberError;
      }
      
      console.log('✅ Пользователь добавлен как владелец');
      
      // 3. Перезагружаем список привычек
      await loadHabits();
      
      console.log('=== ПРИВЫЧКА УСПЕШНО СОЗДАНА ===');

      // 4. Сброс формы
      setNewHabit({
        title: '',
        startDate: new Date()
      });
      setShowCreateForm(false);
      setShowDatePicker(false);

      toast.success('Привычка создана!');
      
    } catch (error) {
      console.error('🔥 ОШИБКА СОЗДАНИЯ ПРИВЫЧКИ:', error);
      
      // Попробуем альтернативный метод
      try {
        console.log('🔄 Пробуем через RPC...');
        
        const formattedDate = newHabit.startDate.toISOString().split('T')[0];
        
        const { data, error: rpcError } = await supabase.rpc('create_habit', {
          p_title: newHabit.title.trim(),
          p_start_date: formattedDate
        });
        
        if (rpcError) {
          console.error('RPC ошибка:', rpcError);
          throw new Error(`RPC: ${rpcError.message}`);
        }
        
        console.log('✅ RPC успешно:', data);
        await loadHabits();
        
        setNewHabit({ 
          title: '', 
          startDate: new Date()
        });
        setShowCreateForm(false);
        setShowDatePicker(false);
        
      } catch (fallbackError) {
        console.error('Все методы не сработали:', fallbackError);
        toast.error(`Ошибка: ${fallbackError.message}`);
      }
    } finally {
      setCreatingHabit(false);
    }
  };

  // Отметить привычку выполненной
  const toggleHabitCompletion = async (habitId) => {
    try {
      const habit = habits.find(h => h.id === habitId);
      if (!habit) return;

      const now = new Date();
      const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      const todayStr = todayUTC.toISOString().split('T')[0];

      const habitStartDate = new Date(habit.startDate);
      const habitStartUTC = new Date(Date.UTC(
        habitStartDate.getFullYear(),
        habitStartDate.getMonth(),
        habitStartDate.getDate()
      ));
      const habitStartStr = habitStartUTC.toISOString().split('T')[0];

      if (todayStr < habitStartStr) {
        toast(`Привычка будет доступна с ${formatDisplayDate(habit.startDate)}`, { icon: '📅' });
        return;
      }

      const { data: existingProgress } = await supabase
        .from('habit_progress')
        .select('*')
        .eq('habit_id', habitId)
        .eq('user_id', user.id)
        .eq('completed_date', todayStr)
        .maybeSingle();

      if (existingProgress?.is_completed) {
        // Отменяем выполнение
        if (habit.source_type === 'competition' && habit.competition_id) {
          // Для соревновательных привычек нужно и декрементировать счёт
          const { error } = await supabase.rpc('unmark_competition_habit_complete', {
            p_habit_id: habitId
          });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('habit_progress')
            .update({ is_completed: false })
            .eq('id', existingProgress.id);
          if (error) throw error;
        }
      } else {
        // Отмечаем выполнение
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

      if (habit.source_type === 'competition') {
        window.dispatchEvent(new Event('habit-completed'));
      }

      // Обновляем локально
      setProgressData(prev => {
        const habitProgress = prev[habitId] ? [...prev[habitId]] : [];
        const todayIndex = habitProgress.findIndex(p => p.completed_date === todayStr);

        if (todayIndex >= 0) {
          habitProgress[todayIndex] = {
            ...habitProgress[todayIndex],
            is_completed: !habitProgress[todayIndex].is_completed
          };
        } else {
          habitProgress.push({
            habit_id: habitId,
            user_id: user.id,
            completed_date: todayStr,
            is_completed: true
          });
        }

        return {
          ...prev,
          [habitId]: habitProgress
        };
      });

    } catch (error) {
      console.error('Ошибка отметки выполнения:', error);
      toast.error(`Ошибка: ${error.message}`);
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
      
      // Обновляем локально
      setHabits(habits.filter(habit => habit.id !== id));
    } catch (error) {
      console.error('Ошибка удаления привычки:', error);
      toast.error(`Ошибка: ${error.message}`);
    }
  };

  // Вспомогательная функция для склонения слова "день"
  const getDaysWord = (days) => {
    if (days % 10 === 1 && days % 100 !== 11) return 'день';
    if (days % 10 >= 2 && days % 10 <= 4 && (days % 100 < 10 || days % 100 >= 20)) return 'дня';
    return 'дней';
  };

  // Обработчик нажатия на кнопку создания привычки на пустом экране
  const handleCreateFirstHabitClick = () => {
    console.log('🎯 КНОПКА "СОЗДАТЬ ПРИВЫЧКУ" НАЖАТА');
    setShowCreateForm(true);
  };

  // Логи для отладки
  console.log('🎯 Состояние компонента:', {
    isInitialized,
    user: !!user,
    loading,
    habitsCount: habits.length,
    showCreateForm
  });

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
            <div className="user-avatar" onClick={() => navigate('/profile')}>
              <span>{user?.email?.charAt(0).toUpperCase() || 'U'}</span>
            </div>
          </div>
        </header>

        <div className="empty-habits-container">
          <div className="empty-habits-content">
            <div className="empty-habits-icon">
              <span className="icon-circle">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <path d="M16 2v4M8 2v4M3 10h18"/>
                  <path d="m9 16 2 2 4-4"/>
                </svg>
              </span>
            </div>
            <h2 className="empty-habits-title">
              Создайте первую привычку!
            </h2>
            <p className="empty-habits-description">
              Начните с малого. Выберите одну привычку, которую хотите развивать каждый день.
            </p>

            <button
              className="create-first-habit-btn"
              onClick={handleCreateFirstHabitClick}
            >
              Создать привычку
            </button>
          </div>
        </div>

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

        {showCreateForm && (
          <CreateHabitModal
            newHabit={newHabit}
            setNewHabit={setNewHabit}
            handleCreateHabit={handleCreateHabit}
            setShowCreateForm={setShowCreateForm}
            loading={creatingHabit}
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

  // Основной интерфейс с привычками
  const todayStr = today.toISOString().split('T')[0];
  const completedToday = habits.filter(h => {
    const p = progressData[h.id] || [];
    return p.find(pr => pr.completed_date === todayStr && pr.is_completed);
  }).length;
  const totalActive = habits.filter(h => {
    const start = new Date(h.startDate).toISOString().split('T')[0];
    return start <= todayStr;
  }).length;
  const allDoneToday = totalActive > 0 && completedToday === totalActive;

  return (
    <div className="habits-page">
      <header className="habits-header">
        <div className="header-content">
          <h1>DoubleDo</h1>
          <div className="user-avatar" onClick={() => navigate('/profile')}>
            <span>{user?.email?.charAt(0).toUpperCase() || 'U'}</span>
          </div>
        </div>
        {totalActive > 0 && (
          <div className="daily-progress">
            <div className="daily-progress-bar">
              <div
                className="daily-progress-fill"
                style={{ width: `${(completedToday / totalActive) * 100}%` }}
              />
            </div>
            <span className="daily-progress-label">
              {allDoneToday ? '🎉 Все выполнено!' : `${completedToday} из ${totalActive} сегодня`}
            </span>
          </div>
        )}
      </header>

      <main className="habits-main" ref={mainRef}>
        {(pullY > 0 || pullRefreshing) && (
          <div className="pull-indicator" style={{ height: pullRefreshing ? 48 : pullY }}>
            <div className={`pull-spinner${pullRefreshing ? ' spinning' : ''}`} />
          </div>
        )}
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
          {[...habits].sort((a, b) => {
            const aStart = new Date(a.startDate).toISOString().split('T')[0];
            const bStart = new Date(b.startDate).toISOString().split('T')[0];
            const aFuture = aStart > todayStr ? 1 : 0;
            const bFuture = bStart > todayStr ? 1 : 0;
            if (aFuture !== bFuture) return aFuture - bFuture;
            const aDone = (progressData[a.id] || []).find(p => p.completed_date === todayStr && p.is_completed) ? 1 : 0;
            const bDone = (progressData[b.id] || []).find(p => p.completed_date === todayStr && p.is_completed) ? 1 : 0;
            return aDone - bDone;
          }).map(habit => (
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
              getDaysWord={getDaysWord}
              onEditClick={handleEditClick}
              competitionScores={competitionScores}
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

      {/* НАВИГАЦИЯ */}
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

      {showCreateForm && (
        <CreateHabitModal
          newHabit={newHabit}
          setNewHabit={setNewHabit}
          handleCreateHabit={handleCreateHabit}
          setShowCreateForm={setShowCreateForm}
          loading={creatingHabit}
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

      {showEditForm && editingHabit && (
        <EditHabitModal
          editForm={editForm}
          setEditForm={setEditForm}
          handleUpdateHabit={handleUpdateHabit}
          setShowEditForm={setShowEditForm}
          loading={updatingHabit}
          editDatePicker={editDatePicker}
          setEditDatePicker={setEditDatePicker}
          datePickerRef={editDatePickerRef}
          datePickerMonth={datePickerMonth}
          datePickerYear={datePickerYear}
          handlePrevMonth={handlePrevMonth}
          handleNextMonth={handleNextMonth}
          datePickerWeeks={datePickerWeeks}
          handleDateSelect={handleEditDateSelect}
          isTodayInDatePicker={isTodayInDatePicker}
          isSelectedInDatePicker={isSelectedInEditDatePicker}
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
  getDayStatus,
  getDaysWord,
  onEditClick,
  competitionScores
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const menuRef = useRef(null);
  const progress = progressData[habit.id] || [];

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const todayStr = todayUTC.toISOString().split('T')[0];
  
  const habitStartDate = new Date(habit.startDate);
  const habitStartUTC = new Date(Date.UTC(
    habitStartDate.getFullYear(),
    habitStartDate.getMonth(),
    habitStartDate.getDate()
  ));
  const habitStartStr = habitStartUTC.toISOString().split('T')[0];
  
  // Проверяем, можно ли выполнять привычку сегодня
  const isTodayActive = habitStartStr <= todayStr;
  
  // Вычисляем сколько дней осталось до начала привычки
  const daysUntilStart = Math.max(0, Math.ceil((habitStartUTC.getTime() - todayUTC.getTime()) / (1000 * 60 * 60 * 24)));
  
  // Проверяем, выполнена ли привычка сегодня
  const isTodayCompleted = progress.find(p => p.completed_date === todayStr && p.is_completed);

  // Считаем текущую серию выполнений (streak)
  const streak = (() => {
    let count = 0;
    const check = new Date(todayUTC);
    // Если сегодня не выполнена — начинаем с вчера
    if (!isTodayCompleted) check.setUTCDate(check.getUTCDate() - 1);
    while (true) {
      const dateStr = check.toISOString().split('T')[0];
      if (dateStr < habitStartStr) break;
      const done = progress.find(p => p.completed_date === dateStr && p.is_completed);
      if (!done) break;
      count++;
      check.setUTCDate(check.getUTCDate() - 1);
    }
    return count;
  })();

  // Закрытие меню при клике снаружи
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleComplete = async () => {
    if (!isTodayActive) return;

    setIsLoading(true);
    try {
      await toggleHabitCompletion(habit.id);
      if (!isTodayCompleted) {
        setJustCompleted(true);
        setTimeout(() => setJustCompleted(false), 600);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    onEditClick(habit);
    setShowMenu(false);
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
    setShowMenu(false);
  };

  const confirmDelete = () => {
    deleteHabit(habit.id);
    setShowDeleteConfirm(false);
  };

  // Определяем текст для кнопки
  const getButtonText = () => {
    if (isLoading) return '...';
    if (isTodayCompleted) return '✓ ВЫПОЛНЕНО';
    if (isTodayActive) return 'ВЫПОЛНИТЬ';
    
    if (daysUntilStart === 1) return 'ЧЕРЕЗ 1 ДЕНЬ';
    if (daysUntilStart === 2) return 'ЧЕРЕЗ 2 ДНЯ';
    if (daysUntilStart === 3) return 'ЧЕРЕЗ 3 ДНЯ';
    if (daysUntilStart === 4) return 'ЧЕРЕЗ 4 ДНЯ';
    if (daysUntilStart === 5) return 'ЧЕРЕЗ 5 ДНЕЙ';
    return `ЧЕРЕЗ ${daysUntilStart} ДНЕЙ`;
  };

  // Определяем класс для кнопки
  const getButtonClass = () => {
    const baseClass = 'complete-habit-btn-small';
    
    if (isTodayCompleted) return `${baseClass} completed`;
    if (isTodayActive) return `${baseClass} active`;
    return `${baseClass} disabled future-habit`;
  };

  return (
    <>
    {showDeleteConfirm && (
      <div className="confirm-overlay" onClick={() => setShowDeleteConfirm(false)}>
        <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
          <p className="confirm-title">Удалить привычку?</p>
          <p className="confirm-text">«{habit.title}» и весь прогресс будут удалены навсегда.</p>
          <div className="confirm-actions">
            <button className="confirm-cancel" onClick={() => setShowDeleteConfirm(false)}>Отмена</button>
            <button className="confirm-delete" onClick={confirmDelete}>Удалить</button>
          </div>
        </div>
      </div>
    )}
    <div className="habit-card">
      <div className="habit-card-header">
        <div className="habit-title-section">
          <div className="habit-title-with-menu">
            {/* Меню действий СЛЕВА от названия */}
            {habit.role === 'owner' && (
              <div className="habit-menu-container" ref={menuRef}>
                <button 
                  className="habit-menu-toggle simple"
                  onClick={() => setShowMenu(!showMenu)}
                  title="Действия"
                >
                  ⋮
                </button>
                
                {showMenu && (
                  <div className="habit-menu-dropdown">
                    <button 
                      className="menu-item"
                      onClick={handleEdit}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M18.5 2.5C18.8978 2.10217 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10217 21.5 2.5C21.8978 2.89782 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10217 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>Редактировать</span>
                    </button>
                    <button 
                      className="menu-item delete"
                      onClick={handleDelete}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 6H5H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M10 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M14 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>Удалить</span>
                    </button>
                  </div>
                )}
              </div>
            )}
            
            <h3 className="habit-card-title">{habit.title}</h3>
          </div>
          
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
          className={`${getButtonClass()}${justCompleted ? ' complete-animate' : ''}`}
          onClick={handleComplete}
          disabled={isLoading || !isTodayActive}
          title={!isTodayActive ? `Привычка будет доступна с ${formatDisplayDate(habit.startDate)} (через ${daysUntilStart} ${getDaysWord(daysUntilStart)})` : ''}
        >
          {getButtonText()}
        </button>
        
        <div className="habit-actions">
          {streak >= 2 && (
            <span className="streak-badge">
              🔥 {streak} {streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'}
            </span>
          )}
          {habit.source_type === 'competition' && habit.competition_id && (
            <span className="competition-score-badge">
              🏆 {(competitionScores[habit.competition_id]?.my_score ?? habit.my_score) || 0}
              {' : '}
              {(competitionScores[habit.competition_id]?.friend_score ?? habit.friend_score) || 0}
            </span>
          )}
        </div>
      </div>
    </div>
    </>
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
    <div className="modal-overlay" onClick={() => !loading && setShowCreateForm(false)}>
      <div className="modal-content create-habit-modal" onClick={(e) => e.stopPropagation()}>
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
              placeholder="Например: 'Пить воду', 'Зарядка', 'Читать'"
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
                                <div
                                  key={dayIndex}
                                  className="datepicker-day outside-month"
                                >
                                  {day}
                                </div>
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
              <p>⚠️ Привычку можно будет выполнять только начиная с этой даты.</p>
              <p>Если вы выберете будущую дату, кнопка "ВЫПОЛНИТЬ" будет неактивна до её наступления.</p>
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
              {loading ? 'Создание...' : 'Создать привычку'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Компонент модального окна редактирования привычки
function EditHabitModal({
  editForm,
  setEditForm,
  handleUpdateHabit,
  setShowEditForm,
  loading,
  editDatePicker,
  setEditDatePicker,
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
    <div className="modal-overlay" onClick={() => !loading && setShowEditForm(false)}>
      <div className="modal-content edit-habit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Редактировать привычку</h3>
          <button 
            className="modal-close"
            onClick={() => setShowEditForm(false)}
            disabled={loading}
          >
            ×
          </button>
        </div>
        
        <form onSubmit={handleUpdateHabit} className="edit-habit-form">
          <div className="form-group">
            <label className="form-label">Название привычки</label>
            <input
              type="text"
              value={editForm.title}
              onChange={(e) => setEditForm({...editForm, title: e.target.value})}
              placeholder="Введите новое название"
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
                onClick={() => setEditDatePicker(!editDatePicker)}
              >
                <span className="date-value">
                  {editForm.startDate ? editForm.startDate.toLocaleDateString('ru-RU') : 'Выберите дату'}
                </span>
                <span className="date-icon">📅</span>
              </div>
              
              {editDatePicker && (
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
                                <div
                                  key={dayIndex}
                                  className="datepicker-day outside-month"
                                >
                                  {day}
                                </div>
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
              <p>⚠️ Привычку можно будет выполнять только начиная с этой даты.</p>
              <p>Если вы выберете будущую дату, кнопка "ВЫПОЛНИТЬ" будет неактивна до её наступления.</p>
            </div>
          </div>
          
          <div className="modal-actions">
            <button 
              type="button"
              className="btn-secondary"
              onClick={() => setShowEditForm(false)}
              disabled={loading}
            >
              Отмена
            </button>
            <button 
              type="submit"
              className="btn-primary"
              disabled={loading || !editForm.title.trim() || !editForm.startDate}
            >
              {loading ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default HabitsPage;
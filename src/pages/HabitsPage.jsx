import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import BottomNav from '../components/BottomNav';
import './HabitsPage.css';

function HabitsPage() {
  const navigate = useNavigate();
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
  const [editDatePickerMonth, setEditDatePickerMonth] = useState(new Date().getMonth());
  const [editDatePickerYear, setEditDatePickerYear] = useState(new Date().getFullYear());
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

  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  // Форматируем дату используя локальные компоненты (без сдвига в UTC)
  const formatDateLocal = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const currentDay = today.getDate();

  // Загрузка пользователя
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
          console.error('Ошибка получения пользователя:', error);
          setUser(null);
        } else {
          setUser(user);
        }
      } catch (err) {
        console.error('Исключение при получении пользователя:', err);
        setUser(null);
      } finally {
        setIsInitialized(true);
      }
    };
    
    checkUser();
  }, []);

  // Загрузка привычек после получения пользователя
  useEffect(() => {
    if (user && isInitialized && !loading) {
      loadHabits();
    }
  }, [user, isInitialized]);

  // Pull-to-refresh
  useEffect(() => {
    const onTouchStart = (e) => {
      if (window.scrollY === 0) pullStartY.current = e.touches[0].clientY;
    };
    const onTouchMove = (e) => {
      if (pullStartY.current === null) return;
      const delta = e.touches[0].clientY - pullStartY.current;
      if (delta > 0) setPullY(Math.min(delta * 0.4, 70));
      else { pullStartY.current = null; setPullY(0); }
    };
    const onTouchEnd = async () => {
      if (pullStartY.current === null) return;
      pullStartY.current = null;
      if (pullY >= 60 && !pullRefreshing) {
        setPullRefreshing(true);
        await loadHabits();
        setPullRefreshing(false);
      }
      setPullY(0);
    };
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [pullY, pullRefreshing]);

  // Загрузка привычек пользователя
  const loadHabits = async () => {
    if (!user) return;

    setLoading(true);

    try {
      const habitsData = await loadHabitsSafe();
      setHabits(habitsData || []);

      if (habitsData && habitsData.length > 0) {
        await loadAllProgress(habitsData);
        await loadCompetitionScores();
      }
    } catch (error) {
      console.error('Ошибка загрузки привычек:', error);
    } finally {
      setLoading(false);
    }
  };

  // Упрощенная загрузка привычек
  const loadHabitsSafe = async () => {
    try {
      // 1. Пробуем RPC функцию
      const { data: habitsData, error } = await supabase
        .rpc('get_all_user_habits');

      if (error) {
        console.error('RPC ошибка get_all_user_habits:', error);
        throw error;
      }

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
        console.error('Ошибка запроса habit_members:', membersError);
        throw membersError;
      }
      
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
      
      return formattedHabits;

    } catch (error) {
      console.error('Ошибка загрузки привычек, пробуем прямой запрос:', error);

      // 3. Последняя попытка: ручной запрос
      try {
        const { data: directHabits, error: directError } = await supabase
          .from('habits')
          .select('*')
          .eq('created_by', user.id);
        
        if (directError) {
          console.error('Ошибка прямого запроса привычек:', directError);
          return [];
        }
        
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
        console.error('Финальная ошибка загрузки привычек:', finalError);
        return [];
      }
    }
  };

  // Загрузка прогресса для всех привычек
  const loadAllProgress = async (habitsList) => {
    if (!user || !habitsList || habitsList.length === 0) {
      return;
    }

    try {
      const progressCache = {};
      const habitIds = habitsList.map(h => h.id);

      // Предыдущий + текущий месяц, чтобы streak не обрезался на границе месяца
      const startOfMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
      const endOfMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0));

      const { data, error } = await supabase
        .from('habit_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('habit_id', habitIds)
        .gte('completed_date', startOfMonth.toISOString().split('T')[0])
        .lte('completed_date', endOfMonth.toISOString().split('T')[0]);

      if (error) {
        console.error('Ошибка запроса прогресса:', error);
        return;
      }

      if (data) {
        data.forEach(progress => {
          const dateStr = new Date(progress.completed_date).toISOString().split('T')[0];
          if (!progressCache[progress.habit_id]) progressCache[progress.habit_id] = [];
          progressCache[progress.habit_id].push({ ...progress, completed_date: dateStr });
        });
      }

      setProgressData(progressCache);
    } catch (error) {
      console.error('Ошибка загрузки прогресса:', error);
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

  const generateEditDatePickerCalendar = () => {
    const firstDayOfMonth = new Date(editDatePickerYear, editDatePickerMonth, 1);
    const lastDayOfMonth = new Date(editDatePickerYear, editDatePickerMonth + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const firstDayOfWeek = firstDayOfMonth.getDay();
    const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const weeks = [];
    let week = [];
    for (let i = 0; i < startOffset; i++) week.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      week.push(day);
      if (week.length === 7) { weeks.push(week); week = []; }
    }
    if (week.length > 0) { while (week.length < 7) week.push(null); weeks.push(week); }
    return weeks;
  };

  const calendarWeeks = generateHabitCalendar();
  const datePickerWeeks = generateDatePickerCalendar();
  const editDatePickerWeeks = generateEditDatePickerCalendar();
  
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

  const handleEditPrevMonth = () => {
    if (editDatePickerMonth === 0) {
      setEditDatePickerMonth(11);
      setEditDatePickerYear(editDatePickerYear - 1);
    } else {
      setEditDatePickerMonth(editDatePickerMonth - 1);
    }
  };

  const handleEditNextMonth = () => {
    if (editDatePickerMonth === 11) {
      setEditDatePickerMonth(0);
      setEditDatePickerYear(editDatePickerYear + 1);
    } else {
      setEditDatePickerMonth(editDatePickerMonth + 1);
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
    const selectedDate = new Date(Date.UTC(editDatePickerYear, editDatePickerMonth, day));
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
    const startDate = new Date(habit.startDate);
    setEditForm({
      title: habit.title,
      startDate: startDate
    });
    setEditDatePickerMonth(startDate.getMonth());
    setEditDatePickerYear(startDate.getFullYear());
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
      const formattedDate = formatDateLocal(editForm.startDate);
      
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
      editDatePickerMonth === selectedUTC.getMonth() &&
      editDatePickerYear === selectedUTC.getFullYear()
    );
  };

  const isTodayInEditDatePicker = (day) => {
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    return (
      day === todayUTC.getDate() &&
      editDatePickerMonth === todayUTC.getMonth() &&
      editDatePickerYear === todayUTC.getFullYear()
    );
  };

  const isPastDayInEditDatePicker = (day) => {
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const date = new Date(Date.UTC(editDatePickerYear, editDatePickerMonth, day));
    return date < todayUTC;
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

  // Создание привычки
  const handleCreateHabit = async (e) => {
    e.preventDefault();

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
      const formattedDate = formatDateLocal(newHabit.startDate);

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
        console.error('Ошибка создания привычки:', habitError);
        throw habitError;
      }

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
        console.error('Ошибка добавления в habit_members:', memberError);
        throw memberError;
      }

      // 3. Перезагружаем список привычек
      await loadHabits();

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
      
      // Попробуем альтернативный метод через RPC
      try {
        const formattedDate = formatDateLocal(newHabit.startDate);
        
        const { data, error: rpcError } = await supabase.rpc('create_habit', {
          p_title: newHabit.title.trim(),
          p_start_date: formattedDate
        });
        
        if (rpcError) {
          console.error('RPC ошибка create_habit:', rpcError);
          throw new Error(`RPC: ${rpcError.message}`);
        }

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
          // Push сопернику о выполнении
          supabase.rpc('notify_rival_habit_complete_push', {
            p_competition_id: habit.competition_id,
            p_habit_title: habit.title,
          }).catch(() => {});
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
    setShowCreateForm(true);
  };

  // Если загрузка данных
  if (!isInitialized || (user && loading && habits.length === 0)) {
    return (
      <div className="habits-page">
        <header className="habits-header">
          <div className="header-content">
            <h1>duo.</h1>
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
            <h1>duo.</h1>
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
            <h1>duo.</h1>
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

        <BottomNav />

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
      {(pullY > 0 || pullRefreshing) && (
        <div className="pull-indicator" style={{ height: pullRefreshing ? 48 : pullY }}>
          <div className={`pull-spinner${pullRefreshing ? ' spinning' : ''}`} />
        </div>
      )}
      <header className="habits-header">
        <div className="header-content">
          <h1>duo.</h1>
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
      <BottomNav />

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
          datePickerMonth={editDatePickerMonth}
          datePickerYear={editDatePickerYear}
          handlePrevMonth={handleEditPrevMonth}
          handleNextMonth={handleEditNextMonth}
          datePickerWeeks={editDatePickerWeeks}
          handleDateSelect={handleEditDateSelect}
          isTodayInDatePicker={isTodayInEditDatePicker}
          isSelectedInDatePicker={isSelectedInEditDatePicker}
          isPastDayInDatePicker={isPastDayInEditDatePicker}
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
  const [skipModalOpen, setSkipModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [sendingSkip, setSendingSkip] = useState(false);
  // Навигация по месяцам в календаре
  const [calViewMonth, setCalViewMonth] = useState(currentMonth);
  const [calViewYear, setCalViewYear] = useState(currentYear);
  const [extraProgress, setExtraProgress] = useState(null);
  const [loadingCal, setLoadingCal] = useState(false);
  const menuRef = useRef(null);

  const isCurrentView = calViewMonth === currentMonth && calViewYear === currentYear;
  const progress = isCurrentView
    ? (progressData[habit.id] || [])
    : (extraProgress || []);

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

  // Загрузка прогресса при переходе на другой месяц
  useEffect(() => {
    if (isCurrentView) {
      setExtraProgress(null);
      return;
    }
    let cancelled = false;
    const fetchMonth = async () => {
      setLoadingCal(true);
      try {
        const startDate = `${calViewYear}-${String(calViewMonth + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(calViewYear, calViewMonth + 1, 0).getDate();
        const endDate = `${calViewYear}-${String(calViewMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        const { data } = await supabase
          .from('habit_progress')
          .select('habit_id, completed_date, is_completed')
          .eq('habit_id', habit.id)
          .eq('user_id', user.id)
          .gte('completed_date', startDate)
          .lte('completed_date', endDate);
        if (!cancelled) {
          setExtraProgress((data || []).map(p => ({
            ...p,
            completed_date: new Date(p.completed_date).toISOString().split('T')[0]
          })));
        }
      } catch {
        if (!cancelled) setExtraProgress([]);
      } finally {
        if (!cancelled) setLoadingCal(false);
      }
    };
    fetchMonth();
    return () => { cancelled = true; };
  }, [calViewMonth, calViewYear, isCurrentView]);

  const calMonthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
                         'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

  const handleCalPrev = () => {
    if (calViewMonth === 0) {
      setCalViewMonth(11);
      setCalViewYear(y => y - 1);
    } else {
      setCalViewMonth(m => m - 1);
    }
  };

  const handleCalNext = () => {
    if (calViewYear === currentYear && calViewMonth >= currentMonth) return;
    if (calViewMonth === 11) {
      setCalViewMonth(0);
      setCalViewYear(y => y + 1);
    } else {
      setCalViewMonth(m => m + 1);
    }
  };

  // Генерация календаря для просматриваемого месяца
  const generateViewCalendar = () => {
    const firstDayOfMonth = new Date(calViewYear, calViewMonth, 1);
    const lastDayOfMonth = new Date(calViewYear, calViewMonth + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const firstDayOfWeek = firstDayOfMonth.getDay();
    const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const weeks = [];
    let week = [];
    for (let i = 0; i < startOffset; i++) week.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      week.push(day);
      if (week.length === 7) { weeks.push(week); week = []; }
    }
    if (week.length > 0) { while (week.length < 7) week.push(null); weeks.push(week); }
    return weeks;
  };

  const viewCalendarWeeks = generateViewCalendar();

  // Статус дня для просматриваемого месяца
  const getViewDayStatus = (day) => {
    if (!day || !habit) return 'empty';
    const dayDate = new Date(Date.UTC(calViewYear, calViewMonth, day));
    const dayStr = dayDate.toISOString().split('T')[0];
    const habitStartDate = new Date(habit.startDate);
    const habitStartStr = new Date(Date.UTC(
      habitStartDate.getFullYear(),
      habitStartDate.getMonth(),
      habitStartDate.getDate()
    )).toISOString().split('T')[0];
    const todayUTC = new Date(Date.UTC(currentYear, currentMonth, currentDay));
    const todayStr = todayUTC.toISOString().split('T')[0];
    if (dayStr < habitStartStr) return 'before-start';
    const progressForDate = progress?.find(p => p.completed_date === dayStr);
    if (dayStr === todayStr) return progressForDate?.is_completed ? 'today-completed' : 'today';
    if (progressForDate?.is_completed) return 'completed';
    if (dayStr < todayStr && dayStr >= habitStartStr) return 'missed';
    return 'future';
  };

  const canGoNext = !(calViewYear === currentYear && calViewMonth >= currentMonth);

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

  const handleRequestSkip = async () => {
    const reason = selectedReason || customReason.trim();
    if (!reason) return;
    setSendingSkip(true);
    try {
      const { data } = await supabase.rpc('request_habit_skip', {
        p_competition_id: habit.competition_id,
        p_skip_date: todayStr,
        p_reason: reason,
      });
      if (data?.success) {
        toast.success('Запрос отправлен сопернику');
        setSkipModalOpen(false);
        setSelectedReason('');
        setCustomReason('');
      } else {
        toast.error('Ошибка отправки запроса');
      }
    } catch {
      toast.error('Ошибка');
    } finally {
      setSendingSkip(false);
    }
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
    {skipModalOpen && (
      <div className="skip-modal-overlay" onClick={() => setSkipModalOpen(false)}>
        <div className="skip-modal" onClick={e => e.stopPropagation()}>
          <h3 className="skip-modal-title">Причина пропуска</h3>
          <div className="skip-reason-presets">
            {['Болел 🤒', 'В дороге ✈️', 'Форс-мажор ⚡'].map(r => (
              <button
                key={r}
                className={`skip-preset-btn${selectedReason === r ? ' selected' : ''}`}
                onClick={() => { setSelectedReason(r); setCustomReason(''); }}
              >{r}</button>
            ))}
          </div>
          <input
            className="skip-custom-input"
            type="text"
            placeholder="Своя причина..."
            value={customReason}
            maxLength={100}
            onChange={e => { setCustomReason(e.target.value); setSelectedReason(''); }}
          />
          <div className="skip-modal-actions">
            <button className="skip-cancel-btn" onClick={() => setSkipModalOpen(false)}>Отмена</button>
            <button
              className="skip-submit-btn"
              onClick={handleRequestSkip}
              disabled={sendingSkip || (!selectedReason && !customReason.trim())}
            >{sendingSkip ? '...' : 'Отправить'}</button>
          </div>
        </div>
      </div>
    )}
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
        <div className="cal-month-nav">
          <button className="cal-nav-btn" onClick={handleCalPrev} type="button">‹</button>
          <span className="cal-nav-label">
            {calMonthNames[calViewMonth]}{calViewYear !== currentYear ? ` ${calViewYear}` : ''}
            {loadingCal && <span className="cal-loading"> ·</span>}
          </span>
          <button
            className="cal-nav-btn"
            onClick={handleCalNext}
            type="button"
            disabled={!canGoNext}
          >›</button>
        </div>
        <div className="calendar-grid-small">
          <div className="weekdays-row-small">
            {dayNames.map((dayName, index) => (
              <div key={index} className="weekday-cell-small">
                {dayName}
              </div>
            ))}
          </div>

          {viewCalendarWeeks.map((week, weekIndex) => (
            <div key={weekIndex} className="calendar-week-small">
              {week.map((day, dayIndex) => {
                if (day === null) {
                  return <div key={dayIndex} className="calendar-day-small empty"></div>;
                }

                const status = getViewDayStatus(day);
                const isToday = isCurrentView && day === currentDay;

                return (
                  <div
                    key={dayIndex}
                    className={`calendar-day-small ${status} ${isToday ? 'today-highlight' : ''}`}
                    title={`${day}.${calViewMonth + 1}.${calViewYear}`}
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
        {habit.source_type === 'competition' && habit.competition_id && isTodayActive && !isTodayCompleted && (
          <button
            className="skip-habit-btn"
            onClick={() => setSkipModalOpen(true)}
            disabled={isLoading}
            title="Попросить засчитать пропуск"
          >Пропустить</button>
        )}
        
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
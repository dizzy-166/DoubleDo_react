/* ── duo. i18n ──────────────────────────────────────────────────
   Shared key with hi-dashboard: localStorage 'hi_lang'
   Values: 'ru' | 'en'   Default: 'ru'
────────────────────────────────────────────────────────────────── */

export const strings = {
  ru: {
    // ── BottomNav ────────────────────────────────────────────────
    navCompetitions: 'Соревнования',
    navHabits:       'Привычки',
    navStats:        'Статистика',
    navProfile:      'Профиль',

    // ── Common ───────────────────────────────────────────────────
    loading:    'Загрузка…',
    error:      'Ошибка',
    save:       'Сохранить',
    cancel:     'Отмена',
    create:     'Создать',
    delete:     'Удалить',
    edit:       'Изменить',
    confirm:    'Подтвердить',
    yes:        'Да',
    no:         'Нет',
    back:       '← назад',

    // ── Auth ─────────────────────────────────────────────────────
    loginTitle:   'duo.',
    loginSub:     'соревнование привычек · hi. экосистема',
    loginSendBtn: 'Получить код',
    loginSending: 'Отправка…',
    loginVerify:  'Войти',
    loginVerifying:'Проверка…',
    loginBack:    '← другой email',
    loginHint:    e => `Код отправлен на ${e}`,
    loginErrEmail:'Введи email',
    loginErrCode: 'Введи 6-значный код',
    loginErrOtp:  'Неверный или истёкший код',
    signOut:      'Выйти',
    signingOut:   'Выхожу…',

    // ── Habits ───────────────────────────────────────────────────
    habitsTitle:     'Мои привычки',
    habitAdd:        '+ Привычка',
    habitNew:        'Новая привычка',
    habitEdit:       'Изменить привычку',
    habitName:       'Название',
    habitNamePH:     'Название привычки…',
    habitStart:      'Дата начала',
    habitToday:      '● сегодня',
    habitDone:       '✓ Выполнено',
    habitStreak:     n => `${n} дн.`,
    habitNoHabits:   'Нет привычек. Создай первую!',
    habitDeleteConfirm: 'Удалить привычку?',
    habitSaving:     'Сохранение…',
    habitCreating:   'Создание…',

    // ── Competitions ─────────────────────────────────────────────
    compTitle:       'Соревнования',
    compNew:         '+ Соревнование',
    compActive:      'Активные',
    compFriends:     'Друзья',
    compRequests:    'Заявки',
    compNoComp:      'Нет активных соревнований',
    compInvite:      'Пригласить друга',
    compCreateTitle: 'Новое соревнование',
    compHabit:       'Привычка',
    compPartner:     'Партнёр',
    compSearch:      'Поиск пользователей…',
    compDay:         n => `День ${n}`,
    compStreak:      n => `${n} дн. подряд`,
    compVs:          'vs',
    compAccept:      'Принять',
    compDecline:     'Отклонить',
    compEnd:         'Завершить',
    compEndConfirm:  'Завершить соревнование?',

    // ── Friends ──────────────────────────────────────────────────
    friendsAdd:      'Добавить друга',
    friendsPending:  'Входящие заявки',
    friendsSent:     'Исходящие заявки',
    friendsNone:     'Нет друзей',
    friendsSendReq:  'Отправить заявку',
    friendsReqSent:  'Заявка отправлена',
    friendsAlready:  'Уже друзья',
    friendsRemove:   'Удалить из друзей',
    friendsAccept:   'Принять',
    friendsDecline:  'Отклонить',

    // ── Stats ────────────────────────────────────────────────────
    statsTitle:      'Статистика',
    statsTotal:      'Всего дней',
    statsStreak:     'Текущий стрик',
    statsBest:       'Лучший стрик',
    statsRate:       'Выполнение',
    statsNoData:     'Нет данных',
    statsHabit:      'Привычка',

    // ── Profile ──────────────────────────────────────────────────
    profileTitle:    'Профиль',
    profileUsername: 'Имя пользователя',
    profileEmail:    'Email',
    profileSince:    d => `участник с ${d}`,
    profileEdit:     'Изменить профиль',
  },

  en: {
    // ── BottomNav ────────────────────────────────────────────────
    navCompetitions: 'Competitions',
    navHabits:       'Habits',
    navStats:        'Stats',
    navProfile:      'Profile',

    // ── Common ───────────────────────────────────────────────────
    loading:    'Loading…',
    error:      'Error',
    save:       'Save',
    cancel:     'Cancel',
    create:     'Create',
    delete:     'Delete',
    edit:       'Edit',
    confirm:    'Confirm',
    yes:        'Yes',
    no:         'No',
    back:       '← back',

    // ── Auth ─────────────────────────────────────────────────────
    loginTitle:   'duo.',
    loginSub:     'habit competition · hi. ecosystem',
    loginSendBtn: 'Get code',
    loginSending: 'Sending…',
    loginVerify:  'Sign in',
    loginVerifying:'Checking…',
    loginBack:    '← other email',
    loginHint:    e => `Code sent to ${e}`,
    loginErrEmail:'Enter your email',
    loginErrCode: 'Enter the 6-digit code',
    loginErrOtp:  'Invalid or expired code',
    signOut:      'Sign out',
    signingOut:   'Signing out…',

    // ── Habits ───────────────────────────────────────────────────
    habitsTitle:     'My habits',
    habitAdd:        '+ Habit',
    habitNew:        'New habit',
    habitEdit:       'Edit habit',
    habitName:       'Name',
    habitNamePH:     'Habit name…',
    habitStart:      'Start date',
    habitToday:      '● today',
    habitDone:       '✓ Done',
    habitStreak:     n => `${n} d.`,
    habitNoHabits:   'No habits yet. Create your first!',
    habitDeleteConfirm: 'Delete habit?',
    habitSaving:     'Saving…',
    habitCreating:   'Creating…',

    // ── Competitions ─────────────────────────────────────────────
    compTitle:       'Competitions',
    compNew:         '+ Competition',
    compActive:      'Active',
    compFriends:     'Friends',
    compRequests:    'Requests',
    compNoComp:      'No active competitions',
    compInvite:      'Invite a friend',
    compCreateTitle: 'New competition',
    compHabit:       'Habit',
    compPartner:     'Partner',
    compSearch:      'Search users…',
    compDay:         n => `Day ${n}`,
    compStreak:      n => `${n} days in a row`,
    compVs:          'vs',
    compAccept:      'Accept',
    compDecline:     'Decline',
    compEnd:         'End',
    compEndConfirm:  'End competition?',

    // ── Friends ──────────────────────────────────────────────────
    friendsAdd:      'Add friend',
    friendsPending:  'Incoming requests',
    friendsSent:     'Sent requests',
    friendsNone:     'No friends',
    friendsSendReq:  'Send request',
    friendsReqSent:  'Request sent',
    friendsAlready:  'Already friends',
    friendsRemove:   'Remove friend',
    friendsAccept:   'Accept',
    friendsDecline:  'Decline',

    // ── Stats ────────────────────────────────────────────────────
    statsTitle:      'Statistics',
    statsTotal:      'Total days',
    statsStreak:     'Current streak',
    statsBest:       'Best streak',
    statsRate:       'Completion rate',
    statsNoData:     'No data',
    statsHabit:      'Habit',

    // ── Profile ──────────────────────────────────────────────────
    profileTitle:    'Profile',
    profileUsername: 'Username',
    profileEmail:    'Email',
    profileSince:    d => `member since ${d}`,
    profileEdit:     'Edit profile',
  },
}

export function t(lang, key, ...args) {
  const entry = strings[lang]?.[key] ?? strings.en[key] ?? key
  return typeof entry === 'function' ? entry(...args) : entry
}

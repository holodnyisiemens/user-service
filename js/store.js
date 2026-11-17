'use strict';

/**
 * Слой данных сервиса управления пользователями (имитация бэкенда).
 *
 * Пользователи и сессия хранятся в localStorage (в браузере) или в памяти
 * (в Node.js — поэтому модуль можно покрыть тестами, см. test.js).
 * Подтверждение почты происходит заданным кодом CONFIRM_CODE.
 * Пароли сохраняются только в виде стаба хэша — в реальном сервисе
 * хэширование и выдача кода подтверждения живут на сервере.
 */

(function (global) {
  // Захардкоженный код подтверждения почты / телефона.
  const CONFIRM_CODE = '123456';

  function memoryStorage() {
    const map = new Map();
    return {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => void map.set(key, String(value)),
      removeItem: (key) => void map.delete(key),
    };
  }

  const storage = (function () {
    try {
      if (global.localStorage) return global.localStorage;
    } catch (e) {
      // доступ к localStorage может быть запрещён настройками браузера
    }
    return memoryStorage();
  })();

  const USERS_KEY = 'lab8.users';
  const SESSION_KEY = 'lab8.session';
  const PENDING_KEY = 'lab8.pending';

  function readUsers() {
    try {
      return JSON.parse(storage.getItem(USERS_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function writeUsers(users) {
    storage.setItem(USERS_KEY, JSON.stringify(users));
  }

  // Стаб хэша (FNV-1a) — только для лабораторного хранения паролей.
  function hash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }

  function fail(error) {
    return { ok: false, error };
  }

  function succeed(data) {
    return Object.assign({ ok: true }, data);
  }

  // --- валидация полей ---

  function validateName(name) {
    return typeof name === 'string' && name.trim().length >= 2 ? '' : 'Имя: минимум 2 символа';
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Некорректный email';
  }

  function validatePhone(phone) {
    return /^\+?[0-9][0-9\s\-()]{8,18}$/.test(phone) ? '' : 'Некорректный телефон';
  }

  function validatePassword(password) {
    if (typeof password !== 'string' || password.length < 8) {
      return 'Пароль: минимум 8 символов';
    }
    if (!/[a-zа-яё]/i.test(password) || !/\d/.test(password)) {
      return 'Пароль должен содержать букву и цифру';
    }
    return '';
  }

  // --- сценарии ---

  // Регистрация: валидация, отказ при занятом email, пользователь не подтверждён.
  function register({ name, email, phone, password }) {
    name = String(name || '').trim();
    email = String(email || '').trim().toLowerCase();
    phone = String(phone || '').trim();

    const fieldError =
      validateName(name) || validateEmail(email) || validatePhone(phone) || validatePassword(password);
    if (fieldError) return fail(fieldError);

    const users = readUsers();
    if (users.some((u) => u.email === email)) {
      return fail('Пользователь с таким email уже зарегистрирован');
    }

    users.push({
      name,
      email,
      phone,
      passwordHash: hash(password),
      confirmed: false,
      createdAt: Date.now(),
    });
    writeUsers(users);
    storage.setItem(PENDING_KEY, email);
    return succeed({ email });
  }

  // Email пользователя, ожидающего подтверждения (для формы подтверждения).
  function pending() {
    return storage.getItem(PENDING_KEY) || null;
  }

  // Подтверждение почты захардкоженным кодом.
  function confirm(email, code) {
    email = String(email || '').trim().toLowerCase();
    const users = readUsers();
    const user = users.find((u) => u.email === email);
    if (!user) return fail('Пользователь не найден');
    if (String(code).trim() !== CONFIRM_CODE) return fail('Неверный код подтверждения');
    user.confirmed = true;
    writeUsers(users);
    storage.removeItem(PENDING_KEY);
    return succeed({ email });
  }

  // Вход: только подтверждённые пользователи, открывает сессию.
  function login(email, password) {
    email = String(email || '').trim().toLowerCase();
    const user = readUsers().find((u) => u.email === email);
    if (!user || user.passwordHash !== hash(String(password || ''))) {
      return fail('Неверный email или пароль');
    }
    if (!user.confirmed) {
      return fail('Почта не подтверждена — сначала введите код из письма');
    }
    storage.setItem(SESSION_KEY, email);
    return succeed({ email });
  }

  function currentUser() {
    const email = storage.getItem(SESSION_KEY);
    if (!email) return null;
    return readUsers().find((u) => u.email === email) || null;
  }

  function logout() {
    storage.removeItem(SESSION_KEY);
    return succeed();
  }

  // Общие данные профиля (email — логин, поэтому не редактируется).
  function updateProfile({ name, phone }) {
    const user = currentUser();
    if (!user) return fail('Нет активной сессии');

    name = String(name || '').trim();
    phone = String(phone || '').trim();
    const fieldError = validateName(name) || validatePhone(phone);
    if (fieldError) return fail(fieldError);

    user.name = name;
    user.phone = phone;
    const users = readUsers();
    users[users.findIndex((u) => u.email === user.email)] = user;
    writeUsers(users);
    return succeed({ user: publicUser(user) });
  }

  // Смена пароля: проверка текущего и совпадения повтора.
  function changePassword({ current, next, repeat }) {
    const user = currentUser();
    if (!user) return fail('Нет активной сессии');
    if (user.passwordHash !== hash(String(current || ''))) {
      return fail('Текущий пароль неверный');
    }
    if (String(next || '') !== String(repeat || '')) {
      return fail('Новые пароли не совпадают');
    }
    const fieldError = validatePassword(next);
    if (fieldError) return fail(fieldError);
    if (hash(next) === user.passwordHash) {
      return fail('Новый пароль совпадает со старым');
    }

    user.passwordHash = hash(next);
    const users = readUsers();
    users[users.findIndex((u) => u.email === user.email)] = user;
    writeUsers(users);
    return succeed();
  }

  function publicUser(user) {
    return {
      name: user.name,
      email: user.email,
      phone: user.phone,
      confirmed: user.confirmed,
      createdAt: user.createdAt,
    };
  }

  const api = {
    CONFIRM_CODE,
    register,
    pending,
    confirm,
    login,
    logout,
    currentUser,
    updateProfile,
    changePassword,
  };

  global.UserStore = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);

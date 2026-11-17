'use strict';

/* global UserStore */

/**
 * Фронтовая часть сервиса: SPA на хэш-роутинге без фреймворков.
 * Маршруты: #/register, #/confirm, #/login, #/dashboard, #/dashboard/security.
 * Каждое представление — функция, возвращающая html и bind() для событий.
 */

(function () {
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (ch) => {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function navigate(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function currentRoute() {
    return (location.hash || '#/').replace(/^#\/?/, '');
  }

  function showMessage(form, text, type) {
    const el = form.querySelector('[data-message]');
    el.textContent = text;
    el.className = `form-message ${type}`;
  }

  // --- форма регистрации ---

  function registerView() {
    return {
      html: `
        <section class="card">
          <h2>Регистрация</h2>
          <form id="register-form" novalidate>
            <label>Имя<input name="name" required></label>
            <label>Email<input name="email" type="email" required></label>
            <label>Телефон<input name="phone" placeholder="+7 999 123-45-67" required></label>
            <label>Пароль<input name="password" type="password" required></label>
            <label>Повторите пароль<input name="password2" type="password" required></label>
            <p class="form-message" data-message></p>
            <button type="submit">Зарегистрироваться</button>
          </form>
          <p class="switch">Уже есть аккаунт? <a href="#/login">Войти</a></p>
        </section>`,
      bind() {
        const form = document.getElementById('register-form');
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          const data = Object.fromEntries(new FormData(form));
          if (data.password !== data.password2) {
            showMessage(form, 'Пароли не совпадают', 'error');
            return;
          }
          const result = UserStore.register(data);
          if (!result.ok) {
            showMessage(form, result.error, 'error');
            return;
          }
          navigate('#/confirm');
        });
      },
    };
  }

  // --- форма подтверждения почты (код захардкожен, «письмо» эмулируется) ---

  function confirmView() {
    const email = UserStore.pending();
    if (!email) return { redirect: '#/login' };
    return {
      html: `
        <section class="card">
          <h2>Подтверждение почты</h2>
          <p>На адрес <strong>${escapeHtml(email)}</strong> отправлен код подтверждения.</p>
          <p class="dev-hint" id="dev-hint">Эмуляция письма: ваш код — <strong>${UserStore.CONFIRM_CODE}</strong></p>
          <form id="confirm-form" novalidate>
            <label>Код из письма<input name="code" required autocomplete="one-time-code"></label>
            <p class="form-message" data-message></p>
            <button type="submit">Подтвердить</button>
            <p class="switch"><button type="button" id="resend" class="link-button">Отправить код ещё раз</button></p>
          </form>
        </section>`,
      bind() {
        const form = document.getElementById('confirm-form');
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          const code = new FormData(form).get('code');
          const result = UserStore.confirm(email, code);
          if (!result.ok) {
            showMessage(form, result.error, 'error');
            return;
          }
          showMessage(form, 'Почта подтверждена. Переход ко входу…', 'success');
          setTimeout(() => navigate('#/login'), 900);
        });
        document.getElementById('resend').addEventListener('click', () => {
          document.getElementById('dev-hint').textContent =
            `Код отправлен повторно на ${email} (эмуляция письма): ${UserStore.CONFIRM_CODE}`;
        });
      },
    };
  }

  // --- форма логина ---

  function loginView() {
    return {
      html: `
        <section class="card">
          <h2>Вход</h2>
          <form id="login-form" novalidate>
            <label>Email<input name="email" type="email" required></label>
            <label>Пароль<input name="password" type="password" required></label>
            <p class="form-message" data-message></p>
            <button type="submit">Войти</button>
          </form>
          <p class="switch">Нет аккаунта? <a href="#/register">Зарегистрироваться</a></p>
        </section>`,
      bind() {
        const form = document.getElementById('login-form');
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          const data = Object.fromEntries(new FormData(form));
          const result = UserStore.login(data.email, data.password);
          if (!result.ok) {
            showMessage(form, result.error, 'error');
            return;
          }
          navigate('#/dashboard');
        });
      },
    };
  }

  // --- дэшборд: вкладки общих данных и безопасности ---

  function dashboardView(tab) {
    const user = UserStore.currentUser();
    if (!user) return { redirect: '#/login' };

    const profileTab = `
      <form id="profile-form" novalidate>
        <label>Имя<input name="name" value="${escapeHtml(user.name)}" required></label>
        <label>Email<input value="${escapeHtml(user.email)}" disabled></label>
        <label>Телефон<input name="phone" value="${escapeHtml(user.phone)}" required></label>
        <p class="hint">Email используется как логин, поэтому не редактируется.</p>
        <p class="form-message" data-message></p>
        <button type="submit">Сохранить</button>
      </form>`;

    const securityTab = `
      <form id="password-form" novalidate>
        <label>Текущий пароль<input name="current" type="password" required></label>
        <label>Новый пароль<input name="next" type="password" required></label>
        <label>Повторите новый пароль<input name="repeat" type="password" required></label>
        <p class="form-message" data-message></p>
        <button type="submit">Сменить пароль</button>
      </form>
      <p class="hint">Вы вошли как ${escapeHtml(user.email)}</p>`;

    return {
      html: `
        <section class="card">
          <h2>Дэшборд — ${escapeHtml(user.name)}</h2>
          <div class="tabs">
            <a class="tab ${tab === 'profile' ? 'active' : ''}" href="#/dashboard">Общие данные</a>
            <a class="tab ${tab === 'security' ? 'active' : ''}" href="#/dashboard/security">Безопасность</a>
          </div>
          ${tab === 'profile' ? profileTab : securityTab}
        </section>`,
      bind() {
        const profileForm = document.getElementById('profile-form');
        if (profileForm) {
          profileForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(profileForm));
            const result = UserStore.updateProfile(data);
            showMessage(profileForm, result.ok ? 'Данные сохранены' : result.error, result.ok ? 'success' : 'error');
          });
          return;
        }
        const passwordForm = document.getElementById('password-form');
        passwordForm.addEventListener('submit', (event) => {
          event.preventDefault();
          const data = Object.fromEntries(new FormData(passwordForm));
          const result = UserStore.changePassword(data);
          showMessage(
            passwordForm,
            result.ok ? 'Пароль изменён' : result.error,
            result.ok ? 'success' : 'error'
          );
          if (result.ok) passwordForm.reset();
        });
      },
    };
  }

  // --- навигация и роутер ---

  function renderNav() {
    const user = UserStore.currentUser();
    nav.innerHTML = user
      ? `<span class="nav-user">${escapeHtml(user.name)}</span>
         <a href="#/dashboard">Дэшборд</a>
         <button type="button" id="logout" class="link-button">Выйти</button>`
      : `<a href="#/login">Вход</a>
         <a href="#/register">Регистрация</a>`;
    const logoutButton = document.getElementById('logout');
    if (logoutButton) {
      logoutButton.addEventListener('click', () => {
        UserStore.logout();
        navigate('#/login');
      });
    }
  }

  function resolve() {
    const route = currentRoute();
    const user = UserStore.currentUser();

    if (route === 'confirm' && user) return { redirect: '#/dashboard' };
    if ((route === 'login' || route === 'register') && user) return { redirect: '#/dashboard' };
    if (route === 'dashboard' || route === 'dashboard/security') return dashboardView(route === 'dashboard' ? 'profile' : 'security');
    if (route === 'register') return registerView();
    if (route === 'confirm') return confirmView();
    if (route === 'login' || route === '') return loginView();
    return { redirect: user ? '#/dashboard' : '#/login' };
  }

  function render() {
    const view = resolve();
    if (view.redirect) {
      navigate(view.redirect);
      return;
    }
    app.innerHTML = view.html;
    view.bind();
    renderNav();
  }

  window.addEventListener('hashchange', render);
  render();
})();

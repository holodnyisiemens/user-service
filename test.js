'use strict';

// Сценарные проверки слоя данных (js/store.js) в Node.js:
// регистрация -> подтверждение -> логин -> профиль -> смена пароля.

const store = require('./js/store.js');

let passed = 0;
const plan = [];
function check(name, condition) {
  plan.push([name, condition]);
  if (condition) passed++;
}

const USER = {
  name: 'Алексей Устинов',
  email: 'ustinov@example.com',
  phone: '+7 999 123-45-67',
  password: 'Passw0rd',
};

console.log('--- Регистрация ---');
check('корректные данные принимаются', store.register(USER).ok);
check(
  'дубликат email отклоняется',
  !store.register({ ...USER, phone: '+7 999 000-00-00' }).ok
);
check(
  'слабый пароль отклоняется',
  !store.register({ ...USER, email: 'a@b.co', password: '123' }).ok
);
check(
  'невалидный email отклоняется',
  !store.register({ ...USER, email: 'not-an-email' }).ok
);
check(
  'невалидный телефон отклоняется',
  !store.register({ ...USER, email: 'c@d.co', phone: 'abc' }).ok
);
check('ожидает подтверждения именно этот email', store.pending() === USER.email);

console.log('--- Подтверждение почты ---');
check('вход до подтверждения запрещён', !store.login(USER.email, USER.password).ok);
check('неверный код отклоняется', !store.confirm(USER.email, '000000').ok);
check('захардкоженный код принимается', store.confirm(USER.email, store.CONFIRM_CODE).ok);

console.log('--- Логин и сессия ---');
check('неверный пароль отклоняется', !store.login(USER.email, 'WrongPass1').ok);
check('неизвестный email отклоняется', !store.login('nobody@example.com', 'Passw0rd').ok);
check('верные данные пускают', store.login(USER.email, USER.password).ok);
check('сессия открыта', store.currentUser() && store.currentUser().email === USER.email);

console.log('--- Дэшборд: общие данные ---');
check(
  'обновление профиля работает',
  store.updateProfile({ name: 'Алексей К.', phone: '+7 900 555-01-02' }).ok
);
check('имя сохранилось', store.currentUser().name === 'Алексей К.');
check('телефон сохранился', store.currentUser().phone === '+7 900 555-01-02');
check(
  'плохой телефон в профиле отклоняется',
  !store.updateProfile({ name: 'Алексей К.', phone: 'abc' }).ok
);

console.log('--- Дэшборд: безопасность ---');
check(
  'неверный текущий пароль отклоняется',
  !store.changePassword({ current: 'nope', next: 'NewPass123', repeat: 'NewPass123' }).ok
);
check(
  'несовпадение повтора отклоняется',
  !store.changePassword({ current: USER.password, next: 'NewPass123', repeat: 'NewPass124' }).ok
);
check(
  'смена пароля работает',
  store.changePassword({ current: USER.password, next: 'NewPass123', repeat: 'NewPass123' }).ok
);
check('старый пароль больше не пускает', !store.login(USER.email, USER.password).ok);
store.logout();
check('после выхода сессии нет', store.currentUser() === null);
check('новый пароль работает', store.login(USER.email, 'NewPass123').ok);

console.log(`\nпройдено ${passed}/${plan.length} проверок`);
if (passed !== plan.length) process.exitCode = 1;

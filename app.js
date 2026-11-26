'use strict';
document.getElementById('year').textContent = new Date().getFullYear();
const quiz = document.getElementById('quiz');
const choices = document.getElementById('quiz-choices');
const result = document.getElementById('quiz-result');
function resetQuiz() { choices.hidden = false; result.hidden = true; }
document.getElementById('quiz-open').addEventListener('click', () => { resetQuiz(); quiz.showModal(); quiz.scrollTop = 0; });
document.querySelector('.close-dialog').addEventListener('click', () => quiz.close());
quiz.addEventListener('click', e => { if (e.target === quiz) { const box = quiz.getBoundingClientRect(); if(e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) quiz.close(); } });
const suggestions = {
  "standard": "PRO TRADING — СТАНДАРТ. 6 учебных модулей, обучение в группе до 30 человек. Видеоуроки, конспекты и учебные материалы в Telegram, домашние задания с проверкой в личном чате с куратором. В программу входят 3 групповые Zoom-встречи по расписанию. Продолжительность: 6 недель обучения и 2 недели поддержки. Сертификат после успешной сдачи итоговой работы. Стоимость 50 000 ₽.",
  "family": "Тариф „Вдвоём“.\n\nПрограмма PRO TRADING для тех, кто хочет пройти обучение вместе с другом, близким человеком или коллегой.\n\nВы проходите тот же курс, что и участники Стандарта: 6 учебных модулей, групповые Zoom-встречи, домашние задания и учебные материалы.\n\nПри совместной записи каждый получает скидку 20%. Стоимость обучения составляет 40 000 ₽ с человека, общая стоимость 80 000 ₽ за двоих.\n\nОбучение проходит в общей группе до 30 человек.",
  "vip": "PRO TRADING — ПРЕМИУМ. Индивидуальное обучение, 7 учебных модулей. Видеоуроки, конспекты и учебные материалы в Telegram, домашние задания с проверкой в личном чате. В программу входят 6 индивидуальных Zoom-встреч по согласованному расписанию. Продолжительность: 8 недель обучения и 2 недели практической торговли по стратегии MONEY TREND. Сертификат после успешной сдачи итоговой работы. Стоимость 100 000 ₽.",
  "start": "КРИПТОБИРЖА С НУЛЯ. Индивидуальная онлайн-встреча продолжительностью 2 часа. Вы познакомитесь с интерфейсом криптобиржи и настройками безопасности, научитесь покупать и продавать USDT через P2P, пополнять биржевой счёт и выводить криптовалюту на другие кошельки. Разберём отличия спотовой и фьючерсной торговли, работу торгового терминала, рыночные и лимитные ордера, установку тейк-профита и стоп-лосса, а также частичное закрытие позиции. Стоимость — 5 000 ₽.",
  "practice": "ТОРГОВЫЙ ПРАКТИКУМ. Для тех, кто уже знаком с основами технического анализа и хочет развивать навыки самостоятельной торговли. В закрытом Telegram-канале мы ежедневно анализируем рынок, разбираем торговые ситуации, обсуждаем точки входа и выхода, уделяем внимание риск-менеджменту и торговой дисциплине. Стоимость участия — 10 000 ₽ в месяц."
};
document.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => {
  const choice = button.dataset.choice;
  document.getElementById('quiz-result-copy').innerText = suggestions[choice];
  document.getElementById('quiz-course-link').setAttribute('href', '#' + choice);
  choices.hidden = true; result.hidden = false;
  document.getElementById('quiz-course-link').focus({ preventScroll: true });
  quiz.scrollTop = 0;
}));
document.getElementById('quiz-course-link').addEventListener('click', () => quiz.close());
document.getElementById('quiz-reset').addEventListener('click', () => { resetQuiz(); choices.querySelector('button').focus({ preventScroll: true }); quiz.scrollTop = 0; });
document.querySelectorAll('.enroll').forEach(link => { link.href = 'https://t.me/nl_nikilara?text=' + encodeURIComponent('Здравствуйте, Лариса! Хочу узнать подробнее: «' + link.dataset.course + '».'); });

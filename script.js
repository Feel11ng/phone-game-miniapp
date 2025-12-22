// static/script.js

// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;

tg.ready(); // Говорим Telegram, что приложение готово

// Пример изменения цвета статус-бара
tg.setBackgroundColor('#2a2a2a');
tg.setHeaderColor('#2a2a2a');

// Пример получения данных пользователя
const user = tg.initDataUnsafe?.user;
console.log('Данные пользователя:', user);

// --- Заглушка для получения данных от бота ---
// В реальности эти данные должны приходить от бота через Web App Data или отдельный API-эндпоинт
// Для начала просто симулируем

function simulateGetUserData() {
    // Это будет заменено на реальный вызов API
    return {
        signals: 150,
        inventory: [
            { name: "Samsung Galaxy A01", image: "images/phones/galaxy_a01.jpg", rarity: "Common" },
            { name: "iPhone 15 Pro Max", image: "images/phones/iphone_15_pro_max.jpg", rarity: "Legendary" }
        ]
    };
}

// --- Загрузка данных при открытии ---
document.addEventListener('DOMContentLoaded', function() {
    const userData = simulateGetUserData();

    document.getElementById('signals-count').textContent = userData.signals;

    const inventoryList = document.getElementById('inventory-list');
    const loadingText = document.getElementById('inventory-loading');

    if (userData.inventory.length > 0) {
        loadingText.style.display = 'none';
        userData.inventory.forEach(phone => {
            const card = document.createElement('div');
            card.className = 'phone-card';
            card.innerHTML = `
                <img src="${phone.image}" alt="${phone.name}">
                <p>${phone.name}</p>
                <small>${phone.rarity}</small>
            `;
            inventoryList.appendChild(card);
        });
    } else {
        loadingText.textContent = 'У вас пока нет телефонов.';
    }

    // --- Обработка открытия кейса ---
    document.getElementById('open-case-btn').addEventListener('click', function() {
        // Проверка баланса (симуляция)
        if (userData.signals >= 50) {
            // Здесь должна быть логика запроса к боту для открытия кейса
            // Пока симулируем успешное открытие
            setTimeout(() => {
                const resultDiv = document.getElementById('case-result');
                const resultImg = document.getElementById('result-phone-img');
                const resultName = document.getElementById('result-phone-name');

                // Симуляция полученного телефона
                const newPhone = { name: "Google Pixel 8 Pro", image: "images/phones/pixel_8_pro.jpg" };

                resultImg.src = newPhone.image;
                resultName.textContent = newPhone.name;
                resultDiv.style.display = 'block';

                // Обновление баланса (симуляция)
                userData.signals -= 50;
                document.getElementById('signals-count').textContent = userData.signals;

                // Прокрутка к результату
                resultDiv.scrollIntoView({ behavior: 'smooth' });

            }, 1000); // Задержка для эффекта "открытия"
        } else {
            alert('Недостаточно Сигналов!');
        }
    });
});
// script.js

// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;

tg.ready(); // Говорим Telegram, что приложение готово

// Пример изменения цвета статус-бара
tg.setBackgroundColor('#1a1a2e');
tg.setHeaderColor('#1a1a2e');

// Пример получения данных пользователя
const user = tg.initDataUnsafe?.user;
console.log('Данные пользователя:', user);

// --- Заглушка для получения данных от бота ---
function simulateGetUserData() {
    return {
        signals: 100,
        inventory: [
            { name: "Samsung Galaxy A01", image: "images/phones/galaxy_a01.jpg", rarity: "Common" },
            { name: "iPhone 15 Pro Max", image: "images/phones/iphone_15_pro_max.jpg", rarity: "Legendary" }
        ]
    };
}

// --- Функции для работы с интерфейсом ---
document.addEventListener('DOMContentLoaded', function() {
    const userData = simulateGetUserData();
    updateBalance(userData.signals);

    // Инициализация вкладок
    initTabs();

    // Инициализация коллекции
    renderInventory(userData.inventory);

    // Инициализация кейсов
    initCaseButtons();

    // Инициализация рынка
    initMarketItems();
});

function updateBalance(signals) {
    document.getElementById('signals-count').textContent = signals;
}

function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Удалить активный класс со всех кнопок и контента
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Добавить активный класс к выбранной кнопке и контенту
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

function renderInventory(inventory) {
    const inventoryList = document.getElementById('inventory-list');
    const loadingText = document.getElementById('inventory-loading');

    if (inventory.length > 0) {
        loadingText.style.display = 'none';
        inventoryList.innerHTML = ''; // Очистить

        inventory.forEach(phone => {
            const card = document.createElement('div');
            card.className = 'phone-card';
            card.innerHTML = `
                <img src="${phone.image}" alt="${phone.name}">
                <div class="info">
                    <div class="name">${phone.name}</div>
                    <div class="rarity ${getRarityClass(phone.rarity)}">${phone.rarity}</div>
                </div>
            `;
            inventoryList.appendChild(card);
        });
    } else {
        loadingText.textContent = 'У вас пока нет телефонов.';
    }
}

function getRarityClass(rarity) {
    switch(rarity) {
        case 'Common': return 'rarity-common';
        case 'Rare': return 'rarity-rare';
        case 'Epic': return 'rarity-epic';
        case 'Legendary': return 'rarity-legendary';
        default: return '';
    }
}

function initCaseButtons() {
    const caseCards = document.querySelectorAll('.case-card');
    const caseResult = document.getElementById('case-result');
    const closeResultBtn = document.getElementById('close-result-btn');
    const resultImg = document.getElementById('result-phone-img');
    const resultName = document.getElementById('result-phone-name');
    const resultRarity = document.getElementById('result-rarity');

    caseCards.forEach(card => {
        card.addEventListener('click', async () => {
            const caseType = card.getAttribute('data-case');
            const cost = getCaseCost(caseType);
            const signals = parseInt(document.getElementById('signals-count').textContent);

            if (signals >= cost) {
                // Показать рулетку
                showRoulette(caseType);

                // Симуляция открытия
                setTimeout(() => {
                    const newPhone = getRandomPhone(caseType);
                    resultImg.src = newPhone.image;
                    resultName.textContent = newPhone.name;
                    resultRarity.textContent = newPhone.rarity;
                    resultRarity.className = `rarity ${getRarityClass(newPhone.rarity)}`;

                    // Обновление баланса
                    const newSignals = signals - cost;
                    updateBalance(newSignals);

                    // Показать результат
                    caseResult.classList.remove('hidden');
                    playCelebrationSound();
                }, 5000); // Задержка 5 секунд для анимации
            } else {
                alert('Недостаточно Сигналов!');
            }
        });
    });

    closeResultBtn.addEventListener('click', () => {
        caseResult.classList.add('hidden');
    });
}

function getCaseCost(caseType) {
    switch(caseType) {
        case 'basic': return 50;
        case 'epic': return 200;
        case 'legendary': return 500;
        default: return 50;
    }
}

function getRandomPhone(caseType) {
    const phones = {
        basic: [
            { name: "Samsung Galaxy A01", image: "images/phones/galaxy_a01.jpg", rarity: "Common" },
            { name: "Xiaomi Redmi Note 13", image: "images/phones/redmi_note_13.jpg", rarity: "Common" }
        ],
        epic: [
            { name: "Google Pixel 8 Pro", image: "images/phones/pixel_8_pro.jpg", rarity: "Epic" },
            { name: "OnePlus 12", image: "images/phones/oneplus_12.jpg", rarity: "Epic" }
        ],
        legendary: [
            { name: "iPhone 16 Pro Max", image: "images/phones/iphone_16_pro_max.jpg", rarity: "Legendary" },
            { name: "Samsung Galaxy S24 Ultra", image: "images/phones/samsung_s24_ultra.jpg", rarity: "Legendary" }
        ]
    };

    const phoneList = phones[caseType] || phones.basic;
    const randomIndex = Math.floor(Math.random() * phoneList.length);
    return phoneList[randomIndex];
}

function showRoulette(caseType) {
    const roulette = document.getElementById('case-roulette');
    const rouletteWheel = document.getElementById('roulette-wheel');
    const startBtn = document.getElementById('start-roulette-btn');
    const closeBtn = document.getElementById('close-roulette-btn');

    // Очистить рулетку
    rouletteWheel.innerHTML = '';

    // Создать список телефонов для рулетки
    const phones = getPhonesForRoulette(caseType);
    for (let i = 0; i < 20; i++) { // Создать 20 элементов для плавности
        const phone = phones[Math.floor(Math.random() * phones.length)];
        const item = document.createElement('div');
        item.className = 'roulette-item';
        item.innerHTML = `<img src="${phone.image}" alt="${phone.name}">`;
        rouletteWheel.appendChild(item);
    }

    // Показать рулетку
    roulette.classList.remove('hidden');

    // Анимация прокрутки
    let scrollPosition = 0;
    const wheelWidth = rouletteWheel.scrollWidth;
    const containerWidth = rouletteWheel.parentElement.clientWidth;

    const animate = () => {
        scrollPosition += 50; // Скорость прокрутки
        if (scrollPosition > wheelWidth - containerWidth) {
            scrollPosition = 0;
        }
        rouletteWheel.style.transform = `translateX(-${scrollPosition}px)`;

        if (scrollPosition > wheelWidth / 2) {
            // Замедлить анимацию
            scrollPosition += 10;
            if (scrollPosition > wheelWidth - containerWidth) {
                scrollPosition = 0;
            }
            rouletteWheel.style.transform = `translateX(-${scrollPosition}px)`;

            // Остановиться на случайном телефоне
            setTimeout(() => {
                const randomIndex = Math.floor(Math.random() * phones.length);
                const selectedPhone = phones[randomIndex];
                // Здесь можно добавить логику выбора телефона
                // Для простоты просто показываем результат
                roulette.classList.add('hidden');
            }, 2000);
        }

        requestAnimationFrame(animate);
    };

    // Запустить анимацию
    animate();

    // Обработчики кнопок
    startBtn.addEventListener('click', () => {
        // Можно запустить новую анимацию
        console.log('Запуск рулетки...');
    });

    closeBtn.addEventListener('click', () => {
        roulette.classList.add('hidden');
    });
}

function getPhonesForRoulette(caseType) {
    const phones = {
        basic: [
            { name: "Samsung Galaxy A01", image: "images/phones/galaxy_a01.jpg", rarity: "Common" },
            { name: "Xiaomi Redmi Note 13", image: "images/phones/redmi_note_13.jpg", rarity: "Common" }
        ],
        epic: [
            { name: "Google Pixel 8 Pro", image: "images/phones/pixel_8_pro.jpg", rarity: "Epic" },
            { name: "OnePlus 12", image: "images/phones/oneplus_12.jpg", rarity: "Epic" }
        ],
        legendary: [
            { name: "iPhone 16 Pro Max", image: "images/phones/iphone_16_pro_max.jpg", rarity: "Legendary" },
            { name: "Samsung Galaxy S24 Ultra", image: "images/phones/samsung_s24_ultra.jpg", rarity: "Legendary" }
        ]
    };

    return phones[caseType] || phones.basic;
}

function playCelebrationSound() {
    // Можно добавить звуковое сопровождение
    // Например, с помощью Audio API
    // const audio = new Audio('sound/celebration.mp3');
    // audio.play().catch(e => console.log('Не удалось воспроизвести звук:', e));
}

function initMarketItems() {
    // В реальности здесь будет загрузка данных с сервера
    // Пока оставим заглушку
    const marketItems = document.querySelectorAll('.market-item button');
    marketItems.forEach(button => {
        button.addEventListener('click', () => {
            alert('Покупка не реализована в этой версии.');
        });
    });
}

// static/script.js

// Инициализация Telegram Web App
const tg = window.Telegram?.WebApp;

// Состояние приложения
const state = {
    user: {
        id: null,
        firstName: 'Игрок',
        username: 'player',
        photoUrl: null,
        signals: 1000,
        inventory: [],
        lastActivity: []
    },
    currentPage: 'home',
    cases: [
        {
            id: 1,
            name: 'Базовый кейс',
            price: 50,
            image: 'https://via.placeholder.com/200',
            items: [
                { name: 'Samsung Galaxy A01', rarity: 'common', chance: 0.7 },
                { name: 'Xiaomi Redmi Note 10', rarity: 'uncommon', chance: 0.2 },
                { name: 'Google Pixel 8 Pro', rarity: 'rare', chance: 0.08 },
                { name: 'iPhone 15 Pro Max', rarity: 'legendary', chance: 0.02 }
            ]
        },
        {
            id: 2,
            name: 'Премиум кейс',
            price: 200,
            image: 'https://via.placeholder.com/200/6c5ce7',
            items: [
                { name: 'Samsung Galaxy S23', rarity: 'uncommon', chance: 0.5 },
                { name: 'Google Pixel 8 Pro', rarity: 'rare', chance: 0.3 },
                { name: 'iPhone 15 Pro Max', rarity: 'legendary', chance: 0.15 },
                { name: 'Золотой iPhone 15 Pro Max', rarity: 'mythical', chance: 0.05 }
            ]
        }
    ],
    marketItems: []
};

// DOM элементы
const elements = {
    // Шапка
    balanceElement: document.getElementById('signals-count'),
    userAvatar: document.getElementById('user-avatar'),
    
    // Основной контент
    mainContent: document.getElementById('main-content'),
    
    // Навигация
    navItems: document.querySelectorAll('.nav-item'),
    
    // Страницы
    pages: {
        home: document.getElementById('home-section'),
        inventory: document.getElementById('inventory-section'),
        cases: document.getElementById('cases-section'),
        market: document.getElementById('market-section'),
        profile: document.getElementById('profile-section')
    },
    
    // Элементы профиля
    profileUsername: document.getElementById('username'),
    profileAvatar: document.getElementById('profile-avatar'),
    totalPhones: document.getElementById('total-phones'),
    totalCases: document.getElementById('total-cases'),
    totalSales: document.getElementById('total-sales'),
    
    // Уведомления
    notification: document.getElementById('notification')
};

// Утилиты
const utils = {
    // Форматирование чисел с разделителями
    formatNumber: (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '),
    
    // Генерация случайного числа в диапазоне
    randomInRange: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    
    // Выбор случайного элемента с учетом вероятностей
    weightedRandom: (items) => {
        let total = items.reduce((sum, item) => sum + item.chance, 0);
        const random = Math.random() * total;
        let current = 0;
        
        for (const item of items) {
            current += item.chance;
            if (random <= current) return item;
        }
        
        return items[items.length - 1];
    },
    
    // Показать уведомление
    showNotification: (message, type = 'info', duration = 3000) => {
        const notification = elements.notification;
        notification.textContent = message;
        notification.className = `notification show ${type}`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, duration);
    },
    
    // Анимация появления элемента
    fadeIn: (element, duration = 300) => {
        element.style.opacity = 0;
        element.style.display = 'block';
        let start = null;
        
        const step = (timestamp) => {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            const opacity = Math.min(progress / duration, 1);
            element.style.opacity = opacity;
            
            if (progress < duration) {
                window.requestAnimationFrame(step);
            }
        };
        
        window.requestAnimationFrame(step);
    },
    
    // Создание элемента с атрибутами
    createElement: (tag, attributes = {}, children = []) => {
        const element = document.createElement(tag);
        
        for (const [key, value] of Object.entries(attributes)) {
            if (key === 'text') {
                element.textContent = value;
            } else if (key === 'html') {
                element.innerHTML = value;
            } else if (key === 'class') {
                element.className = value;
            } else if (key === 'style') {
                Object.assign(element.style, value);
            } else {
                element.setAttribute(key, value);
            }
        }
        
        if (Array.isArray(children)) {
            children.forEach(child => {
                if (child instanceof Node) {
                    element.appendChild(child);
                } else if (typeof child === 'string') {
                    element.appendChild(document.createTextNode(child));
                }
            });
        }
        
        return element;
    }
};

// Обработчики событий
const eventHandlers = {
    // Переключение между страницами
    handleNavigation: (e) => {
        e.preventDefault();
        const targetSection = e.currentTarget.dataset.section;
        
        // Обновляем активный пункт меню
        elements.navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.section === targetSection);
        });
        
        // Показываем выбранную страницу
        Object.entries(elements.pages).forEach(([id, element]) => {
            element.classList.toggle('active', id === targetSection);
        });
        
        // Обновляем состояние
        state.currentPage = targetSection;
        
        // Загружаем данные для страницы, если нужно
        if (targetSection === 'inventory') {
            loadInventory();
        } else if (targetSection === 'market') {
            loadMarket();
        }
    },
    
    // Открытие кейса
    handleOpenCase: async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const button = e.currentTarget;
        const caseId = parseInt(button.dataset.caseId);
        const caseData = state.cases.find(c => c.id === caseId);
        
        console.log('Попытка открыть кейс:', caseId, caseData);
        
        if (!caseData) {
            console.error('Кейс не найден:', caseId);
            utils.showNotification('Ошибка: кейс не найден', 'error');
            return;
        }
        
        // Проверяем баланс
        if (state.user.signals < caseData.price) {
            utils.showNotification(`Недостаточно Сигналов! Нужно ${caseData.price}`, 'error');
            return;
        }
        
        // Показываем анимацию загрузки
        const originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<div class="spinner"></div>';
        
        try {
            console.log('Начинаем открытие кейса...');
            
            // Имитация задержки открытия кейса
            await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
            
            // Выбираем случайный приз с учетом вероятностей
            const prize = utils.weightedRandom(caseData.items);
            console.log('Выпал приз:', prize);
            
            if (!prize) {
                throw new Error('Не удалось определить приз');
            }
            
            // Создаем объект приза
            const newPhone = {
                id: Date.now(),
                name: prize.name,
                rarity: prize.rarity,
                image: `https://via.placeholder.com/300?text=${encodeURIComponent(prize.name)}`,
                receivedAt: new Date().toISOString()
            };
            
            // Добавляем приз в инвентарь
            state.user.inventory.push(newPhone);
            
            // Обновляем баланс
            state.user.signals -= caseData.price;
            
            // Обновляем интерфейс
            updateUI();
            
            // Показываем анимацию выигрыша
            const modal = document.querySelector('.case-result-modal');
            if (modal) {
                const prizeImage = modal.querySelector('#result-phone-img');
                const prizeName = modal.querySelector('#result-phone-name');
                const prizeRarity = modal.querySelector('.prize-rarity');
                
                if (prizeImage) prizeImage.src = newPhone.image;
                if (prizeImage) prizeImage.alt = newPhone.name;
                if (prizeName) prizeName.textContent = newPhone.name;
                if (prizeRarity) {
                    prizeRarity.textContent = getRarityName(newPhone.rarity);
                    prizeRarity.className = `prize-rarity rarity-${newPhone.rarity}`;
                }
                
                // Показываем модальное окно
                modal.classList.add('active');
                
                // Добавляем анимацию конфетти
                const confettiContainer = modal.querySelector('.prize-animation');
                if (confettiContainer) {
                    createConfetti(confettiContainer);
                }
                
                // Закрытие по клику вне контента
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.classList.remove('active');
                    }
                });
            }
            
            // Добавляем запись в историю
            ui.addActivity(`Открыт кейс "${caseData.name}" и получен ${prize.name}`);
            
            console.log('Кейс успешно открыт, получен приз:', newPhone);
            
        } catch (error) {
            console.error('Ошибка при открытии кейса:', error);
            utils.showNotification('Произошла ошибка при открытии кейса', 'error');
        } finally {
            button.disabled = false;
            button.innerHTML = originalText;
        }
    },
    
    // Показ уведомления при наведении на элемент
    handleTooltip: (e) => {
        const tooltip = e.currentTarget.dataset.tooltip;
        if (tooltip) {
            // Показываем всплывающую подсказку
            console.log('Показать подсказку:', tooltip);
        }
    }
};

// Функции для работы с интерфейсом
const ui = {
    // Инициализация интерфейса
    init: () => {
        // Загружаем данные пользователя
        loadUserData();
        
        // Инициализируем навигацию
        elements.navItems.forEach(item => {
            item.addEventListener('click', eventHandlers.handleNavigation);
        });
        
        // Инициализируем быстрые действия на главной
        const quickActions = document.querySelectorAll('.action-card');
        quickActions.forEach(action => {
            action.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                const navItem = document.querySelector(`.nav-item[data-section="${section}"]`);
                if (navItem) navItem.click();
            });
        });
        
        // Инициализируем кнопки модального окна
        const closeModal = document.querySelector('.close-modal');
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                document.querySelector('.modal').classList.remove('active');
            });
        }
        
        // Инициализируем кнопки профиля
        const profileButtons = {
            'settings-btn': () => utils.showNotification('Настройки скоро будут доступны', 'info'),
            'help-btn': () => utils.showNotification('Обратитесь в поддержку для помощи', 'info'),
            'logout-btn': () => {
                if (confirm('Вы уверены, что хотите выйти?')) {
                    // В реальном приложении здесь был бы выход из аккаунта
                    utils.showNotification('Выход выполнен', 'success');
                }
            }
        };
        
        Object.entries(profileButtons).forEach(([id, handler]) => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', handler);
            }
        });
        
        // Загружаем начальные данные
        loadHomePage();
        loadCases();
        loadInventory(); // Загружаем инвентарь при инициализации
    },
    
    // Обновление баланса
    updateBalance: () => {
        elements.balanceElement.textContent = utils.formatNumber(state.user.signals);
    },
    
    // Загрузка главной страницы
    loadHomePage: () => {
        // Загружаем последние действия
        const activityList = document.getElementById('activity-feed');
        activityList.innerHTML = '';
        
        const activities = [
            'Добро пожаловать в Phone Tycoon!',
            'Попробуйте открыть кейс',
            'Проверьте свой инвентарь'
        ];
        
        activities.forEach(activity => {
            const item = utils.createElement('div', { class: 'activity-item' }, [activity]);
            activityList.appendChild(item);
        });
    },
    
    // Загрузка кейсов
    loadCases: () => {
        const casesContainer = document.querySelector('.cases-grid');
        if (!casesContainer) return;
        
        casesContainer.innerHTML = '';
        
        state.cases.forEach(caseItem => {
            const caseElement = utils.createElement('div', { class: 'case-card' }, [
                utils.createElement('div', { class: 'case-image' }, [
                    utils.createElement('img', { src: caseItem.image, alt: caseItem.name })
                ]),
                utils.createElement('div', { class: 'case-info' }, [
                    utils.createElement('h3', { text: caseItem.name }),
                    utils.createElement('div', { class: 'case-price' }, [
                        utils.createElement('i', { class: 'fas fa-bolt' }),
                        ` ${caseItem.price} Сигналов`
                    ]),
                    utils.createElement('button', { 
                        class: 'btn open-case-btn',
                        'data-case-id': caseItem.id
                    }, 'Открыть кейс')
                ])
            ]);
            
            // Добавляем обработчик открытия кейса
            const openButton = caseElement.querySelector('.open-case-btn');
            if (openButton) {
                openButton.addEventListener('click', eventHandlers.handleOpenCase);
            }
            
            casesContainer.appendChild(caseElement);
        });
    },
    
    // Загрузка инвентаря
    loadInventory: () => {
        console.log('Загрузка инвентаря...');
        const inventoryList = document.getElementById('inventory-list');
        if (!inventoryList) {
            console.error('Элемент инвентаря не найден');
            return;
        }
        
        // Показываем индикатор загрузки
        inventoryList.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Загрузка коллекции...</p>
            </div>
        `;
        
        // В реальном приложении здесь был бы запрос к API
        // Пока используем тестовые данные
        const testInventory = [
            { id: 1, name: 'Samsung Galaxy A01', rarity: 'common', image: 'https://via.placeholder.com/150?text=Samsung+A01' },
            { id: 2, name: 'iPhone 15 Pro Max', rarity: 'legendary', image: 'https://via.placeholder.com/150?text=iPhone+15+Pro+Max' },
            { id: 3, name: 'Xiaomi Redmi Note 10', rarity: 'uncommon', image: 'https://via.placeholder.com/150?text=Xiaomi+Note+10' },
            { id: 4, name: 'Google Pixel 8 Pro', rarity: 'rare', image: 'https://via.placeholder.com/150?text=Pixel+8+Pro' }
        ];
        
        // Имитируем загрузку данных
        setTimeout(() => {
            try {
                console.log('Данные инвентаря загружены');
                
                if (testInventory.length === 0) {
                    inventoryList.innerHTML = `
                        <div class="empty-state">
                            <p>Ваш инвентарь пуст</p>
                            <p>Откройте кейсы, чтобы получить телефоны</p>
                        </div>
                    `;
                    return;
                }
                
                // Создаем сетку для телефонов
                const grid = document.createElement('div');
                grid.className = 'phone-grid';
                
                testInventory.forEach(phone => {
                    const phoneElement = document.createElement('div');
                    phoneElement.className = 'phone-card';
                    phoneElement.dataset.phoneId = phone.id;
                    
                    phoneElement.innerHTML = `
                        <div class="phone-image">
                            <img src="${phone.image}" alt="${phone.name}" loading="lazy">
                        </div>
                        <div class="phone-info">
                            <div class="phone-name">${phone.name}</div>
                            <div class="phone-rarity rarity-${phone.rarity}">${getRarityName(phone.rarity)}</div>
                        </div>
                    `;
                    
                    grid.appendChild(phoneElement);
                });
                
                // Заменяем содержимое инвентаря
                inventoryList.innerHTML = '';
                inventoryList.appendChild(grid);
                
                console.log('Инвентарь успешно отображен');
                
            } catch (error) {
                console.error('Ошибка при загрузке инвентаря:', error);
                inventoryList.innerHTML = `
                    <div class="error-state">
                        <p>Произошла ошибка при загрузке инвентаря</p>
                        <button class="btn btn-secondary" id="retry-loading">Попробовать снова</button>
                    </div>
                `;
            }
        }, 800); // Уменьшаем задержку для тестирования
    },
    
    // Загрузка рынка
    loadMarket: () => {
        // Заглушка для загрузки рынка
        const marketItems = document.getElementById('market-items');
        if (!marketItems) return;
        
        marketItems.innerHTML = `
            <div class="empty-state">
                <p>Рынок скоро откроется</p>
                <p>Здесь вы сможете покупать и продавать телефоны</p>
            </div>
        `;
    },
    
    // Показ анимации выигрыша
    showPrizeAnimation: (prize) => {
        const modal = document.querySelector('.case-result-modal');
        if (!modal) return;
        
        // Обновляем данные в модальном окне
        const prizeImage = modal.querySelector('#result-phone-img');
        const prizeName = modal.querySelector('#result-phone-name');
        const prizeRarity = modal.querySelector('.prize-rarity');
        
        prizeImage.src = `https://via.placeholder.com/300?text=${encodeURIComponent(prize.name)}`;
        prizeImage.alt = prize.name;
        prizeName.textContent = prize.name;
        prizeRarity.textContent = getRarityName(prize.rarity);
        prizeRarity.className = `prize-rarity rarity-${prize.rarity}`;
        
        // Показываем модальное окно
        modal.classList.add('active');
        
        // Создаем конфетти
        createConfetti(modal.querySelector('.prize-animation'));
        
        // Закрытие по клику вне контента
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
        
        // Кнопка закрытия
        const closeButton = modal.querySelector('.close-modal, #close-result');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                modal.classList.remove('active');
            });
        }
    },
    
    // Добавление активности в ленту
    addActivity: (text) => {
        const activityList = document.getElementById('activity-feed');
        if (!activityList) return;
        
        const activity = utils.createElement('div', { 
            class: 'activity-item',
            style: { animation: 'slideIn 0.3s ease-out' }
        }, [text]);
        
        activityList.insertBefore(activity, activityList.firstChild);
        
        // Ограничиваем количество записей
        while (activityList.children.length > 10) {
            activityList.removeChild(activityList.lastChild);
        }
    }
};

// Вспомогательные функции
function getRarityName(rarity) {
    const names = {
        'common': 'Обычный',
        'uncommon': 'Необычный',
        'rare': 'Редкий',
        'epic': 'Эпический',
        'legendary': 'Легендарный',
        'mythical': 'Мифический'
    };
    return names[rarity] || rarity;
}

function createConfetti(container) {
    // Очищаем предыдущие конфетти
    container.querySelectorAll('.confetti').forEach(el => el.remove());
    
    // Создаем новые конфетти
    const colors = ['#fdcb6e', '#ff7675', '#6c5ce7', '#00b894', '#0984e3'];
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        
        // Случайные параметры
        const size = utils.randomInRange(5, 10);
        const color = colors[utils.randomInRange(0, colors.length - 1)];
        const left = utils.randomInRange(0, 100);
        const delay = utils.randomInRange(0, 2000);
        const duration = utils.randomInRange(2000, 5000);
        
        // Применяем стили
        Object.assign(confetti.style, {
            width: `${size}px`,
            height: `${size}px`,
            backgroundColor: color,
            left: `${left}%`,
            animation: `confetti ${duration}ms ease-out ${delay}ms 1`,
            opacity: '0.8',
            position: 'absolute',
            zIndex: '1'
        });
        
        // Добавляем в контейнер
        container.appendChild(confetti);
        
        // Удаляем после анимации
        setTimeout(() => {
            confetti.remove();
        }, duration + delay);
    }
}

// Загрузка данных пользователя
async function loadUserData() {
    try {
        // В реальном приложении здесь был бы запрос к API
        // const response = await fetch('/api/user');
        // const data = await response.json();
        
        // Имитация загрузки данных
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Обновляем состояние
        if (tg?.initDataUnsafe?.user) {
            const tgUser = tg.initDataUnsafe.user;
            state.user.id = tgUser.id;
            state.user.firstName = tgUser.first_name || 'Игрок';
            state.user.username = tgUser.username || 'player';
            state.user.photoUrl = tgUser.photo_url;
        }
        
        // Обновляем интерфейс
        updateUI();
        
    } catch (error) {
        console.error('Ошибка при загрузке данных пользователя:', error);
        utils.showNotification('Не удалось загрузить данные', 'error');
    }
}

// Обновление интерфейса на основе состояния
function updateUI() {
    try {
        // Обновляем баланс
        ui.updateBalance();
        
        // Обновляем профиль
        if (elements.profileUsername) {
            elements.profileUsername.textContent = state.user.firstName;
            elements.totalPhones.textContent = state.user.inventory.length;
            // Добавляем счетчик открытых кейсов
            elements.totalCases.textContent = state.user.inventory.length > 0 ? state.user.inventory.length : '0';
            elements.totalSales.textContent = '0'; // Можно добавить историю продаж
        }
        
        // Обновляем аватар
        const avatarElements = [elements.userAvatar, elements.profileAvatar].filter(Boolean);
        avatarElements.forEach(avatar => {
            if (!avatar) return;
            
            if (state.user.photoUrl) {
                avatar.style.backgroundImage = `url(${state.user.photoUrl})`;
                avatar.innerHTML = '';
            } else {
                avatar.textContent = state.user.firstName ? state.user.firstName[0].toUpperCase() : 'U';
            }
        });
        
        // Обновляем отображение баланса в шапке
        if (elements.balanceElement) {
            elements.balanceElement.textContent = utils.formatNumber(state.user.signals);
        }
        
    } catch (error) {
        console.error('Ошибка при обновлении интерфейса:', error);
    }
}

// Функция для делегирования событий
function setupEventDelegation() {
    // Обработка кликов по кнопкам открытия кейсов
    document.addEventListener('click', (e) => {
        const openCaseBtn = e.target.closest('.open-case-btn');
        if (openCaseBtn) {
            eventHandlers.handleOpenCase(e);
            return;
        }

        // Обработка кликов по кнопкам навигации
        const navItem = e.target.closest('.nav-item');
        if (navItem) {
            e.preventDefault();
            const section = navItem.dataset.section;
            if (section) {
                // Обновляем активный пункт меню
                document.querySelectorAll('.nav-item').forEach(item => {
                    item.classList.toggle('active', item === navItem);
                });

                // Показываем выбранную страницу
                Object.entries(elements.pages).forEach(([id, element]) => {
                    if (element) {
                        element.classList.toggle('active', id === section);
                    }
                });

                // Обновляем состояние
                state.currentPage = section;

                // Загружаем данные для страницы
                if (section === 'inventory') {
                    ui.loadInventory();
                } else if (section === 'market') {
                    ui.loadMarket();
                } else if (section === 'cases') {
                    ui.loadCases();
                } else if (section === 'profile') {
                    ui.loadProfile();
                }
            }
        }
    });

    // Обработка кнопок профиля
    document.addEventListener('click', (e) => {
        const settingsBtn = e.target.closest('#settings-btn');
        const helpBtn = e.target.closest('#help-btn');
        const logoutBtn = e.target.closest('#logout-btn');
        const closeModalBtn = e.target.closest('.close-modal');
        const retryBtn = e.target.closest('#retry-loading');

        if (settingsBtn) {
            utils.showNotification('Настройки скоро будут доступны', 'info');
        } else if (helpBtn) {
            utils.showNotification('Обратитесь в поддержку для помощи', 'info');
        } else if (logoutBtn) {
            if (confirm('Вы уверены, что хотите выйти?')) {
                utils.showNotification('Выход выполнен', 'success');
            }
        } else if (closeModalBtn) {
            document.querySelector('.modal.active')?.classList.remove('active');
        } else if (retryBtn) {
            ui.loadInventory();
        }
    });
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Инициализируем делегирование событий
    setupEventDelegation();
    
    // Загружаем данные пользователя
    loadUserData();
    
    // Показываем главную страницу
    document.querySelector('.nav-item[data-section="home"]')?.classList.add('active');
    document.getElementById('home-section')?.classList.add('active');
    
    // Загружаем начальные данные
    ui.loadHomePage();
    
    // Инициализируем Telegram Web App
    if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        
        // Обработка кнопки "Назад"
        tg.BackButton.onClick(() => {
            if (state.currentPage !== 'home') {
                // Возвращаемся на главную
                const homeButton = document.querySelector('.nav-item[data-section="home"]');
                if (homeButton) homeButton.click();
            } else {
                tg.close();
            }
        });
        
        // Обновляем кнопку "Назад" при изменении страницы
        const updateBackButton = () => {
            if (state.currentPage !== 'home') {
                tg.BackButton.show();
            } else {
                tg.BackButton.hide();
            }
        };
        
        // Следим за изменением страниц
        const observer = new MutationObserver(updateBackButton);
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            observer.observe(mainContent, { 
                childList: true, 
                subtree: true,
                attributes: true,
                attributeFilter: ['class']
            });
        }
        
        updateBackButton();
    }
});

// Экспортируем объекты для отладки
window.appState = state;
window.ui = ui;

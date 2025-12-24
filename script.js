// static/script.js

// Импорт утилит
import { apiService } from './api.js';
import AnimationManager from './animations.js';

// Глобальные переменные
let tg;

// Инициализация Telegram WebApp
function initTelegramWebApp() {
    if (window.Telegram && window.Telegram.WebApp) {
        tg = window.Telegram.WebApp;
        tg.expand();
        tg.enableClosingConfirmation();
        return true;
    }
    return false;
}

function handleTopupBalance() {
    utils.showNotification('Пополнение баланса пока не доступно', 'info');
}

function renderInventory(inventory = []) {
    const container = document.getElementById('inventory-list');
    if (!container) return;

    container.innerHTML = '';
    if (!inventory.length) {
        container.innerHTML = `
            <div class="empty-state">
                <p>Инвентарь пуст</p>
                <p>Откройте кейсы, чтобы получить телефоны</p>
            </div>
        `;
        return;
    }

    inventory.forEach(item => {
        const card = utils.createElement('div', { class: 'phone-card rarity-' + (item.rarity || 'common') }, [
            utils.createElement('div', { class: 'phone-icon' }, [
                utils.createElement('img', { src: item.image || '/static/images/placeholder-phone.png', alt: item.name })
            ]),
            utils.createElement('div', { class: 'phone-info' }, [
                utils.createElement('h4', { text: item.name }),
                utils.createElement('p', { text: getRarityName(item.rarity || 'common') })
            ])
        ]);
        container.appendChild(card);
    });
}

// Using utils.showNotification instead of duplicate function

/**
 * Основное состояние приложения
 * @type {Object}
 */
const state = {
    user: {
        id: null,
        firstName: 'Гость',
        username: 'guest',
        photoUrl: null,
        signals: 0,
        inventory: []
    },
    isLoading: false,
    currentPage: 'home',
    cases: []
};

/**
 * Основные элементы интерфейса
 * @type {Object}
 */
const elements = {};

/**
 * Глобальные настройки приложения
 * @type {Object}
 */
const settings = {
    ANIMATION_DURATION: 300, // ms
    TRANSITION_DELAY: 100, // ms
    API_TIMEOUT: 10000 // ms
};

// Telegram WebApp is already initialized in initTelegramWebApp()
// Remove duplicate declaration

/**
 * Утилиты приложения
 * @type {Object}
 */
const utils = {
    /**
     * Форматирует число с разделителями разрядов
     * @param {number} num - Число для форматирования
     * @returns {string} Отформатированная строка
     */
    formatNumber: (num) => {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    },
    
    /**
     * Показывает уведомление
     * @param {string} message - Текст уведомления
     * @param {string} [type='info'] - Тип уведомления (info, success, error)
     */
    showNotification: (message, type = 'info') => {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Автоматическое скрытие уведомления
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    },
    
    /**
     * Создает эффект конфетти
     * @param {HTMLElement} container - Контейнер для конфетти
     */
    createConfetti: (container) => {
        if (!container) return;
        
        // Очищаем предыдущие конфетти
        container.innerHTML = '';
        
        // Создаем 50 конфетти
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            
            // Случайные цвета
            const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            
            // Случайные размеры и позиции
            const size = Math.random() * 10 + 5;
            const posX = Math.random() * 100;
            const animationDuration = Math.random() * 3 + 2;
            
            // Применяем стили
            Object.assign(confetti.style, {
                position: 'absolute',
                width: `${size}px`,
                height: `${size}px`,
                backgroundColor: randomColor,
                left: `${posX}%`,
                top: '-20px',
                borderRadius: '50%',
                animation: `fall ${animationDuration}s linear forwards`,
                zIndex: 1000
            });
            
            // Добавляем анимацию падения
            const keyframes = `
                @keyframes fall {
                    to {
                        transform: translateY(calc(100vh + 20px));
                        opacity: 0;
                    }
                }
            `;
            
            // Добавляем стили анимации
            const style = document.createElement('style');
            style.type = 'text/css';
            style.appendChild(document.createTextNode(keyframes));
            document.head.appendChild(style);
            
            container.appendChild(confetti);
            
            // Удаляем конфетти после анимации
            setTimeout(() => {
                confetti.remove();
            }, animationDuration * 1000);
        }
    },
    
    randomInRange: (min, max) => {
        const minNum = Number(min);
        const maxNum = Number(max);
        return Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum;
    },
    
    createElement: (tag, attrs = {}, children = []) => {
        const el = document.createElement(tag);

        if (attrs && typeof attrs === 'object') {
            Object.entries(attrs).forEach(([key, value]) => {
                if (key === 'class') {
                    el.className = value;
                } else if (key === 'text') {
                    el.textContent = value;
                } else if (key === 'html') {
                    el.innerHTML = value;
                } else if (key === 'style' && value && typeof value === 'object') {
                    Object.assign(el.style, value);
                } else if (value !== undefined && value !== null) {
                    el.setAttribute(key, value);
                }
            });
        }

        const list = Array.isArray(children) ? children : [children];
        list.forEach((child) => {
            if (child === undefined || child === null) return;
            if (child instanceof Node) {
                el.appendChild(child);
            } else {
                el.appendChild(document.createTextNode(String(child)));
            }
        });

        return el;
    }
};

function safeCall(fn, errorMessage = 'Произошла ошибка') {
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            console.error(errorMessage, error);
            try {
                utils.showNotification(errorMessage, 'error');
            } catch (_) {
                // ignore
            }
            throw error;
        }
    };
}

/**
 * Основной объект приложения
 */
const app = {
    // Инициализация интерфейса
    init: async function() {
        console.log('Инициализация интерфейса...');
        
        try {
            // Инициализация Telegram WebApp
            const isTelegram = initTelegramWebApp();
            
            // Инициализация элементов интерфейса
            initElements();
            
            // Настройка обработчиков событий
            setupEventListeners();
            
            // Загрузка данных пользователя
            await loadUserData();
            
            // Обновление интерфейса
            updateUI();
            
            // Показ главной страницы
            showPage('home');
            
            // Прячем прелоадер
            const preloader = document.querySelector('.app-loading');
            if (preloader) {
                preloader.style.opacity = '0';
                setTimeout(() => preloader.style.display = 'none', 300);
            }
            
        } catch (error) {
            console.error('Ошибка инициализации приложения:', error);
            utils.showNotification('Ошибка загрузки приложения', 'error');
        }
        return true;
    },
    
    // Показать страницу
    showPage: function(pageId) {
        // Скрываем все страницы
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        
        // Показываем выбранную страницу
        const page = document.querySelector(`#${pageId}-section`);
        if (page) {
            page.classList.add('active');
            state.currentPage = pageId;
            
            // Обновляем активную кнопку навигации
            document.querySelectorAll('.nav-item').forEach(item => {
                if (item.dataset.section === pageId) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });
            
            // Загружаем контент страницы
            this[`load${pageId.charAt(0).toUpperCase() + pageId.slice(1)}Page`]?.();
        }
    },
    
    // Загрузка главной страницы
    loadHomePage: function() {
        console.log('Загрузка главной страницы...');
        // Здесь будет загрузка данных для главной страницы
        this.updateUI();
    },
    
    // Загрузка страницы кейсов
    loadCasesPage: function() {
        console.log('Загрузка страницы кейсов...');
        // Инициализируем кейсы
        const casesContainer = document.querySelector('.cases-grid');
        if (casesContainer && casesContainer.children.length === 0) {
            // Добавляем тестовый кейс, если контейнер пуст
            const testCase = {
                id: 1,
                name: 'Базовый кейс',
                price: 50,
                image: 'https://via.placeholder.com/120?text=Case'
            };
            state.cases = [testCase];
            ui.loadCases();
        }
        this.updateUI();
    },
    
    // Загрузка инвентаря
    loadInventoryPage: function() {
        console.log('Загрузка инвентаря...');
        ui.renderInventoryPage();
        this.updateUI();
    },
    
    // Загрузка маркетплейса
    loadMarketPage: function() {
        console.log('Загрузка маркетплейса...');
        ui.loadMarket();
        this.updateUI();
    },
    
    // Загрузка профиля
    loadProfilePage: function() {
        console.log('Загрузка профиля...');
        ui.updateProfilePage();
        this.updateUI();
    },
    
    // Обновление интерфейса
    updateUI: function() {
        console.log('Обновление интерфейса...');
        
        // Обновляем баланс, если элемент существует
        if (elements.balanceElement && state.user) {
            elements.balanceElement.textContent = utils.formatNumber(state.user.signals || 0);
        }
        
        // Обновляем аватар, если элемент существует
        if (elements.profileAvatar && state.user) {
            if (state.user.photoUrl) {
                elements.profileAvatar.style.backgroundImage = `url(${state.user.photoUrl})`;
                elements.profileAvatar.textContent = '';
            } else {
                elements.profileAvatar.textContent = state.user.firstName ? state.user.firstName[0].toUpperCase() : 'G';
            }
        }
    },
    
    // Показать уведомление
    showNotification: function(message, type = 'info') {
        utils.showNotification(message, type);
    }
};

/**
 * Инициализирует приложение
 * @returns {Promise<void>}
 */
async function initApp() {
    console.log('Инициализация приложения...');
    
    try {
        // Инициализация Telegram WebApp
        if (window.Telegram?.WebApp) {
            tg = window.Telegram.WebApp;
            tg.expand();
            
            // Загружаем данные пользователя из Telegram
            if (tg.initDataUnsafe?.user) {
                const userData = tg.initDataUnsafe.user;
                state.user = {
                    id: userData.id,
                    firstName: userData.first_name || 'Пользователь',
                    username: userData.username || `user_${userData.id}`,
                    photoUrl: userData.photo_url,
                    signals: 0,
                    inventory: []
                };
            }
        } else {
            // Для отладки, если приложение запущено не в Telegram
            state.user = {
                id: 'test-' + Math.random().toString(36).substr(2, 9),
                firstName: 'Тестовый',
                username: 'test-user',
                signals: 500,
                inventory: []
            };
            console.log('Используется тестовый пользователь');
        }
        
        // Инициализация интерфейса
        await app.init();
        await ui.init();
        
        // Обновляем UI
        updateUI();
        
        console.log('Приложение успешно инициализировано');
        return true;
        
    } catch (error) {
        console.error('Ошибка при инициализации приложения:', error);
        
        // Показываем сообщение об ошибке
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.innerHTML = `
            <h3>Произошла ошибка</h3>
            <p>${error.message || 'Неизвестная ошибка'}</p>
            <button onclick="window.location.reload()">Обновить страницу</button>
        `;
        
        document.body.innerHTML = '';
        document.body.appendChild(errorMessage);
        document.body.style.padding = '20px';
        
        return false;
    }
}

/**
 * Инициализирует элементы интерфейса
 */
function initElements() {
    // Навигация
    elements.navItems = document.querySelectorAll('.nav-item');
    elements.mainContent = document.querySelector('.main-content');
    
    // Профиль
    elements.profileAvatar = document.querySelector('.profile-avatar');
    elements.balanceElement = document.querySelector('.balance-value') || document.getElementById('signals-count');
    
    // Модальные окна
    elements.modal = document.querySelector('.modal');
    elements.closeModal = document.querySelector('.close-modal');
    
    // Секции страниц
    elements.homeSection = document.querySelector('#home-section');
    elements.casesSection = document.querySelector('#cases-section');
    elements.inventorySection = document.querySelector('#inventory-section');
    elements.marketSection = document.querySelector('#market-section');
}

/**
 * Настраивает обработчики событий
 */
function setupEventListeners() {
    // Обработчики навигации
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function handleNavigation(e) {
            if (e) e.preventDefault();
            const target = e?.currentTarget || e?.target?.closest('[data-section]');
            const section = target?.getAttribute('data-section');
            if (section) {
                app.showPage(section);
            }
        });
    });
    
    // Обработчики быстрых действий на главной
    document.querySelectorAll('.action-card').forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            const section = card.getAttribute('data-section');
            if (section) {
                app.showPage(section);
            }
        });
    });
    
    // Обработчики кнопок
    document.addEventListener('click', (e) => {
        // Обработка открытия кейса
        const caseItem = e.target.closest('.case-item');
        if (caseItem) {
        }
        
        // Обработка кнопок открытия кейсов
        const openCaseBtn = e.target.closest('.open-case-btn');
        if (openCaseBtn) {
            e.preventDefault();
            handleOpenCase(e);
            return;
        }
        
        // Обработка вкладок маркета
        const tabBtn = e.target.closest('.market-tabs .tab-btn');
        if (tabBtn) {
            e.preventDefault();
            const tabId = tabBtn.dataset.tab;
            handleMarketTabChange(tabId);
            return;
        }
    });
    
    // Обработка закрытия модального окна
    if (elements.closeModal) {
        elements.closeModal.addEventListener('click', () => {
            if (elements.modal) {
                elements.modal.style.display = 'none';
            }
        });
    }
}

/**
 * Показывает указанную страницу
 * @param {string} pageId - Идентификатор страницы
 */
function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    const currentPage = document.querySelector('.page.active');
    const nextPage = document.getElementById(`${pageId}-section`);

    if (!nextPage) return;

    nextPage.style.opacity = '0';
    nextPage.style.transform = 'translateY(10px)';
    nextPage.style.display = 'block';

    requestAnimationFrame(() => {
        if (currentPage) {
            currentPage.style.opacity = '0';
            currentPage.style.transform = 'translateY(-10px)';
        }

        setTimeout(() => {
            pages.forEach(page => {
                page.classList.remove('active');
                page.style.display = 'none';
                page.style.opacity = '';
                page.style.transform = '';
            });

            nextPage.classList.add('active');
            nextPage.style.display = 'block';

            requestAnimationFrame(() => {
                nextPage.style.opacity = '1';
                nextPage.style.transform = 'translateY(0)';
                nextPage.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

                setTimeout(() => {
                    nextPage.style.transition = '';
                }, 300);
            });

            window.history.pushState({ page: pageId }, '', `#${pageId}`);
            app.loadPageData(pageId);
        }, 150);
    });

    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.dataset.section === pageId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

/**
 * Загружает данные для указанной страницы
 * @param {string} pageId - Идентификатор страницы
 */
async function loadPageData(pageId) {
    try {
        state.isLoading = true;
        
        switch (pageId) {
            case 'home':
                await app.loadHomePage();
                break;
            case 'cases':
                await app.loadCasesPage();
                break;
            case 'inventory':
                await app.loadInventoryPage();
                break;
            case 'market':
                await app.loadMarketPage();
                break;
        }
    } catch (error) {
        console.error(`Ошибка при загрузке страницы ${pageId}:`, error);
        utils.showNotification('Не удалось загрузить данные страницы', 'error');
    } finally {
        state.isLoading = false;
    }
}

/**
 * Обработчик открытия кейса
 * @param {Event} e - Событие клика
 */
async function handleOpenCase(e) {
    if (state.isLoading) return;
    
    try {
        state.isLoading = true;
        const caseId = e.currentTarget.dataset.caseId;
        
        // Здесь будет запрос к API для открытия кейса
        // const prize = await apiService.openCase(caseId);
        
        // Временная заглушка
        const prize = {
            id: 'phone_1',
            name: 'iPhone 13 Pro',
            rarity: 'legendary',
            image: '/images/phones/iphone13pro.png'
        };
        
        // Показываем анимацию выигрыша
        ui.showPrizeAnimation(prize);
        
        // Обновляем инвентарь
        state.user.inventory.push(prize);
        updateUI();
        
    } catch (error) {
        console.error('Ошибка при открытии кейса:', error);
        utils.showNotification('Не удалось открыть кейс', 'error');
    } finally {
        state.isLoading = false;
    }
}

/**
 * Обработчик п��реключения вкладок маркета
 * @param {string} tabId - Идентификатор вкладки
 */
function handleMarketTabChange(tabId) {
    // Обновляем активную вкладку
    document.querySelectorAll('.market-tabs .tab-btn').forEach(btn => {
        if (btn.dataset.tab === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Показываем соответствующий контент
    document.querySelectorAll('.tab-content').forEach(content => {
        if (content.id === `${tabId}-tab`) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });
    
    // Загружаем данные для вкладки
    switch (tabId) {
        case 'buy':
            ui.showMarketItems();
            break;
        case 'sell':
            ui.showSellInterface();
            break;
        case 'my-sales':
            ui.showMySales();
            break;
    }
}

/**
 * Обработчики событий
 * @type {Object}
 */
const eventHandlers = {
    /**
     * Обработчик навигации
     * @param {Event} e - Событие клика
     */
    handleNavigation: (e) => {
        e.preventDefault();
        const targetSection = e.currentTarget?.dataset?.section;
        if (targetSection) {
            app.showPage(targetSection);
        }
    },
    
    // Открытие кейса
    handleOpenCase: async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const button = e.currentTarget;
        const caseId = parseInt(button.dataset.caseId);
        
        // Здесь будет запрос к API для открытия кейса
        // const prize = await apiService.openCase(caseId);
        
        // Временная заглушка
        const prize = {
            id: 'phone_1',
            name: 'iPhone 13 Pro',
            rarity: 'legendary',
            image: '/images/phones/iphone13pro.png'
        };
        
        // Показываем анимацию выигрыша
        ui.showPrizeAnimation(prize);
        
        // Обновляем инвентарь
        state.user.inventory.push(prize);
        updateUI();
        
        // Добавляем запись в историю
        ui.addActivity(`Открыт кейс и получен ${prize.name}`);
        
        console.log('Кейс успешно открыт, получен приз:', prize);
    },
    
    // Показ уведомления при наведении на элемент
    handleTooltip: (e) => {
        const tooltip = e.target.dataset.tooltip;
        if (tooltip) {
            // Показываем всплывающую подсказку
            console.log('Показать подсказку:', tooltip);
        }
    }
};

/**
 * Функции для работы с интерфейсом
 */
const ui = {
    // Фильтрация инвентаря
    filterInventory: (filterType) => {
        const inventoryList = document.getElementById('inventory-list');
        if (!inventoryList) return;

        const phoneCards = inventoryList.querySelectorAll('.phone-card');
        
        phoneCards.forEach(card => {
            const rarity = card.querySelector('.phone-rarity')?.textContent?.toLowerCase() || '';
            
            if (filterType === 'все') {
                card.style.display = 'block';
            } else if (filterType === 'обычные' && rarity.includes('обычн')) {
                card.style.display = 'block';
            } else if (filterType === 'редкие' && rarity.includes('редк')) {
                card.style.display = 'block';
            } else if (filterType === 'эпические' && rarity.includes('эпич')) {
                card.style.display = 'block';
            } else if (filterType === 'легендарные' && rarity.includes('легенд')) {
                card.style.display = 'block';
            } else if (filterType !== 'все') {
                card.style.display = 'none';
            }
        });
    },
    
    // Инициализация интерфейса
    init: async function() {
        console.log('Инициализация UI...');
        
        // Проверяем существование элементов
        if (!elements || !elements.navItems) {
            console.error('Элементы интерфейса не найдены');
            return;
        }
        
        try {
            // Инициализируем навигацию
            if (elements.navItems && elements.navItems.length > 0) {
                elements.navItems.forEach(item => {
                    if (item) {
                        item.addEventListener('click', eventHandlers.handleNavigation);
                    }
                });
                console.log('Навигация инициализирована');
            }
            
            // Инициализируем быстрые действия на главной
            const quickActions = document.querySelectorAll('.action-card');
            if (quickActions && quickActions.length > 0) {
                quickActions.forEach(action => {
                    action.addEventListener('click', (e) => {
                        const section = e.currentTarget.dataset.section;
                        const navItem = document.querySelector(`.nav-item[data-section="${section}"]`);
                        if (navItem) navItem.click();
                    });
                });
                console.log('Быстрые действия инициализированы');
            }
            
            // Инициализируем кнопки модального окна
            const closeModal = document.querySelector('.close-modal');
            if (closeModal) {
                closeModal.addEventListener('click', () => {
                    const modal = document.querySelector('.modal');
                    if (modal) modal.classList.remove('active');
                });
                console.log('Модальные окна инициализированы');
            }
            
            // Инициализируем кнопки профиля
            const profileButtons = {
                'settings-btn': () => utils.showNotification('Настройки скоро будут доступны', 'info'),
                'help-btn': () => utils.showNotification('Обратитесь в поддержку для помощи', 'info'),
                'logout-btn': () => {
                    if (confirm('Вы уверены, что хотите выйти?')) {
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
            
            console.log('UI инициализирован успешно');
            return true;
            
        } catch (error) {
            console.error('Ошибка при инициализации UI:', error);
            throw error;
        }
    },
    
    // Обновление баланса
    updateBalance: () => {
        if (!elements.balanceElement) return;
        elements.balanceElement.textContent = utils.formatNumber(Number(state.user?.signals ?? 0));
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
    
    // Функция для загрузки инвентаря с ленивой загрузкой
    loadInventory: safeCall(async function() {
        if (state.isLoading) return;
        
        try {
            state.isLoading = true;
            
            // Показываем скелетон загрузки
            const container = document.getElementById('inventory-container');
            if (container) {
                container.innerHTML = '';
                container.append(AnimationManager.createSkeletonLoader(5, { 
                    height: '60px',
                    style: { marginBottom: '1rem', borderRadius: '8px' }
                }));
            }
            
            // Загружаем данные с кешированием
            const inventory = await apiService.get('/user/inventory');
            
            // Рендерим инвентарь
            renderInventory(inventory);
            
            return inventory;
        } catch (error) {
            console.error('Ошибка загрузки инвентаря:', error);
            throw error;
        } finally {
            state.isLoading = false;
        }
    }, 'Не удалось загрузить инвентарь'),
    
    // Загрузка рынка
    loadMarket: () => {
        console.log('Загрузка рынка...');
        
        // Показываем индикатор загрузки
        const marketContent = document.querySelector('#market-section .tab-content.active');
        if (!marketContent) return;
        
        marketContent.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Загрузка рынка...</p>
            </div>
        `;
        
        // Имитация загрузки данных с сервера
        setTimeout(() => {
            try {
                // Определяем активную вкладку
                const activeTab = document.querySelector('.market-tabs .tab-btn.active')?.dataset.tab || 'buy';
                
                if (activeTab === 'buy') {
                    ui.showMarketItems();
                } else if (activeTab === 'sell') {
                    ui.showSellInterface();
                } else if (activeTab === 'my-sales') {
                    ui.showMySales();
                }
            } catch (error) {
                console.error('Ошибка при загрузке рынка:', error);
                marketContent.innerHTML = `
                    <div class="error-state">
                        <p>Произошла ошибка при загрузке рынка</p>
                        <button class="btn btn-secondary" id="retry-market">Попробовать снова</button>
                    </div>
                `;
            }
        }, 800);
    },
    
    // Показать товары на рынке
    showMarketItems: () => {
        const marketContent = document.querySelector('#market-section .tab-content.active');
        if (!marketContent) return;
        
        // Тестовые данные для демонстрации
        const marketItems = [
            { id: 1, name: 'iPhone 15 Pro Max', price: 500, seller: 'User123', rarity: 'legendary' },
            { id: 2, name: 'Samsung Galaxy S23', price: 450, seller: 'Trader22', rarity: 'rare' },
            { id: 3, name: 'Google Pixel 8 Pro', price: 400, seller: 'PhoneLover', rarity: 'rare' },
            { id: 4, name: 'Xiaomi 13T Pro', price: 350, seller: 'TechGuru', rarity: 'uncommon' }
        ];
        
        let html = `
            <div class="market-filters">
                <select class="filter-select" id="market-filter">
                    <option value="all">Все телефоны</option>
                    <option value="common">Обычные</option>
                    <option value="uncommon">Необычные</option>
                    <option value="rare">Редкие</option>
                    <option value="legendary">Легендарные</option>
                </select>
                <div class="search-box">
                    <i class="fas fa-search"></i>
                    <input type="text" id="market-search" placeholder="Поиск по названию...">
                </div>
            </div>
            <div class="market-items" id="market-items-list">
        `;
        
        if (marketItems.length === 0) {
            html += `
                <div class="empty-state">
                    <p>На рынке пока нет товаров</p>
                    <p>Будьте первым, кто выставит телефон на продажу!</p>
                </div>
            `;
        } else {
            marketItems.forEach(item => {
                html += `
                    <div class="market-item rarity-${item.rarity}" data-id="${item.id}">
                        <div class="item-image">
                            <img src="https://via.placeholder.com/80?text=${encodeURIComponent(item.name.split(' ')[0])}" alt="${item.name}">
                        </div>
                        <div class="item-details">
                            <h4>${item.name}</h4>
                            <div class="item-seller">Продавец: ${item.seller}</div>
                            <div class="item-rarity">${getRarityName(item.rarity)}</div>
                        </div>
                        <div class="item-actions">
                            <div class="item-price">${item.price} <i class="fas fa-bolt"></i></div>
                            <button class="btn btn-buy" data-id="${item.id}">Купить</button>
                        </div>
                    </div>
                `;
            });
        }
        
        html += `</div>`; // Закрываем market-items
        marketContent.innerHTML = html;
    },
    
    // Показать интерфейс продажи
    showSellInterface: () => {
        const marketContent = document.querySelector('#market-section .tab-content.active');
        if (!marketContent) return;
        
        // Получаем телефоны из инвентаря пользователя
        const userPhones = state.user.inventory || [];
        
        let html = `
            <div class="sell-interface">
                <h3>Выберите телефон для продажи</h3>
                <div class="inventory-list" id="sell-phone-list">
        `;
        
        if (userPhones.length === 0) {
            html += `
                <div class="empty-state">
                    <p>Ваш инвентарь пуст</p>
                    <p>Откройте кейсы, чтобы получить телефоны для продажи</p>
                </div>
            `;
        } else {
            userPhones.forEach(phone => {
                html += `
                    <div class="phone-item" data-id="${phone.id}">
                        <div class="phone-image">
                            <img src="${phone.image}" alt="${phone.name}">
                        </div>
                        <div class="phone-info">
                            <h4>${phone.name}</h4>
                            <div class="phone-rarity rarity-${phone.rarity}">${getRarityName(phone.rarity)}</div>
                        </div>
                        <div class="phone-price">
                            <input type="number" min="1" value="100" class="price-input" placeholder="Цена">
                            <button class="btn btn-sell" data-id="${phone.id}">Продать</button>
                        </div>
                    </div>
                `;
            });
        }
        
        html += `
                </div>
                <div class="sell-tip">
                    <i class="fas fa-info-circle"></i>
                    <p>Вы получите 90% от указанной цены (10% - комиссия площадки)</p>
                </div>
            </div>
        `;
        
        marketContent.innerHTML = html;
    },
    
    // Показать мои продажи
    showMySales: () => {
        const marketContent = document.querySelector('#market-section .tab-content.active');
        if (!marketContent) return;
        
        // Тестовые данные для демонстрации
        const mySales = [
            { id: 1, name: 'iPhone 14 Pro', price: 450, status: 'sold', date: '2023-12-20' },
            { id: 2, name: 'Samsung S22', price: 400, status: 'active', date: '2023-12-21' },
            { id: 3, name: 'Google Pixel 7', price: 350, status: 'cancelled', date: '2023-12-18' }
        ];
        
        let html = `
            <div class="my-sales">
                <h3>Мои продажи</h3>
                <div class="sales-list">
        `;
        
        if (mySales.length === 0) {
            html += `
                <div class="empty-state">
                    <p>У вас пока нет активных продаж</p>
                    <p>Выставите телефон на продажу во вкладке "Продать"</p>
                </div>
            `;
        } else {
            mySales.forEach(sale => {
                let statusText = '';
                let statusClass = '';
                
                if (sale.status === 'sold') {
                    statusText = 'Продано';
                    statusClass = 'status-sold';
                } else if (sale.status === 'active') {
                    statusText = 'Активно';
                    statusClass = 'status-active';
                } else {
                    statusText = 'Отменено';
                    statusClass = 'status-cancelled';
                }
                
                html += `
                    <div class="sale-item">
                        <div class="sale-info">
                            <h4>${sale.name}</h4>
                            <div class="sale-date">${sale.date}</div>
                            <div class="sale-status ${statusClass}">${statusText}</div>
                        </div>
                        <div class="sale-price">
                            ${sale.price} <i class="fas fa-bolt"></i>
                        </div>
                    </div>
                `;
            });
        }
        
        html += `
                </div>
            </div>
        `;
        
        marketContent.innerHTML = html;
    },
    
    // Показ анимации выигрыша
    showPrizeAnimation: (prize) => {
        const modal = document.querySelector('.case-result-modal');
        if (!modal) {
            console.error('Модальное окно не найдено');
            return;
        }
        
        try {
            // Обновляем данные в модальном окне
            const prizeImage = modal.querySelector('#result-phone-img');
            const prizeName = modal.querySelector('#result-phone-name');
            const prizeRarity = modal.querySelector('.prize-rarity');
            const prizeAnimation = modal.querySelector('.prize-animation');
            
            if (!prizeImage || !prizeName || !prizeRarity || !prizeAnimation) {
                throw new Error('Не все элементы модального окна найдены');
            }
            
            // Устанавливаем данные о призе
            prizeImage.src = `https://via.placeholder.com/300?text=${encodeURIComponent(prize.name)}`;
            prizeImage.alt = prize.name;
            prizeName.textContent = prize.name;
            prizeRarity.textContent = getRarityName(prize.rarity);
            prizeRarity.className = `prize-rarity rarity-${prize.rarity}`;
            
            // Функция для закрытия модального окна
            const closeModal = () => {
                modal.classList.remove('active');
                // Удаляем обработчик после закрытия
                modal.removeEventListener('click', handleOutsideClick);
                
                // Удаляем обработчик кнопки закрытия
                if (closeButton) {
                    closeButton.removeEventListener('click', closeModal);
                }
            };
            
            // Обработчик клика вне контента
            const handleOutsideClick = (e) => {
                if (e.target === modal) {
                    closeModal();
                }
            };
            
            // Добавляем обработчик закрытия
            modal.addEventListener('click', handleOutsideClick);
            
            // Добавляем кнопку закрытия, если её нет
            let closeButton = modal.querySelector('.close-modal, #close-result');
            if (!closeButton) {
                closeButton = document.createElement('button');
                closeButton.className = 'close-modal';
                closeButton.innerHTML = '&times;';
                modal.appendChild(closeButton);
            }
            
            // Назначаем обработчик кнопки закрытия
            closeButton.addEventListener('click', closeModal);
            
            // Показываем модальное окно
            modal.classList.add('active');
            
            // Создаем конфетти
            utils.createConfetti(prizeAnimation);
            
        } catch (error) {
            console.error('Ошибка при показе анимации выигрыша:', error);
            utils.showNotification('Не удалось отобразить выигрыш', 'error');
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
    },
    
    // Отрисовка страницы инвентаря
    renderInventoryPage: () => {
        const container = document.getElementById('inventory-list');
        if (!container) return;
        
        container.innerHTML = '';
        const inventory = state.user.inventory || [];
        
        if (inventory.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Инвентарь пуст</p>
                    <p>Откройте кейсы, чтобы получить телефоны</p>
                </div>
            `;
            return;
        }
        
        inventory.forEach(phone => {
            const card = utils.createElement('div', { class: `phone-card rarity-${phone.rarity || 'common'}` }, [
                utils.createElement('div', { class: 'phone-icon' }, [
                    utils.createElement('img', { 
                        src: phone.image || 'https://via.placeholder.com/84?text=Phone', 
                        alt: phone.name 
                    })
                ]),
                utils.createElement('div', { class: 'phone-info' }, [
                    utils.createElement('h4', { text: phone.name }),
                    utils.createElement('p', { text: getRarityName(phone.rarity || 'common') })
                ])
            ]);
            container.appendChild(card);
        });
    },
    
    // Обновление профиля
    updateProfilePage: () => {
        const username = document.querySelector('#username');
        const totalPhones = document.getElementById('total-phones');
        const totalCases = document.getElementById('total-cases');
        const totalSales = document.getElementById('total-sales');
        const profileAvatar = document.querySelector('.profile-avatar');
        
        if (username) username.textContent = state.user.firstName;
        if (totalPhones) totalPhones.textContent = state.user.inventory.length;
        if (totalCases) totalCases.textContent = state.user.inventory.length;
        if (totalSales) totalSales.textContent = '0';
        
        if (profileAvatar) {
            if (state.user.photoUrl) {
                profileAvatar.style.backgroundImage = `url(${state.user.photoUrl})`;
                profileAvatar.innerHTML = '';
            } else {
                profileAvatar.textContent = state.user.firstName ? state.user.firstName[0].toUpperCase() : 'U';
            }
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
        // Инициализация Telegram WebApp, если доступно
        if (window.Telegram?.WebApp) {
            tg = window.Telegram.WebApp;
            tg.expand(); // Раскрываем веб-приложение на весь экран
            
            // Ждем инициализации Telegram WebApp
            if (!tg.initDataUnsafe) {
                await new Promise(resolve => {
                    const checkInit = setInterval(() => {
                        if (tg.initDataUnsafe) {
                            clearInterval(checkInit);
                            resolve();
                        }
                    }, 100);
                    
                    // Таймаут на случай, если данные не придут
                    setTimeout(() => {
                        clearInterval(checkInit);
                        resolve();
                    }, 3000);
                });
            }
            
            // Загружаем данные пользователя из Telegram
            if (tg.initDataUnsafe?.user) {
                const tgUser = tg.initDataUnsafe.user;
                state.user = {
                    id: tgUser.id,
                    firstName: tgUser.first_name || 'Игрок',
                    username: tgUser.username || 'player',
                    photoUrl: tgUser.photo_url,
                    signals: state.user.signals,
                    inventory: state.user.inventory
                };
            }
        }
        
        // Если данные из Telegram не загрузились, используем тестовые данные
        if (!state.user) {
            state.user = {
                id: Date.now(),
                firstName: 'Тестовый',
                username: 'test_user',
                signals: 1000,
                inventory: []
            };
        }
        
        // Обновляем интерфейс
        updateUI();
        return state.user;
        
    } catch (error) {
        console.error('Ошибка при загрузке данных пользователя:', error);
        utils.showNotification('Не удалось загрузить данные', 'error');
        throw error; // Пробрасываем ошибку для обработки в вызывающем коде
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
            elements.balanceElement.textContent = utils.formatNumber(Number(state.user.signals));
        }
        
    } catch (error) {
        console.error('Ошибка при обновлении интерфейса:', error);
    }
}

// Экспортируем функцию инициализации
if (typeof window !== 'undefined') {
    window.initApp = initApp;
}

export default initApp;

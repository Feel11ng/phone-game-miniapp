// static/script.js

// Импорт утилит
import { apiService, throttle, debounce } from './api.js';
import ErrorHandler from './errorHandler.js';
import AnimationManager from './animations.js';
import { SoundManager } from './sounds.js';

// Инициализация утилит
ErrorHandler.init();
AnimationManager.init();
const soundManager = new SoundManager();

// Глобальные настройки анимаций
const ANIMATION_DURATION = 300; // ms
const TRANSITION_DELAY = 100; // ms

// Инициализация Telegram Web App
const tg = window.Telegram?.WebApp;

// Глобальное состояние приложения
const state = {
    user: null,
    isLoading: false,
    currentPage: 'home',
    cache: new Map(),
    // Остальные состояния
    inventory: [],
    marketItems: [],
    cases: [],
    balance: 0,
    lastUpdated: null
};

// Оборачиваем основные функции в обработчик ошибок
const safeCall = ErrorHandler.withErrorHandling;

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

// Утилиты для работы с интерфейсом
const utils = {
    showNotification: function(message, type = 'info') {
        // Создаем уведомление
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Добавляем в DOM
        document.body.appendChild(notification);
        
        // Автоматически скрываем через 3 секунды
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
};

// Функции для работы с интерфейсом
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

// Функция для делегирования событий с улучшенной обработкой
function setupEventDelegation() {
    // Обработка кликов по кнопкам
    document.addEventListener('click', (e) => {
        // Обработка всех кликов по кнопкам с анимацией
        const button = e.target.closest('button, .btn, .action-card, .nav-item');
        if (button && !button.hasAttribute('disabled')) {
            // Воспроизводим звук клика
            soundManager.play('buttonClick');
            
            // Добавляем визуальную обратную связь
            button.classList.add('active');
            setTimeout(() => {
                button.classList.remove('active');
            }, 200);
            
            // Вибрация (если доступно)
            soundManager.hapticFeedback('light');
        }
        
        // Обработка навигации
        const navLink = e.target.closest('[data-section]');
        if (navLink) {
            e.preventDefault();
            const section = navLink.dataset.section;
            navigateTo(section);
        }
        
        // Обработка вкладок
        const tabBtn = e.target.closest('.tab-btn');
        if (tabBtn) {
            e.preventDefault();
            const tabId = tabBtn.dataset.tab;
            switchTab(tabId);
        }
    });
    
    // Обработка наведения на интерактивные элементы
    document.addEventListener('mouseover', (e) => {
        const interactive = e.target.closest('.hover-effect, .btn, .card, .action-card');
        if (interactive) {
            interactive.classList.add('hover-active');
        }
    });
    
    document.addEventListener('mouseout', (e) => {
        const interactive = e.target.closest('.hover-effect, .btn, .card, .action-card');
        if (interactive) {
            interactive.classList.remove('hover-active');
        }
    });
    
    // Инициализация при загрузке страницы
    document.addEventListener('DOMContentLoaded', () => {
        // Добавляем класс loaded для плавного появления
        document.body.classList.add('loaded');
    });
    
    // Обработка нажатия на карточки
    document.addEventListener('mousedown', (e) => {
        const pressable = e.target.closest('.pressable, .card, .btn');
        if (pressable) {
            pressable.classList.add('pressed');
        }
    });
    
    document.addEventListener('mouseup', () => {
        const pressed = document.querySelectorAll('.pressed');
        pressed.forEach(el => el.classList.remove('pressed'));
    });
    
    // Обработка касаний на мобильных устройствах
    document.addEventListener('touchstart', (e) => {
        const touchTarget = e.target.closest('.touch-feedback');
        if (touchTarget) {
            touchTarget.classList.add('touch-active');
            soundManager.hapticFeedback('light');
        }
    }, { passive: true });
    
    document.addEventListener('touchend', () => {
        const activeTouch = document.querySelectorAll('.touch-active');
        activeTouch.forEach(el => el.classList.remove('touch-active'));
    }, { passive: true });
    
    // Инициализация перетаскивания для карточек
    initDragAndDrop();
}
// Обработка переключения вкладок рынка
document.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('.market-tabs .tab-btn');
    if (tabBtn) {
        e.preventDefault();
            const tabId = tabBtn.dataset.tab;
            
            // Обновляем активную вкладку
            document.querySelectorAll('.market-tabs .tab-btn').forEach(btn => {
                btn.classList.toggle('active', btn === tabBtn);
            });
            
            // Показываем соответствующий контент
            document.querySelectorAll('.market-section .tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            const targetTab = document.getElementById(`${tabId}-tab`);
            if (targetTab) {
                targetTab.classList.add('active');
            }
            
            // Загружаем данные для выбранной вкладки
            if (tabId === 'buy') {
                ui.showMarketItems();
            } else if (tabId === 'sell') {
                ui.showSellInterface();
            } else if (tabId === 'my-sales') {
                ui.showMySales();
            }
        }
        
        // Обработка кнопки покупки на рынке
        const buyBtn = e.target.closest('.btn-buy');
        if (buyBtn) {
            const itemId = parseInt(buyBtn.dataset.id);
            const itemElement = buyBtn.closest('.market-item');
            const itemName = itemElement?.querySelector('h4')?.textContent || 'этот товар';
            
            if (confirm(`Вы уверены, что хотите купить ${itemName}?`)) {
                // Здесь будет вызов API для покупки
                utils.showNotification(`Поздравляем с покупкой ${itemName}!`, 'success');
                // Обновляем интерфейс
                itemElement.remove();
                // Обновляем баланс (в реальном приложении это будет после ответа сервера)
                state.user.signals -= 100; // Примерная сумма
                updateUI();
            }
        }
        
        // Обработка кнопки продажи
        const sellBtn = e.target.closest('.btn-sell');
        if (sellBtn) {
            const phoneId = parseInt(sellBtn.dataset.id);
            const phoneItem = sellBtn.closest('.phone-item');
            const priceInput = phoneItem?.querySelector('.price-input');
            const price = priceInput ? parseInt(priceInput.value) : 0;
            
            if (!price || price < 1) {
                utils.showNotification('Укажите корректную цену', 'error');
                return;
            }
            
            const phoneName = phoneItem?.querySelector('h4')?.textContent || 'этот телефон';
            
            if (confirm(`Выставить на продажу ${phoneName} за ${price} сигналов?`)) {
                // Здесь будет вызов API для размещения на продажу
                utils.showNotification(`Телефон ${phoneName} выставлен на продажу за ${price} сигналов`, 'success');
                // В реальном приложении нужно удалить телефон из инвентаря после ответа сервера
                // и добавить его в раздел "Мои продажи"
                phoneItem.remove();
            }
        }
        
        // Обработка кнопки повтора загрузки рынка
        const retryBtn = e.target.closest('#retry-market');
        if (retryBtn) {
            ui.loadMarket();
        }
    });
    
    // Обработка кликов по кнопкам открытия кейсов
document.addEventListener('click', (e) => {
    const openCaseBtn = e.target.closest('.open-case-btn');
    if (openCaseBtn) {
        eventHandlers.handleOpenCase(e);
        return;
        }

        // Обработка кликов по кнопкам навигации в нижнем меню
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
                } else if (section === 'home') {
                    ui.loadHomePage();
                }
            }
        }

        // Обработка кнопок фильтрации в инвентаре
        const filterBtn = e.target.closest('.filter-btn');
        if (filterBtn) {
            e.preventDefault();
            const filterType = filterBtn.textContent.trim().toLowerCase();
            ui.filterInventory(filterType);
            
            // Обновляем активную кнопку фильтра
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.toggle('active', btn === filterBtn);
            });
        }

        // Обработка кнопок быстрого доступа на главной
        const actionCard = e.target.closest('.action-card');
        if (actionCard) {
            const section = actionCard.dataset.section;
            if (section) {
                // Находим соответствующий элемент навигации и эмулируем клик
                const navItem = document.querySelector(`.nav-item[data-section="${section}"]`);
                if (navItem) {
                    navItem.click();
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
            soundManager.play('notification');
        } else if (helpBtn) {
            utils.showNotification('Обратитесь в поддержку для помощи', 'info');
            soundManager.play('notification');
        } else if (logoutBtn) {
            if (confirm('Вы уверены, что хотите выйти?')) {
                utils.showNotification('Выход выполнен', 'success');
                soundManager.play('success');
                // Здесь можно добавить логику выхода
                if (window.Telegram?.WebApp) {
                    window.Telegram.WebApp.close();
                }
            }
        } else if (closeModalBtn) {
            const modal = closeModalBtn.closest('.modal');
            if (modal) {
                modal.classList.remove('active');
            soundManager.play('buttonClick');
        }
    } else if (retryBtn) {
        soundManager.play('buttonClick');
        ui.loadInventory().catch(error => {
            console.error('Ошибка при загрузке инвентаря:', error);
            utils.showNotification('Не удалось загрузить инвентарь', 'error');
        });
    }
});

// Экспортируем объекты для отладки
window.appState = state;
window.ui = ui;

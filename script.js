// script.js - Refactored version
import { apiService } from './api.js';
import AnimationManager from './animations.js';
import { soundManager } from './sounds.js';

// ======================
// Конфигурация
// ======================
const CONFIG = {
    ANIMATION_DURATION: 300,
    API_TIMEOUT: 10000,
    CACHE_TTL: 5 * 60 * 1000
};

// ======================
// Глобальное состояние
// ======================
const state = {
    user: {
        id: null,
        firstName: 'Гость',
        username: 'guest',
        photoUrl: null,
        signals: 0,
        inventory: []
    },
    cases: [],
    marketItems: [],
    isLoading: false,
    currentPage: 'home'
};

// ======================
// DOM элементы
// ======================
const elements = {
    // Навигация
    navItems: null,
    mainContent: null,
    
    // Профиль
    userAvatar: null,
    profileAvatar: null,
    balanceElement: null,
    signalsCount: null,
    
    // Страницы
    pages: null,
    
    // Модальные окна
    caseResultModal: null,
    sellItemModal: null,
    
    init() {
        this.navItems = document.querySelectorAll('.nav-item');
        this.mainContent = document.querySelector('.main-content');
        this.userAvatar = document.getElementById('user-avatar');
        this.profileAvatar = document.querySelector('.profile-avatar');
        this.balanceElement = document.querySelector('.balance-value');
        this.signalsCount = document.getElementById('signals-count');
        this.pages = document.querySelectorAll('.page');
        this.caseResultModal = document.querySelector('.case-result-modal');
        this.sellItemModal = document.querySelector('.sell-item-modal');
    }
};

// ======================
// Утилиты
// ======================
const utils = {
    formatNumber(num) {
        return Number(num || 0).toLocaleString('ru-RU');
    },
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Звук для уведомления
        if (type === 'success') soundManager.play('success');
        if (type === 'error') soundManager.play('error');
        
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    },
    
    createElement(tag, attrs = {}, children = []) {
        const el = document.createElement(tag);
        
        Object.entries(attrs).forEach(([key, value]) => {
            if (key === 'class') el.className = value;
            else if (key === 'text') el.textContent = value;
            else if (key === 'html') el.innerHTML = value;
            else if (key === 'style' && typeof value === 'object') {
                Object.assign(el.style, value);
            } else if (value !== undefined && value !== null) {
                el.setAttribute(key, value);
            }
        });
        
        const childArray = Array.isArray(children) ? children : [children];
        childArray.forEach(child => {
            if (child instanceof Node) el.appendChild(child);
            else if (child) el.appendChild(document.createTextNode(String(child)));
        });
        
        return el;
    },
    
    getRarityName(rarity) {
        const names = {
            common: 'Обычный',
            uncommon: 'Необычный',
            rare: 'Редкий',
            epic: 'Эпический',
            legendary: 'Легендарный'
        };
        return names[rarity] || rarity;
    },
    
    createConfetti(container) {
        if (!container) return;
        
        container.innerHTML = '';
        const colors = ['#fdcb6e', '#ff7675', '#6c5ce7', '#00b894', '#0984e3'];
        
        for (let i = 0; i < 50; i++) {
            const confetti = utils.createElement('div', {
                class: 'confetti',
                style: {
                    width: `${Math.random() * 10 + 5}px`,
                    height: `${Math.random() * 10 + 5}px`,
                    backgroundColor: colors[Math.floor(Math.random() * colors.length)],
                    left: `${Math.random() * 100}%`,
                    position: 'absolute',
                    zIndex: '1'
                }
            });
            
            container.appendChild(confetti);
        }
    }
};

// ======================
// UI компоненты
// ======================
const UI = {
    updateBalance() {
        const balance = state.user.signals || 0;
        if (elements.signalsCount) {
            elements.signalsCount.textContent = utils.formatNumber(balance);
        }
        if (elements.balanceElement) {
            elements.balanceElement.textContent = utils.formatNumber(balance);
        }
    },
    
    updateUserAvatar() {
        const avatars = [elements.userAvatar, elements.profileAvatar].filter(Boolean);
        
        avatars.forEach(avatar => {
            if (state.user.photoUrl) {
                avatar.style.backgroundImage = `url(${state.user.photoUrl})`;
                avatar.style.backgroundSize = 'cover';
                avatar.innerHTML = '';
            } else {
                const initial = state.user.firstName[0]?.toUpperCase() || 'U';
                avatar.textContent = initial;
                avatar.style.backgroundImage = 'none';
            }
        });
    },
    
    showPage(pageId) {
        // Убираем active у всех страниц
        elements.pages.forEach(page => page.classList.remove('active'));
        
        // Добавляем active нужной странице
        const targetPage = document.getElementById(`${pageId}-section`);
        if (targetPage) {
            targetPage.classList.add('active');
            state.currentPage = pageId;
            
            // Обновляем навигацию
            elements.navItems.forEach(item => {
                if (item.dataset.section === pageId) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });
            
            // Загружаем данные страницы
            this.loadPageData(pageId);
        }
    },
    
    async loadPageData(pageId) {
        switch(pageId) {
            case 'home':
                await this.loadHomePage();
                break;
            case 'cases':
                await this.loadCasesPage();
                break;
            case 'inventory':
                await this.loadInventoryPage();
                break;
            case 'market':
                await this.loadMarketPage();
                break;
            case 'profile':
                await this.loadProfilePage();
                break;
        }
    },
    
    async loadHomePage() {
        const activityFeed = document.getElementById('activity-feed');
        if (!activityFeed) return;
        
        activityFeed.innerHTML = `
            <div class="activity-item">Добро пожаловать в Phone Tycoon!</div>
            <div class="activity-item">Откройте кейс, чтобы получить телефон</div>
            <div class="activity-item">Торгуйте на маркетплейсе</div>
        `;
    },
    
    async loadCasesPage() {
        const casesGrid = document.querySelector('.cases-grid');
        if (!casesGrid) return;
        
        try {
            // Показываем загрузку
            casesGrid.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Загрузка кейсов...</p></div>';
            
            // Загружаем кейсы
            const response = await apiService.get('/cases');
            state.cases = response.cases || [];
            
            // Рендерим кейсы
            casesGrid.innerHTML = '';
            
            if (state.cases.length === 0) {
                casesGrid.innerHTML = '<div class="empty-state"><p>Кейсы временно недоступны</p></div>';
                return;
            }
            
            state.cases.forEach(caseItem => {
                const caseCard = utils.createElement('div', { class: 'case-card' }, [
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
                            'data-case-id': caseItem.id,
                            text: 'Открыть'
                        })
                    ])
                ]);
                
                casesGrid.appendChild(caseCard);
            });
        } catch (error) {
            console.error('Ошибка загрузки кейсов:', error);
            casesGrid.innerHTML = '<div class="error-state"><p>Не удалось загрузить кейсы</p></div>';
        }
    },
    
    async loadInventoryPage(containerId = 'inventory-list') {
        const inventoryList = document.getElementById(containerId);
        if (!inventoryList) return;
        
        try {
            // Показываем загрузку
            inventoryList.innerHTML = '<div class="loading-state"><div class="loading-spinner"><div class="spinner"></div><p>Загрузка...</p></div></div>';
            
            // Загружаем инвентарь
            const response = await apiService.get(`/inventory?userId=${state.user.id}`);
            if (response.ok && response.inventory) {
                state.user.inventory = response.inventory;
            } else {
               state.user.inventory = [];
            }
            
            inventoryList.innerHTML = '';
            
            if (state.user.inventory.length === 0) {
                inventoryList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-box-open"></i>
                        <p>Инвентарь пуст</p>
                        <p class="text-soft">Откройте кейсы, чтобы получить телефоны</p>
                    </div>
                `;
                return;
            }
            
            state.user.inventory.forEach(phone => {
                const phoneCard = utils.createElement('div', {
                    class: `phone-card rarity-${phone.rarity || 'common'}`
                }, [
                    utils.createElement('div', { class: 'phone-icon' }, [
                        utils.createElement('img', {
                            src: phone.image || 'https://via.placeholder.com/84?text=Phone',
                            alt: phone.name
                        })
                    ]),
                    utils.createElement('div', { class: 'phone-info' }, [
                        utils.createElement('h4', { text: phone.name }),
                        utils.createElement('p', { text: utils.getRarityName(phone.rarity || 'common') })
                    ]),
                    utils.createElement('div', { class: 'phone-actions' }, [
                        utils.createElement('button', {
                            class: 'btn btn-sell',
                            'data-inventory-id': phone.id,
                            text: 'Продать'
                        })
                    ])
                ]);
                
                inventoryList.appendChild(phoneCard);
            });
        } catch (error) {
            console.error('Ошибка загрузки инвентаря:', error);
            inventoryList.innerHTML = '<div class="error-state"><p>Не удалось загрузить инвентарь</p></div>';
        }
    },
    
    async loadMarketPage() {
        const marketItems = document.getElementById('market-items');
        if (!marketItems) return;
        
        try {
            marketItems.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Загрузка маркета...</p></div>';
            
            const response = await apiService.get('/market');
            state.marketItems = response.items || [];
            
            this.renderMarketItems('buy');
        } catch (error) {
            console.error('Ошибка загрузки маркета:', error);
            marketItems.innerHTML = '<div class="error-state"><p>Не удалось загрузить маркет</p></div>';
        }
    },
    
    renderMarketItems(tab) {
       const container = document.getElementById(`${tab}-items`);
       if (!container) return;
       
       container.innerHTML = '';
       
       let itemsToRender = [];
       if (tab === 'buy') {
           itemsToRender = state.marketItems.filter(item => item.seller_id !== state.user.id);
       } else if (tab === 'my-listings') {
           itemsToRender = state.marketItems.filter(item => item.seller_id === state.user.id);
       }

       if (itemsToRender.length === 0) {
           container.innerHTML = `<div class="empty-state"><p>Здесь пока пусто</p></div>`;
           return;
       }

       itemsToRender.forEach(item => {
           const itemCard = utils.createElement('div', {
               class: `market-item rarity-${item.rarity}`
           }, [
               utils.createElement('div', { class: 'item-image' }, [
                   utils.createElement('img', {
                       src: item.image_filename ? `/images/phones/${item.image_filename}` : `https://via.placeholder.com/80?text=${encodeURIComponent(item.name.split(' ')[0])}`,
                       alt: item.name
                   })
               ]),
               utils.createElement('div', { class: 'item-details' }, [
                   utils.createElement('h4', { text: item.name }),
                   utils.createElement('div', { class: 'item-seller', text: `Продавец: ${item.seller_name || 'Неизвестно'}` }),
                   utils.createElement('div', { class: 'item-rarity', text: utils.getRarityName(item.rarity) })
               ]),
               utils.createElement('div', { class: 'item-actions' }, [
                   utils.createElement('div', { class: 'item-price' }, [
                       `${item.price_signals} `,
                       utils.createElement('i', { class: 'fas fa-bolt' })
                   ]),
                   tab === 'buy'
                       ? utils.createElement('button', {
                           class: 'btn btn-buy',
                           'data-item-id': item.id,
                           text: 'Купить'
                       })
                       : utils.createElement('button', {
                           class: 'btn btn-unlist',
                           'data-item-id': item.id,
                           text: 'Снять'
                       })
               ])
           ]);
           container.appendChild(itemCard);
       });
   },
    
    async loadProfilePage() {
        const username = document.getElementById('username');
        const totalPhones = document.getElementById('total-phones');
        const totalCases = document.getElementById('total-cases');
        
        if (username) username.textContent = state.user.firstName;
        if (totalPhones) totalPhones.textContent = state.user.inventory.length;
        if (totalCases) totalCases.textContent = state.user.inventory.length;
        
        this.updateUserAvatar();
    },
    
    showCaseResult(prize) {
        if (!elements.caseResultModal) return;
        
        const prizeImage = elements.caseResultModal.querySelector('#result-phone-img');
        const prizeName = elements.caseResultModal.querySelector('#result-phone-name');
        const prizeRarity = elements.caseResultModal.querySelector('.prize-rarity');
        const prizeAnimation = elements.caseResultModal.querySelector('.prize-animation');
        
        if (prizeImage) prizeImage.src = prize.image;
        if (prizeName) prizeName.textContent = prize.name;
        if (prizeRarity) {
            prizeRarity.textContent = utils.getRarityName(prize.rarity);
            prizeRarity.className = `prize-rarity rarity-${prize.rarity}`;
        }
        
        // Создаем конфетти
        if (prizeAnimation) utils.createConfetti(prizeAnimation);
        
        // Показываем модальное окно
        elements.caseResultModal.classList.add('active');
        
        // Звук выигрыша
        soundManager.play('win');
        soundManager.hapticFeedback('success');
    }
};

// ======================
// Обработчики событий
// ======================
const EventHandlers = {
    init() {
       document.body.addEventListener('click', (e) => {
           const target = e.target;

           // Навигация
           const navItem = target.closest('.nav-item');
           if (navItem) {
               this.handleNavigation(e);
               return;
           }

           // Глобальные клики
           this.handleGlobalClick(e);
       });

        // Закрытие модального окна
        if (elements.caseResultModal) {
            const closeBtn = elements.caseResultModal.querySelector('.close-modal, #close-result');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    elements.caseResultModal.classList.remove('active');
                });
            }
        }
        
        // Быстрые действия на главной
        document.querySelectorAll('.action-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const section = card.dataset.section;
                if (section) UI.showPage(section);
            });
        });
    },
    
    handleNavigation(e) {
        e.preventDefault();
        const section = e.currentTarget.dataset.section;
        if (section) {
            soundManager.play('buttonClick');
            UI.showPage(section);
        }
    },
    
    handleGlobalClick(e) {
        // Открытие кейса
        const openCaseBtn = e.target.closest('.open-case-btn');
        if (openCaseBtn) {
            e.preventDefault();
            EventHandlers.handleOpenCase(openCaseBtn);
            return;
        }
        
        // Покупка на маркете
        const buyBtn = e.target.closest('.btn-buy');
        if (buyBtn) {
            e.preventDefault();
            EventHandlers.handleBuyItem(buyBtn);
            return;
        }
        
        // Переключение вкладок маркета
        const tabBtn = e.target.closest('.tab-btn');
        if (tabBtn) {
            e.preventDefault();
            EventHandlers.handleMarketTab(tabBtn);
            return;
        }
        
        // Продажа из инвентаря
        const sellBtn = e.target.closest('.btn-sell');
        if (sellBtn) {
            e.preventDefault();
            EventHandlers.handleSellItem(sellBtn);
            return;
        }
        
        // Снятие с продажи
        const unlistBtn = e.target.closest('.btn-unlist');
        if (unlistBtn) {
            e.preventDefault();
            EventHandlers.handleUnlistItem(unlistBtn);
            return;
        }
    },
    
    async handleOpenCase(button) {
        if (state.isLoading) return;
        
        const caseId = parseInt(button.dataset.caseId);
        const caseItem = state.cases.find(c => c.id === caseId);
        
        if (!caseItem) {
            utils.showNotification('Кейс не найден', 'error');
            return;
        }
        
        if (state.user.signals < caseItem.price) {
            utils.showNotification('Недостаточно сигналов', 'error');
            soundManager.play('error');
            return;
        }
        
        try {
            state.isLoading = true;
            button.disabled = true;
            button.textContent = 'Открываем...';
            
            // Звук открытия
            soundManager.play('openCase');
            
            const response = await apiService.post('/cases/open', { caseId });
            
            if (response.ok && response.prize) {
                // Обновляем состояние
                state.user.signals = response.newBalance;
                state.user.inventory.push(response.prize);
                
                // Обновляем UI
                UI.updateBalance();
                UI.showCaseResult(response.prize);
                
                utils.showNotification(`Получен: ${response.prize.name}!`, 'success');
            }
        } catch (error) {
            console.error('Ошибка открытия кейса:', error);
            utils.showNotification('Не удалось открыть кейс', 'error');
        } finally {
            state.isLoading = false;
            button.disabled = false;
            button.textContent = 'Открыть';
        }
    },
    
    async handleBuyItem(button) {
        const itemId = parseInt(button.dataset.itemId);
        const item = state.marketItems.find(i => i.id === itemId);
        
        if (!item) {
            utils.showNotification('Товар не найден', 'error');
            return;
        }
        
        if (state.user.signals < item.price_signals) {
            utils.showNotification('Недостаточно сигналов', 'error');
            return;
        }
        
        try {
            state.isLoading = true;
            button.disabled = true;
            button.textContent = 'Покупаем...';

            const response = await apiService.post('/market/buy', { listingId: item.id, userId: state.user.id });

            if (response.ok) {
                utils.showNotification('Телефон успешно куплен!', 'success');
                state.user.signals = response.newBalance;
                UI.updateBalance();
                UI.loadMarketPage();
                UI.loadInventoryPage();
            }
        } catch (error) {
            console.error('Ошибка покупки:', error);
            utils.showNotification(error.message || 'Не удалось купить телефон', 'error');
        } finally {
            state.isLoading = false;
            button.disabled = false;
            button.textContent = 'Купить';
        }
    },

   handleSellItem(button) {
       const inventoryId = parseInt(button.dataset.inventoryId);
       console.log("Trying to sell item with inventoryId:", inventoryId);
       console.log("Current inventory:", state.user.inventory);
       const item = state.user.inventory.find(i => i.id === inventoryId);
       
       if (!item) {
           utils.showNotification('Предмет не найден в инвентаре', 'error');
           return;
       }

       const modal = elements.sellItemModal;
       modal.querySelector('#sell-item-name').textContent = item.name;
       modal.querySelector('#sell-item-id').value = item.id;
       modal.classList.add('active');

       const form = modal.querySelector('#sell-item-form');
       form.onsubmit = async (e) => {
           e.preventDefault();
           const price = parseInt(modal.querySelector('#sell-price').value);
           if (isNaN(price) || price <= 0) {
               utils.showNotification('Введите корректную цену', 'error');
               return;
           }

           try {
               const response = await apiService.post('/market/sell', {
                   inventoryItemId: item.id,
                   userId: state.user.id,
                   price: price
               });

               if (response.ok) {
                   utils.showNotification('Телефон выставлен на продажу!', 'success');
                   modal.classList.remove('active');
                   UI.loadInventoryPage(); // Обновляем инвентарь
                   UI.loadMarketPage(); // Обновляем маркет
               }
           } catch (error) {
               utils.showNotification(error.message || 'Не удалось выставить на продажу', 'error');
           }
       };
   },
   
   async handleUnlistItem(button) {
       const itemId = parseInt(button.dataset.itemId);
       // Логика снятия с продажи
   },

    handleMarketTab(button) {
        const tabId = button.dataset.tab;
        
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabId}-tab`).classList.add('active');
        
        if (tabId === 'buy') {
            UI.renderMarketItems('buy');
        } else if (tabId === 'sell') {
            // UI для продажи уже в инвентаре
            UI.loadInventoryPage('sell-phone-list');
        } else if (tabId === 'my-sales') {
            UI.renderMarketItems('my-listings');
        }
    }
};

// ======================
// Инициализация Telegram WebApp
// ======================
let tg = null;

function initTelegramWebApp() {
    if (window.Telegram?.WebApp) {
        tg = window.Telegram.WebApp;
        tg.expand();
        tg.enableClosingConfirmation();
        
        // Загружаем данные пользователя
        if (tg.initDataUnsafe?.user) {
            const user = tg.initDataUnsafe.user;
            state.user.id = user.id;
            state.user.firstName = user.first_name || 'Игрок';
            state.user.username = user.username || 'player';
            state.user.photoUrl = user.photo_url;
        }
        
        return true;
    }
    
    // Тестовые данные для разработки
    console.warn('Telegram WebApp not available, using test data');
    state.user = {
        id: Date.now(),
        firstName: 'Тестовый',
        username: 'test_user',
        signals: 1000,
        inventory: []
    };
    
    return false;
}

// ======================
// Загрузка данных пользователя
// ======================
async function loadUserData() {
    try {
        const response = await apiService.get('/user');
        if (response.ok && response.user) {
            state.user = {
                ...state.user,
                ...response.user
            };
        }
    } catch (error) {
        console.error('Ошибка загрузки данных пользователя:', error);
    }
}

// ======================
// Главная функция инициализации
// ======================
async function initApp() {
    try {
        // Инициализация Telegram WebApp
        initTelegramWebApp();
        
        // Инициализация DOM элементов
        elements.init();
        
        // Загрузка данных пользователя
        await loadUserData();
        
        // Инициализация обработчиков событий
        EventHandlers.init();
        
        // Обновление UI
        UI.updateBalance();
        UI.updateUserAvatar();
        
        // Показываем главную страницу
        UI.showPage('home');
        
        // Скрываем загрузчик
        const loader = document.querySelector('.app-loading');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 300);
        }
        
        document.body.classList.add('loaded');
        
        console.log('✅ Приложение успешно инициализировано');
        
    } catch (error) {
        console.error('❌ Ошибка инициализации приложения:', error);
        utils.showNotification('Ошибка загрузки приложения', 'error');
    }
}

// ======================
// Экспорт и запуск
// ======================
export default initApp;

if (typeof window !== 'undefined') {
    window.initApp = initApp;
}

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
    
    init() {
        this.navItems = document.querySelectorAll('.nav-item');
        this.mainContent = document.querySelector('.main-content');
        this.userAvatar = document.getElementById('user-avatar');
        this.profileAvatar = document.querySelector('.profile-avatar');
        this.balanceElement = document.querySelector('.balance-value');
        this.signalsCount = document.getElementById('signals-count');
        this.pages = document.querySelectorAll('.page');
        this.caseResultModal = document.querySelector('.case-result-modal');
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
    
    async loadInventoryPage() {
        const inventoryList = document.getElementById('inventory-list');
        if (!inventoryList) return;
        
        try {
            // Показываем загрузку
            inventoryList.innerHTML = '<div class="loading-state"><div class="loading-spinner"><div class="spinner"></div><p>Загрузка...</p></div></div>';
            
            // Загружаем инвентарь
            const response = await apiService.get('/inventory?userId=test_user');
            if (response.ok && response.inventory) {
                state.user.inventory = response.inventory;
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
            
            const userId = state.user.id || 'test_user';
            const response = await apiService.get(`/market?userId=${userId}`);
            state.marketItems = response.items || [];
            
            this.renderMarketItems();
        } catch (error) {
            console.error('Ошибка загрузки маркета:', error);
            marketItems.innerHTML = '<div class="error-state"><p>Не удалось загрузить маркет</p></div>';
        }
    },
    
    renderMarketItems() {
        const marketItems = document.getElementById('market-items');
        if (!marketItems) return;
        
        marketItems.innerHTML = '';
        
        if (state.marketItems.length === 0) {
            marketItems.innerHTML = '<div class="empty-state"><i class="fas fa-store-slash"></i><p>На рынке пока нет товаров</p><p class="text-soft">Станьте первым продавцом!</p></div>';
            return;
        }
        
        state.marketItems.forEach(item => {
            const itemCard = utils.createElement('div', {
                class: `market-item rarity-${item.rarity}`
            }, [
                utils.createElement('div', { class: 'item-image' }, [
                    utils.createElement('img', {
                        src: item.image || `https://via.placeholder.com/80?text=${encodeURIComponent(item.name.split(' ')[0])}`,
                        alt: item.name
                    })
                ]),
                utils.createElement('div', { class: 'item-details' }, [
                    utils.createElement('h4', { text: item.name }),
                    utils.createElement('div', { class: 'item-seller', text: `Продавец: ${item.sellerName}` }),
                    utils.createElement('div', { class: 'item-rarity', text: utils.getRarityName(item.rarity) })
                ]),
                utils.createElement('div', { class: 'item-actions' }, [
                    utils.createElement('div', { class: 'item-price' }, [
                        `${item.price} `,
                        utils.createElement('i', { class: 'fas fa-bolt' })
                    ]),
                    utils.createElement('button', {
                        class: 'btn btn-buy',
                        'data-listing-id': item.id,
                        text: 'Купить'
                    })
                ])
            ]);
            
            marketItems.appendChild(itemCard);
        });
    },
    
    async loadSellTab() {
        const sellPhoneList = document.getElementById('sell-phone-list');
        if (!sellPhoneList) return;
        
        sellPhoneList.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
        
        // Обновляем инвентарь
        try {
            const userId = state.user.id || 'test_user';
            const response = await apiService.get(`/inventory?userId=${userId}`);
            if (response.ok && response.inventory) {
                state.user.inventory = response.inventory;
            }
        } catch (error) {
            console.error('Ошибка загрузки инвентаря:', error);
        }
        
        sellPhoneList.innerHTML = '';
        
        if (state.user.inventory.length === 0) {
            sellPhoneList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <p>Нет телефонов для продажи</p>
                    <p class="text-soft">Откройте кейсы, чтобы получить телефоны</p>
                </div>
            `;
            return;
        }
        
        state.user.inventory.forEach(phone => {
            const phoneCard = utils.createElement('div', {
                class: `phone-card rarity-${phone.rarity || 'common'} sellable`
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
                utils.createElement('button', {
                    class: 'btn btn-sell-phone',
                    'data-phone-id': phone.id,
                    'data-phone-name': phone.name,
                    text: 'Продать'
                })
            ]);
            
            sellPhoneList.appendChild(phoneCard);
        });
    },
    
    async loadMySalesTab() {
        const salesList = document.getElementById('sales-list');
        if (!salesList) return;
        
        salesList.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
        
        try {
            const userId = state.user.id || 'test_user';
            const response = await apiService.get(`/market/my-listings?userId=${userId}`);
            const myListings = response.listings || [];
            
            salesList.innerHTML = '';
            
            if (myListings.length === 0) {
                salesList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-receipt"></i>
                        <p>У вас пока нет активных продаж</p>
                    </div>
                `;
                return;
            }
            
            myListings.forEach(listing => {
                const listingCard = utils.createElement('div', {
                    class: `sale-card rarity-${listing.rarity}`
                }, [
                    utils.createElement('div', { class: 'sale-image' }, [
                        utils.createElement('img', {
                            src: listing.image || 'https://via.placeholder.com/60?text=Phone',
                            alt: listing.name
                        })
                    ]),
                    utils.createElement('div', { class: 'sale-info' }, [
                        utils.createElement('h4', { text: listing.name }),
                        utils.createElement('div', { class: 'sale-rarity', text: utils.getRarityName(listing.rarity) }),
                        utils.createElement('div', { class: 'sale-price' }, [
                            utils.createElement('i', { class: 'fas fa-bolt' }),
                            ` ${listing.price} Сигналов`
                        ])
                    ]),
                    utils.createElement('button', {
                        class: 'btn btn-outline btn-cancel-sale',
                        'data-listing-id': listing.id,
                        text: 'Снять с продажи'
                    })
                ]);
                
                salesList.appendChild(listingCard);
            });
        } catch (error) {
            console.error('Ошибка загрузки продаж:', error);
            salesList.innerHTML = '<div class="error-state"><p>Не удалось загрузить продажи</p></div>';
        }
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
        // Навигация
        elements.navItems.forEach(item => {
            item.addEventListener('click', this.handleNavigation);
        });
        
        // Делегирование событий для динамического контента
        document.addEventListener('click', this.handleGlobalClick);
        
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
        
        // Продажа телефона
        const sellBtn = e.target.closest('.btn-sell-phone');
        if (sellBtn) {
            e.preventDefault();
            EventHandlers.handleSellPhone(sellBtn);
            return;
        }
        
        // Снятие с продажи
        const cancelSaleBtn = e.target.closest('.btn-cancel-sale');
        if (cancelSaleBtn) {
            e.preventDefault();
            EventHandlers.handleCancelSale(cancelSaleBtn);
            return;
        }
        
        // Переключение вкладок маркета
        const tabBtn = e.target.closest('.tab-btn');
        if (tabBtn) {
            e.preventDefault();
            EventHandlers.handleMarketTab(tabBtn);
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
        if (state.isLoading) return;
        
        const listingId = button.dataset.listingId;
        const item = state.marketItems.find(i => i.id === listingId);
        
        if (!item) {
            utils.showNotification('Товар не найден', 'error');
            return;
        }
        
        if (state.user.signals < item.price) {
            utils.showNotification('Недостаточно сигналов', 'error');
            soundManager.play('error');
            return;
        }
        
        try {
            state.isLoading = true;
            button.disabled = true;
            button.textContent = 'Покупаем...';
            
            const userId = state.user.id || 'test_user';
            const response = await apiService.post('/market/buy', {
                userId,
                listingId
            });
            
            if (response.ok) {
                // Обновляем баланс
                state.user.signals = response.newBalance;
                UI.updateBalance();
                
                // Добавляем в инвентарь
                state.user.inventory.push(response.phone);
                
                // Удаляем из списка маркета
                state.marketItems = state.marketItems.filter(i => i.id !== listingId);
                UI.renderMarketItems();
                
                utils.showNotification(`Куплен: ${item.name}!`, 'success');
                soundManager.play('success');
            } else {
                utils.showNotification(response.error || 'Ошибка покупки', 'error');
            }
        } catch (error) {
            console.error('Ошибка покупки:', error);
            utils.showNotification('Не удалось купить товар', 'error');
        } finally {
            state.isLoading = false;
            button.disabled = false;
            button.textContent = 'Купить';
        }
    },
    
    async handleSellPhone(button) {
        const phoneId = button.dataset.phoneId;
        const phoneName = button.dataset.phoneName;
        
        // Показываем промпт для ввода цены
        const priceInput = prompt(`Укажите цену для "${phoneName}" (в сигналах):`, '100');
        
        if (!priceInput) return; // Отменили
        
        const price = parseInt(priceInput);
        
        if (isNaN(price) || price <= 0) {
            utils.showNotification('Неверная цена', 'error');
            return;
        }
        
        try {
            button.disabled = true;
            button.textContent = 'Выставляем...';
            
            const userId = state.user.id || 'test_user';
            const response = await apiService.post('/market/sell', {
                userId,
                phoneId,
                price
            });
            
            if (response.ok) {
                // Удаляем из инвентаря
                state.user.inventory = state.user.inventory.filter(p => p.id !== phoneId);
                
                // Перезагружаем вкладку продажи
                UI.loadSellTab();
                
                utils.showNotification(`${phoneName} выставлен на продажу за ${price} сигналов!`, 'success');
                soundManager.play('success');
            } else {
                utils.showNotification(response.error || 'Ошибка продажи', 'error');
            }
        } catch (error) {
            console.error('Ошибка продажи:', error);
            utils.showNotification('Не удалось выставить на продажу', 'error');
        } finally {
            button.disabled = false;
            button.textContent = 'Продать';
        }
    },
    
    async handleCancelSale(button) {
        const listingId = button.dataset.listingId;
        
        try {
            button.disabled = true;
            button.textContent = 'Снимаем...';
            
            const userId = state.user.id || 'test_user';
            const response = await apiService.post(`/market/listing/${listingId}`, {
                userId
            }, 'DELETE');
            
            if (response.ok) {
                // Добавляем телефон обратно в инвентарь
                state.user.inventory.push(response.phone);
                
                // Перезагружаем вкладку "Мои продажи"
                UI.loadMySalesTab();
                
                utils.showNotification('Товар снят с продажи', 'success');
                soundManager.play('success');
            } else {
                utils.showNotification(response.error || 'Ошибка отмены', 'error');
            }
        } catch (error) {
            console.error('Ошибка отмены продажи:', error);
            utils.showNotification('Не удалось снять с продажи', 'error');
        } finally {
            button.disabled = false;
            button.textContent = 'Снять с продажи';
        }
    },
    
    handleMarketTab(button) {
        const tabId = button.dataset.tab;
        
        // Обновляем активную вкладку
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn === button);
        });
        
        // Показываем контент
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabId}-tab`);
        });
        
        // Загружаем данные
        switch(tabId) {
            case 'buy':
                UI.renderMarketItems();
                break;
            case 'sell':
                UI.loadSellTab();
                break;
            case 'my-sales':
                UI.loadMySalesTab();
                break;
        }
        
        soundManager.play('buttonClick');
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

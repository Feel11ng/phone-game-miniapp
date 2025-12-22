// Импорт утилит
import { apiService, throttle, debounce } from './api.js';
import AnimationManager from './animations.js';

// ======================
// Конфигурация
// ======================
const CONFIG = {
    ANIMATION_DURATION: 300,
    TRANSITION_DELAY: 100,
    API_TIMEOUT: 10000
};

// ======================
// Состояние приложения
// ======================
const state = {
    user: {
        id: null,
        firstName: 'Гость',
        username: 'guest',
        photoUrl: null,
        balance: 0,
        inventory: []
    },
    isLoading: false,
    currentPage: 'home',
    // Другие состояния...
};

// ======================
// Утилиты
// ======================
const utils = {
    formatNumber: (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '),
    
    showNotification: (message, type = 'info') => {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    },
    
    // Другие утилиты...
};

// ======================
// UI Компоненты
// ======================
const ui = {
    elements: {},
    
    initElements() {
        // Инициализация DOM-элементов
        this.elements = {
            navItems: document.querySelectorAll('.nav-item'),
            mainContent: document.querySelector('.main-content'),
            profileAvatar: document.querySelector('.profile-avatar'),
            balanceElement: document.querySelector('.balance-value'),
            // Другие элементы...
        };
    },
    
    // Функция для создания эффекта конфетти
    createConfetti(container) {
        if (!container) return;
        
        container.innerHTML = '';
        
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            
            const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            const size = Math.random() * 10 + 5;
            const posX = Math.random() * 100;
            const animationDuration = Math.random() * 3 + 2;
            
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
            
            container.appendChild(confetti);
            
            setTimeout(() => {
                confetti.remove();
            }, animationDuration * 1000);
        }
    },
    
    // Другие методы UI...
};

// ======================
// Обработчики событий
// ======================
const eventHandlers = {
    handleNavigation(e) {
        e.preventDefault();
        const target = e.currentTarget;
        const section = target.dataset.section;
        
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        target.classList.add('active');
        
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        
        const targetSection = document.querySelector(`#${section}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
            state.currentPage = section;
            
            switch(section) {
                case 'home': return ui.loadHomePage();
                case 'cases': return ui.loadCases();
                case 'inventory': return ui.loadInventory();
                case 'market': return ui.loadMarket();
            }
        }
    },
    
    // Другие обработчики событий...
};

// ======================
// Инициализация приложения
// ======================
async function initApp() {
    try {
        // Инициализация UI
        ui.initElements();
        
        // Загрузка данных пользователя
        await loadUserData();
        
        // Настройка обработчиков событий
        setupEventDelegation();
        
        // Показ главной страницы
        ui.showPage('home');
        
        console.log('Приложение инициализировано');
    } catch (error) {
        console.error('Ошибка при инициализации приложения:', error);
        utils.showNotification('Не удалось загрузить приложение', 'error');
    }
}

// ======================
// Вспомогательные функции
// ======================
async function loadUserData() {
    // Загрузка данных пользователя...
}

function setupEventDelegation() {
    // Настройка делегирования событий...
}

// Экспорт
if (typeof window !== 'undefined') {
    window.app = {
        init: initApp,
        state,
        ui,
        utils
    };
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', initApp);

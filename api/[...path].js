// Improved API endpoint with better structure
// In-memory data store (в продакшене замените на реальную БД)
const dataStore = {
    users: new Map(),
    inventory: new Map(),
    marketListings: new Map(), // Хранение объявлений: Map<listingId, listing>
    userListings: new Map() // Связь пользователь -> его объявления: Map<userId, Set<listingId>>
};

let nextListingId = 1; // Счетчик для ID объявлений

// Моковые данные кейсов
const CASES = [
    {
        id: 1,
        name: 'Базовый кейс',
        price: 50,
        image: 'https://via.placeholder.com/120?text=Basic',
        pool: [
            { id: 'ip13', name: 'iPhone 13', rarity: 'uncommon', image: 'https://via.placeholder.com/300?text=iPhone13', chance: 0.4 },
            { id: 'mi12', name: 'Xiaomi 12', rarity: 'common', image: 'https://via.placeholder.com/300?text=Xiaomi12', chance: 0.5 },
            { id: 'px6', name: 'Google Pixel 6', rarity: 'rare', image: 'https://via.placeholder.com/300?text=Pixel6', chance: 0.1 }
        ]
    },
    {
        id: 2,
        name: 'Премиум кейс',
        price: 150,
        image: 'https://via.placeholder.com/120?text=Premium',
        pool: [
            { id: 'ip15pm', name: 'iPhone 15 Pro Max', rarity: 'legendary', image: 'https://via.placeholder.com/300?text=15ProMax', chance: 0.05 },
            { id: 's23u', name: 'Samsung S23 Ultra', rarity: 'epic', image: 'https://via.placeholder.com/300?text=S23Ultra', chance: 0.15 },
            { id: 'px8p', name: 'Pixel 8 Pro', rarity: 'rare', image: 'https://via.placeholder.com/300?text=Pixel8Pro', chance: 0.3 },
            { id: 'op11', name: 'OnePlus 11', rarity: 'uncommon', image: 'https://via.placeholder.com/300?text=OP11', chance: 0.5 }
        ]
    },
    {
        id: 3,
        name: 'Легендарный кейс',
        price: 500,
        image: 'https://via.placeholder.com/120?text=Legendary',
        pool: [
            { id: 'ip15pmu', name: 'iPhone 15 Pro Max Ultra', rarity: 'legendary', image: 'https://via.placeholder.com/300?text=Ultra', chance: 0.2 },
            { id: 's24u', name: 'Samsung S24 Ultra', rarity: 'legendary', image: 'https://via.placeholder.com/300?text=S24', chance: 0.2 },
            { id: 'px9p', name: 'Pixel 9 Pro', rarity: 'epic', image: 'https://via.placeholder.com/300?text=P9Pro', chance: 0.4 },
            { id: 'fold5', name: 'Galaxy Z Fold 5', rarity: 'epic', image: 'https://via.placeholder.com/300?text=Fold5', chance: 0.2 }
        ]
    }
];

// Утилита для выбора приза на основе шансов
function selectPrizeFromPool(pool) {
    const random = Math.random();
    let cumulative = 0;
    
    for (const item of pool) {
        cumulative += item.chance;
        if (random <= cumulative) {
            return { ...item };
        }
    }
    
    return { ...pool[pool.length - 1] };
}

// Получить или создать пользователя
function getUserOrCreate(userId) {
    if (!dataStore.users.has(userId)) {
        dataStore.users.set(userId, {
            id: userId,
            firstName: 'Игрок',
            username: `player_${userId}`,
            signals: 1000,
            photoUrl: null
        });
        
        // Стартовый инвентарь
        dataStore.inventory.set(userId, [
            {
                id: `phone_${Date.now()}_1`,
                name: 'Samsung Galaxy A01',
                rarity: 'common',
                image: 'https://via.placeholder.com/120?text=A01'
            }
        ]);
    }
    
    return dataStore.users.get(userId);
}

// Главный обработчик
module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    
    // Handle OPTIONS
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }
    
    // Parse URL
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname.replace(/^\/api\/?/, '');
    const segments = path.split('/').filter(Boolean);
    
    // Parse body for POST requests
    const parseBody = () => new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch {
                resolve({});
            }
        });
    });
    
    try {
        // === GET /user ===
        if (req.method === 'GET' && segments[0] === 'user' && !segments[1]) {
            const userId = url.searchParams.get('userId') || 'test_user';
            const user = getUserOrCreate(userId);
            
            return res.status(200).json({
                ok: true,
                user
            });
        }
        
        // === GET /inventory ===
        if (req.method === 'GET' && (segments[0] === 'inventory' || (segments[0] === 'user' && segments[1] === 'inventory'))) {
            const userId = url.searchParams.get('userId') || 'test_user';
            getUserOrCreate(userId);
            
            const inventory = dataStore.inventory.get(userId) || [];
            
            return res.status(200).json({
                ok: true,
                inventory
            });
        }
        
        // === GET /cases ===
        if (req.method === 'GET' && segments[0] === 'cases' && !segments[1]) {
            // Возвращаем кейсы без информации о шансах
            const casesPublic = CASES.map(c => ({
                id: c.id,
                name: c.name,
                price: c.price,
                image: c.image
            }));
            
            return res.status(200).json({
                ok: true,
                cases: casesPublic
            });
        }
        
        // === POST /cases/open ===
        if (req.method === 'POST' && segments[0] === 'cases' && segments[1] === 'open') {
            const body = await parseBody();
            const userId = body.userId || 'test_user';
            const caseId = Number(body.caseId);
            
            // Находим кейс
            const caseItem = CASES.find(c => c.id === caseId);
            if (!caseItem) {
                return res.status(404).json({
                    ok: false,
                    error: 'Кейс не найден'
                });
            }
            
            // Получаем пользователя
            const user = getUserOrCreate(userId);
            
            // Проверяем баланс
            if (user.signals < caseItem.price) {
                return res.status(400).json({
                    ok: false,
                    error: 'Недостаточно сигналов'
                });
            }
            
            // Выбираем приз
            const prize = selectPrizeFromPool(caseItem.pool);
            prize.id = `phone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Обновляем баланс
            user.signals -= caseItem.price;
            dataStore.users.set(userId, user);
            
            // Добавляем в инвентарь
            const inventory = dataStore.inventory.get(userId) || [];
            inventory.push(prize);
            dataStore.inventory.set(userId, inventory);
            
            return res.status(200).json({
                ok: true,
                prize,
                newBalance: user.signals
            });
        }
        
        // === GET /market ===
        if (req.method === 'GET' && segments[0] === 'market' && !segments[1]) {
            const userId = url.searchParams.get('userId') || 'test_user';
            
            // Получаем все объявления, кроме своих
            const allListings = Array.from(dataStore.marketListings.values())
                .filter(listing => listing.sellerId !== userId)
                .sort((a, b) => b.createdAt - a.createdAt); // Новые сверху
            
            return res.status(200).json({
                ok: true,
                items: allListings
            });
        }
        
        // === GET /market/my-listings ===
        if (req.method === 'GET' && segments[0] === 'market' && segments[1] === 'my-listings') {
            const userId = url.searchParams.get('userId') || 'test_user';
            
            // Получаем объявления пользователя
            const userListingIds = dataStore.userListings.get(userId) || new Set();
            const myListings = Array.from(userListingIds)
                .map(id => dataStore.marketListings.get(id))
                .filter(Boolean)
                .sort((a, b) => b.createdAt - a.createdAt);
            
            return res.status(200).json({
                ok: true,
                listings: myListings
            });
        }
        
        // === POST /market/buy ===
        if (req.method === 'POST' && segments[0] === 'market' && segments[1] === 'buy') {
            const body = await parseBody();
            const userId = body.userId || 'test_user';
            const listingId = body.listingId;
            
            // Находим объявление
            const listing = dataStore.marketListings.get(listingId);
            if (!listing) {
                return res.status(404).json({
                    ok: false,
                    error: 'Объявление не найдено'
                });
            }
            
            // Проверяем, что покупатель не продавец
            if (listing.sellerId === userId) {
                return res.status(400).json({
                    ok: false,
                    error: 'Нельзя купить собственный товар'
                });
            }
            
            // Получаем покупателя
            const buyer = getUserOrCreate(userId);
            
            // Проверяем баланс
            if (buyer.signals < listing.price) {
                return res.status(400).json({
                    ok: false,
                    error: 'Недостаточно сигналов'
                });
            }
            
            // Получаем продавца
            const seller = getUserOrCreate(listing.sellerId);
            
            // Выполняем транзакцию
            buyer.signals -= listing.price;
            seller.signals += listing.price;
            
            // Обновляем пользователей
            dataStore.users.set(userId, buyer);
            dataStore.users.set(listing.sellerId, seller);
            
            // Переносим телефон в инвентарь покупателя
            const buyerInventory = dataStore.inventory.get(userId) || [];
            buyerInventory.push(listing.phone);
            dataStore.inventory.set(userId, buyerInventory);
            
            // Удаляем объявление
            dataStore.marketListings.delete(listingId);
            
            // Удаляем из списка объявлений продавца
            const sellerListings = dataStore.userListings.get(listing.sellerId);
            if (sellerListings) {
                sellerListings.delete(listingId);
            }
            
            return res.status(200).json({
                ok: true,
                message: 'Покупка выполнена успешно',
                newBalance: buyer.signals,
                phone: listing.phone
            });
        }
        
        // === POST /market/sell ===
        if (req.method === 'POST' && segments[0] === 'market' && segments[1] === 'sell') {
            const body = await parseBody();
            const userId = body.userId || 'test_user';
            const phoneId = body.phoneId;
            const price = Number(body.price);
            
            // Валидация
            if (!phoneId || !price || price <= 0) {
                return res.status(400).json({
                    ok: false,
                    error: 'Неверные данные'
                });
            }
            
            // Получаем пользователя
            const user = getUserOrCreate(userId);
            
            // Получаем инвентарь
            const inventory = dataStore.inventory.get(userId) || [];
            
            // Находим телефон в инвентаре
            const phoneIndex = inventory.findIndex(p => p.id === phoneId);
            if (phoneIndex === -1) {
                return res.status(404).json({
                    ok: false,
                    error: 'Телефон не найден в инвентаре'
                });
            }
            
            const phone = inventory[phoneIndex];
            
            // Удаляем из инвентаря
            inventory.splice(phoneIndex, 1);
            dataStore.inventory.set(userId, inventory);
            
            // Создаем объявление
            const listingId = `listing_${nextListingId++}`;
            const listing = {
                id: listingId,
                phone: phone,
                price: price,
                sellerId: userId,
                sellerName: user.firstName || user.username,
                createdAt: Date.now(),
                // Дублируем информацию для удобства
                name: phone.name,
                rarity: phone.rarity,
                image: phone.image
            };
            
            // Сохраняем объявление
            dataStore.marketListings.set(listingId, listing);
            
            // Добавляем в список объявлений пользователя
            if (!dataStore.userListings.has(userId)) {
                dataStore.userListings.set(userId, new Set());
            }
            dataStore.userListings.get(userId).add(listingId);
            
            return res.status(200).json({
                ok: true,
                message: 'Товар выставлен на продажу',
                listing: listing
            });
        }
        
        // === DELETE /market/listing/:id ===
        if (req.method === 'DELETE' && segments[0] === 'market' && segments[1] === 'listing') {
            const listingId = segments[2];
            const body = await parseBody();
            const userId = body.userId || url.searchParams.get('userId') || 'test_user';
            
            // Находим объявление
            const listing = dataStore.marketListings.get(listingId);
            if (!listing) {
                return res.status(404).json({
                    ok: false,
                    error: 'Объявление не найдено'
                });
            }
            
            // Проверяем, что удаляет владелец
            if (listing.sellerId !== userId) {
                return res.status(403).json({
                    ok: false,
                    error: 'Нет прав для удаления этого объявления'
                });
            }
            
            // Возвращаем телефон в инвентарь
            const inventory = dataStore.inventory.get(userId) || [];
            inventory.push(listing.phone);
            dataStore.inventory.set(userId, inventory);
            
            // Удаляем объявление
            dataStore.marketListings.delete(listingId);
            
            // Удаляем из списка объявлений пользователя
            const userListings = dataStore.userListings.get(userId);
            if (userListings) {
                userListings.delete(listingId);
            }
            
            return res.status(200).json({
                ok: true,
                message: 'Объявление удалено',
                phone: listing.phone
            });
        }
        
        // === POST /logs (логирование) ===
        if (req.method === 'POST' && segments[0] === 'logs') {
            await parseBody(); // Просто читаем body
            return res.status(200).json({ ok: true });
        }
        
        // 404 - Not Found
        return res.status(404).json({
            ok: false,
            error: 'Endpoint not found',
            path: `/${path}`
        });
        
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({
            ok: false,
            error: 'Internal Server Error',
            message: error.message
        });
    }
};

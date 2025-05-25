// JavaScript для страницы заказов с управлением услугами
let ordersData = [];
let filteredOrders = [];
let currentPage = 1;
let pageSize = 20;
let currentSort = { field: 'created_at', order: 'desc' };
let currentView = 'table';
let filters = {
    search: '',
    status: '',
    manager: '',
    dateRange: ''
};
let currentOrderId = null; // Для работы с модальными окнами

async function initOrdersPage() {
    try {
        showLoading();
        await loadOrders();
        await loadStats();
        await loadManagers();
        setupEventListeners();
        renderOrders();
        
    } catch (error) {
        console.error('Ошибка инициализации страницы заказов:', error);
        notifications.error('Ошибка загрузки данных');
    } finally {
        hideLoading();
    }
}

async function loadOrders() {
    try {
        const response = await api.getOrders({
            page_size: 1000,
            ordering: `${currentSort.order === 'desc' ? '-' : ''}${currentSort.field}`
        });
        
        ordersData = response.results || [];
        filteredOrders = [...ordersData];
        
        updateResultsCount();
        
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        throw error;
    }
}

async function loadStats() {
    try {
        const stats = await api.getOrdersStatsByStatus();
        
        const total = ordersData.length;
        const inProgress = ordersData.filter(order => order.status === 'in_progress').length;
        const completed = ordersData.filter(order => order.status === 'completed').length;
        const totalAmount = ordersData.reduce((sum, order) => sum + parseFloat(order.total_cost || 0), 0);
        
        updateElement('stats-total', total);
        updateElement('stats-in-progress', inProgress);
        updateElement('stats-completed', completed);
        updateElement('stats-total-amount', formatCurrency(totalAmount));
        
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

async function loadManagers() {
    try {
        if (getCurrentUserRole() === 'owner') {
            const response = await api.getUsers({ role: 'manager' });
            const managerSelect = document.getElementById('manager-filter');
            
            response.results?.forEach(manager => {
                const option = document.createElement('option');
                option.value = manager.id;
                option.textContent = `${manager.first_name} ${manager.last_name}`;
                managerSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Ошибка загрузки менеджеров:', error);
    }
}

function setupEventListeners() {
    // Поиск
    const searchInput = document.getElementById('search');
    searchInput.addEventListener('input', TimingUtils.debounce(handleSearch, 300));
    
    // Фильтры
    document.getElementById('status-filter').addEventListener('change', handleFilterChange);
    document.getElementById('date-filter').addEventListener('change', handleFilterChange);
    
    const managerFilter = document.getElementById('manager-filter');
    if (managerFilter) {
        managerFilter.addEventListener('change', handleFilterChange);
    }
    
    // Сортировка
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', handleSort);
    });
    
    // Очистка фильтров
    document.querySelector('[onclick="clearFilters()"]').onclick = clearFilters;
    
    // Экспорт
    document.querySelector('[onclick="exportOrders()"]').onclick = exportOrders;
    
    // Модальные окна
    setupModalEventListeners();
}

function setupModalEventListeners() {
    // Закрытие модальных окон по ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeOrderDetailModal();
            closeAddServiceModal();
        }
    });
    
    // Обработчик изменения услуги
    const serviceSelect = document.getElementById('service-select');
    if (serviceSelect) {
        serviceSelect.addEventListener('change', handleServiceChange);
    }
    
    // Обработчик изменения цены для расчета маржи
    const servicePriceInput = document.getElementById('service-price');
    if (servicePriceInput) {
        servicePriceInput.addEventListener('input', calculateServiceMargin);
    }
}

function handleSearch(e) {
    filters.search = e.target.value.toLowerCase().trim();
    applyFilters();
}

function handleFilterChange(e) {
    const filterId = e.target.id;
    
    if (filterId === 'status-filter') {
        filters.status = e.target.value;
    } else if (filterId === 'manager-filter') {
        filters.manager = e.target.value;
    } else if (filterId === 'date-filter') {
        filters.dateRange = e.target.value;
    }
    
    applyFilters();
}

function handleSort(e) {
    const field = e.currentTarget.dataset.sort;
    
    if (currentSort.field === field) {
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.order = 'asc';
    }
    
    updateSortIcons();
    applySorting();
    renderOrders();
}

function applyFilters() {
    filteredOrders = ordersData.filter(order => {
        // Поиск по тексту
        if (filters.search) {
            const searchText = filters.search;
            const searchFields = [
                order.id?.toString() || '',
                order.client_name || '',
                order.manager_name || ''
            ].join(' ').toLowerCase();
            
            if (!searchFields.includes(searchText)) {
                return false;
            }
        }
        
        // Фильтр по статусу
        if (filters.status && order.status !== filters.status) {
            return false;
        }
        
        // Фильтр по менеджеру
        if (filters.manager && order.manager?.toString() !== filters.manager) {
            return false;
        }
        
        // Фильтр по дате
        if (filters.dateRange) {
            const orderDate = new Date(order.created_at);
            const now = new Date();
            
            switch (filters.dateRange) {
                case 'today':
                    if (!DateUtils.isToday(orderDate)) return false;
                    break;
                case 'week':
                    const weekAgo = DateUtils.addDays(now, -7);
                    if (orderDate < weekAgo) return false;
                    break;
                case 'month':
                    if (orderDate.getMonth() !== now.getMonth() || 
                        orderDate.getFullYear() !== now.getFullYear()) return false;
                    break;
                case 'quarter':
                    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
                    if (orderDate < quarterStart) return false;
                    break;
            }
        }
        
        return true;
    });
    
    applySorting();
    currentPage = 1;
    updateResultsCount();
    renderOrders();
}

function applySorting() {
    filteredOrders.sort((a, b) => {
        let aVal = a[currentSort.field];
        let bVal = b[currentSort.field];
        
        if (currentSort.field === 'created_at') {
            aVal = new Date(aVal);
            bVal = new Date(bVal);
        } else if (currentSort.field === 'total_cost') {
            aVal = parseFloat(aVal) || 0;
            bVal = parseFloat(bVal) || 0;
        } else if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }
        
        if (currentSort.order === 'desc') {
            return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
        } else {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        }
    });
}

function updateSortIcons() {
    document.querySelectorAll('.sortable i').forEach(icon => {
        icon.className = 'fas fa-sort ml-1 text-gray-400';
    });
    
    const activeHeader = document.querySelector(`[data-sort="${currentSort.field}"] i`);
    if (activeHeader) {
        activeHeader.className = `fas fa-sort-${currentSort.order === 'asc' ? 'up' : 'down'} ml-1 text-gray-700`;
    }
}

function renderOrders() {
    if (currentView === 'table') {
        renderTableView();
    } else {
        renderKanbanView();
    }
    
    if (currentView === 'table') {
        renderPagination();
    }
}

function renderTableView() {
    const tbody = document.getElementById('orders-table-body');
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageOrders = filteredOrders.slice(startIndex, endIndex);
    
    if (pageOrders.length === 0) {
        document.getElementById('table-view').classList.add('hidden');
        document.getElementById('empty-state').classList.remove('hidden');
        return;
    }
    
    document.getElementById('table-view').classList.remove('hidden');
    document.getElementById('empty-state').classList.add('hidden');
    
    const html = pageOrders.map(order => {
        const servicesText = order.items?.length > 0 
            ? `${order.items.length} услуг${order.items.length === 1 ? 'а' : order.items.length < 5 ? 'и' : ''}`
            : 'Нет услуг';
            
        const installersText = order.installers_names?.length > 0
            ? order.installers_names.map(installer => installer.name).join(', ')
            : 'Не назначены';
            
        return `
            <tr class="hover:bg-gray-50">
                <td>
                    <div class="flex items-center">
                        <span class="text-sm font-medium text-gray-900">
                            <a href="#" onclick="viewOrderDetail(${order.id})" class="hover:text-blue-600">
                                #${order.id}
                            </a>
                        </span>
                    </div>
                </td>
                <td>
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10">
                            <div class="h-10 w-10 rounded-full bg-gray-500 flex items-center justify-center">
                                <span class="text-sm font-medium text-white">
                                    ${order.client_name?.charAt(0).toUpperCase() || '?'}
                                </span>
                            </div>
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${order.client_name || 'Неизвестный клиент'}</div>
                            ${order.client_phone ? `<div class="text-sm text-gray-500">${formatPhone(order.client_phone)}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge status-${order.status}">
                        ${getStatusLabel(order.status)}
                    </span>
                </td>
                <td>
                    <div class="text-sm text-gray-900">${servicesText}</div>
                    ${order.items?.length > 0 ? `
                        <div class="text-sm text-gray-500">${StringUtils.truncate(order.items[0].service_name || '', 25)}</div>
                    ` : ''}
                </td>
                <td>
                    <div class="text-sm font-medium text-gray-900">${formatCurrency(order.total_cost || 0)}</div>
                </td>
                <td>
                    <div class="text-sm text-gray-900">${order.manager_name || 'Не назначен'}</div>
                </td>
                <td>
                    <div class="text-sm text-gray-900">${StringUtils.truncate(installersText, 20)}</div>
                </td>
                <td>
                    <div class="text-sm text-gray-900">${DateUtils.format(order.created_at, 'dd.MM.yyyy')}</div>
                    <div class="text-sm text-gray-500">${DateUtils.timeAgo(order.created_at)}</div>
                </td>
                <td class="text-right">
                    <div class="flex items-center justify-end space-x-2">
                        <button onclick="viewOrderDetail(${order.id})" 
                                class="text-gray-400 hover:text-gray-600" 
                                title="Просмотр">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${canEditOrder(order) ? `
                            <button onclick="editOrder(${order.id})" 
                                    class="text-blue-400 hover:text-blue-600" 
                                    title="Редактировать">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="changeOrderStatus(${order.id}, '${getNextStatus(order.status)}')" 
                                    class="text-green-400 hover:text-green-600" 
                                    title="${getNextStatusLabel(order.status)}">
                                <i class="fas fa-arrow-right"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = html;
}

function renderKanbanView() {
    const statusGroups = {
        new: [],
        in_progress: [],
        completed: []
    };
    
    // Группируем заказы по статусам
    filteredOrders.forEach(order => {
        if (statusGroups[order.status]) {
            statusGroups[order.status].push(order);
        }
    });
    
    // Обновляем счетчики
    document.getElementById('new-count').textContent = statusGroups.new.length;
    document.getElementById('in-progress-count').textContent = statusGroups.in_progress.length;
    document.getElementById('completed-count').textContent = statusGroups.completed.length;
    
    // Рендерим карточки для каждого статуса
    Object.entries(statusGroups).forEach(([status, orders]) => {
        const container = document.getElementById(`${status.replace('_', '-')}-orders`);
        
        if (orders.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-inbox text-4xl mb-4"></i>
                    <p>Нет заказов</p>
                </div>
            `;
            return;
        }
        
        const html = orders.map(order => `
            <div class="kanban-card" data-order-id="${order.id}">
                <div class="flex items-start justify-between mb-2">
                    <div class="flex items-center">
                        <span class="text-sm font-medium text-gray-900">#${order.id}</span>
                        <span class="ml-2 badge badge-primary">${formatCurrency(order.total_cost || 0)}</span>
                    </div>
                    <div class="flex space-x-1">
                        <button onclick="viewOrderDetail(${order.id})" 
                                class="text-gray-400 hover:text-gray-600 p-1" 
                                title="Просмотр">
                            <i class="fas fa-eye text-xs"></i>
                        </button>
                        ${canEditOrder(order) ? `
                            <button onclick="editOrder(${order.id})" 
                                    class="text-blue-400 hover:text-blue-600 p-1" 
                                    title="Редактировать">
                                <i class="fas fa-edit text-xs"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
                
                <div class="mb-3">
                    <h4 class="text-sm font-medium text-gray-900 mb-1">${order.client_name || 'Неизвестный клиент'}</h4>
                    ${order.client_phone ? `<p class="text-xs text-gray-500">${formatPhone(order.client_phone)}</p>` : ''}
                    ${order.client_address ? `<p class="text-xs text-gray-500 line-clamp-2">${order.client_address}</p>` : ''}
                </div>
                
                <div class="mb-3">
                    ${order.items?.length > 0 ? `
                        <p class="text-xs text-gray-600">${order.items.length} услуг${order.items.length === 1 ? 'а' : order.items.length < 5 ? 'и' : ''}</p>
                        <p class="text-xs text-gray-500">${StringUtils.truncate(order.items[0].service_name || '', 30)}</p>
                    ` : '<p class="text-xs text-gray-500">Нет услуг</p>'}
                </div>
                
                <div class="flex items-center justify-between pt-3 border-t border-gray-200">
                    <div class="text-xs text-gray-500">
                        ${DateUtils.timeAgo(order.created_at)}
                    </div>
                    ${canEditOrder(order) && getNextStatus(order.status) ? `
                        <button onclick="changeOrderStatus(${order.id}, '${getNextStatus(order.status)}')" 
                                class="btn btn-sm btn-outline text-xs">
                            ${getNextStatusLabel(order.status)}
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
        
        container.innerHTML = html;
    });
    
    // Показываем канбан и скрываем пустое состояние
    document.getElementById('kanban-view').classList.remove('hidden');
    document.getElementById('empty-state').classList.add('hidden');
}

function renderPagination() {
    const totalPages = Math.ceil(filteredOrders.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize + 1;
    const endIndex = Math.min(currentPage * pageSize, filteredOrders.length);
    
    updateElement('showing-from', startIndex);
    updateElement('showing-to', endIndex);
    updateElement('showing-total', filteredOrders.length);
    
    // Мобильная пагинация
    const prevMobile = document.getElementById('prev-mobile');
    const nextMobile = document.getElementById('next-mobile');
    
    if (prevMobile) {
        prevMobile.disabled = currentPage === 1;
        prevMobile.onclick = () => changePage(currentPage - 1);
    }
    
    if (nextMobile) {
        nextMobile.disabled = currentPage === totalPages;
        nextMobile.onclick = () => changePage(currentPage + 1);
    }
    
    // Десктопная пагинация
    const paginationContainer = document.getElementById('pagination-buttons');
    if (!paginationContainer) return;
    
    let paginationHTML = '';
    
    // Предыдущая страница
    paginationHTML += `
        <button onclick="changePage(${currentPage - 1})" 
                ${currentPage === 1 ? 'disabled' : ''} 
                class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${currentPage === 1 ? 'cursor-not-allowed opacity-50' : ''}">
            <i class="fas fa-chevron-left"></i>
        </button>
    `;
    
    // Номера страниц
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === currentPage;
        paginationHTML += `
            <button onclick="changePage(${i})" 
                    class="relative inline-flex items-center px-4 py-2 border text-sm font-medium ${isActive 
                        ? 'z-10 bg-primary-50 border-primary-500 text-primary-600' 
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }">
                ${i}
            </button>
        `;
    }
    
    // Следующая страница
    paginationHTML += `
        <button onclick="changePage(${currentPage + 1})" 
                ${currentPage === totalPages ? 'disabled' : ''} 
                class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${currentPage === totalPages ? 'cursor-not-allowed opacity-50' : ''}">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    paginationContainer.innerHTML = paginationHTML;
}

function changePage(page) {
    const totalPages = Math.ceil(filteredOrders.length / pageSize);
    
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    renderOrders();
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchView(view) {
    currentView = view;
    
    // Обновляем кнопки
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-primary-50', 'text-primary-600');
        btn.classList.add('text-gray-500');
    });
    
    const activeBtn = document.getElementById(`view-${view}`);
    activeBtn.classList.add('active', 'bg-primary-50', 'text-primary-600');
    activeBtn.classList.remove('text-gray-500');
    
    // Переключаем представления
    if (view === 'table') {
        document.getElementById('table-view').classList.remove('hidden');
        document.getElementById('kanban-view').classList.add('hidden');
        document.getElementById('pagination').classList.remove('hidden');
    } else {
        document.getElementById('table-view').classList.add('hidden');
        document.getElementById('kanban-view').classList.remove('hidden');
        document.getElementById('pagination').classList.add('hidden');
    }
    
    renderOrders();
}

function clearFilters() {
    filters = { search: '', status: '', manager: '', dateRange: '' };
    
    document.getElementById('search').value = '';
    document.getElementById('status-filter').value = '';
    document.getElementById('date-filter').value = '';
    
    const managerFilter = document.getElementById('manager-filter');
    if (managerFilter) {
        managerFilter.value = '';
    }
    
    filteredOrders = [...ordersData];
    currentPage = 1;
    
    updateResultsCount();
    renderOrders();
}

async function exportOrders() {
    try {
        showLoading();
        await api.exportOrders();
        notifications.success('Файл загружен');
    } catch (error) {
        console.error('Ошибка экспорта:', error);
        notifications.error('Ошибка экспорта данных');
    } finally {
        hideLoading();
    }
}

// Работа с деталями заказа
async function viewOrderDetail(orderId) {
    try {
        currentOrderId = orderId;
        
        // Загружаем детали заказа
        const orderData = await api.getOrder(orderId);
        
        // Обновляем заголовок
        document.getElementById('order-detail-title').textContent = `Заказ #${orderData.id}`;
        
        // Создаем контент
        const content = createOrderDetailContent(orderData);
        document.getElementById('order-detail-content').innerHTML = content;
        
        // Показываем модальное окно
        document.getElementById('order-detail-modal').classList.remove('hidden');
        
    } catch (error) {
        console.error('Ошибка загрузки деталей заказа:', error);
        notifications.error('Ошибка загрузки деталей заказа');
    }
}

function createOrderDetailContent(order) {
    const items = order.items || [];
    const totalCost = parseFloat(order.total_cost || 0);
    
    return `
        <!-- Основная информация -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Информация о заказе -->
            <div>
                <h4 class="text-lg font-medium text-gray-900 mb-4">Информация о заказе</h4>
                <div class="space-y-3">
                    <div class="flex justify-between">
                        <span class="text-sm text-gray-600">Номер заказа:</span>
                        <span class="font-medium">#${order.id}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-sm text-gray-600">Статус:</span>
                        <span class="badge status-${order.status}">${getStatusLabel(order.status)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-sm text-gray-600">Дата создания:</span>
                        <span class="font-medium">${DateUtils.format(order.created_at, 'dd.MM.yyyy HH:mm')}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-sm text-gray-600">Менеджер:</span>
                        <span class="font-medium">${order.manager_name || 'Не назначен'}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-sm text-gray-600">Общая сумма:</span>
                        <span class="text-lg font-bold text-green-600">${formatCurrency(totalCost)}</span>
                    </div>
                </div>
            </div>
            
            <!-- Информация о клиенте -->
            <div>
                <h4 class="text-lg font-medium text-gray-900 mb-4">Клиент</h4>
                <div class="space-y-3">
                    <div class="flex items-center">
                        <i class="fas fa-user text-gray-400 mr-2"></i>
                        <span class="font-medium">${order.client_name || 'Неизвестный клиент'}</span>
                    </div>
                    ${order.client_phone ? `
                        <div class="flex items-center">
                            <i class="fas fa-phone text-gray-400 mr-2"></i>
                            <span>${formatPhone(order.client_phone)}</span>
                        </div>
                    ` : ''}
                    ${order.client_address ? `
                        <div class="flex items-start">
                            <i class="fas fa-map-marker-alt text-gray-400 mr-2 mt-1"></i>
                            <span>${order.client_address}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
        
        <!-- Услуги в заказе -->
        <div class="mt-6">
            <div class="flex items-center justify-between mb-4">
                <h4 class="text-lg font-medium text-gray-900">Услуги в заказе</h4>
                ${canEditOrder(order) ? `
                    <button onclick="openAddServiceModal()" class="btn btn-sm btn-success">
                        <i class="fas fa-plus mr-1"></i>
                        Добавить услугу
                    </button>
                ` : ''}
            </div>
            
            ${items.length > 0 ? `
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Услуга</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Цена</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Продавец</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                                ${canEditOrder(order) ? '<th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>' : ''}
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${items.map(item => `
                                <tr>
                                    <td class="px-4 py-4">
                                        <div>
                                            <div class="text-sm font-medium text-gray-900">${item.service_name}</div>
                                            <div class="text-sm text-gray-500">${item.service_category_display}</div>
                                        </div>
                                    </td>
                                    <td class="px-4 py-4">
                                        <span class="text-sm font-medium text-gray-900">${formatCurrency(item.price)}</span>
                                    </td>
                                    <td class="px-4 py-4">
                                        <span class="text-sm text-gray-900">${item.seller_name}</span>
                                    </td>
                                    <td class="px-4 py-4">
                                        <span class="text-sm text-gray-500">${DateUtils.format(item.created_at, 'dd.MM.yyyy')}</span>
                                    </td>
                                    ${canEditOrder(order) ? `
                                        <td class="px-4 py-4 text-right">
                                            <button onclick="removeServiceFromOrder(${item.id})" 
                                                    class="text-red-400 hover:text-red-600" 
                                                    title="Удалить">
                                                <i class="fas fa-trash text-sm"></i>
                                            </button>
                                        </td>
                                    ` : ''}
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot class="bg-gray-50">
                            <tr>
                                <td colspan="${canEditOrder(order) ? '4' : '3'}" class="px-4 py-3 text-right text-sm font-medium text-gray-900">
                                    Итого:
                                </td>
                                <td class="px-4 py-3 text-left">
                                    <span class="text-lg font-bold text-green-600">${formatCurrency(totalCost)}</span>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            ` : `
                <div class="text-center py-8 bg-gray-50 rounded-lg">
                    <i class="fas fa-clipboard-list text-4xl text-gray-400 mb-4"></i>
                    <p class="text-gray-500 mb-4">В заказе пока нет услуг</p>
                    ${canEditOrder(order) ? `
                        <button onclick="openAddServiceModal()" class="btn btn-primary">
                            <i class="fas fa-plus mr-2"></i>
                            Добавить первую услугу
                        </button>
                    ` : ''}
                </div>
            `}
        </div>
        
        <!-- Монтажники -->
        ${order.installers_names?.length > 0 ? `
            <div class="mt-6">
                <h4 class="text-lg font-medium text-gray-900 mb-4">Назначенные монтажники</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    ${order.installers_names.map(installer => `
                        <div class="flex items-center p-3 bg-gray-50 rounded-lg">
                            <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                                <span class="text-sm font-medium text-white">${installer.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <span class="font-medium text-gray-900">${installer.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
    `;
}

function closeOrderDetailModal() {
    document.getElementById('order-detail-modal').classList.add('hidden');
    currentOrderId = null;
}

function editCurrentOrder() {
    if (currentOrderId) {
        closeOrderDetailModal();
        editOrder(currentOrderId);
    }
}

// Работа с услугами в заказе
async function openAddServiceModal() {
    if (!currentOrderId) {
        notifications.error('Не выбран заказ');
        return;
    }
    
    try {
        // Загружаем данные для модального окна
        const [servicesResponse, sellersResponse] = await Promise.all([
            api.getServices(),
            api.getUsers({ role__in: 'manager,installer' })
        ]);
        
        // Заполняем селект услуг
        const serviceSelect = document.getElementById('service-select');
        serviceSelect.innerHTML = '<option value="">Выберите услугу</option>';
        
        servicesResponse.results?.forEach(service => {
            const option = document.createElement('option');
            option.value = service.id;
            option.textContent = `${service.name} (${service.category_display})`;
            option.dataset.costPrice = service.cost_price;
            option.dataset.sellingPrice = service.selling_price;
            serviceSelect.appendChild(option);
        });
        
        // Заполняем селект продавцов
        const sellerSelect = document.getElementById('service-seller');
        sellerSelect.innerHTML = '<option value="">Выберите продавца</option>';
        
        sellersResponse.results?.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.first_name} ${user.last_name} (${user.role === 'manager' ? 'Менеджер' : 'Монтажник'})`;
            sellerSelect.appendChild(option);
        });
        
        // Очищаем форму
        document.getElementById('add-service-form').reset();
        document.getElementById('service-info').classList.add('hidden');
        
        // Показываем модальное окно
        document.getElementById('add-service-modal').classList.remove('hidden');
        
    } catch (error) {
        console.error('Ошибка загрузки данных для добавления услуги:', error);
        notifications.error('Ошибка загрузки данных');
    }
}

function closeAddServiceModal() {
    document.getElementById('add-service-modal').classList.add('hidden');
}

function handleServiceChange(e) {
    const selectedOption = e.target.selectedOptions[0];
    
    if (selectedOption.value) {
        const costPrice = parseFloat(selectedOption.dataset.costPrice || 0);
        const sellingPrice = parseFloat(selectedOption.dataset.sellingPrice || 0);
        
        // Заполняем рекомендуемую цену
        document.getElementById('service-price').value = sellingPrice;
        
        // Показываем информацию об услуге
        document.getElementById('service-cost').textContent = formatCurrency(costPrice);
        document.getElementById('service-recommended-price').textContent = formatCurrency(sellingPrice);
        document.getElementById('service-info').classList.remove('hidden');
        
        // Пересчитываем маржу
        calculateServiceMargin();
    } else {
        document.getElementById('service-info').classList.add('hidden');
        document.getElementById('service-price').value = '';
    }
}

function calculateServiceMargin() {
    const serviceSelect = document.getElementById('service-select');
    const priceInput = document.getElementById('service-price');
    const selectedOption = serviceSelect.selectedOptions[0];
    
    if (selectedOption && selectedOption.value && priceInput.value) {
        const costPrice = parseFloat(selectedOption.dataset.costPrice || 0);
        const sellingPrice = parseFloat(priceInput.value || 0);
        
        if (costPrice > 0 && sellingPrice > 0) {
            const margin = ((sellingPrice - costPrice) / costPrice * 100);
            const marginAmount = sellingPrice - costPrice;
            
            document.getElementById('service-margin').innerHTML = `
                <span class="${margin > 100 ? 'text-green-600' : margin > 50 ? 'text-yellow-600' : 'text-red-600'}">
                    ${margin.toFixed(1)}%
                </span>
                (${formatCurrency(marginAmount)})
            `;
        } else {
            document.getElementById('service-margin').textContent = '—';
        }
    }
}

async function addServiceToOrder() {
    if (!currentOrderId) {
        notifications.error('Не выбран заказ');
        return;
    }
    
    try {
        const form = document.getElementById('add-service-form');
        
        // Валидация формы
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        const formData = new FormData(form);
        const serviceData = {
            service: parseInt(formData.get('service')),
            price: parseFloat(formData.get('price')),
            seller: parseInt(formData.get('seller'))
        };
        
        // Добавляем услугу в заказ
        await api.addOrderItem(currentOrderId, serviceData);
        
        notifications.success('Услуга добавлена в заказ');
        closeAddServiceModal();
        
        // Обновляем детали заказа
        await viewOrderDetail(currentOrderId);
        
        // Обновляем список заказов
        await refreshData();
        
    } catch (error) {
        console.error('Ошибка добавления услуги:', error);
        notifications.apiError(error, 'Ошибка добавления услуги');
    }
}

async function removeServiceFromOrder(itemId) {
    if (!currentOrderId) {
        notifications.error('Не выбран заказ');
        return;
    }
    
    if (!confirm('Вы уверены, что хотите удалить эту услугу из заказа?')) {
        return;
    }
    
    try {
        // Используем API для удаления позиции
        await api.delete(`modal/order/${currentOrderId}/items/${itemId}/`);
        
        notifications.success('Услуга удалена из заказа');
        
        // Обновляем детали заказа
        await viewOrderDetail(currentOrderId);
        
        // Обновляем список заказов
        await refreshData();
        
    } catch (error) {
        console.error('Ошибка удаления услуги:', error);
        notifications.apiError(error, 'Ошибка удаления услуги');
    }
}

// Действия с заказами
function viewOrder(id) {
    window.location.href = `/orders/${id}/`;
}

async function editOrder(id) {
    try {
        await modal.show('edit-order', { 
            title: 'Редактировать заказ', 
            id: id,
            size: 'lg'
        });
    } catch (error) {
        console.error('Ошибка открытия формы редактирования:', error);
        notifications.error('Ошибка открытия формы');
    }
}

async function changeOrderStatus(id, newStatus) {
    try {
        const statusLabels = {
            'in_progress': 'в работу',
            'completed': 'завершенным'
        };
        
        const confirmMessage = `Изменить статус заказа #${id} на "${getStatusLabel(newStatus)}"?`;
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        await api.changeOrderStatus(id, newStatus);
        notifications.success(`Заказ #${id} переведен ${statusLabels[newStatus] || 'в новый статус'}`);
        
        // Обновляем данные
        await loadOrders();
        await loadStats();
        renderOrders();
        
        // Если открыто модальное окно деталей, обновляем его
        if (currentOrderId === id) {
            await viewOrderDetail(id);
        }
        
    } catch (error) {
        console.error('Ошибка изменения статуса:', error);
        notifications.error('Ошибка изменения статуса заказа');
    }
}

// Вспомогательные функции
function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function updateResultsCount() {
    updateElement('total-count', filteredOrders.length);
}

function getStatusLabel(status) {
    const labels = {
        'new': 'Новый',
        'in_progress': 'В работе',
        'completed': 'Завершен'
    };
    return labels[status] || status;
}

function getNextStatus(currentStatus) {
    const nextStatuses = {
        'new': 'in_progress',
        'in_progress': 'completed',
        'completed': null
    };
    return nextStatuses[currentStatus];
}

function getNextStatusLabel(currentStatus) {
    const labels = {
        'new': 'В работу',
        'in_progress': 'Завершить',
        'completed': ''
    };
    return labels[currentStatus] || '';
}

function canEditOrder(order) {
    const userRole = getCurrentUserRole();
    
    if (userRole === 'owner') return true;
    if (userRole === 'manager') {
        const currentUserId = getCurrentUserId();
        return order.manager === currentUserId;
    }
    
    return false;
}

function getCurrentUserRole() {
    const userMeta = document.querySelector('meta[name="current-user"]');
    if (userMeta) {
        try {
            const user = JSON.parse(userMeta.content);
            return user.role;
        } catch (e) {
            return 'guest';
        }
    }
    return 'guest';
}

function getCurrentUserId() {
    const userMeta = document.querySelector('meta[name="current-user"]');
    if (userMeta) {
        try {
            const user = JSON.parse(userMeta.content);
            return user.id;
        } catch (e) {
            return null;
        }
    }
    return null;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount || 0);
}

function formatPhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('7')) {
        return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length === 10) {
        return `+7 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 8)}-${cleaned.slice(8)}`;
    }
    return phone;
}

// Функция для обновления данных
window.refreshData = async function() {
    try {
        await loadOrders();
        await loadStats();
        renderOrders();
        notifications.success('Данные обновлены');
    } catch (error) {
        console.error('Ошибка обновления данных:', error);
        notifications.error('Ошибка обновления данных');
    }
};

// Экспорт для глобального использования
window.initOrdersPage = initOrdersPage;
window.switchView = switchView;
window.clearFilters = clearFilters;
window.exportOrders = exportOrders;
window.viewOrder = viewOrder;
window.viewOrderDetail = viewOrderDetail;
window.closeOrderDetailModal = closeOrderDetailModal;
window.editCurrentOrder = editCurrentOrder;
window.editOrder = editOrder;
window.changeOrderStatus = changeOrderStatus;
window.openAddServiceModal = openAddServiceModal;
window.closeAddServiceModal = closeAddServiceModal;
window.addServiceToOrder = addServiceToOrder;
window.removeServiceFromOrder = removeServiceFromOrder;

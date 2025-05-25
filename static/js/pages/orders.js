// JavaScript для страницы заказов
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
                            <a href="/orders/${order.id}/" class="hover:text-blue-600">
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
                        <button onclick="viewOrder(${order.id})" 
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
                        <button onclick="viewOrder(${order.id})" 
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
window.editOrder = editOrder;
window.changeOrderStatus = changeOrderStatus;
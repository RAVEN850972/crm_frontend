// JavaScript для страницы клиентов
let clientsData = [];
let filteredClients = [];
let currentPage = 1;
let pageSize = 20;
let currentSort = { field: 'created_at', order: 'desc' };
let currentView = 'table';
let filters = {
    search: '',
    source: '',
    dateRange: ''
};

async function initClientsPage() {
    try {
        showLoading();
        await loadClients();
        await loadStats();
        setupEventListeners();
        renderClients();
        
    } catch (error) {
        console.error('Ошибка инициализации страницы клиентов:', error);
        notifications.error('Ошибка загрузки данных');
    } finally {
        hideLoading();
    }
}

async function loadClients() {
    try {
        const response = await api.getClients({
            page_size: 1000, // Загружаем все клиенты для фильтрации на фронте
            ordering: `${currentSort.order === 'desc' ? '-' : ''}${currentSort.field}`
        });
        
        clientsData = response.results || [];
        filteredClients = [...clientsData];
        
        // Обновляем счетчик
        updateResultsCount();
        
    } catch (error) {
        console.error('Ошибка загрузки клиентов:', error);
        throw error;
    }
}

async function loadStats() {
    try {
        // Загружаем статистику клиентов
        const stats = await api.getClientsStatsBySource();
        
        // Подсчитываем общие метрики
        const total = clientsData.length;
        const thisMonth = clientsData.filter(client => {
            const created = new Date(client.created_at);
            const now = new Date();
            return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
        }).length;
        
        // Постоянные клиенты (условно - те у кого больше 1 заказа)
        const regular = Math.floor(total * 0.3); // Заглушка
        
        // Средний чек (заглушка)
        const averageCheck = 42500;
        
        // Обновляем статистику
        updateElement('stats-total', total);
        updateElement('stats-month', thisMonth);
        updateElement('stats-regular', regular);
        updateElement('stats-average', formatCurrency(averageCheck));
        
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

function setupEventListeners() {
    // Поиск
    const searchInput = document.getElementById('search');
    searchInput.addEventListener('input', TimingUtils.debounce(handleSearch, 300));
    
    // Фильтры
    document.getElementById('source-filter').addEventListener('change', handleFilterChange);
    document.getElementById('date-filter').addEventListener('change', handleFilterChange);
    document.getElementById('page-size').addEventListener('change', handlePageSizeChange);
    
    // Сортировка
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', handleSort);
    });
    
    // Очистка фильтров
    document.querySelector('[onclick="clearFilters()"]').onclick = clearFilters;
    
    // Экспорт
    document.querySelector('[onclick="exportClients()"]').onclick = exportClients;
}

function handleSearch(e) {
    filters.search = e.target.value.toLowerCase().trim();
    applyFilters();
}

function handleFilterChange(e) {
    const filterId = e.target.id;
    
    if (filterId === 'source-filter') {
        filters.source = e.target.value;
    } else if (filterId === 'date-filter') {
        filters.dateRange = e.target.value;
    }
    
    applyFilters();
}

function handlePageSizeChange(e) {
    pageSize = parseInt(e.target.value);
    currentPage = 1;
    renderClients();
}

function handleSort(e) {
    const field = e.currentTarget.dataset.sort;
    
    if (currentSort.field === field) {
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.order = 'asc';
    }
    
    // Обновляем иконки сортировки
    updateSortIcons();
    
    // Применяем сортировку
    applySorting();
    renderClients();
}

function applyFilters() {
    filteredClients = clientsData.filter(client => {
        // Поиск по тексту
        if (filters.search) {
            const searchText = filters.search;
            const searchFields = [
                client.name,
                client.phone,
                client.address,
                client.email || ''
            ].join(' ').toLowerCase();
            
            if (!searchFields.includes(searchText)) {
                return false;
            }
        }
        
        // Фильтр по источнику
        if (filters.source && client.source !== filters.source) {
            return false;
        }
        
        // Фильтр по дате
        if (filters.dateRange) {
            const clientDate = new Date(client.created_at);
            const now = new Date();
            
            switch (filters.dateRange) {
                case 'today':
                    if (!DateUtils.isToday(clientDate)) return false;
                    break;
                case 'week':
                    const weekAgo = DateUtils.addDays(now, -7);
                    if (clientDate < weekAgo) return false;
                    break;
                case 'month':
                    if (clientDate.getMonth() !== now.getMonth() || 
                        clientDate.getFullYear() !== now.getFullYear()) return false;
                    break;
                case 'quarter':
                    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
                    if (clientDate < quarterStart) return false;
                    break;
            }
        }
        
        return true;
    });
    
    // Применяем сортировку к отфильтрованным данным
    applySorting();
    
    // Сбрасываем на первую страницу
    currentPage = 1;
    
    // Обновляем счетчик и отображение
    updateResultsCount();
    renderClients();
}

function applySorting() {
    filteredClients.sort((a, b) => {
        let aVal = a[currentSort.field];
        let bVal = b[currentSort.field];
        
        // Обработка разных типов данных
        if (currentSort.field === 'created_at') {
            aVal = new Date(aVal);
            bVal = new Date(bVal);
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
    // Сбрасываем все иконки
    document.querySelectorAll('.sortable i').forEach(icon => {
        icon.className = 'fas fa-sort ml-1 text-gray-400';
    });
    
    // Устанавливаем активную иконку
    const activeHeader = document.querySelector(`[data-sort="${currentSort.field}"] i`);
    if (activeHeader) {
        activeHeader.className = `fas fa-sort-${currentSort.order === 'asc' ? 'up' : 'down'} ml-1 text-gray-700`;
    }
}

function renderClients() {
    if (currentView === 'table') {
        renderTableView();
    } else {
        renderCardsView();
    }
    
    renderPagination();
}

function renderTableView() {
    const tbody = document.getElementById('clients-table-body');
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageClients = filteredClients.slice(startIndex, endIndex);
    
    if (pageClients.length === 0) {
        document.getElementById('table-view').classList.add('hidden');
        document.getElementById('empty-state').classList.remove('hidden');
        return;
    }
    
    document.getElementById('table-view').classList.remove('hidden');
    document.getElementById('empty-state').classList.add('hidden');
    
    const html = pageClients.map(client => `
        <tr class="hover:bg-gray-50">
            <td>
                <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10">
                        <div class="h-10 w-10 rounded-full bg-primary-500 flex items-center justify-center">
                            <span class="text-sm font-medium text-white">
                                ${client.name.charAt(0).toUpperCase()}
                            </span>
                        </div>
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">
                            <a href="/clients/${client.id}/" class="hover:text-blue-600">
                                ${client.name}
                            </a>
                        </div>
                        ${client.email ? `<div class="text-sm text-gray-500">${client.email}</div>` : ''}
                    </div>
                </div>
            </td>
            <td>
                <div class="text-sm text-gray-900">
                    <div class="flex items-center mb-1">
                        <i class="fas fa-phone text-gray-400 mr-2"></i>
                        ${formatPhone(client.phone)}
                    </div>
                    <div class="flex items-center text-gray-500">
                        <i class="fas fa-map-marker-alt text-gray-400 mr-2"></i>
                        <span class="truncate" title="${client.address}">${StringUtils.truncate(client.address, 30)}</span>
                    </div>
                </div>
            </td>
            <td>
                <span class="badge badge-${getSourceColor(client.source)}">
                    ${getSourceLabel(client.source)}
                </span>
            </td>
            <td>
                <div class="text-sm text-gray-900">
                    <div class="font-medium">0 заказов</div>
                    <div class="text-gray-500">0 ₽</div>
                </div>
            </td>
            <td>
                <div class="text-sm text-gray-900">${DateUtils.format(client.created_at, 'dd.MM.yyyy')}</div>
                <div class="text-sm text-gray-500">${DateUtils.timeAgo(client.created_at)}</div>
            </td>
            <td class="text-right">
                <div class="flex items-center justify-end space-x-2">
                    <button onclick="viewClient(${client.id})" 
                            class="text-gray-400 hover:text-gray-600" 
                            title="Просмотр">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${canEditClient() ? `
                        <button onclick="editClient(${client.id})" 
                                class="text-blue-400 hover:text-blue-600" 
                                title="Редактировать">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="createOrderForClient(${client.id})" 
                                class="text-green-400 hover:text-green-600" 
                                title="Создать заказ">
                            <i class="fas fa-plus"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
    
    tbody.innerHTML = html;
}

function renderCardsView() {
    const container = document.getElementById('clients-cards-container');
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageClients = filteredClients.slice(startIndex, endIndex);
    
    if (pageClients.length === 0) {
        document.getElementById('cards-view').classList.add('hidden');
        document.getElementById('empty-state').classList.remove('hidden');
        return;
    }
    
    document.getElementById('cards-view').classList.remove('hidden');
    document.getElementById('empty-state').classList.add('hidden');
    
    const html = pageClients.map(client => `
        <div class="card card-hover">
            <div class="flex items-start justify-between">
                <div class="flex items-center">
                    <div class="flex-shrink-0 h-12 w-12">
                        <div class="h-12 w-12 rounded-full bg-primary-500 flex items-center justify-center">
                            <span class="text-lg font-medium text-white">
                                ${client.name.charAt(0).toUpperCase()}
                            </span>
                        </div>
                    </div>
                    <div class="ml-4">
                        <h3 class="text-lg font-medium text-gray-900">
                            <a href="/clients/${client.id}/" class="hover:text-blue-600">
                                ${client.name}
                            </a>
                        </h3>
                        <span class="badge badge-${getSourceColor(client.source)}">
                            ${getSourceLabel(client.source)}
                        </span>
                    </div>
                </div>
                <div class="flex space-x-1">
                    <button onclick="viewClient(${client.id})" 
                            class="text-gray-400 hover:text-gray-600 p-1" 
                            title="Просмотр">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${canEditClient() ? `
                        <button onclick="editClient(${client.id})" 
                                class="text-blue-400 hover:text-blue-600 p-1" 
                                title="Редактировать">
                            <i class="fas fa-edit"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
            
            <div class="mt-4 space-y-2">
                <div class="flex items-center text-sm text-gray-600">
                    <i class="fas fa-phone text-gray-400 mr-2 w-4"></i>
                    ${formatPhone(client.phone)}
                </div>
                ${client.email ? `
                    <div class="flex items-center text-sm text-gray-600">
                        <i class="fas fa-envelope text-gray-400 mr-2 w-4"></i>
                        ${client.email}
                    </div>
                ` : ''}
                <div class="flex items-start text-sm text-gray-600">
                    <i class="fas fa-map-marker-alt text-gray-400 mr-2 w-4 mt-0.5"></i>
                    <span class="line-clamp-2">${client.address}</span>
                </div>
            </div>
            
            <div class="mt-4 flex items-center justify-between pt-4 border-t border-gray-200">
                <div class="text-sm text-gray-500">
                    Создан ${DateUtils.timeAgo(client.created_at)}
                </div>
                ${canEditClient() ? `
                    <button onclick="createOrderForClient(${client.id})" 
                            class="btn btn-sm btn-success">
                        <i class="fas fa-plus mr-1"></i>
                        Заказ
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

function renderPagination() {
    const totalPages = Math.ceil(filteredClients.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize + 1;
    const endIndex = Math.min(currentPage * pageSize, filteredClients.length);
    
    // Обновляем информацию о показанных результатах
    updateElement('showing-from', startIndex);
    updateElement('showing-to', endIndex);
    updateElement('showing-total', filteredClients.length);
    
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
    const totalPages = Math.ceil(filteredClients.length / pageSize);
    
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    renderClients();
    
    // Скролл наверх
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
        document.getElementById('cards-view').classList.add('hidden');
    } else {
        document.getElementById('table-view').classList.add('hidden');
        document.getElementById('cards-view').classList.remove('hidden');
    }
    
    renderClients();
}

function clearFilters() {
    filters = { search: '', source: '', dateRange: '' };
    
    document.getElementById('search').value = '';
    document.getElementById('source-filter').value = '';
    document.getElementById('date-filter').value = '';
    
    filteredClients = [...clientsData];
    currentPage = 1;
    
    updateResultsCount();
    renderClients();
}

async function exportClients() {
    try {
        showLoading();
        await api.exportClients();
        notifications.success('Файл загружен');
    } catch (error) {
        console.error('Ошибка экспорта:', error);
        notifications.error('Ошибка экспорта данных');
    } finally {
        hideLoading();
    }
}

// Действия с клиентами
function viewClient(id) {
    window.location.href = `/clients/${id}/`;
}

async function editClient(id) {
    try {
        await modal.show('edit-client', { 
            title: 'Редактировать клиента', 
            id: id 
        });
    } catch (error) {
        console.error('Ошибка открытия формы редактирования:', error);
        notifications.error('Ошибка открытия формы');
    }
}

async function createOrderForClient(clientId) {
    try {
        await modal.show('create-order', { 
            title: 'Новый заказ', 
            size: 'lg',
            data: { client: clientId }
        });
    } catch (error) {
        console.error('Ошибка создания заказа:', error);
        notifications.error('Ошибка создания заказа');
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
    updateElement('total-count', filteredClients.length);
}

function getSourceColor(source) {
    const colors = {
        'avito': 'primary',
        'vk': 'primary',
        'website': 'success',
        'recommendations': 'warning',
        'other': 'gray'
    };
    return colors[source] || 'gray';
}

function getSourceLabel(source) {
    const labels = {
        'avito': 'Авито',
        'vk': 'ВК',
        'website': 'Сайт',
        'recommendations': 'Рекомендации',
        'other': 'Другое'
    };
    return labels[source] || source;
}

function canEditClient() {
    // Проверяем права пользователя
    const userRole = getCurrentUserRole();
    return userRole === 'owner' || userRole === 'manager';
}

function getCurrentUserRole() {
    // Получаем роль из meta-тега или другого источника
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

// Функция для обновления данных (вызывается после создания/редактирования)
window.refreshData = async function() {
    try {
        await loadClients();
        await loadStats();
        renderClients();
        notifications.success('Данные обновлены');
    } catch (error) {
        console.error('Ошибка обновления данных:', error);
        notifications.error('Ошибка обновления данных');
    }
};

// Экспорт для глобального использования
window.initClientsPage = initClientsPage;
window.switchView = switchView;
window.clearFilters = clearFilters;
window.exportClients = exportClients;
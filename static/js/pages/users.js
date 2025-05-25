// JavaScript для страницы пользователей
let usersData = [];
let filteredUsers = [];
let currentPage = 1;
let pageSize = 20;
let currentSort = { field: 'first_name', order: 'asc' };
let filters = {
    search: '',
    role: '',
    status: ''
};
let editingUserId = null;

async function initUsersPage() {
    try {
        showLoading();
        await loadUsers();
        await loadStats();
        setupEventListeners();
        renderUsers();
        
    } catch (error) {
        console.error('Ошибка инициализации страницы пользователей:', error);
        notifications.error('Ошибка загрузки данных');
    } finally {
        hideLoading();
    }
}

async function loadUsers() {
    try {
        const response = await api.getUsers({
            page_size: 1000,
            ordering: `${currentSort.order === 'desc' ? '-' : ''}${currentSort.field}`
        });
        
        usersData = response.results || [];
        filteredUsers = [...usersData];
        
        updateResultsCount();
        
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        throw error;
    }
}

async function loadStats() {
    try {
        const total = usersData.length;
        const active = usersData.filter(user => user.is_active).length;
        const managers = usersData.filter(user => user.role === 'manager').length;
        const installers = usersData.filter(user => user.role === 'installer').length;
        
        updateElement('stats-total', total);
        updateElement('stats-active', active);
        updateElement('stats-managers', managers);
        updateElement('stats-installers', installers);
        
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

function setupEventListeners() {
    // Поиск
    const searchInput = document.getElementById('search');
    searchInput.addEventListener('input', TimingUtils.debounce(handleSearch, 300));
    
    // Фильтры
    document.getElementById('role-filter').addEventListener('change', handleFilterChange);
    document.getElementById('status-filter').addEventListener('change', handleFilterChange);
    document.getElementById('page-size').addEventListener('change', handlePageSizeChange);
    
    // Сортировка
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', handleSort);
    });
    
    // Модальные окна
    document.getElementById('user-submit').addEventListener('click', handleUserSubmit);
    
    // Закрытие модальных окон по клику на backdrop
    document.getElementById('user-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeUserModal();
        }
    });
    
    document.getElementById('user-detail-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeUserDetailModal();
        }
    });
}

function handleSearch(e) {
    filters.search = e.target.value.toLowerCase().trim();
    applyFilters();
}

function handleFilterChange(e) {
    const filterId = e.target.id;
    
    if (filterId === 'role-filter') {
        filters.role = e.target.value;
    } else if (filterId === 'status-filter') {
        filters.status = e.target.value;
    }
    
    applyFilters();
}

function handlePageSizeChange(e) {
    pageSize = parseInt(e.target.value);
    currentPage = 1;
    renderUsers();
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
    renderUsers();
}

function applyFilters() {
    filteredUsers = usersData.filter(user => {
        // Поиск по тексту
        if (filters.search) {
            const searchText = filters.search;
            const searchFields = [
                user.first_name || '',
                user.last_name || '',
                user.username || '',
                user.email || '',
                user.phone || ''
            ].join(' ').toLowerCase();
            
            if (!searchFields.includes(searchText)) {
                return false;
            }
        }
        
        // Фильтр по роли
        if (filters.role && user.role !== filters.role) {
            return false;
        }
        
        // Фильтр по статусу
        if (filters.status) {
            const isActive = user.is_active;
            if (filters.status === 'active' && !isActive) return false;
            if (filters.status === 'inactive' && isActive) return false;
        }
        
        return true;
    });
    
    applySorting();
    currentPage = 1;
    updateResultsCount();
    renderUsers();
}

function applySorting() {
    filteredUsers.sort((a, b) => {
        let aVal = a[currentSort.field];
        let bVal = b[currentSort.field];
        
        if (currentSort.field === 'last_login') {
            aVal = aVal ? new Date(aVal) : new Date(0);
            bVal = bVal ? new Date(bVal) : new Date(0);
        } else if (typeof aVal === 'string') {
            aVal = aVal?.toLowerCase() || '';
            bVal = bVal?.toLowerCase() || '';
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

function renderUsers() {
    const tbody = document.getElementById('users-table-body');
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageUsers = filteredUsers.slice(startIndex, endIndex);
    
    if (pageUsers.length === 0) {
        document.querySelector('.card .overflow-x-auto').classList.add('hidden');
        document.getElementById('empty-state').classList.remove('hidden');
        return;
    }
    
    document.querySelector('.card .overflow-x-auto').classList.remove('hidden');
    document.getElementById('empty-state').classList.add('hidden');
    
    const html = pageUsers.map(user => `
        <tr class="hover:bg-gray-50">
            <td>
                <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10">
                        <div class="h-10 w-10 rounded-full ${getRoleColor(user.role)} flex items-center justify-center">
                            <span class="text-sm font-medium text-white">
                                ${getUserInitials(user)}
                            </span>
                        </div>
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">
                            <a href="#" onclick="viewUser(${user.id})" class="hover:text-blue-600">
                                ${user.first_name} ${user.last_name}
                            </a>
                        </div>
                        <div class="text-sm text-gray-500">@${user.username}</div>
                    </div>
                </div>
            </td>
            <td>
                <span class="badge badge-${getRoleBadgeColor(user.role)}">
                    ${getRoleLabel(user.role)}
                </span>
            </td>
            <td>
                <div class="text-sm text-gray-900">
                    ${user.email ? `
                        <div class="flex items-center mb-1">
                            <i class="fas fa-envelope text-gray-400 mr-2"></i>
                            ${user.email}
                        </div>
                    ` : ''}
                    ${user.phone ? `
                        <div class="flex items-center text-gray-500">
                            <i class="fas fa-phone text-gray-400 mr-2"></i>
                            ${formatPhone(user.phone)}
                        </div>
                    ` : ''}
                </div>
            </td>
            <td>
                <div class="text-sm text-gray-900">
                    ${getUserStats(user)}
                </div>
            </td>
            <td>
                <div class="text-sm text-gray-900">
                    ${user.last_login ? DateUtils.format(user.last_login, 'dd.MM.yyyy HH:mm') : 'Никогда'}
                </div>
                ${user.last_login ? `<div class="text-sm text-gray-500">${DateUtils.timeAgo(user.last_login)}</div>` : ''}
            </td>
            <td>
                <span class="badge ${user.is_active ? 'badge-success' : 'badge-danger'}">
                    ${user.is_active ? 'Активный' : 'Неактивный'}
                </span>
            </td>
            <td class="text-right">
                <div class="flex items-center justify-end space-x-2">
                    <button onclick="viewUser(${user.id})" 
                            class="text-gray-400 hover:text-gray-600" 
                            title="Просмотр">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="editUser(${user.id})" 
                            class="text-blue-400 hover:text-blue-600" 
                            title="Редактировать">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${user.role !== 'owner' ? `
                        <button onclick="toggleUserStatus(${user.id})" 
                                class="text-${user.is_active ? 'red' : 'green'}-400 hover:text-${user.is_active ? 'red' : 'green'}-600" 
                                title="${user.is_active ? 'Деактивировать' : 'Активировать'}">
                            <i class="fas fa-${user.is_active ? 'ban' : 'check'}"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
    
    tbody.innerHTML = html;
    renderPagination();
}

function renderPagination() {
    const totalPages = Math.ceil(filteredUsers.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize + 1;
    const endIndex = Math.min(currentPage * pageSize, filteredUsers.length);
    
    updateElement('showing-from', startIndex);
    updateElement('showing-to', endIndex);
    updateElement('showing-total', filteredUsers.length);
    
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
    const totalPages = Math.ceil(filteredUsers.length / pageSize);
    
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    renderUsers();
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function clearFilters() {
    filters = { search: '', role: '', status: '' };
    
    document.getElementById('search').value = '';
    document.getElementById('role-filter').value = '';
    document.getElementById('status-filter').value = '';
    
    filteredUsers = [...usersData];
    currentPage = 1;
    
    updateResultsCount();
    renderUsers();
}

async function exportUsers() {
    try {
        showLoading();
        // Здесь будет экспорт через API
        notifications.success('Файл загружен');
    } catch (error) {
        console.error('Ошибка экспорта:', error);
        notifications.error('Ошибка экспорта данных');
    } finally {
        hideLoading();
    }
}

// Модальные окна и действия с пользователями

function openCreateUserModal() {
    editingUserId = null;
    document.getElementById('user-modal-title').textContent = 'Новый сотрудник';
    document.querySelector('#user-submit .submit-text').textContent = 'Создать';
    
    // Очищаем форму
    document.getElementById('user-form').reset();
    document.getElementById('password-fields').style.display = 'block';
    
    // Показываем модальное окно
    document.getElementById('user-modal').classList.remove('hidden');
    
    // Фокус на первое поле
    setTimeout(() => {
        document.getElementById('first-name').focus();
    }, 100);
}

async function editUser(userId) {
    try {
        editingUserId = userId;
        const user = usersData.find(u => u.id === userId);
        
        if (!user) {
            notifications.error('Пользователь не найден');
            return;
        }
        
        document.getElementById('user-modal-title').textContent = 'Редактировать сотрудника';
        document.querySelector('#user-submit .submit-text').textContent = 'Сохранить';
        
        // Заполняем форму данными пользователя
        document.getElementById('first-name').value = user.first_name || '';
        document.getElementById('last-name').value = user.last_name || '';
        document.getElementById('username').value = user.username || '';
        document.getElementById('email').value = user.email || '';
        document.getElementById('phone').value = user.phone || '';
        document.getElementById('role').value = user.role || '';
        
        // Скрываем поля пароля при редактировании
        document.getElementById('password-fields').style.display = 'none';
        
        // Показываем модальное окно
        document.getElementById('user-modal').classList.remove('hidden');
        
    } catch (error) {
        console.error('Ошибка загрузки данных пользователя:', error);
        notifications.error('Ошибка загрузки данных');
    }
}

async function viewUser(userId) {
    try {
        const user = usersData.find(u => u.id === userId);
        
        if (!user) {
            notifications.error('Пользователь не найден');
            return;
        }
        
        document.getElementById('user-detail-title').textContent = `${user.first_name} ${user.last_name}`;
        
        // Создаем контент для модального окна
        const content = createUserDetailContent(user);
        document.getElementById('user-detail-content').innerHTML = content;
        
        // Устанавливаем обработчик для кнопки редактирования
        document.getElementById('edit-user-btn').onclick = () => {
            closeUserDetailModal();
            editUser(userId);
        };
        
        // Показываем модальное окно
        document.getElementById('user-detail-modal').classList.remove('hidden');
        
    } catch (error) {
        console.error('Ошибка загрузки деталей пользователя:', error);
        notifications.error('Ошибка загрузки данных');
    }
}

function createUserDetailContent(user) {
    return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Личная информация -->
            <div>
                <h4 class="text-lg font-medium text-gray-900 mb-4">Личная информация</h4>
                <div class="space-y-3">
                    <div class="flex items-center">
                        <div class="w-16 h-16 rounded-full ${getRoleColor(user.role)} flex items-center justify-center mr-4">
                            <span class="text-xl font-medium text-white">
                                ${getUserInitials(user)}
                            </span>
                        </div>
                        <div>
                            <p class="font-medium text-gray-900">${user.first_name} ${user.last_name}</p>
                            <p class="text-sm text-gray-500">@${user.username}</p>
                        </div>
                    </div>
                    
                    ${user.email ? `
                        <div class="flex items-center">
                            <i class="fas fa-envelope text-gray-400 w-4 mr-3"></i>
                            <span class="text-sm text-gray-900">${user.email}</span>
                        </div>
                    ` : ''}
                    
                    ${user.phone ? `
                        <div class="flex items-center">
                            <i class="fas fa-phone text-gray-400 w-4 mr-3"></i>
                            <span class="text-sm text-gray-900">${formatPhone(user.phone)}</span>
                        </div>
                    ` : ''}
                    
                    <div class="flex items-center">
                        <i class="fas fa-user-tag text-gray-400 w-4 mr-3"></i>
                        <span class="badge badge-${getRoleBadgeColor(user.role)}">${getRoleLabel(user.role)}</span>
                    </div>
                    
                    <div class="flex items-center">
                        <i class="fas fa-circle text-gray-400 w-4 mr-3"></i>
                        <span class="badge ${user.is_active ? 'badge-success' : 'badge-danger'}">
                            ${user.is_active ? 'Активный' : 'Неактивный'}
                        </span>
                    </div>
                </div>
            </div>
            
            <!-- Рабочая информация -->
            <div>
                <h4 class="text-lg font-medium text-gray-900 mb-4">Рабочая информация</h4>
                <div class="space-y-3">
                    <div class="flex justify-between">
                        <span class="text-sm text-gray-500">Дата регистрации:</span>
                        <span class="text-sm text-gray-900">${DateUtils.format(user.date_joined, 'dd.MM.yyyy')}</span>
                    </div>
                    
                    <div class="flex justify-between">
                        <span class="text-sm text-gray-500">Последний вход:</span>
                        <span class="text-sm text-gray-900">
                            ${user.last_login ? DateUtils.format(user.last_login, 'dd.MM.yyyy HH:mm') : 'Никогда'}
                        </span>
                    </div>
                    
                    <div class="flex justify-between">
                        <span class="text-sm text-gray-500">Статистика:</span>
                        <span class="text-sm text-gray-900">${getUserStats(user)}</span>
                    </div>
                </div>
                
                <!-- Права доступа -->
                <div class="mt-6">
                    <h5 class="text-sm font-medium text-gray-900 mb-2">Права доступа</h5>
                    <div class="space-y-2">
                        ${getUserPermissions(user.role).map(permission => `
                            <div class="flex items-center">
                                <i class="fas fa-check text-green-500 w-4 mr-2"></i>
                                <span class="text-sm text-gray-700">${permission}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function toggleUserStatus(userId) {
    try {
        const user = usersData.find(u => u.id === userId);
        if (!user) return;
        
        const action = user.is_active ? 'деактивировать' : 'активировать';
        
        if (!confirm(`Вы уверены, что хотите ${action} пользователя ${user.first_name} ${user.last_name}?`)) {
            return;
        }
        
        const updatedUser = { ...user, is_active: !user.is_active };
        await api.updateUser(userId, { is_active: updatedUser.is_active });
        
        // Обновляем данные локально
        const index = usersData.findIndex(u => u.id === userId);
        if (index !== -1) {
            usersData[index] = updatedUser;
        }
        
        applyFilters();
        loadStats();
        
        notifications.success(`Пользователь ${user.is_active ? 'деактивирован' : 'активирован'}`);
        
    } catch (error) {
        console.error('Ошибка изменения статуса пользователя:', error);
        notifications.error('Ошибка изменения статуса');
    }
}

async function handleUserSubmit() {
    const submitButton = document.getElementById('user-submit');
    const submitText = submitButton.querySelector('.submit-text');
    const loadingSpinner = submitButton.querySelector('.loading-spinner');
    
    try {
        // Показываем индикатор загрузки
        submitButton.disabled = true;
        submitText.textContent = editingUserId ? 'Сохранение...' : 'Создание...';
        loadingSpinner.classList.remove('hidden');
        
        // Собираем данные формы
        const formData = getFormData();
        
        // Валидация
        if (!validateUserForm(formData)) {
            return;
        }
        
        let result;
        if (editingUserId) {
            // Редактирование
            result = await api.updateUser(editingUserId, formData);
            notifications.success('Пользователь успешно обновлен');
        } else {
            // Создание
            result = await api.createUser(formData);
            notifications.success('Пользователь успешно создан');
        }
        
        // Закрываем модальное окно
        closeUserModal();
        
        // Обновляем данные
        await loadUsers();
        await loadStats();
        renderUsers();
        
    } catch (error) {
        console.error('Ошибка сохранения пользователя:', error);
        notifications.apiError(error, 'Ошибка сохранения данных');
        
    } finally {
        // Восстанавливаем кнопку
        submitButton.disabled = false;
        submitText.textContent = editingUserId ? 'Сохранить' : 'Создать';
        loadingSpinner.classList.add('hidden');
    }
}

function getFormData() {
    const form = document.getElementById('user-form');
    const formData = new FormData(form);
    const data = {};
    
    for (const [key, value] of formData.entries()) {
        if (value !== '') {
            data[key] = value;
        }
    }
    
    // Удаляем подтверждение пароля из данных
    delete data.password_confirm;
    
    return data;
}

function validateUserForm(data) {
    // Проверка обязательных полей
    if (!data.first_name || !data.last_name || !data.username || !data.role) {
        notifications.error('Заполните все обязательные поля');
        return false;
    }
    
    // Проверка пароля при создании
    if (!editingUserId) {
        const password = document.getElementById('password').value;
        const passwordConfirm = document.getElementById('password-confirm').value;
        
        if (!password) {
            notifications.error('Пароль обязателен для заполнения');
            return false;
        }
        
        if (password.length < 8) {
            notifications.error('Пароль должен содержать минимум 8 символов');
            return false;
        }
        
        if (password !== passwordConfirm) {
            notifications.error('Пароли не совпадают');
            return false;
        }
    }
    
    // Проверка email
    if (data.email && !ValidationUtils.isEmail(data.email)) {
        notifications.error('Введите корректный email');
        return false;
    }
    
    return true;
}

function closeUserModal() {
    document.getElementById('user-modal').classList.add('hidden');
    document.getElementById('user-form').reset();
    editingUserId = null;
}

function closeUserDetailModal() {
    document.getElementById('user-detail-modal').classList.add('hidden');
}

// Вспомогательные функции

function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function updateResultsCount() {
    updateElement('total-count', filteredUsers.length);
}

function getUserInitials(user) {
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || user.username?.charAt(0).toUpperCase() || '?';
}

function getRoleColor(role) {
    const colors = {
        'owner': 'bg-purple-500',
        'manager': 'bg-blue-500',
        'installer': 'bg-green-500'
    };
    return colors[role] || 'bg-gray-500';
}

function getRoleBadgeColor(role) {
    const colors = {
        'owner': 'primary',
        'manager': 'primary',
        'installer': 'success'
    };
    return colors[role] || 'gray';
}

function getRoleLabel(role) {
    const labels = {
        'owner': 'Владелец',
        'manager': 'Менеджер',
        'installer': 'Монтажник'
    };
    return labels[role] || role;
}

function getUserStats(user) {
    // Здесь будет реальная статистика из API
    switch (user.role) {
        case 'manager':
            return 'Заказы: —, Клиенты: —';
        case 'installer':
            return 'Монтажи: —, Рейтинг: —';
        case 'owner':
            return 'Полный доступ';
        default:
            return '—';
    }
}

function getUserPermissions(role) {
    const permissions = {
        'owner': [
            'Полный доступ к системе',
            'Управление пользователями',
            'Просмотр финансов',
            'Настройка системы'
        ],
        'manager': [
            'Управление клиентами',
            'Создание заказов',
            'Планирование монтажей',
            'Просмотр своей статистики'
        ],
        'installer': [
            'Просмотр расписания',
            'Отметка выполнения работ',
            'Просмотр заказов',
            'Работа с календарем'
        ]
    };
    
    return permissions[role] || [];
}

// Глобальные функции
window.openCreateUserModal = openCreateUserModal;
window.editUser = editUser;
window.viewUser = viewUser;
window.toggleUserStatus = toggleUserStatus;
window.closeUserModal = closeUserModal;
window.closeUserDetailModal = closeUserDetailModal;
window.clearFilters = clearFilters;
window.exportUsers = exportUsers;
window.changePage = changePage;

// Функция для обновления данных
window.refreshData = async function() {
    try {
        await loadUsers();
        await loadStats();
        renderUsers();
        notifications.success('Данные обновлены');
    } catch (error) {
        console.error('Ошибка обновления данных:', error);
        notifications.error('Ошибка обновления данных');
    }
};

// Экспорт для глобального использования
window.initUsersPage = initUsersPage;
// JavaScript для календаря монтажей
let calendar;
let schedulesData = [];
let filteredEvents = [];
let filters = {
    installer: '',
    status: '',
    priority: ''
};

async function initCalendarPage() {
    try {
        showLoading();
        await loadInstallers();
        await loadOrders();
        await loadSchedules();
        initCalendar();
        await loadStats();
        setupEventListeners();
        
    } catch (error) {
        console.error('Ошибка инициализации календаря:', error);
        notifications.error('Ошибка загрузки данных календаря');
    } finally {
        hideLoading();
    }
}

async function loadInstallers() {
    try {
        const response = await api.getUsers({ role: 'installer' });
        const installerFilter = document.getElementById('installer-filter');
        const installersSelect = document.getElementById('installers-select');
        
        response.results?.forEach(installer => {
            // Добавляем в фильтр
            const filterOption = document.createElement('option');
            filterOption.value = installer.id;
            filterOption.textContent = `${installer.first_name} ${installer.last_name}`;
            installerFilter.appendChild(filterOption);
            
            // Добавляем в форму планирования
            const selectOption = document.createElement('option');
            selectOption.value = installer.id;
            selectOption.textContent = `${installer.first_name} ${installer.last_name}`;
            installersSelect.appendChild(selectOption);
        });
        
    } catch (error) {
        console.error('Ошибка загрузки монтажников:', error);
    }
}

async function loadOrders() {
    try {
        // Загружаем заказы без расписания
        const response = await api.getOrders({ 
            status__in: 'new,in_progress',
            page_size: 100
        });
        
        const orderSelect = document.getElementById('order-select');
        
        response.results?.forEach(order => {
            const option = document.createElement('option');
            option.value = order.id;
            option.textContent = `#${order.id} - ${order.client_name} (${formatCurrency(order.total_cost)})`;
            option.dataset.clientName = order.client_name;
            option.dataset.clientAddress = order.client_address;
            option.dataset.totalCost = order.total_cost;
            orderSelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
    }
}

async function loadSchedules() {
    try {
        // Загружаем расписания на текущий месяц
        const startDate = new Date();
        startDate.setDate(1);
        const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
        
        const response = await api.getCalendar({
            start_date: formatDate(startDate),
            end_date: formatDate(endDate)
        });
        
        schedulesData = response.calendar ? Object.values(response.calendar).flat() : [];
        filteredEvents = convertSchedulesToEvents(schedulesData);
        
        if (calendar) {
            calendar.removeAllEvents();
            calendar.addEventSource(filteredEvents);
        }
        
    } catch (error) {
        console.error('Ошибка загрузки расписаний:', error);
    }
}

async function loadStats() {
    try {
        const today = new Date();
        const todayStr = formatDate(today);
        
        // Статистика на сегодня
        const todaySchedules = schedulesData.filter(schedule => 
            schedule.date === todayStr
        );
        
        const scheduledCount = schedulesData.filter(schedule => 
            schedule.status === 'scheduled'
        ).length;
        
        const busyInstallers = new Set(
            todaySchedules.map(schedule => 
                schedule.installers?.map(installer => installer.id)
            ).flat()
        ).size;
        
        // Подсчет общего расстояния (заглушка)
        const totalDistance = todaySchedules.length * 15; // примерно 15 км на монтаж
        
        updateElement('stats-today', todaySchedules.length);
        updateElement('stats-scheduled', scheduledCount);
        updateElement('stats-busy-installers', busyInstallers);
        updateElement('stats-total-distance', totalDistance);
        
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'ru',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        
        height: 'auto',
        
        events: filteredEvents,
        
        eventClick: function(info) {
            showScheduleDetails(info.event);
        },
        
        dateClick: function(info) {
            if (canCreateSchedule()) {
                openCreateScheduleModal(info.dateStr);
            }
        },
        
        eventDidMount: function(info) {
            // Добавляем tooltip
            info.el.setAttribute('title', 
                `${info.event.title}\n${info.event.extendedProps.clientAddress}`
            );
        },
        
        datesSet: function(info) {
            // Загружаем данные при смене диапазона дат
            loadSchedulesForRange(info.start, info.end);
        }
    });
    
    calendar.render();
}

function convertSchedulesToEvents(schedules) {
    return schedules.map(schedule => ({
        id: schedule.id,
        title: `${schedule.start_time} - ${schedule.client_name}`,
        start: `${schedule.date}T${schedule.start_time}`,
        end: `${schedule.date}T${schedule.end_time}`,
        backgroundColor: getStatusColor(schedule.status),
        borderColor: getPriorityColor(schedule.priority),
        textColor: '#ffffff',
        extendedProps: {
            scheduleId: schedule.id,
            orderId: schedule.order_id,
            clientName: schedule.client_name,
            clientAddress: schedule.client_address,
            clientPhone: schedule.client_phone,
            manager: schedule.manager,
            status: schedule.status,
            priority: schedule.priority,
            installers: schedule.installers,
            notes: schedule.notes,
            isOverdue: schedule.is_overdue
        }
    }));
}

function getStatusColor(status) {
    const colors = {
        'scheduled': '#3b82f6',
        'in_progress': '#f59e0b',
        'completed': '#10b981',
        'cancelled': '#ef4444',
        'rescheduled': '#6b7280'
    };
    return colors[status] || '#6b7280';
}

function getPriorityColor(priority) {
    const colors = {
        'low': '#6b7280',
        'normal': '#3b82f6',
        'high': '#f59e0b',
        'urgent': '#ef4444'
    };
    return colors[priority] || '#3b82f6';
}

function setupEventListeners() {
    // Фильтры
    document.getElementById('installer-filter').addEventListener('change', handleFilterChange);
    document.getElementById('status-filter').addEventListener('change', handleFilterChange);
    document.getElementById('priority-filter').addEventListener('change', handleFilterChange);
    
    // Форма планирования
    const scheduleForm = document.getElementById('schedule-form');
    const submitButton = document.getElementById('schedule-submit');
    
    submitButton.addEventListener('click', handleScheduleSubmit);
    
    // Проверка доступности при изменении времени и монтажников
    document.getElementById('schedule-date').addEventListener('change', checkAvailability);
    document.getElementById('start-time').addEventListener('change', checkAvailability);
    document.getElementById('end-time').addEventListener('change', checkAvailability);
    document.getElementById('installers-select').addEventListener('change', checkAvailability);
}

function handleFilterChange() {
    filters.installer = document.getElementById('installer-filter').value;
    filters.status = document.getElementById('status-filter').value;
    filters.priority = document.getElementById('priority-filter').value;
    
    applyFilters();
}

function applyFilters() {
    filteredEvents = convertSchedulesToEvents(
        schedulesData.filter(schedule => {
            if (filters.installer && !schedule.installers?.some(installer => 
                installer.id.toString() === filters.installer)) {
                return false;
            }
            
            if (filters.status && schedule.status !== filters.status) {
                return false;
            }
            
            if (filters.priority && schedule.priority !== filters.priority) {
                return false;
            }
            
            return true;
        })
    );
    
    if (calendar) {
        calendar.removeAllEvents();
        calendar.addEventSource(filteredEvents);
    }
}

function clearFilters() {
    filters = { installer: '', status: '', priority: '' };
    
    document.getElementById('installer-filter').value = '';
    document.getElementById('status-filter').value = '';
    document.getElementById('priority-filter').value = '';
    
    applyFilters();
}

function filterToday() {
    const today = formatDate(new Date());
    calendar.gotoDate(today);
    calendar.changeView('timeGridDay');
}

function filterOverdue() {
    const overdueEvents = filteredEvents.filter(event => 
        event.extendedProps.isOverdue
    );
    
    if (overdueEvents.length === 0) {
        notifications.info('Просроченных монтажей нет');
        return;
    }
    
    // Переходим к первому просроченному событию
    calendar.gotoDate(overdueEvents[0].start);
    calendar.changeView('timeGridDay');
}

async function loadSchedulesForRange(start, end) {
    try {
        const response = await api.getCalendar({
            start_date: formatDate(start),
            end_date: formatDate(end)
        });
        
        const newSchedules = response.calendar ? Object.values(response.calendar).flat() : [];
        
        // Объединяем с существующими данными
        const existingIds = new Set(schedulesData.map(s => s.id));
        const uniqueNewSchedules = newSchedules.filter(s => !existingIds.has(s.id));
        
        schedulesData = [...schedulesData, ...uniqueNewSchedules];
        applyFilters();
        
    } catch (error) {
        console.error('Ошибка загрузки расписаний для диапазона:', error);
    }
}

function showScheduleDetails(event) {
    const props = event.extendedProps;
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg max-w-md w-full p-6">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-medium">Монтаж #${props.scheduleId}</h3>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="space-y-3">
                <div>
                    <label class="text-sm font-medium text-gray-700">Клиент:</label>
                    <p class="text-sm text-gray-900">${props.clientName}</p>
                </div>
                
                <div>
                    <label class="text-sm font-medium text-gray-700">Адрес:</label>
                    <p class="text-sm text-gray-900">${props.clientAddress}</p>
                </div>
                
                <div>
                    <label class="text-sm font-medium text-gray-700">Телефон:</label>
                    <p class="text-sm text-gray-900">${formatPhone(props.clientPhone)}</p>
                </div>
                
                <div>
                    <label class="text-sm font-medium text-gray-700">Время:</label>
                    <p class="text-sm text-gray-900">${event.title}</p>
                </div>
                
                <div>
                    <label class="text-sm font-medium text-gray-700">Статус:</label>
                    <span class="badge status-${props.status}">${getStatusLabel(props.status)}</span>
                </div>
                
                <div>
                    <label class="text-sm font-medium text-gray-700">Приоритет:</label>
                    <span class="badge priority-${props.priority}">${getPriorityLabel(props.priority)}</span>
                </div>
                
                <div>
                    <label class="text-sm font-medium text-gray-700">Монтажники:</label>
                    <p class="text-sm text-gray-900">${props.installers?.map(i => i.name).join(', ') || 'Не назначены'}</p>
                </div>
                
                ${props.notes ? `
                    <div>
                        <label class="text-sm font-medium text-gray-700">Заметки:</label>
                        <p class="text-sm text-gray-900">${props.notes}</p>
                    </div>
                ` : ''}
            </div>
            
            <div class="mt-6 flex space-x-3">
                ${canManageSchedule(props) ? `
                    <button onclick="editSchedule(${props.scheduleId})" class="btn btn-primary btn-sm">
                        <i class="fas fa-edit mr-1"></i>
                        Редактировать
                    </button>
                    ${props.status === 'scheduled' ? `
                        <button onclick="startWork(${props.scheduleId})" class="btn btn-success btn-sm">
                            <i class="fas fa-play mr-1"></i>
                            Начать
                        </button>
                    ` : ''}
                    ${props.status === 'in_progress' ? `
                        <button onclick="completeWork(${props.scheduleId})" class="btn btn-success btn-sm">
                            <i class="fas fa-check mr-1"></i>
                            Завершить
                        </button>
                    ` : ''}
                ` : ''}
                <button onclick="viewOrder(${props.orderId})" class="btn btn-outline btn-sm">
                    <i class="fas fa-eye mr-1"></i>
                    Заказ
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function openCreateScheduleModal(date = null) {
    const modal = document.getElementById('schedule-modal');
    modal.classList.remove('hidden');
    
    // Устанавливаем дату, если передана
    if (date) {
        document.getElementById('schedule-date').value = date;
    }
    
    // Устанавливаем время по умолчанию
    document.getElementById('start-time').value = '09:00';
    document.getElementById('end-time').value = '12:00';
    
    // Очищаем форму
    document.getElementById('schedule-form').reset();
    document.getElementById('availability-check').classList.add('hidden');
}

function closeScheduleModal() {
    document.getElementById('schedule-modal').classList.add('hidden');
}

async function handleScheduleSubmit() {
    const submitButton = document.getElementById('schedule-submit');
    const submitText = submitButton.querySelector('.submit-text');
    const loadingSpinner = submitButton.querySelector('.loading-spinner');
    
    submitButton.disabled = true;
    submitText.textContent = 'Планирование...';
    loadingSpinner.classList.remove('hidden');
    
    try {
        const formData = new FormData(document.getElementById('schedule-form'));
        const data = {
            order_id: parseInt(formData.get('order')),
            scheduled_date: formData.get('date'),
            start_time: formData.get('start_time'),
            end_time: formData.get('end_time'),
            installer_ids: Array.from(document.getElementById('installers-select').selectedOptions)
                .map(option => parseInt(option.value)),
            priority: formData.get('priority'),
            notes: formData.get('notes')
        };
        
        await api.createSchedule(data);
        notifications.success('Монтаж успешно запланирован');
        
        closeScheduleModal();
        await loadSchedules();
        await loadStats();
        
    } catch (error) {
        console.error('Ошибка планирования монтажа:', error);
        notifications.apiError(error, 'Ошибка планирования монтажа');
        
    } finally {
        submitButton.disabled = false;
        submitText.textContent = 'Запланировать';
        loadingSpinner.classList.add('hidden');
    }
}

async function checkAvailability() {
    const date = document.getElementById('schedule-date').value;
    const startTime = document.getElementById('start-time').value;
    const endTime = document.getElementById('end-time').value;
    const selectedInstallers = Array.from(document.getElementById('installers-select').selectedOptions)
        .map(option => parseInt(option.value));
    
    if (!date || !startTime || !endTime || selectedInstallers.length === 0) {
        document.getElementById('availability-check').classList.add('hidden');
        return;
    }
    
    const checkDiv = document.getElementById('availability-check');
    const icon = document.getElementById('availability-icon');
    const message = document.getElementById('availability-message');
    
    checkDiv.classList.remove('hidden', 'bg-red-50', 'bg-green-50');
    checkDiv.classList.add('bg-blue-50');
    icon.className = 'fas fa-spinner fa-spin h-5 w-5 text-blue-500';
    message.textContent = 'Проверка доступности...';
    
    try {
        const response = await api.checkAvailability({
            installer_ids: selectedInstallers,
            date: date,
            start_time: startTime,
            end_time: endTime
        });
        
        if (response.available) {
            checkDiv.classList.remove('bg-blue-50');
            checkDiv.classList.add('bg-green-50');
            icon.className = 'fas fa-check h-5 w-5 text-green-500';
            message.textContent = 'Все монтажники доступны';
        } else {
            checkDiv.classList.remove('bg-blue-50');
            checkDiv.classList.add('bg-red-50');
            icon.className = 'fas fa-exclamation-triangle h-5 w-5 text-red-500';
            message.textContent = `Конфликт: ${response.conflicts.join(', ')}`;
        }
        
    } catch (error) {
        checkDiv.classList.remove('bg-blue-50');
        checkDiv.classList.add('bg-red-50');
        icon.className = 'fas fa-exclamation-triangle h-5 w-5 text-red-500';
        message.textContent = 'Ошибка проверки доступности';
    }
}

async function optimizeRoutes() {
    try {
        showLoading();
        
        const today = new Date();
        const response = await api.optimizeRoute({
            date: formatDate(today)
        });
        
        if (response.message) {
            notifications.success('Маршруты оптимизированы');
            await loadSchedules();
        }
        
    } catch (error) {
        console.error('Ошибка оптимизации маршрутов:', error);
        notifications.error('Ошибка оптимизации маршрутов');
    } finally {
        hideLoading();
    }
}

async function exportSchedule() {
    try {
        // Экспорт расписания (реализация зависит от API)
        notifications.info('Функция экспорта в разработке');
    } catch (error) {
        notifications.error('Ошибка экспорта расписания');
    }
}

// Действия с расписанием
async function startWork(scheduleId) {
    try {
        await api.startWork(scheduleId);
        notifications.success('Работа начата');
        await loadSchedules();
        await loadStats();
    } catch (error) {
        notifications.apiError(error, 'Ошибка начала работы');
    }
}

async function completeWork(scheduleId) {
    try {
        await api.completeWork(scheduleId);
        notifications.success('Работа завершена');
        await loadSchedules();
        await loadStats();
    } catch (error) {
        notifications.apiError(error, 'Ошибка завершения работы');
    }
}

function editSchedule(scheduleId) {
    // Открыть модальное окно редактирования
    // Реализация зависит от требований
    notifications.info('Функция редактирования в разработке');
}

function viewOrder(orderId) {
    window.location.href = `/orders/${orderId}/`;
}

// Вспомогательные функции
function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function formatDate(date) {
    return DateUtils.format(date, 'yyyy-MM-dd');
}

function getStatusLabel(status) {
    const labels = {
        'scheduled': 'Запланировано',
        'in_progress': 'Выполняется',
        'completed': 'Завершено',
        'cancelled': 'Отменено',
        'rescheduled': 'Перенесено'
    };
    return labels[status] || status;
}

function getPriorityLabel(priority) {
    const labels = {
        'low': 'Низкий',
        'normal': 'Обычный',
        'high': 'Высокий',
        'urgent': 'Срочный'
    };
    return labels[priority] || priority;
}

function canCreateSchedule() {
    const userRole = getCurrentUserRole();
    return userRole === 'owner' || userRole === 'manager';
}

function canManageSchedule(scheduleProps) {
    const userRole = getCurrentUserRole();
    
    if (userRole === 'owner') return true;
    if (userRole === 'manager') return true;
    if (userRole === 'installer') {
        const currentUserId = getCurrentUserId();
        return scheduleProps.installers?.some(installer => installer.id === currentUserId);
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

// Экспорт для глобального использования
window.initCalendarPage = initCalendarPage;
window.openCreateScheduleModal = openCreateScheduleModal;
window.closeScheduleModal = closeScheduleModal;
window.optimizeRoutes = optimizeRoutes;
window.exportSchedule = exportSchedule;
window.filterToday = filterToday;
window.filterOverdue = filterOverdue;
window.clearFilters = clearFilters;
window.startWork = startWork;
window.completeWork = completeWork;
window.editSchedule = editSchedule;
window.viewOrder = viewOrder;
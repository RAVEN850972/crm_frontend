// JavaScript для дашборда
let dashboardData = {};
let financeChart = null;

async function initDashboard() {
    try {
        showLoading();
        await loadDashboardData();
        renderDashboard();
        setupEventListeners();
        updateLastUpdatedTime();
        
        // Автообновление каждые 5 минут
        setInterval(refreshDashboard, 5 * 60 * 1000);
        
    } catch (error) {
        console.error('Ошибка инициализации дашборда:', error);
        notifications.error('Ошибка загрузки данных дашборда');
    } finally {
        hideLoading();
    }
}

async function loadDashboardData() {
    try {
        // Загружаем основные данные
        const [dashboardStats, financeStats] = await Promise.all([
            api.getDashboardStats(),
            api.getFinanceStats().catch(() => null) // Для не-владельцев может быть недоступно
        ]);
        
        dashboardData = {
            ...dashboardStats,
            finance: financeStats
        };
        
        // Дополнительные данные в зависимости от роли
        const userRole = getCurrentUserRole();
        
        if (userRole === 'manager') {
            await loadManagerData();
        } else if (userRole === 'installer') {
            await loadInstallerData();
        }
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        throw error;
    }
}

async function loadManagerData() {
    try {
        // Загружаем данные менеджера
        const userId = getCurrentUserId();
        
        const [orders, clients, salary] = await Promise.all([
            api.getOrders({ manager: userId, created_at__gte: getStartOfMonth() }),
            api.getClients({ search: '', created_at__gte: getStartOfMonth() }),
            api.calculateSalary(userId, {
                start_date: formatDate(getStartOfMonth()),
                end_date: formatDate(new Date())
            }).catch(() => null)
        ]);
        
        dashboardData.manager = {
            orders: orders.results || [],
            clients: clients.results || [],
            salary: salary?.salary || {}
        };
        
    } catch (error) {
        console.error('Ошибка загрузки данных менеджера:', error);
    }
}

async function loadInstallerData() {
    try {
        const userId = getCurrentUserId();
        const today = new Date();
        
        const [todaySchedule, monthlyStats, salary] = await Promise.all([
            api.getCalendar({
                installer_id: userId,
                start_date: formatDate(today),
                end_date: formatDate(today)
            }),
            api.getOrders({
                installers: userId,
                completed_at__gte: getStartOfMonth(),
                status: 'completed'
            }),
            api.calculateSalary(userId, {
                start_date: formatDate(getStartOfMonth()),
                end_date: formatDate(new Date())
            }).catch(() => null)
        ]);
        
        dashboardData.installer = {
            todaySchedule: todaySchedule.calendar || {},
            monthlyStats: monthlyStats.results || [],
            salary: salary?.salary || {}
        };
        
    } catch (error) {
        console.error('Ошибка загрузки данных монтажника:', error);
    }
}

function renderDashboard() {
    const userRole = getCurrentUserRole();
    
    switch (userRole) {
        case 'owner':
            renderOwnerDashboard();
            break;
        case 'manager':
            renderManagerDashboard();
            break;
        case 'installer':
            renderInstallerDashboard();
            break;
    }
}

function renderOwnerDashboard() {
    const data = dashboardData;
    const finance = data.finance || {};
    
    // Финансовые метрики
    updateElement('monthly-income', formatCurrency(finance.income_this_month || 0));
    updateElement('monthly-expenses', formatCurrency(finance.expense_this_month || 0));
    updateElement('monthly-profit', formatCurrency(finance.profit_this_month || 0));
    updateElement('company-balance', formatCurrency(data.company_balance || 0));
    
    // Изменения (пока заглушка)
    updateElement('income-change', '+12.5%');
    updateElement('expenses-change', '+8.2%');
    updateElement('profit-change', '+18.7%');
    
    // Статистика заказов
    updateElement('total-orders', data.total_orders || 0);
    updateElement('completed-orders', data.completed_orders || 0);
    updateElement('orders-this-month', data.orders_this_month || 0);
    
    // Топ менеджеры
    renderTopManagers(data.top_managers || []);
    
    // Последние заказы
    renderRecentOrders(data.recent_orders || []);
    
    // График финансов
    renderFinanceChart(finance.daily_stats || []);
}

function renderManagerDashboard() {
    const data = dashboardData;
    const manager = data.manager || {};
    
    // Статистика менеджера
    updateElement('my-orders', manager.orders?.length || 0);
    
    const totalRevenue = manager.orders?.reduce((sum, order) => sum + parseFloat(order.total_cost || 0), 0) || 0;
    updateElement('my-revenue', formatCurrency(totalRevenue));
    updateElement('my-clients', manager.clients?.length || 0);
    updateElement('my-salary', formatCurrency(manager.salary?.total_salary || 0));
    
    // Воронка продаж
    renderSalesFunnel(manager.orders || []);
    
    // Активные заказы
    renderActiveOrders(manager.orders?.filter(order => order.status !== 'completed') || []);
}

function renderInstallerDashboard() {
    const data = dashboardData;
    const installer = data.installer || {};
    
    // Дата сегодня
    updateElement('today-date', formatDate(new Date(), { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    }));
    
    // Расписание на сегодня
    renderTodaySchedule(installer.todaySchedule);
    
    // Статистика за месяц
    updateElement('installations-count', installer.monthlyStats?.length || 0);
    updateElement('installer-salary', formatCurrency(installer.salary?.total_salary || 0));
    
    // Маршрут (пока заглушка)
    updateElement('route-distance', '47');
}

function renderTopManagers(managers) {
    const container = document.getElementById('top-managers');
    if (!container) return;
    
    if (managers.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">Нет данных</p>';
        return;
    }
    
    const html = managers.map((manager, index) => `
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-3">
            <div class="flex items-center">
                <div class="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white font-semibold text-sm mr-3">
                    ${index + 1}
                </div>
                <div>
                    <p class="font-medium text-gray-900">${manager.name}</p>
                    <p class="text-sm text-gray-500">${manager.orders_count} заказов</p>
                </div>
            </div>
            <div class="text-right">
                <p class="font-semibold text-gray-900">${formatCurrency(manager.revenue)}</p>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

function renderRecentOrders(orders) {
    const container = document.getElementById('recent-orders');
    if (!container) return;
    
    if (orders.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">Нет заказов</p>';
        return;
    }
    
    const html = orders.map(order => `
        <div class="flex items-center justify-between py-3 border-b border-gray-200 last:border-b-0">
            <div>
                <p class="font-medium text-gray-900">
                    <a href="/orders/${order.id}/" class="hover:text-blue-600">
                        Заказ #${order.id}
                    </a>
                </p>
                <p class="text-sm text-gray-500">${order.client_name}</p>
            </div>
            <div class="text-right">
                <p class="font-semibold text-gray-900">${formatCurrency(order.total_cost)}</p>
                <span class="badge status-${order.status}">${order.status_display}</span>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

function renderFinanceChart(dailyStats) {
    const canvas = document.getElementById('finance-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Уничтожаем предыдущий график
    if (financeChart) {
        financeChart.destroy();
    }
    
    const labels = dailyStats.map(stat => DateUtils.format(stat.date, 'dd.MM'));
    const incomeData = dailyStats.map(stat => stat.income);
    const expenseData = dailyStats.map(stat => stat.expense);
    
    financeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Доходы',
                    data: incomeData,
                    borderColor: 'rgb(34, 197, 94)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Расходы',
                    data: expenseData,
                    borderColor: 'rgb(239, 68, 68)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

function renderSalesFunnel(orders) {
    const container = document.getElementById('sales-funnel');
    if (!container) return;
    
    // Простая воронка продаж
    const total = orders.length;
    const inProgress = orders.filter(o => o.status === 'in_progress').length;
    const completed = orders.filter(o => o.status === 'completed').length;
    
    const html = `
        <div class="space-y-3">
            <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600">Лиды</span>
                <span class="font-semibold">${total}</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-yellow-500 h-2 rounded-full" style="width: ${total > 0 ? (inProgress / total * 100) : 0}%"></div>
            </div>
            
            <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600">Завершено</span>
                <span class="font-semibold">${completed}</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-green-500 h-2 rounded-full" style="width: ${total > 0 ? (completed / total * 100) : 0}%"></div>
            </div>
            
            <div class="pt-3 border-t">
                <p class="text-sm text-gray-500">
                    Конверсия: ${total > 0 ? ((completed / total) * 100).toFixed(1) : 0}%
                </p>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function renderActiveOrders(orders) {
    const container = document.getElementById('active-orders');
    if (!container) return;
    
    if (orders.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">Нет активных заказов</p>';
        return;
    }
    
    const html = orders.slice(0, 5).map(order => `
        <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg mb-3">
            <div>
                <p class="font-medium text-gray-900">
                    <a href="/orders/${order.id}/" class="hover:text-blue-600">
                        #${order.id} - ${order.client_name}
                    </a>
                </p>
                <p class="text-sm text-gray-500">${DateUtils.timeAgo(order.created_at)}</p>
            </div>
            <div class="text-right">
                <span class="badge status-${order.status}">${order.status_display}</span>
                <p class="text-sm font-semibold text-gray-900 mt-1">${formatCurrency(order.total_cost)}</p>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

function renderTodaySchedule(scheduleData) {
    const container = document.getElementById('today-schedule');
    if (!container) return;
    
    const today = DateUtils.format(new Date(), 'yyyy-MM-dd');
    const todaySchedules = scheduleData[today] || [];
    
    if (todaySchedules.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-calendar-check text-4xl text-gray-400 mb-4"></i>
                <p class="text-gray-500">На сегодня монтажей не запланировано</p>
                <p class="text-sm text-gray-400">Хорошего отдыха!</p>
            </div>
        `;
        return;
    }
    
    const html = todaySchedules.map(schedule => `
        <div class="bg-white border border-gray-200 rounded-lg p-4 mb-3">
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center">
                    <div class="w-3 h-3 rounded-full mr-3 ${getStatusColor(schedule.status)}"></div>
                    <span class="font-medium text-gray-900">${schedule.start_time} - ${schedule.end_time}</span>
                    <span class="badge priority-${schedule.priority} ml-2">${schedule.priority_display}</span>
                </div>
                <span class="badge status-${schedule.status}">${schedule.status_display}</span>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <p class="font-semibold text-gray-900">${schedule.client_name}</p>
                    <p class="text-sm text-gray-600">
                        <i class="fas fa-map-marker-alt mr-1"></i>
                        ${schedule.client_address}
                    </p>
                    <p class="text-sm text-gray-600">
                        <i class="fas fa-phone mr-1"></i>
                        ${formatPhone(schedule.client_phone)}
                    </p>
                </div>
                
                <div class="text-right">
                    ${schedule.notes ? `<p class="text-sm text-gray-600 mb-2">${schedule.notes}</p>` : ''}
                    <div class="flex flex-col sm:flex-row gap-2 justify-end">
                        ${schedule.status === 'scheduled' ? 
                            `<button onclick="startWork(${schedule.id})" class="btn btn-sm btn-success">
                                <i class="fas fa-play mr-1"></i>
                                Начать
                            </button>` : ''
                        }
                        ${schedule.status === 'in_progress' ? 
                            `<button onclick="completeWork(${schedule.id})" class="btn btn-sm btn-primary">
                                <i class="fas fa-check mr-1"></i>
                                Завершить
                            </button>` : ''
                        }
                        <button onclick="openScheduleDetails(${schedule.id})" class="btn btn-sm btn-outline">
                            <i class="fas fa-info mr-1"></i>
                            Детали
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

function setupEventListeners() {
    // Обновление периода графика финансов
    const periodSelect = document.getElementById('finance-period');
    if (periodSelect) {
        periodSelect.addEventListener('change', async (e) => {
            const period = e.target.value;
            await updateFinanceChart(period);
        });
    }
}

async function updateFinanceChart(period = 30) {
    try {
        const financeData = await api.getFinanceStats({ days: period });
        renderFinanceChart(financeData.daily_stats || []);
    } catch (error) {
        console.error('Ошибка обновления графика:', error);
    }
}

async function refreshDashboard() {
    const refreshBtn = document.getElementById('refresh-btn');
    const originalText = refreshBtn.innerHTML;
    
    try {
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Обновление...';
        refreshBtn.disabled = true;
        
        await loadDashboardData();
        renderDashboard();
        updateLastUpdatedTime();
        
        notifications.success('Данные обновлены');
        
    } catch (error) {
        console.error('Ошибка обновления дашборда:', error);
        notifications.error('Ошибка обновления данных');
    } finally {
        refreshBtn.innerHTML = originalText;
        refreshBtn.disabled = false;
    }
}

// Функции для работы с расписанием монтажника
async function startWork(scheduleId) {
    try {
        await api.startWork(scheduleId);
        notifications.success('Работа начата');
        await refreshDashboard();
    } catch (error) {
        console.error('Ошибка начала работы:', error);
        notifications.error('Ошибка при начале работы');
    }
}

async function completeWork(scheduleId) {
    try {
        await api.completeWork(scheduleId);
        notifications.success('Работа завершена');
        await refreshDashboard();
    } catch (error) {
        console.error('Ошибка завершения работы:', error);
        notifications.error('Ошибка при завершении работы');
    }
}

function openScheduleDetails(scheduleId) {
    // Открыть модальное окно с деталями расписания
    window.location.href = `/calendar/schedule/${scheduleId}/`;
}

// Вспомогательные функции
function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function updateLastUpdatedTime() {
    const element = document.getElementById('last-updated');
    if (element) {
        element.textContent = DateUtils.format(new Date(), 'dd.MM.yyyy HH:mm');
    }
}

function getCurrentUserRole() {
    // Получаем роль из meta-тега или глобальной переменной
    const userMeta = document.querySelector('meta[name="current-user"]');
    if (userMeta) {
        try {
            const user = JSON.parse(userMeta.content);
            return user.role;
        } catch (e) {
            console.warn('Не удалось получить роль пользователя');
        }
    }
    
    // Fallback - определяем по URL или другим признакам
    return 'owner'; // По умолчанию
}

function getCurrentUserId() {
    const userMeta = document.querySelector('meta[name="current-user"]');
    if (userMeta) {
        try {
            const user = JSON.parse(userMeta.content);
            return user.id;
        } catch (e) {
            console.warn('Не удалось получить ID пользователя');
        }
    }
    return null;
}

function getStartOfMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
}

function formatDate(date) {
    return DateUtils.format(date, 'yyyy-MM-dd');
}

function getStatusColor(status) {
    const colors = {
        'scheduled': 'bg-blue-500',
        'in_progress': 'bg-yellow-500',
        'completed': 'bg-green-500',
        'cancelled': 'bg-red-500',
        'rescheduled': 'bg-gray-500'
    };
    return colors[status] || 'bg-gray-500';
}

// Функция для глобального использования
window.refreshData = refreshDashboard;
window.initDashboard = initDashboard;
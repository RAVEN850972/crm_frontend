// Analytics Page JavaScript
let analyticsData = {};
let charts = {};
let currentPeriod = 30;

// Инициализация страницы аналитики
async function initAnalyticsPage() {
    try {
        showLoading();
        await loadAnalyticsData();
        setupEventListeners();
        renderAnalytics();
        
    } catch (error) {
        console.error('Ошибка инициализации аналитики:', error);
        notifications.error('Ошибка загрузки аналитических данных');
    } finally {
        hideLoading();
    }
}

// Загрузка аналитических данных
async function loadAnalyticsData() {
    try {
        const [
            dashboardStats,
            financeStats,
            clientsStats,
            ordersStats,
            servicesStats
        ] = await Promise.all([
            api.getDashboardStats(),
            api.getFinanceStats().catch(() => ({})),
            api.getClientsStatsBySource(),
            api.getOrdersStatsByManager(),
            api.get('services/stats/popular/')
        ]);

        analyticsData = {
            dashboard: dashboardStats,
            finance: financeStats,
            clients: clientsStats,
            orders: ordersStats,
            services: servicesStats
        };

        // Загружаем дополнительные данные для аналитики
        await loadAdditionalAnalytics();
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        throw error;
    }
}

// Загрузка дополнительных аналитических данных
async function loadAdditionalAnalytics() {
    try {
        // Воронка продаж
        analyticsData.salesFunnel = await calculateSalesFunnel();
        
        // Прогнозы
        analyticsData.forecasts = await calculateForecasts();
        
        // Операционные метрики
        analyticsData.operationalMetrics = await calculateOperationalMetrics();
        
        // Рекомендации
        analyticsData.recommendations = await generateRecommendations();
        
        // KPI
        analyticsData.kpi = await calculateKPI();
        
    } catch (error) {
        console.error('Ошибка загрузки дополнительных данных:', error);
    }
}

// Расчет воронки продаж
async function calculateSalesFunnel() {
    const { dashboard } = analyticsData;
    
    // Примерные данные на основе заказов
    const totalLeads = Math.round(dashboard.total_orders * 1.8); // Предполагаем 80% конверсию из лидов в заказы
    const meetings = Math.round(totalLeads * 0.75);
    const orders = dashboard.total_orders;
    const completedOrders = dashboard.completed_orders;
    const repeatOrders = Math.round(completedOrders * 0.15); // 15% повторных заказов

    return {
        leads: totalLeads,
        meetings: meetings,
        orders: orders,
        installations: completedOrders,
        repeat: repeatOrders,
        conversions: {
            leadsToMeetings: meetings / totalLeads,
            meetingsToOrders: orders / meetings,
            ordersToInstallations: completedOrders / orders,
            installationsToRepeat: repeatOrders / completedOrders
        }
    };
}

// Расчет прогнозов
async function calculateForecasts() {
    const { dashboard, finance } = analyticsData;
    
    const currentRevenue = finance.income_this_month || 0;
    const growth = 0.15; // 15% рост
    
    return {
        revenue: {
            value: currentRevenue * (1 + growth),
            range: {
                min: currentRevenue * (1 + growth - 0.1),
                max: currentRevenue * (1 + growth + 0.1)
            }
        },
        orders: Math.round(dashboard.orders_this_month * (1 + growth)),
        clients: Math.round(dashboard.clients_this_month * (1 + growth)),
        managersLoad: '87%',
        installersLoad: '92%'
    };
}

// Расчет операционных метрик
async function calculateOperationalMetrics() {
    return {
        leadProcessingTime: '1.2 дня',
        orderToInstallTime: '3.5 дня',
        installationTime: '2.8 часа',
        npsScore: '8.9',
        repeatOrdersRate: '15%'
    };
}

// Генерация рекомендаций
async function generateRecommendations() {
    const recommendations = [];
    
    // Анализ данных и генерация рекомендаций
    const { dashboard, finance } = analyticsData;
    
    if (dashboard.orders_this_month < dashboard.completed_orders * 0.8) {
        recommendations.push({
            type: 'warning',
            title: 'Снижение новых заказов',
            description: 'Количество новых заказов снизилось. Рекомендуем усилить маркетинговые активности.',
            action: 'Проанализировать источники лидов'
        });
    }
    
    if (finance.expense_this_month > finance.income_this_month * 0.7) {
        recommendations.push({
            type: 'alert',
            title: 'Высокие расходы',
            description: 'Расходы составляют более 70% от доходов. Необходимо оптимизировать затраты.',
            action: 'Пересмотреть структуру расходов'
        });
    }
    
    recommendations.push({
        type: 'info',
        title: 'Сезонность спроса',
        description: 'Приближается пик сезона. Рекомендуем увеличить складские запасы.',
        action: 'Планировать закупки оборудования'
    });
    
    return recommendations;
}

// Расчет KPI
async function calculateKPI() {
    const { dashboard, finance } = analyticsData;
    
    return [
        {
            name: 'Выручка',
            fact: finance.income_this_month || 0,
            plan: 900000,
            unit: '₽'
        },
        {
            name: 'Новые клиенты',
            fact: dashboard.clients_this_month,
            plan: 30,
            unit: 'шт'
        },
        {
            name: 'Завершенные заказы',
            fact: dashboard.completed_orders,
            plan: 80,
            unit: 'шт'
        },
        {
            name: 'Маржинальность',
            fact: finance.income_this_month ? ((finance.income_this_month - finance.expense_this_month) / finance.income_this_month * 100) : 0,
            plan: 60,
            unit: '%'
        },
        {
            name: 'NPS',
            fact: 8.9,
            plan: 9.0,
            unit: ''
        }
    ];
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Фильтр периода
    document.getElementById('period-filter').addEventListener('change', (e) => {
        currentPeriod = parseInt(e.target.value);
        refreshAnalytics();
    });
    
    // Тип графика выручки
    document.getElementById('revenue-chart-type').addEventListener('change', (e) => {
        updateRevenueChart(e.target.value);
    });
}

// Рендеринг всей аналитики
function renderAnalytics() {
    renderKeyMetrics();
    renderSalesFunnel();
    renderCharts();
    renderTopLists();
    renderOperationalMetrics();
    renderForecasts();
    renderRecommendations();
    renderKPI();
}

// Рендеринг ключевых метрик
function renderKeyMetrics() {
    const { dashboard, finance } = analyticsData;
    
    // Общая выручка
    updateMetric('total-revenue', formatCurrency(finance.income_this_month || 0));
    updateMetric('revenue-change', '+12.5%', 'text-green-600');
    
    // Маржинальность
    const margin = finance.income_this_month ? 
        ((finance.income_this_month - finance.expense_this_month) / finance.income_this_month * 100) : 0;
    updateMetric('margin-percentage', margin.toFixed(1) + '%');
    updateMetric('margin-change', '+2.3%', 'text-green-600');
    
    // Средний чек
    const avgCheck = dashboard.completed_orders ? 
        (finance.income_this_month / dashboard.completed_orders) : 0;
    updateMetric('average-check', formatCurrency(avgCheck));
    updateMetric('check-change', '+8.7%', 'text-green-600');
    
    // Новые клиенты
    updateMetric('new-clients', dashboard.clients_this_month || 0);
    updateMetric('clients-change', '+15.2%', 'text-green-600');
}

// Рендеринг воронки продаж
function renderSalesFunnel() {
    const funnel = analyticsData.salesFunnel;
    if (!funnel) return;
    
    const container = document.getElementById('sales-funnel');
    const maxWidth = 100;
    
    const stages = [
        { name: 'Лиды', value: funnel.leads, color: 'bg-blue-500' },
        { name: 'Встречи', value: funnel.meetings, color: 'bg-indigo-500' },
        { name: 'Заказы', value: funnel.orders, color: 'bg-purple-500' },
        { name: 'Установки', value: funnel.installations, color: 'bg-green-500' },
        { name: 'Повторные', value: funnel.repeat, color: 'bg-yellow-500' }
    ];
    
    const maxValue = Math.max(...stages.map(s => s.value));
    
    container.innerHTML = stages.map((stage, index) => {
        const width = (stage.value / maxValue) * maxWidth;
        const conversion = index > 0 ? 
            ((stage.value / stages[index - 1].value) * 100).toFixed(1) + '%' : '';
        
        return `
            <div class="flex items-center space-x-4">
                <div class="w-24 text-sm font-medium text-gray-700">${stage.name}</div>
                <div class="flex-1">
                    <div class="flex items-center space-x-2">
                        <div class="flex-1 bg-gray-200 rounded-full h-6">
                            <div class="${stage.color} h-6 rounded-full flex items-center justify-end pr-2" 
                                 style="width: ${width}%">
                                <span class="text-white text-xs font-medium">${stage.value}</span>
                            </div>
                        </div>
                        ${conversion ? `<span class="text-sm text-gray-500 w-12">${conversion}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Общая конверсия
    const totalConversion = ((funnel.installations / funnel.leads) * 100).toFixed(1);
    document.getElementById('conversion-rate').textContent = totalConversion + '%';
}

// Рендеринг графиков
function renderCharts() {
    renderRevenueChart();
    renderServicesChart();
    renderSourcesChart();
    renderManagersChart();
}

// График выручки
function renderRevenueChart() {
    const ctx = document.getElementById('revenue-chart').getContext('2d');
    
    if (charts.revenue) {
        charts.revenue.destroy();
    }
    
    const months = [];
    const revenue = [];
    const currentDate = new Date();
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        months.push(date.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }));
        revenue.push(Math.random() * 200000 + 600000); // Случайные данные
    }
    
    charts.revenue = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Выручка',
                data: revenue,
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
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
            }
        }
    });
}

// График услуг
function renderServicesChart() {
    const ctx = document.getElementById('services-chart').getContext('2d');
    
    if (charts.services) {
        charts.services.destroy();
    }
    
    const services = analyticsData.services || [];
    const labels = services.map(s => s.name);
    const data = services.map(s => s.count);
    
    charts.services = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    'rgb(59, 130, 246)',
                    'rgb(16, 185, 129)',
                    'rgb(245, 158, 11)',
                    'rgb(139, 92, 246)',
                    'rgb(239, 68, 68)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

// График источников
function renderSourcesChart() {
    const ctx = document.getElementById('sources-chart').getContext('2d');
    
    if (charts.sources) {
        charts.sources.destroy();
    }
    
    const sources = analyticsData.clients || [];
    const labels = sources.map(s => s.source);
    const data = sources.map(s => s.count);
    
    charts.sources = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    'rgb(59, 130, 246)',
                    'rgb(16, 185, 129)',
                    'rgb(245, 158, 11)',
                    'rgb(139, 92, 246)',
                    'rgb(239, 68, 68)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

// График менеджеров
function renderManagersChart() {
    const ctx = document.getElementById('managers-chart').getContext('2d');
    
    if (charts.managers) {
        charts.managers.destroy();
    }
    
    const managers = analyticsData.orders || [];
    const labels = managers.map(m => m.name);
    const orders = managers.map(m => m.orders);
    const revenue = managers.map(m => m.revenue);
    
    charts.managers = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Заказы',
                    data: orders,
                    backgroundColor: 'rgb(59, 130, 246)',
                    yAxisID: 'y'
                },
                {
                    label: 'Выручка',
                    data: revenue,
                    type: 'line',
                    borderColor: 'rgb(16, 185, 129)',
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Количество заказов'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Выручка'
                    },
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

// Рендеринг топ списков
function renderTopLists() {
    renderTopServices();
    renderTopClients();
}

// Топ услуг
function renderTopServices() {
    const container = document.getElementById('top-services');
    if (!container) return;
    
    const services = analyticsData.services || [];
    
    const html = services.slice(0, 5).map(service => `
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
                <p class="font-medium text-gray-900">${service.name}</p>
                <p class="text-sm text-gray-500">${service.count} заказов</p>
            </div>
            <div class="text-right">
                <p class="font-semibold text-gray-900">${formatCurrency(service.revenue)}</p>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

// Топ клиентов
function renderTopClients() {
    const container = document.getElementById('top-clients');
    if (!container) return;
    
    const clients = analyticsData.clients || [];
    
    const html = clients.slice(0, 5).map(client => `
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
                <p class="font-medium text-gray-900">${client.name}</p>
                <p class="text-sm text-gray-500">${client.orders} заказов</p>
            </div>
            <div class="text-right">
                <p class="font-semibold text-gray-900">${formatCurrency(client.revenue)}</p>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

// Рендеринг операционных метрик
function renderOperationalMetrics() {
    const metrics = analyticsData.operationalMetrics || {};
    
    updateElement('lead-processing-time', metrics.leadProcessingTime || '—');
    updateElement('order-to-install-time', metrics.orderToInstallTime || '—');
    updateElement('installation-time', metrics.installationTime || '—');
    updateElement('nps-score', metrics.npsScore || '—');
    updateElement('repeat-orders', metrics.repeatOrdersRate || '—');
}

// Рендеринг прогнозов
function renderForecasts() {
    const forecasts = analyticsData.forecasts || {};
    
    updateElement('forecast-revenue', formatCurrency(forecasts.revenue?.value || 0));
    updateElement('forecast-range', 
        `${formatCurrency(forecasts.revenue?.range?.min || 0)} - ${formatCurrency(forecasts.revenue?.range?.max || 0)}`);
    updateElement('forecast-orders', forecasts.orders || '—');
    updateElement('forecast-clients', forecasts.clients || '—');
    updateElement('managers-load', forecasts.managersLoad || '—');
    updateElement('installers-load', forecasts.installersLoad || '—');
}

// Рендеринг рекомендаций
function renderRecommendations() {
    const container = document.getElementById('recommendations');
    if (!container) return;
    
    const recommendations = analyticsData.recommendations || [];
    
    const html = recommendations.map(rec => `
        <div class="p-4 rounded-lg ${getRecommendationColor(rec.type)}">
            <div class="flex items-start">
                <div class="flex-shrink-0">
                    ${getRecommendationIcon(rec.type)}
                </div>
                <div class="ml-3">
                    <h4 class="text-sm font-medium text-gray-900">${rec.title}</h4>
                    <p class="mt-1 text-sm text-gray-600">${rec.description}</p>
                    <p class="mt-2 text-sm font-medium text-gray-900">${rec.action}</p>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

// Рендеринг KPI
function renderKPI() {
    const container = document.getElementById('kpi-table');
    if (!container) return;
    
    const kpi = analyticsData.kpi || [];
    
    const html = kpi.map(item => {
        const completion = (item.fact / item.plan) * 100;
        const status = getKPIStatus(completion);
        
        return `
            <tr>
                <td class="py-3 text-sm text-gray-900">${item.name}</td>
                <td class="py-3 text-sm text-right font-medium">${item.fact}${item.unit}</td>
                <td class="py-3 text-sm text-right text-gray-500">${item.plan}${item.unit}</td>
                <td class="py-3 text-sm text-right">
                    <div class="w-24 bg-gray-200 rounded-full h-2">
                        <div class="${getKPIProgressColor(completion)} h-2 rounded-full" 
                             style="width: ${Math.min(completion, 100)}%"></div>
                    </div>
                </td>
                <td class="py-3 text-sm text-center">
                    <span class="badge ${getKPIStatusColor(status)}">${status}</span>
                </td>
            </tr>
        `;
    }).join('');
    
    container.innerHTML = html;
}

// Вспомогательные функции
function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function formatCurrency(value) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB'
    }).format(value);
}

function getRecommendationColor(type) {
    const colors = {
        warning: 'bg-yellow-50',
        alert: 'bg-red-50',
        info: 'bg-blue-50'
    };
    return colors[type] || 'bg-gray-50';
}

function getRecommendationIcon(type) {
    const icons = {
        warning: '<i class="fas fa-exclamation-triangle text-yellow-400"></i>',
        alert: '<i class="fas fa-exclamation-circle text-red-400"></i>',
        info: '<i class="fas fa-info-circle text-blue-400"></i>'
    };
    return icons[type] || '<i class="fas fa-info-circle text-gray-400"></i>';
}

function getKPIStatus(completion) {
    if (completion >= 100) return 'Выполнено';
    if (completion >= 80) return 'Хорошо';
    if (completion >= 60) return 'Средне';
    return 'Требует внимания';
}

function getKPIStatusColor(status) {
    const colors = {
        'Выполнено': 'bg-green-100 text-green-800',
        'Хорошо': 'bg-blue-100 text-blue-800',
        'Средне': 'bg-yellow-100 text-yellow-800',
        'Требует внимания': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
}

function getKPIProgressColor(completion) {
    if (completion >= 100) return 'bg-green-500';
    if (completion >= 80) return 'bg-blue-500';
    if (completion >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
}

// Экспорт функций
window.refreshAnalytics = async function() {
    try {
        showLoading();
        await loadAnalyticsData();
        renderAnalytics();
        notifications.success('Данные обновлены');
    } catch (error) {
        console.error('Ошибка обновления аналитики:', error);
        notifications.error('Ошибка обновления данных');
    } finally {
        hideLoading();
    }
};

window.exportReport = async function() {
    try {
        showLoading();
        const response = await fetch('/api/analytics/export/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
            }
        });
        
        if (!response.ok) throw new Error('Ошибка экспорта');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics_report_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        
        notifications.success('Отчет экспортирован');
    } catch (error) {
        console.error('Ошибка экспорта отчета:', error);
        notifications.error('Ошибка экспорта отчета');
    } finally {
        hideLoading();
    }
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', initAnalyticsPage);
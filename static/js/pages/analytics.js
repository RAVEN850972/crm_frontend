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
    
    // Уничтожаем предыдущий график
    if (charts.revenue) {
        charts.revenue.destroy();
    }
    
    // Генерируем данные для последних месяцев
    const months = [];
    const revenue = [];
    const currentDate = new Date();
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        months.push(date.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }));
        revenue.push(Math.random() * 200000 + 600000); // Случайные данные
    }
    
    charts.revenue = new Chart
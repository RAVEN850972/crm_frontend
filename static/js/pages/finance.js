// JavaScript для страницы финансов
let financeData = {
    stats: {},
    transactions: [],
    charts: {
        finance: null,
        income: null,
        expenses: null,
        monthlyDynamics: null
    }
};

let currentPeriod = 30;

async function initFinancePage() {
    try {
        showLoading();
        await loadFinanceData();
        await loadTransactions();
        setupEventListeners();
        renderFinanceStats();
        renderCharts();
        renderTransactions();
        
    } catch (error) {
        console.error('Ошибка инициализации страницы финансов:', error);
        notifications.error('Ошибка загрузки финансовых данных');
    } finally {
        hideLoading();
    }
}

async function loadFinanceData() {
    try {
        // Загружаем статистику финансов
        const [balanceData, statsData] = await Promise.all([
            api.getFinanceBalance(),
            api.getFinanceStats()
        ]);
        
        financeData.stats = {
            ...balanceData,
            ...statsData
        };
        
    } catch (error) {
        console.error('Ошибка загрузки финансовых данных:', error);
        throw error;
    }
}

async function loadTransactions() {
    try {
        const response = await api.getTransactions({
            page_size: 10,
            ordering: '-created_at'
        });
        
        financeData.transactions = response.results || [];
        
    } catch (error) {
        console.error('Ошибка загрузки транзакций:', error);
        throw error;
    }
}

function setupEventListeners() {
    // Период финансового графика
    const periodSelect = document.getElementById('finance-period');
    if (periodSelect) {
        periodSelect.addEventListener('change', async (e) => {
            currentPeriod = parseInt(e.target.value);
            await updateFinanceChart();
        });
    }
    
    // Кнопка отправки формы транзакции
    const submitButton = document.getElementById('transaction-submit');
    if (submitButton) {
        submitButton.addEventListener('click', handleTransactionSubmit);
    }
    
    // ESC для закрытия модального окна
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeTransactionModal();
        }
    });
}

function renderFinanceStats() {
    const stats = financeData.stats;
    
    // Основные показатели
    updateElement('monthly-income', formatCurrency(stats.income_this_month || 0));
    updateElement('monthly-expenses', formatCurrency(stats.expense_this_month || 0));
    updateElement('monthly-profit', formatCurrency(stats.profit_this_month || 0));
    updateElement('company-balance', formatCurrency(stats.balance || 0));
    
    // Изменения (заглушка для демонстрации)
    updateElement('income-change', '+12.5%');
    updateElement('expenses-change', '+8.2%');
    updateElement('profit-change', '+18.7%');
    
    // Прогнозы (заглушка)
    const forecastIncome = (stats.income_this_month || 0) * 1.1;
    const forecastExpenses = (stats.expense_this_month || 0) * 1.05;
    const forecastProfit = forecastIncome - forecastExpenses;
    
    updateElement('forecast-income', formatCurrency(forecastIncome));
    updateElement('forecast-expenses', formatCurrency(forecastExpenses));
    updateElement('forecast-profit', formatCurrency(forecastProfit));
    
    // Анализ прибыльности
    const roi = stats.expense_this_month > 0 ? (stats.profit_this_month / stats.expense_this_month * 100) : 0;
    const margin = stats.income_this_month > 0 ? (stats.profit_this_month / stats.income_this_month * 100) : 0;
    const avgCheck = 42500; // Заглушка
    const growth = 15.3; // Заглушка
    
    updateElement('roi-percentage', roi.toFixed(1) + '%');
    updateElement('margin-percentage', margin.toFixed(1) + '%');
    updateElement('average-check', formatCurrency(avgCheck));
    
    const growthElement = document.getElementById('growth-percentage');
    if (growthElement) {
        growthElement.textContent = '+' + growth + '%';
        growthElement.className = 'text-lg font-bold text-green-600';
    }
}

function renderCharts() {
    renderFinanceChart();
    renderIncomeExpensesCharts();
    renderMonthlyDynamicsChart();
}

function renderFinanceChart() {
    const canvas = document.getElementById('finance-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Уничтожаем предыдущий график
    if (financeData.charts.finance) {
        financeData.charts.finance.destroy();
    }
    
    // Генерируем данные для последних дней
    const dailyStats = financeData.stats.daily_stats || generateMockDailyStats();
    
    const labels = dailyStats.map(stat => formatDate(stat.date, 'dd.MM'));
    const incomeData = dailyStats.map(stat => stat.income);
    const expenseData = dailyStats.map(stat => stat.expense);
    
    financeData.charts.finance = new Chart(ctx, {
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

function renderIncomeExpensesCharts() {
    // График структуры доходов
    const incomeCanvas = document.getElementById('income-chart');
    if (incomeCanvas) {
        const ctx = incomeCanvas.getContext('2d');
        
        if (financeData.charts.income) {
            financeData.charts.income.destroy();
        }
        
        const incomeStructure = [
            { label: 'Монтаж', value: 60, color: '#3B82F6' },
            { label: 'Оборудование', value: 35, color: '#10B981' },
            { label: 'Доп. услуги', value: 5, color: '#F59E0B' }
        ];
        
        financeData.charts.income = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: incomeStructure.map(item => item.label),
                datasets: [{
                    data: incomeStructure.map(item => item.value),
                    backgroundColor: incomeStructure.map(item => item.color),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }
    
    // График структуры расходов
    const expensesCanvas = document.getElementById('expenses-chart');
    if (expensesCanvas) {
        const ctx = expensesCanvas.getContext('2d');
        
        if (financeData.charts.expenses) {
            financeData.charts.expenses.destroy();
        }
        
        const expenseStructure = [
            { label: 'Зарплаты', value: 55, color: '#EF4444' },
            { label: 'Закупки', value: 30, color: '#F97316' },
            { label: 'Аренда', value: 10, color: '#8B5CF6' },
            { label: 'Прочие', value: 5, color: '#6B7280' }
        ];
        
        financeData.charts.expenses = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: expenseStructure.map(item => item.label),
                datasets: [{
                    data: expenseStructure.map(item => item.value),
                    backgroundColor: expenseStructure.map(item => item.color),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }
}

function renderMonthlyDynamicsChart() {
    const canvas = document.getElementById('monthly-dynamics-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Уничтожаем предыдущий график
    if (financeData.charts.monthlyDynamics) {
        financeData.charts.monthlyDynamics.destroy();
    }
    
    // Генерируем данные по месяцам
    const monthlyStats = financeData.stats.monthly_stats || generateMockMonthlyStats();
    
    const labels = monthlyStats.map(stat => stat.month);
    const incomeData = monthlyStats.map(stat => stat.income);
    const expenseData = monthlyStats.map(stat => stat.expense);
    const profitData = monthlyStats.map(stat => stat.profit);
    
    financeData.charts.monthlyDynamics = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Доходы',
                    data: incomeData,
                    backgroundColor: 'rgba(34, 197, 94, 0.8)',
                    borderColor: 'rgb(34, 197, 94)',
                    borderWidth: 1
                },
                {
                    label: 'Расходы',
                    data: expenseData,
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderColor: 'rgb(239, 68, 68)',
                    borderWidth: 1
                },
                {
                    label: 'Прибыль',
                    data: profitData,
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderColor: 'rgb(59, 130, 246)',
                    borderWidth: 1,
                    type: 'line'
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
            }
        }
    });
 }
 
 function renderTransactions() {
    const loadingElement = document.getElementById('transactions-loading');
    const tableElement = document.getElementById('transactions-table');
    const tbody = document.getElementById('recent-transactions');
    
    if (financeData.transactions.length === 0) {
        loadingElement.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-receipt text-4xl text-gray-400 mb-4"></i>
                <p class="text-gray-500">Нет транзакций</p>
            </div>
        `;
        return;
    }
    
    loadingElement.classList.add('hidden');
    tableElement.classList.remove('hidden');
    
    const html = financeData.transactions.map(transaction => {
        const typeIcon = transaction.type === 'income' ? 'fa-arrow-up text-green-600' : 'fa-arrow-down text-red-600';
        const amountColor = transaction.type === 'income' ? 'text-green-600' : 'text-red-600';
        const amountPrefix = transaction.type === 'income' ? '+' : '-';
        
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <i class="fas ${typeIcon} mr-2"></i>
                        <span class="text-sm font-medium text-gray-900">
                            ${transaction.type_display || (transaction.type === 'income' ? 'Доход' : 'Расход')}
                        </span>
                    </div>
                </td>
                <td class="px-4 py-4 whitespace-nowrap">
                    <span class="text-sm font-medium ${amountColor}">
                        ${amountPrefix}${formatCurrency(transaction.amount)}
                    </span>
                </td>
                <td class="px-4 py-4">
                    <div class="text-sm text-gray-900">
                        ${StringUtils.truncate(transaction.description, 50)}
                    </div>
                    ${transaction.order_display ? `
                        <div class="text-sm text-gray-500">
                            ${transaction.order_display}
                        </div>
                    ` : ''}
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${DateUtils.format(transaction.created_at, 'dd.MM.yyyy')}
                    <div class="text-xs text-gray-400">
                        ${DateUtils.timeAgo(transaction.created_at)}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = html;
 }
 
 async function updateFinanceChart() {
    try {
        // Перезагружаем данные для нового периода
        const statsData = await api.getFinanceStats({ days: currentPeriod });
        financeData.stats = { ...financeData.stats, ...statsData };
        
        // Перерисовываем график
        renderFinanceChart();
        
    } catch (error) {
        console.error('Ошибка обновления графика:', error);
        notifications.error('Ошибка обновления графика');
    }
 }
 
 // Функции для быстрых действий
 function addIncome() {
    openCreateTransactionModal('income');
 }
 
 function addExpense() {
    openCreateTransactionModal('expense');
 }
 
 function openCreateTransactionModal(type = null) {
    const modal = document.getElementById('transaction-modal');
    const form = document.getElementById('transaction-form');
    const typeSelect = document.getElementById('transaction-type');
    
    // Сбрасываем форму
    form.reset();
    
    // Предустанавливаем тип если передан
    if (type) {
        typeSelect.value = type;
    }
    
    // Загружаем список заказов для связи
    loadOrdersForTransaction();
    
    // Показываем модальное окно
    modal.classList.remove('hidden');
    
    // Фокусируемся на первое поле
    setTimeout(() => {
        if (!type) {
            typeSelect.focus();
        } else {
            document.getElementById('transaction-amount').focus();
        }
    }, 100);
 }
 
 function closeTransactionModal() {
    const modal = document.getElementById('transaction-modal');
    modal.classList.add('hidden');
 }
 
 async function loadOrdersForTransaction() {
    try {
        // Загружаем последние заказы для выбора
        const response = await api.getOrders({
            page_size: 50,
            ordering: '-created_at'
        });
        
        const orderSelect = document.getElementById('transaction-order');
        
        // Очищаем существующие опции (кроме первой)
        while (orderSelect.children.length > 1) {
            orderSelect.removeChild(orderSelect.lastChild);
        }
        
        // Добавляем заказы
        response.results?.forEach(order => {
            const option = document.createElement('option');
            option.value = order.id;
            option.textContent = `Заказ #${order.id} - ${order.client_name} (${formatCurrency(order.total_cost)})`;
            orderSelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
    }
 }
 
 async function handleTransactionSubmit() {
    const form = document.getElementById('transaction-form');
    const submitButton = document.getElementById('transaction-submit');
    const submitText = submitButton.querySelector('.submit-text');
    const loadingSpinner = submitButton.querySelector('.loading-spinner');
    
    // Валидация формы
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    // Показываем индикатор загрузки
    submitButton.disabled = true;
    submitText.textContent = 'Создание...';
    loadingSpinner.classList.remove('hidden');
    
    try {
        // Собираем данные формы
        const formData = new FormData(form);
        const data = {
            type: formData.get('type'),
            amount: parseFloat(formData.get('amount')),
            description: formData.get('description'),
            order: formData.get('order') || null
        };
        
        // Отправляем данные
        await api.createTransaction(data);
        
        // Успешное создание
        notifications.success('Транзакция успешно создана');
        closeTransactionModal();
        
        // Обновляем данные на странице
        await refreshFinanceData();
        
    } catch (error) {
        console.error('Ошибка создания транзакции:', error);
        notifications.apiError(error, 'Ошибка создания транзакции');
        
    } finally {
        // Восстанавливаем кнопку
        submitButton.disabled = false;
        submitText.textContent = 'Создать';
        loadingSpinner.classList.add('hidden');
    }
 }
 
 // Функции для других быстрых действий
 function openSalaryCalculationModal() {
    // Переходим на страницу расчета зарплат
    window.location.href = '/finance/salary-calculation/';
 }
 
 function viewSalaryCalculation() {
    window.location.href = '/finance/salary-calculation/';
 }
 
 function generateReport() {
    // Здесь будет логика генерации отчета
    notifications.info('Функция генерации отчета будет добавлена позже');
 }
 
 async function exportFinanceData() {
    try {
        showLoading();
        await api.exportFinance();
        notifications.success('Файл загружен');
    } catch (error) {
        console.error('Ошибка экспорта:', error);
        notifications.error('Ошибка экспорта данных');
    } finally {
        hideLoading();
    }
 }
 
 // Функция обновления данных
 async function refreshFinanceData() {
    try {
        await loadFinanceData();
        await loadTransactions();
        renderFinanceStats();
        renderCharts();
        renderTransactions();
        
    } catch (error) {
        console.error('Ошибка обновления данных:', error);
        notifications.error('Ошибка обновления данных');
    }
 }
 
 // Вспомогательные функции
 function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        // Убираем placeholder если есть
        const placeholder = element.querySelector('.animate-pulse');
        if (placeholder) {
            element.innerHTML = value;
        } else {
            element.textContent = value;
        }
    }
 }
 
 function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
 }
 
 function formatDate(date, format = 'dd.MM.yyyy') {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    return format
        .replace('dd', day)
        .replace('MM', month)
        .replace('yyyy', year);
 }
 
 // Генерация моковых данных для демонстрации
 function generateMockDailyStats() {
    const stats = [];
    const today = new Date();
    
    for (let i = currentPeriod - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        const income = Math.floor(Math.random() * 50000) + 10000;
        const expense = Math.floor(Math.random() * 20000) + 5000;
        
        stats.push({
            date: date.toISOString().split('T')[0],
            income: income,
            expense: expense,
            profit: income - expense
        });
    }
    
    return stats;
 }
 
 function generateMockMonthlyStats() {
    const stats = [];
    const months = ['Дек 2024', 'Янв 2025', 'Фев 2025', 'Мар 2025', 'Апр 2025', 'Май 2025'];
    
    months.forEach(month => {
        const income = Math.floor(Math.random() * 500000) + 300000;
        const expense = Math.floor(Math.random() * 200000) + 100000;
        
        stats.push({
            month: month,
            income: income,
            expense: expense,
            profit: income - expense
        });
    });
    
    return stats;
 }
 
 // Экспорт функций для глобального использования
 window.initFinancePage = initFinancePage;
 window.refreshFinanceData = refreshFinanceData;
 window.openCreateTransactionModal = openCreateTransactionModal;
 window.closeTransactionModal = closeTransactionModal;
 window.addIncome = addIncome;
 window.addExpense = addExpense;
 window.viewSalaryCalculation = viewSalaryCalculation;
 window.generateReport = generateReport;
 window.exportFinanceData = exportFinanceData;
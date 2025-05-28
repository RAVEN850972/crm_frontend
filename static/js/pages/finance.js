// JavaScript для страницы финансов
let financeData = {};
let financeChart = null;
let expensesChart = null;
let currentTransactionsPage = 1;
let transactionsFilters = {};
let currentSalaryData = [];

// Инициализация страницы
document.addEventListener('DOMContentLoaded', function() {
    initFinancePage();
});

async function initFinancePage() {
    try {
        if (typeof showLoading === 'function') showLoading();
        await loadFinanceData();
        renderFinanceData();
        setupEventListeners();
        
    } catch (error) {
        console.error('Ошибка инициализации страницы финансов:', error);
        if (typeof notifications !== 'undefined') {
            notifications.error('Ошибка загрузки данных');
        } else {
            alert('Ошибка загрузки данных');
        }
    } finally {
        if (typeof hideLoading === 'function') hideLoading();
    }
}

// Загрузка данных
async function loadFinanceData() {
    try {
        const period = document.getElementById('period-select')?.value || 'current_month';
        
        const [balanceData, statsData, transactionsData, salaryData] = await Promise.all([
            api.getFinanceBalance().catch(() => ({ balance: 0 })),
            api.getFinanceStats({ period }).catch(() => ({ 
                income_this_month: 0, 
                expense_this_month: 0, 
                daily_stats: [] 
            })),
            api.get('transactions/', { page_size: 10 }).catch(() => ({ results: [] })),
            loadSalaryData().catch(() => [])
        ]);
        
        financeData = {
            balance: balanceData,
            stats: statsData,
            transactions: transactionsData,
            salaries: salaryData
        };
        
    } catch (error) {
        console.error('Ошибка загрузки финансовых данных:', error);
        // Устанавливаем пустые данные в случае ошибки
        financeData = {
            balance: { balance: 0 },
            stats: { income_this_month: 0, expense_this_month: 0, daily_stats: [] },
            transactions: { results: [] },
            salaries: []
        };
    }
}

async function loadSalaryData() {
    try {
        // Проверяем доступность API
        if (typeof api === 'undefined') {
            console.warn('API не доступен');
            return [];
        }
        
        const users = await api.getUsers({ role__in: 'manager,installer' });
        const currentMonth = new Date();
        const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        
        const salaryPromises = users.results.map(async (user) => {
            try {
                // Получаем расчет зарплаты
                const salaryData = await api.calculateSalary(user.id, {
                    start_date: formatDate(startDate, 'yyyy-MM-dd'),
                    end_date: formatDate(endDate, 'yyyy-MM-dd')
                });
                
                // Проверяем, была ли уже выплачена зарплата за этот период
                const payments = await api.get('salary-payments/', {
                    user: user.id,
                    period_start__gte: formatDate(startDate, 'yyyy-MM-dd'),
                    period_end__lte: formatDate(endDate, 'yyyy-MM-dd')
                }).catch(() => ({ results: [] }));
                
                const totalPaid = payments.results.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
                const remainingSalary = Math.max(0, (salaryData.salary?.total_salary || 0) - totalPaid);
                
                return {
                    user: user,
                    salary: {
                        ...salaryData.salary,
                        total_salary: remainingSalary,
                        calculated_salary: salaryData.salary?.total_salary || 0,
                        paid_amount: totalPaid
                    },
                    period: {
                        start: startDate,
                        end: endDate
                    },
                    isPaid: totalPaid >= (salaryData.salary?.total_salary || 0)
                };
            } catch (error) {
                console.warn(`Не удалось загрузить зарплату для ${user.first_name} ${user.last_name}`);
                return {
                    user: user,
                    salary: { total_salary: 0, calculated_salary: 0, paid_amount: 0 },
                    period: { start: startDate, end: endDate },
                    isPaid: false
                };
            }
        });
        
        return await Promise.all(salaryPromises);
    } catch (error) {
        console.error('Ошибка загрузки данных о зарплатах:', error);
        return [];
    }
}

// Отрисовка данных
function renderFinanceData() {
    renderMainMetrics();
    renderCharts();
    renderTransactionsList();
    renderSalaryList();
}

function renderMainMetrics() {
    const { balance, stats } = financeData;
    
    // Баланс компании
    updateElement('company-balance', formatCurrency(balance?.balance || 0));
    
    // Доходы за период
    updateElement('period-income', formatCurrency(stats?.income_this_month || 0));
    updateElement('income-change', '+12.5%'); // TODO: вычислить реальное изменение
    
    // Расходы за период
    updateElement('period-expenses', formatCurrency(stats?.expense_this_month || 0));
    updateElement('expenses-change', '+8.2%'); // TODO: вычислить реальное изменение
    
    // Прибыль за период
    const profit = (stats?.income_this_month || 0) - (stats?.expense_this_month || 0);
    updateElement('period-profit', formatCurrency(profit));
    updateElement('profit-change', '+18.7%'); // TODO: вычислить реальное изменение
}

function renderCharts() {
    renderFinanceChart();
    renderExpensesChart();
}

function renderFinanceChart() {
    const canvas = document.getElementById('finance-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (financeChart) {
        financeChart.destroy();
    }
    
    const dailyStats = financeData.stats?.daily_stats || [];
    
    const labels = dailyStats.map(stat => formatDate(stat.date, 'dd.MM'));
    const incomeData = dailyStats.map(stat => stat.income || 0);
    const expenseData = dailyStats.map(stat => stat.expense || 0);
    
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

function renderExpensesChart() {
    const canvas = document.getElementById('expenses-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (expensesChart) {
        expensesChart.destroy();
    }
    
    // Моковые данные для структуры расходов
    const expensesStructure = [
        { label: 'Зарплаты', value: 55, color: '#3B82F6' },
        { label: 'Закупки', value: 30, color: '#10B981' },
        { label: 'Аренда', value: 10, color: '#F59E0B' },
        { label: 'Транспорт', value: 5, color: '#EF4444' }
    ];
    
    expensesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: expensesStructure.map(item => item.label),
            datasets: [{
                data: expensesStructure.map(item => item.value),
                backgroundColor: expensesStructure.map(item => item.color),
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
                }
            }
        }
    });
}

function renderTransactionsList() {
    const container = document.getElementById('transactions-list');
    if (!container) return;
    
    const transactions = financeData.transactions?.results || [];
    
    if (transactions.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">Нет транзакций</p>';
        return;
    }
    
    const html = transactions.slice(0, 5).map(transaction => `
        <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div class="flex items-center">
                <div class="w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                    transaction.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                }">
                    <i class="fas ${
                        transaction.type === 'income' ? 'fa-arrow-up text-green-600' : 'fa-arrow-down text-red-600'
                    }"></i>
                </div>
                <div>
                    <p class="font-medium text-gray-900">${transaction.description}</p>
                    <p class="text-sm text-gray-500">${formatDate(transaction.created_at)}</p>
                </div>
            </div>
            <div class="text-right">
                <p class="font-semibold ${
                    transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                }">${formatCurrency(transaction.amount)}</p>
                ${transaction.order ? `<p class="text-xs text-gray-500">Заказ #${transaction.order}</p>` : ''}
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

function renderSalaryList() {
    const container = document.getElementById('salary-list');
    if (!container) return;
    
    const salaries = financeData.salaries || [];
    
    if (salaries.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">Нет данных о зарплатах</p>';
        return;
    }
    
    const html = salaries.map(salaryData => {
        const remainingSalary = salaryData.salary.total_salary || 0;
        const isPaid = salaryData.isPaid || remainingSalary === 0;
        
        return `
            <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg ${isPaid ? 'bg-green-50' : ''}">
                <div class="flex items-center">
                    <div class="w-8 h-8 ${isPaid ? 'bg-green-500' : 'bg-blue-500'} rounded-full flex items-center justify-center mr-3">
                        ${isPaid ? 
                            '<i class="fas fa-check text-white text-sm"></i>' :
                            `<span class="text-white text-sm font-medium">
                                ${(salaryData.user.first_name?.[0] || salaryData.user.username?.[0] || '?').toUpperCase()}
                            </span>`
                        }
                    </div>
                    <div>
                        <p class="font-medium text-gray-900">
                            ${salaryData.user.first_name} ${salaryData.user.last_name}
                        </p>
                        <p class="text-sm text-gray-500">
                            ${getRoleDisplayName(salaryData.user.role)}
                            ${salaryData.salary.paid_amount > 0 ? 
                                `• Выплачено: ${formatCurrency(salaryData.salary.paid_amount)}` : ''
                            }
                        </p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-semibold ${isPaid ? 'text-green-600' : 'text-gray-900'}">
                        ${isPaid ? 'Выплачено' : formatCurrency(remainingSalary)}
                    </p>
                    ${!isPaid && remainingSalary > 0 ? 
                        `<button onclick="openSalaryPaymentModal(${salaryData.user.id})" 
                                class="text-xs text-blue-600 hover:text-blue-800">
                            Выплатить
                        </button>` : 
                        '<span class="text-xs text-green-600">✓ Выплачено</span>'
                    }
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

// Обработчики событий
function setupEventListeners() {
    // Изменение периода
    const periodSelect = document.getElementById('period-select');
    if (periodSelect) {
        periodSelect.addEventListener('change', async () => {
            await refreshFinanceData();
        });
    }
    
    // Изменение периода графика
    const chartPeriod = document.getElementById('chart-period');
    if (chartPeriod) {
        chartPeriod.addEventListener('change', async () => {
            const days = chartPeriod.value;
            await updateFinanceChart(days);
        });
    }
    
    // Закрытие модальных окон при клике на фон
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('fixed') && e.target.classList.contains('inset-0')) {
            if (e.target.closest('#transaction-modal')) closeTransactionModal();
            if (e.target.closest('#salary-modal')) closeSalaryModal();
            if (e.target.closest('#transactions-list-modal')) closeTransactionsListModal();
            if (e.target.closest('#salary-payment-modal')) closeSalaryPaymentModal();
        }
    });
    
    // ESC для закрытия модальных окон
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeTransactionModal();
            closeSalaryModal();
            closeTransactionsListModal();
            closeSalaryPaymentModal();
        }
    });
}

// Модальное окно транзакций
function openCreateTransactionModal(type = null) {
    const modal = document.getElementById('transaction-modal');
    const titleElement = document.getElementById('transaction-modal-title');
    const typeSelect = document.getElementById('transaction-type');
    
    if (type) {
        titleElement.textContent = type === 'income' ? 'Добавить доход' : 'Добавить расход';
        typeSelect.value = type;
    } else {
        titleElement.textContent = 'Новая транзакция';
        typeSelect.value = '';
    }
    
    // Загружаем список заказов для связки
    loadOrdersForTransaction();
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.querySelector('.bg-gray-500').classList.remove('opacity-0');
        modal.querySelector('.transform').classList.remove('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');
        modal.querySelector('.transform').classList.add('opacity-100', 'translate-y-0', 'sm:scale-100');
    }, 10);
}

async function loadOrdersForTransaction() {
    try {
        const orders = await api.getOrders({ status__in: 'new,in_progress' });
        const select = document.getElementById('transaction-order');
        
        select.innerHTML = '<option value="">Не связано с заказом</option>';
        
        orders.results.forEach(order => {
            const option = document.createElement('option');
            option.value = order.id;
            option.textContent = `Заказ #${order.id} - ${order.client_name}`;
            select.appendChild(option);
        });
        
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
    }
}

function closeTransactionModal() {
    const modal = document.getElementById('transaction-modal');
    
    modal.querySelector('.bg-gray-500').classList.add('opacity-0');
    modal.querySelector('.transform').classList.remove('opacity-100', 'translate-y-0', 'sm:scale-100');
    modal.querySelector('.transform').classList.add('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');
    
    setTimeout(() => {
        modal.classList.add('hidden');
        document.getElementById('transaction-form').reset();
    }, 200);
}

async function submitTransactionForm() {
    const form = document.getElementById('transaction-form');
    const submitBtn = document.getElementById('transaction-submit-btn');
    const submitText = submitBtn.querySelector('.submit-text');
    const loadingSpinner = submitBtn.querySelector('.loading-spinner');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    // Показываем индикатор загрузки
    submitBtn.disabled = true;
    submitText.textContent = 'Сохранение...';
    loadingSpinner.classList.remove('hidden');
    
    try {
        const formData = new FormData(form);
        const data = {
            type: formData.get('type'),
            amount: parseFloat(formData.get('amount')),
            description: formData.get('description'),
            order: formData.get('order') || null
        };
        
        await api.post('transactions/', data);
        
        notifications.success('Транзакция успешно добавлена');
        closeTransactionModal();
        await refreshFinanceData();
        
    } catch (error) {
        console.error('Ошибка создания транзакции:', error);
        notifications.apiError(error, 'Ошибка создания транзакции');
        
    } finally {
        submitBtn.disabled = false;
        submitText.textContent = 'Сохранить';
        loadingSpinner.classList.add('hidden');
    }
}

// Модальное окно расчета зарплат
function openSalaryCalculationModal() {
    const modal = document.getElementById('salary-modal');
    
    // Устанавливаем период по умолчанию (текущий месяц)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    document.getElementById('salary-start-date').value = formatDate(startOfMonth, 'yyyy-MM-dd');
    document.getElementById('salary-end-date').value = formatDate(endOfMonth, 'yyyy-MM-dd');
    
    // Скрываем результаты и показываем форму
    document.getElementById('salary-results').classList.add('hidden');
    document.getElementById('salary-loading').classList.add('hidden');
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.querySelector('.bg-gray-500').classList.remove('opacity-0');
        modal.querySelector('.transform').classList.remove('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');
        modal.querySelector('.transform').classList.add('opacity-100', 'translate-y-0', 'sm:scale-100');
    }, 10);
}

function closeSalaryModal() {
    const modal = document.getElementById('salary-modal');
    
    modal.querySelector('.bg-gray-500').classList.add('opacity-0');
    modal.querySelector('.transform').classList.remove('opacity-100', 'translate-y-0', 'sm:scale-100');
    modal.querySelector('.transform').classList.add('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');
    
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
}

async function calculateSalaries() {
    const startDate = document.getElementById('salary-start-date').value;
    const endDate = document.getElementById('salary-end-date').value;
    
    if (!startDate || !endDate) {
        if (typeof notifications !== 'undefined') {
            notifications.warning('Выберите период для расчета');
        } else {
            alert('Выберите период для расчета');
        }
        return;
    }
    
    // Показываем индикатор загрузки
    document.getElementById('salary-loading').classList.remove('hidden');
    document.getElementById('salary-results').classList.add('hidden');
    
    try {
        // Загружаем пользователей
        const users = await api.getUsers({ role__in: 'manager,installer' });
        
        // Рассчитываем зарплату для каждого пользователя
        const salaryPromises = users.results.map(async (user) => {
            try {
                // Получаем расчет зарплаты
                const salaryData = await api.calculateSalary(user.id, {
                    start_date: startDate,
                    end_date: endDate
                });
                
                // Проверяем уже выплаченные суммы за этот период
                const payments = await api.get('salary-payments/', {
                    user: user.id,
                    period_start__gte: startDate,
                    period_end__lte: endDate
                }).catch(() => ({ results: [] }));
                
                const totalPaid = payments.results.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
                const calculatedSalary = salaryData.salary?.total_salary || 0;
                const remainingSalary = Math.max(0, calculatedSalary - totalPaid);
                
                return {
                    user: user,
                    salary: {
                        ...salaryData.salary,
                        total_salary: remainingSalary,
                        calculated_salary: calculatedSalary,
                        paid_amount: totalPaid
                    },
                    period: { start: startDate, end: endDate },
                    isPaid: totalPaid >= calculatedSalary,
                    error: false
                };
            } catch (error) {
                console.warn(`Не удалось рассчитать зарплату для ${user.first_name} ${user.last_name}`);
                return {
                    user: user,
                    salary: { total_salary: 0, calculated_salary: 0, paid_amount: 0 },
                    period: { start: startDate, end: endDate },
                    error: true,
                    isPaid: false
                };
            }
        });
        
        const salaryResults = await Promise.all(salaryPromises);
        currentSalaryData = salaryResults;
        
        renderSalaryResults(salaryResults);
        
        // Скрываем загрузку и показываем результаты
        document.getElementById('salary-loading').classList.add('hidden');
        document.getElementById('salary-results').classList.remove('hidden');
        
    } catch (error) {
        console.error('Ошибка расчета зарплат:', error);
        if (typeof notifications !== 'undefined') {
            notifications.error('Ошибка расчета зарплат');
        } else {
            alert('Ошибка расчета зарплат');
        }
        document.getElementById('salary-loading').classList.add('hidden');
    }
}

function renderSalaryResults(salaryResults) {
    const tbody = document.getElementById('salary-table-body');
    const totalElement = document.getElementById('total-salary');
    
    let totalSalary = 0;
    
    const html = salaryResults.map(data => {
        const remainingSalary = data.salary.total_salary || 0;
        const calculatedSalary = data.salary.calculated_salary || 0;
        const paidAmount = data.salary.paid_amount || 0;
        const isPaid = data.isPaid || remainingSalary === 0;
        
        totalSalary += remainingSalary;
        
        const workDetails = getWorkDetails(data);
        
        return `
            <tr class="${data.error ? 'bg-red-50' : isPaid ? 'bg-green-50' : ''}">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="w-8 h-8 ${isPaid ? 'bg-green-500' : 'bg-blue-500'} rounded-full flex items-center justify-center mr-3">
                            ${isPaid ? 
                                '<i class="fas fa-check text-white text-sm"></i>' :
                                `<span class="text-white text-sm font-medium">
                                    ${(data.user.first_name?.[0] || data.user.username?.[0] || '?').toUpperCase()}
                                </span>`
                            }
                        </div>
                        <div>
                            <div class="text-sm font-medium text-gray-900">
                                ${data.user.first_name} ${data.user.last_name}
                            </div>
                            <div class="text-sm text-gray-500">${data.user.username}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="badge badge-${data.user.role === 'manager' ? 'primary' : 'success'}">
                        ${getRoleDisplayName(data.user.role)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${workDetails}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm">
                        ${paidAmount > 0 ? 
                            `<div class="text-green-600 font-medium">Выплачено: ${formatCurrency(paidAmount)}</div>` : ''
                        }
                        <div class="font-medium ${isPaid ? 'text-green-600' : 'text-gray-900'}">
                            ${isPaid ? 'Полностью выплачено' : `К доплате: ${formatCurrency(remainingSalary)}`}
                        </div>
                        ${calculatedSalary !== remainingSalary ? 
                            `<div class="text-xs text-gray-500">Начислено: ${formatCurrency(calculatedSalary)}</div>` : ''
                        }
                    </div>
                    ${data.error ? '<div class="text-xs text-red-500">Ошибка расчета</div>' : ''}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    ${!isPaid && remainingSalary > 0 && !data.error ?
                        `<button onclick="openSalaryPaymentModal(${data.user.id}, ${JSON.stringify(data).replace(/"/g, '&quot;')})" 
                                class="text-blue-600 hover:text-blue-900">
                            Выплатить
                        </button>` :
                        '<span class="text-gray-400">—</span>'
                    }
                </td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = html;
    totalElement.textContent = formatCurrency(totalSalary);
}

function getWorkDetails(data) {
    const salary = data.salary;
    
    if (data.user.role === 'manager') {
        return `
            <div class="text-xs">
                <div>Заказы: ${salary.completed_orders_count || 0}</div>
                <div>Кондиционеры: ${salary.conditioner_sales_count || 0}</div>
                <div>Доп. услуги: ${salary.additional_sales_count || 0}</div>
            </div>
        `;
    } else if (data.user.role === 'installer') {
        return `
            <div class="text-xs">
                <div>Монтажи: ${salary.completed_orders_count || 0}</div>
                <div>Доп. услуги: ${salary.additional_services_count || 0}</div>
            </div>
        `;
    }
    
    return '<span class="text-gray-400">—</span>';
}

// Модальное окно выплаты зарплаты
function openSalaryPaymentModal(userId, salaryData = null) {
    const modal = document.getElementById('salary-payment-modal');
    
    // Находим данные о пользователе
    let userData = salaryData;
    if (!userData && currentSalaryData.length > 0) {
        userData = currentSalaryData.find(data => data.user.id === userId);
    }
    
    if (!userData) {
        if (typeof notifications !== 'undefined') {
            notifications.error('Данные о зарплате не найдены');
        } else {
            alert('Данные о зарплате не найдены');
        }
        return;
    }
    
    const remainingSalary = userData.salary.total_salary || 0;
    const calculatedSalary = userData.salary.calculated_salary || 0;
    const paidAmount = userData.salary.paid_amount || 0;
    
    // Заполняем форму
    document.getElementById('payment-employee-name').textContent = 
        `${userData.user.first_name} ${userData.user.last_name}`;
    document.getElementById('payment-period').textContent = 
        `${formatDate(userData.period.start)} - ${formatDate(userData.period.end)}`;
    
    const amountInput = document.getElementById('payment-amount');
    amountInput.value = remainingSalary;
    amountInput.removeAttribute('readonly');
    amountInput.setAttribute('max', remainingSalary);
    amountInput.setAttribute('min', '0');
    
    // Добавляем информацию о расчете
    const existingInfo = modal.querySelector('.salary-calculation-info');
    if (existingInfo) {
        existingInfo.remove();
    }
    
    if (calculatedSalary > 0) {
        const infoDiv = document.createElement('div');
        infoDiv.className = 'salary-calculation-info bg-gray-50 p-3 rounded-md text-sm';
        infoDiv.innerHTML = `
            <div class="space-y-1">
                <div class="flex justify-between">
                    <span class="text-gray-600">Начислено за период:</span>
                    <span class="font-medium">${formatCurrency(calculatedSalary)}</span>
                </div>
                ${paidAmount > 0 ? `
                    <div class="flex justify-between">
                        <span class="text-gray-600">Уже выплачено:</span>
                        <span class="font-medium text-green-600">${formatCurrency(paidAmount)}</span>
                    </div>
                    <hr class="my-1">
                    <div class="flex justify-between">
                        <span class="text-gray-600">Остаток к доплате:</span>
                        <span class="font-medium">${formatCurrency(remainingSalary)}</span>
                    </div>
                ` : ''}
            </div>
        `;
        
        // Вставляем информацию после поля суммы
        const amountField = amountInput.closest('div');
        amountField.parentNode.insertBefore(infoDiv, amountField.nextSibling);
    }
    
    // Сохраняем данные для отправки
    modal.dataset.userId = userId;
    modal.dataset.salaryData = JSON.stringify(userData);
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.querySelector('.bg-gray-500').classList.remove('opacity-0');
        modal.querySelector('.transform').classList.remove('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');
        modal.querySelector('.transform').classList.add('opacity-100', 'translate-y-0', 'sm:scale-100');
    }, 10);
}

function closeSalaryPaymentModal() {
    const modal = document.getElementById('salary-payment-modal');
    
    modal.querySelector('.bg-gray-500').classList.add('opacity-0');
    modal.querySelector('.transform').classList.remove('opacity-100', 'translate-y-0', 'sm:scale-100');
    modal.querySelector('.transform').classList.add('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');
    
    setTimeout(() => {
        modal.classList.add('hidden');
        document.getElementById('salary-payment-form').reset();
        
        // Удаляем добавленную информацию о расчете
        const existingInfo = modal.querySelector('.salary-calculation-info');
        if (existingInfo) {
            existingInfo.remove();
        }
    }, 200);
}

async function processSalaryPayment() {
    const modal = document.getElementById('salary-payment-modal');
    const form = document.getElementById('salary-payment-form');
    const submitBtn = document.getElementById('payment-submit-btn');
    const submitText = submitBtn.querySelector('.submit-text');
    const loadingSpinner = submitBtn.querySelector('.loading-spinner');
    
    const userId = modal.dataset.userId;
    const salaryData = JSON.parse(modal.dataset.salaryData);
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const paymentAmount = parseFloat(document.getElementById('payment-amount').value);
    const maxAmount = salaryData.salary.total_salary || 0;
    
    // Валидация суммы
    if (paymentAmount <= 0) {
        if (typeof notifications !== 'undefined') {
            notifications.warning('Сумма выплаты должна быть больше нуля');
        } else {
            alert('Сумма выплаты должна быть больше нуля');
        }
        return;
    }
    
    if (paymentAmount > maxAmount) {
        if (typeof notifications !== 'undefined') {
            notifications.warning(`Сумма выплаты не может превышать ${formatCurrency(maxAmount)}`);
        } else {
            alert(`Сумма выплаты не может превышать ${formatCurrency(maxAmount)}`);
        }
        return;
    }
    
    // Показываем индикатор загрузки
    submitBtn.disabled = true;
    submitText.textContent = 'Выплачиваем...';
    loadingSpinner.classList.remove('hidden');
    
    try {
        const formData = new FormData(form);
        const data = {
            user: parseInt(userId),
            amount: paymentAmount,
            period_start: salaryData.period.start,
            period_end: salaryData.period.end,
            method: formData.get('method'),
            comment: formData.get('comment')
        };
        
        await api.post('salary-payments/', data);
        
        // Создаем соответствующую транзакцию
        await api.post('transactions/', {
            type: 'expense',
            amount: data.amount,
            description: `Выплата зарплаты: ${salaryData.user.first_name} ${salaryData.user.last_name}${
                paymentAmount < maxAmount ? ' (частичная)' : ''
            }`
        });
        
        const isPartial = paymentAmount < maxAmount;
        const message = isPartial 
            ? `Частичная выплата зарплаты (${formatCurrency(paymentAmount)}) для ${salaryData.user.first_name} ${salaryData.user.last_name}`
            : `Зарплата выплачена: ${salaryData.user.first_name} ${salaryData.user.last_name}`;
        
        if (typeof notifications !== 'undefined') {
            notifications.success(message);
        } else {
            alert(message);
        }
        
        closeSalaryPaymentModal();
        await refreshFinanceData();
        
        // Обновляем таблицу зарплат если она открыта
        if (!document.getElementById('salary-results').classList.contains('hidden')) {
            await calculateSalaries();
        }
        
    } catch (error) {
        console.error('Ошибка выплаты зарплаты:', error);
        if (typeof notifications !== 'undefined') {
            notifications.apiError(error, 'Ошибка выплаты зарплаты');
        } else {
            alert('Ошибка выплаты зарплаты');
        }
        
    } finally {
        submitBtn.disabled = false;
        submitText.textContent = 'Выплатить';
        loadingSpinner.classList.add('hidden');
    }
}

// Модальное окно списка транзакций
function openTransactionsListModal() {
    const modal = document.getElementById('transactions-list-modal');
    
    // Сбрасываем фильтры
    document.getElementById('filter-type').value = '';
    document.getElementById('filter-date-from').value = '';
    document.getElementById('filter-date-to').value = '';
    
    currentTransactionsPage = 1;
    transactionsFilters = {};
    
    loadTransactionsList();
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.querySelector('.bg-gray-500').classList.remove('opacity-0');
        modal.querySelector('.transform').classList.remove('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');
        modal.querySelector('.transform').classList.add('opacity-100', 'translate-y-0', 'sm:scale-100');
    }, 10);
}

function closeTransactionsListModal() {
    const modal = document.getElementById('transactions-list-modal');
    
    modal.querySelector('.bg-gray-500').classList.add('opacity-0');
    modal.querySelector('.transform').classList.remove('opacity-100', 'translate-y-0', 'sm:scale-100');
    modal.querySelector('.transform').classList.add('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');
    
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
}

async function loadTransactionsList() {
    try {
        const params = {
            page: currentTransactionsPage,
            page_size: 20,
            ...transactionsFilters
        };
        
        const response = await api.get('transactions/', params);
        renderTransactionsTable(response);
        
    } catch (error) {
        console.error('Ошибка загрузки транзакций:', error);
        notifications.error('Ошибка загрузки транзакций');
    }
}

function renderTransactionsTable(data) {
    const tbody = document.getElementById('transactions-table-body');
    const transactions = data.results || [];
    
    if (transactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                    Транзакции не найдены
                </td>
            </tr>
        `;
        return;
    }
    
    const html = transactions.map(transaction => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${formatDate(transaction.created_at)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="badge ${transaction.type === 'income' ? 'badge-success' : 'badge-danger'}">
                    ${transaction.type_display}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium ${
                transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
            }">
                ${transaction.type === 'income' ? '+' : '-'}${formatCurrency(transaction.amount)}
            </td>
            <td class="px-6 py-4 text-sm text-gray-900">
                <div class="max-w-xs truncate" title="${transaction.description}">
                    ${transaction.description}
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${transaction.order ? `Заказ #${transaction.order}` : '—'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="editTransaction(${transaction.id})" 
                        class="text-blue-600 hover:text-blue-900 mr-2">
                    Изменить
                </button>
                <button onclick="deleteTransaction(${transaction.id})" 
                        class="text-red-600 hover:text-red-900">
                    Удалить
                </button>
            </td>
        </tr>
    `).join('');
    
    tbody.innerHTML = html;
    
    // Обновляем пагинацию
    updateTransactionsPagination(data);
}

function updateTransactionsPagination(data) {
    document.getElementById('transactions-from').textContent = 
        data.results.length > 0 ? ((currentTransactionsPage - 1) * 20 + 1) : 0;
    document.getElementById('transactions-to').textContent = 
        Math.min(currentTransactionsPage * 20, data.count);
    document.getElementById('transactions-total').textContent = data.count;
    
    // Генерируем номера страниц
    const totalPages = Math.ceil(data.count / 20);
    const pageNumbers = document.getElementById('transactions-page-numbers');
    
    let html = '';
    
    // Кнопка "Предыдущая"
    html += `
        <button onclick="changeTransactionsPage(${currentTransactionsPage - 1})" 
                class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${
                    currentTransactionsPage === 1 ? 'cursor-not-allowed opacity-50' : ''
                }" ${currentTransactionsPage === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>
    `;
    
    // Номера страниц
    const startPage = Math.max(1, currentTransactionsPage - 2);
    const endPage = Math.min(totalPages, currentTransactionsPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        html += `
            <button onclick="changeTransactionsPage(${i})" 
                    class="relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        i === currentTransactionsPage 
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' 
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }">
                ${i}
            </button>
        `;
    }
    
    // Кнопка "Следующая"
    html += `
        <button onclick="changeTransactionsPage(${currentTransactionsPage + 1})" 
                class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${
                    currentTransactionsPage === totalPages ? 'cursor-not-allowed opacity-50' : ''
                }" ${currentTransactionsPage === totalPages ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    pageNumbers.innerHTML = html;
}

function filterTransactions() {
    const type = document.getElementById('filter-type').value;
    const dateFrom = document.getElementById('filter-date-from').value;
    const dateTo = document.getElementById('filter-date-to').value;
    
    transactionsFilters = {};
    
    if (type) transactionsFilters.type = type;
    if (dateFrom) transactionsFilters.created_at__gte = dateFrom;
    if (dateTo) transactionsFilters.created_at__lte = dateTo;
    
    currentTransactionsPage = 1;
    loadTransactionsList();
}

function changeTransactionsPage(page) {
    currentTransactionsPage = page;
    loadTransactionsList();
}

function previousTransactionsPage() {
    if (currentTransactionsPage > 1) {
        changeTransactionsPage(currentTransactionsPage - 1);
    }
}

function nextTransactionsPage() {
    changeTransactionsPage(currentTransactionsPage + 1);
}

// Редактирование и удаление транзакций
async function editTransaction(transactionId) {
    try {
        const transaction = await api.get(`transactions/${transactionId}/`);
        
        // Заполняем форму данными транзакции
        document.getElementById('transaction-type').value = transaction.type;
        document.getElementById('transaction-amount').value = transaction.amount;
        document.getElementById('transaction-description').value = transaction.description;
        document.getElementById('transaction-order').value = transaction.order || '';
        
        // Обновляем заголовок
        document.getElementById('transaction-modal-title').textContent = 'Редактировать транзакцию';
        
        // Сохраняем ID для обновления
        const modal = document.getElementById('transaction-modal');
        modal.dataset.transactionId = transactionId;
        
        await loadOrdersForTransaction();
        
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.querySelector('.bg-gray-500').classList.remove('opacity-0');
            modal.querySelector('.transform').classList.remove('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');
            modal.querySelector('.transform').classList.add('opacity-100', 'translate-y-0', 'sm:scale-100');
        }, 10);
        
    } catch (error) {
        console.error('Ошибка загрузки транзакции:', error);
        notifications.error('Ошибка загрузки данных транзакции');
    }
}

async function deleteTransaction(transactionId) {
    if (!confirm('Вы уверены, что хотите удалить эту транзакцию?')) {
        return;
    }
    
    try {
        await api.delete(`transactions/${transactionId}/`);
        notifications.success('Транзакция удалена');
        await loadTransactionsList();
        await refreshFinanceData();
        
    } catch (error) {
        console.error('Ошибка удаления транзакции:', error);
        notifications.apiError(error, 'Ошибка удаления транзакции');
    }
}

// Дополнительные функции
async function payAllSalaries() {
    if (!currentSalaryData.length) {
        if (typeof notifications !== 'undefined') {
            notifications.warning('Нет данных для выплаты');
        } else {
            alert('Нет данных для выплаты');
        }
        return;
    }
    
    // Фильтруем только тех, кому еще нужно доплатить
    const unpaidSalaries = currentSalaryData.filter(data => 
        !data.error && !data.isPaid && (data.salary.total_salary || 0) > 0
    );
    
    if (unpaidSalaries.length === 0) {
        if (typeof notifications !== 'undefined') {
            notifications.info('Всем сотрудникам уже выплачена зарплата за выбранный период');
        } else {
            alert('Всем сотрудникам уже выплачена зарплата за выбранный период');
        }
        return;
    }
    
    const totalAmount = unpaidSalaries.reduce((sum, data) => sum + (data.salary.total_salary || 0), 0);
    
    if (!confirm(`Выплатить зарплату ${unpaidSalaries.length} сотрудникам на общую сумму ${formatCurrency(totalAmount)}?`)) {
        return;
    }
    
    try {
        if (typeof showLoading === 'function') showLoading();
        
        const paymentPromises = unpaidSalaries.map(async (data) => {
            // Создаем выплату
            await api.post('salary-payments/', {
                user: data.user.id,
                amount: data.salary.total_salary,
                period_start: data.period.start,
                period_end: data.period.end,
                method: 'bank_transfer'
            });
            
            // Создаем транзакцию
            await api.post('transactions/', {
                type: 'expense',
                amount: data.salary.total_salary,
                description: `Выплата зарплаты: ${data.user.first_name} ${data.user.last_name}`
            });
            
            return data.user;
        });
        
        const paidEmployees = await Promise.all(paymentPromises);
        
        if (typeof notifications !== 'undefined') {
            notifications.success(`Зарплата выплачена ${paidEmployees.length} сотрудникам`);
        } else {
            alert(`Зарплата выплачена ${paidEmployees.length} сотрудникам`);
        }
        
        closeSalaryModal();
        await refreshFinanceData();
        
    } catch (error) {
        console.error('Ошибка массовой выплаты зарплат:', error);
        if (typeof notifications !== 'undefined') {
            notifications.error('Ошибка при выплате зарплат');
        } else {
            alert('Ошибка при выплате зарплат');
        }
    } finally {
        if (typeof hideLoading === 'function') hideLoading();
    }
}

async function exportSalaryReport() {
    if (!currentSalaryData.length) {
        notifications.warning('Нет данных для экспорта');
        return;
    }
    
    try {
        // Формируем данные для экспорта
        const exportData = currentSalaryData.map(data => ({
            'ФИО': `${data.user.first_name} ${data.user.last_name}`,
            'Роль': getRoleDisplayName(data.user.role),
            'Период': `${formatDate(data.period.start)} - ${formatDate(data.period.end)}`,
            'Базовая ставка': data.salary.fixed_salary || data.salary.installation_pay || 0,
            'Бонусы': (data.salary.orders_pay || 0) + (data.salary.conditioner_pay || 0) + (data.salary.additional_pay || 0),
            'Всего к выплате': data.salary.total_salary || 0,
            'Выполнено работ': data.salary.completed_orders_count || 0
        }));
        
        // Простой экспорт в CSV (для демонстрации)
        const csv = convertToCSV(exportData);
        downloadCSV(csv, 'salary_report.csv');
        
        notifications.success('Отчет экспортирован');
        
    } catch (error) {
        console.error('Ошибка экспорта:', error);
        notifications.error('Ошибка экспорта отчета');
    }
}

async function exportFinanceReport() {
    try {
        await api.downloadFile('export/finance/');
        notifications.success('Финансовый отчет экспортирован');
        
    } catch (error) {
        console.error('Ошибка экспорта финансового отчета:', error);
        notifications.error('Ошибка экспорта отчета');
    }
}

async function updateFinanceChart(days = 30) {
    try {
        const financeStats = await api.getFinanceStats({ days });
        financeData.stats = financeStats;
        renderFinanceChart();
        
    } catch (error) {
        console.error('Ошибка обновления графика:', error);
    }
}

async function refreshFinanceData() {
    const refreshBtn = document.getElementById('refresh-btn');
    const originalText = refreshBtn.innerHTML;
    
    try {
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Обновление...';
        refreshBtn.disabled = true;
        
        await loadFinanceData();
        renderFinanceData();
        
        notifications.success('Данные обновлены');
        
    } catch (error) {
        console.error('Ошибка обновления данных:', error);
        notifications.error('Ошибка обновления данных');
    } finally {
        refreshBtn.innerHTML = originalText;
        refreshBtn.disabled = false;
    }
}

// Вспомогательные функции
function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function formatDate(date, format = 'dd.MM.yyyy') {
    if (!date) return '';
    
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    if (format === 'yyyy-MM-dd') {
        return `${year}-${month}-${day}`;
    }
    
    return `${day}.${month}.${year}`;
}

function formatCurrency(amount) {
    if (typeof amount !== 'number') {
        amount = parseFloat(amount) || 0;
    }
    
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function getRoleDisplayName(role) {
    const roles = {
        'owner': 'Владелец',
        'manager': 'Менеджер',
        'installer': 'Монтажник'
    };
    return roles[role] || role;
}

function convertToCSV(data) {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => `"${row[header]}"`).join(','))
    ].join('\n');
    
    return csvContent;
}

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Глобальные функции для использования в HTML
window.refreshFinanceData = refreshFinanceData;
window.openCreateTransactionModal = openCreateTransactionModal;
window.closeTransactionModal = closeTransactionModal;
window.submitTransactionForm = submitTransactionForm;
window.openSalaryCalculationModal = openSalaryCalculationModal;
window.closeSalaryModal = closeSalaryModal;
window.calculateSalaries = calculateSalaries;
window.openSalaryPaymentModal = openSalaryPaymentModal;
window.closeSalaryPaymentModal = closeSalaryPaymentModal;
window.processSalaryPayment = processSalaryPayment;
window.openTransactionsListModal = openTransactionsListModal;
window.closeTransactionsListModal = closeTransactionsListModal;
window.filterTransactions = filterTransactions;
window.changeTransactionsPage = changeTransactionsPage;
window.previousTransactionsPage = previousTransactionsPage;
window.nextTransactionsPage = nextTransactionsPage;
window.editTransaction = editTransaction;
window.deleteTransaction = deleteTransaction;
window.payAllSalaries = payAllSalaries;
window.exportSalaryReport = exportSalaryReport;
window.exportFinanceReport = exportFinanceReport;
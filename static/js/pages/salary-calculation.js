// JavaScript для страницы расчета зарплат
let salaryData = [];
let selectedEmployees = new Set();
let currentPeriod = {
    start: null,
    end: null
};

async function initSalaryCalculationPage() {
    try {
        setupEventListeners();
        setDefaultPeriod();
        showInitialState();
        
    } catch (error) {
        console.error('Ошибка инициализации страницы расчета зарплат:', error);
        notifications.error('Ошибка загрузки страницы');
    }
}

function setupEventListeners() {
    // Изменение периода
    document.getElementById('period-start').addEventListener('change', handlePeriodChange);
    document.getElementById('period-end').addEventListener('change', handlePeriodChange);
    document.getElementById('role-filter').addEventListener('change', handleRoleFilterChange);
    
    // Экспорт и печать
    document.querySelector('[onclick="exportSalaries()"]').onclick = exportSalaries;
    document.querySelector('[onclick="printSalaries()"]').onclick = printSalaries;
    
    // Выбор сотрудников
    document.querySelector('[onclick="selectAll()"]').onclick = selectAll;
    document.querySelector('[onclick="deselectAll()"]').onclick = deselectAll;
}

function setDefaultPeriod() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    document.getElementById('period-start').value = DateUtils.format(startOfMonth, 'yyyy-MM-dd');
    document.getElementById('period-end').value = DateUtils.format(endOfMonth, 'yyyy-MM-dd');
    
    currentPeriod.start = DateUtils.format(startOfMonth, 'yyyy-MM-dd');
    currentPeriod.end = DateUtils.format(endOfMonth, 'yyyy-MM-dd');
}

function showInitialState() {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('empty-state').classList.remove('hidden');
    document.getElementById('salary-table').classList.add('hidden');
    document.getElementById('summary-cards').style.display = 'none';
}

function handlePeriodChange() {
    const start = document.getElementById('period-start').value;
    const end = document.getElementById('period-end').value;
    
    if (start && end) {
        currentPeriod.start = start;
        currentPeriod.end = end;
        
        // Можно автоматически пересчитывать при изменении периода
        // calculateSalaries();
    }
}

function handleRoleFilterChange() {
    if (salaryData.length > 0) {
        renderSalaryTable();
    }
}

async function calculateSalaries() {
    const startDate = document.getElementById('period-start').value;
    const endDate = document.getElementById('period-end').value;
    
    if (!startDate || !endDate) {
        notifications.warning('Укажите период для расчета');
        return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
        notifications.error('Начальная дата не может быть больше конечной');
        return;
    }
    
    try {
        showLoading();
        
        // Получаем список всех пользователей
        const usersResponse = await api.getUsers({
            role__in: 'manager,installer,owner'
        });
        
        if (!usersResponse.results || usersResponse.results.length === 0) {
            showEmptyState('Нет сотрудников для расчета зарплаты');
            return;
        }
        
        // Рассчитываем зарплату для каждого сотрудника
        const salaryPromises = usersResponse.results.map(async (user) => {
            try {
                const salaryResponse = await api.calculateSalary(user.id, {
                    start_date: startDate,
                    end_date: endDate
                });
                
                return {
                    user: user,
                    salary: salaryResponse.salary,
                    period: { start: startDate, end: endDate }
                };
            } catch (error) {
                console.error(`Ошибка расчета зарплаты для ${user.username}:`, error);
                return {
                    user: user,
                    salary: null,
                    error: 'Ошибка расчета'
                };
            }
        });
        
        salaryData = await Promise.all(salaryPromises);
        
        // Фильтруем успешные расчеты
        const validSalaries = salaryData.filter(item => item.salary !== null);
        
        if (validSalaries.length === 0) {
            showEmptyState('Не удалось рассчитать зарплату ни для одного сотрудника');
            return;
        }
        
        renderSummaryCards();
        renderSalaryTable();
        
        // Сбрасываем выбранных сотрудников
        selectedEmployees.clear();
        updateMassPaymentButton();
        
        notifications.success(`Рассчитана зарплата для ${validSalaries.length} сотрудников`);
        
    } catch (error) {
        console.error('Ошибка расчета зарплат:', error);
        notifications.error('Ошибка расчета зарплат');
        showEmptyState('Ошибка при расчете зарплат');
    } finally {
        hideLoading();
    }
}

function showLoading() {
    document.getElementById('loading-state').style.display = 'block';
    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('salary-table').classList.add('hidden');
    document.getElementById('summary-cards').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loading-state').style.display = 'none';
}

function showEmptyState(message = 'Выберите период для расчета') {
    document.getElementById('empty-state').classList.remove('hidden');
    document.getElementById('salary-table').classList.add('hidden');
    document.getElementById('summary-cards').style.display = 'none';
    
    // Обновляем сообщение если нужно
    const emptyStateDescription = document.querySelector('.empty-state-description');
    if (emptyStateDescription && message !== 'Выберите период для расчета') {
        emptyStateDescription.textContent = message;
    }
}

function renderSummaryCards() {
    const validSalaries = salaryData.filter(item => item.salary !== null);
    const roleFilter = document.getElementById('role-filter').value;
    
    let filteredSalaries = validSalaries;
    if (roleFilter) {
        filteredSalaries = validSalaries.filter(item => item.user.role === roleFilter);
    }
    
    const totalEmployees = filteredSalaries.length;
    const totalAmount = filteredSalaries.reduce((sum, item) => 
        sum + parseFloat(item.salary.total_salary || 0), 0
    );
    const averageSalary = totalEmployees > 0 ? totalAmount / totalEmployees : 0;
    
    // Примерная выручка за период (можно получить из API)
    const estimatedRevenue = totalAmount * 3; // Примерное соотношение
    const salaryPercentage = estimatedRevenue > 0 ? (totalAmount / estimatedRevenue * 100) : 0;
    
    updateElement('total-employees', totalEmployees);
    updateElement('total-amount', formatCurrency(totalAmount));
    updateElement('average-salary', formatCurrency(averageSalary));
    updateElement('salary-percentage', `${salaryPercentage.toFixed(1)}%`);
    
    document.getElementById('summary-cards').style.display = 'grid';
}

function renderSalaryTable() {
    const validSalaries = salaryData.filter(item => item.salary !== null);
    const roleFilter = document.getElementById('role-filter').value;
    
    let filteredSalaries = validSalaries;
    if (roleFilter) {
        filteredSalaries = validSalaries.filter(item => item.user.role === roleFilter);
    }
    
    if (filteredSalaries.length === 0) {
        showEmptyState('Нет данных для отображения с выбранными фильтрами');
        return;
    }
    
    const tbody = document.getElementById('salary-table-body');
    
    const html = filteredSalaries.map(item => {
        const user = item.user;
        const salary = item.salary;
        const userId = user.id;
        
        // Рассчитываем компоненты зарплаты в зависимости от роли
        let baseSalary = 0;
        let bonuses = 0;
        let penalties = 0;
        let total = parseFloat(salary.total_salary || 0);
        
        if (user.role === 'manager') {
            baseSalary = parseFloat(salary.fixed_salary || 0);
            bonuses = parseFloat(salary.orders_pay || 0) + 
                     parseFloat(salary.conditioner_pay || 0) + 
                     parseFloat(salary.additional_pay || 0);
        } else if (user.role === 'installer') {
            baseSalary = parseFloat(salary.installation_pay || 0);
            bonuses = parseFloat(salary.additional_pay || 0);
            penalties = parseFloat(salary.penalties || 0);
        } else if (user.role === 'owner') {
            baseSalary = parseFloat(salary.installation_pay || 0);
            bonuses = parseFloat(salary.remaining_profit || 0);
        }
        
        const isSelected = selectedEmployees.has(userId);
        
        return `
            <tr class="hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}">
                <td>
                    <input type="checkbox" 
                           class="form-checkbox employee-checkbox" 
                           data-user-id="${userId}"
                           ${isSelected ? 'checked' : ''}
                           onchange="toggleEmployeeSelection(${userId})">
                </td>
                <td>
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10">
                            <div class="h-10 w-10 rounded-full bg-primary-500 flex items-center justify-center">
                                <span class="text-sm font-medium text-white">
                                    ${(user.first_name?.[0] || user.username?.[0] || '?').toUpperCase()}
                                </span>
                            </div>
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">
                                ${user.first_name} ${user.last_name || ''}
                            </div>
                            <div class="text-sm text-gray-500">
                                ${user.username}
                            </div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge badge-${getRoleBadgeColor(user.role)}">
                        ${getRoleDisplayName(user.role)}
                    </span>
                </td>
                <td>
                    <div class="text-sm font-medium text-gray-900">
                        ${formatCurrency(baseSalary)}
                    </div>
                </td>
                <td>
                    <div class="text-sm font-medium text-green-600">
                        ${formatCurrency(bonuses)}
                    </div>
                </td>
                <td>
                    <div class="text-sm font-medium text-red-600">
                        ${formatCurrency(penalties)}
                    </div>
                </td>
                <td>
                    <div class="text-lg font-bold text-gray-900">
                        ${formatCurrency(total)}
                    </div>
                </td>
                <td class="text-right">
                    <div class="flex items-center justify-end space-x-2">
                        <button onclick="showSalaryDetail(${userId})" 
                                class="text-blue-400 hover:text-blue-600" 
                                title="Детали расчета">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="processSinglePayment(${userId})" 
                                class="text-green-400 hover:text-green-600" 
                                title="Выплатить">
                            <i class="fas fa-credit-card"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = html;
    
    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('salary-table').classList.remove('hidden');
}

function getRoleBadgeColor(role) {
    const colors = {
        'owner': 'primary',
        'manager': 'success', 
        'installer': 'warning'
    };
    return colors[role] || 'gray';
}

function getRoleDisplayName(role) {
    const names = {
        'owner': 'Владелец',
        'manager': 'Менеджер',
        'installer': 'Монтажник'
    };
    return names[role] || role;
}

function toggleEmployeeSelection(userId) {
    if (selectedEmployees.has(userId)) {
        selectedEmployees.delete(userId);
    } else {
        selectedEmployees.add(userId);
    }
    
    updateSelectAllCheckbox();
    updateMassPaymentButton();
    
    // Обновляем визуальное выделение строки
    renderSalaryTable();
}

function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    
    if (selectAllCheckbox.checked) {
        selectAll();
    } else {
        deselectAll();
    }
}

function selectAll() {
    const roleFilter = document.getElementById('role-filter').value;
    let filteredSalaries = salaryData.filter(item => item.salary !== null);
    
    if (roleFilter) {
        filteredSalaries = filteredSalaries.filter(item => item.user.role === roleFilter);
    }
    
    selectedEmployees.clear();
    filteredSalaries.forEach(item => {
        selectedEmployees.add(item.user.id);
    });
    
    updateSelectAllCheckbox();
    updateMassPaymentButton();
    renderSalaryTable();
}

function deselectAll() {
    selectedEmployees.clear();
    updateSelectAllCheckbox();
    updateMassPaymentButton();
    renderSalaryTable();
}

function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const roleFilter = document.getElementById('role-filter').value;
    let filteredSalaries = salaryData.filter(item => item.salary !== null);
    
    if (roleFilter) {
        filteredSalaries = filteredSalaries.filter(item => item.user.role === roleFilter);
    }
    
    const totalVisible = filteredSalaries.length;
    const selectedVisible = filteredSalaries.filter(item => 
        selectedEmployees.has(item.user.id)
    ).length;
    
    if (selectedVisible === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (selectedVisible === totalVisible) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    }
 }
 
 function updateMassPaymentButton() {
    const massPaymentBtn = document.getElementById('mass-payment-btn');
    const selectedCount = selectedEmployees.size;
    
    if (selectedCount > 0) {
        massPaymentBtn.disabled = false;
        massPaymentBtn.innerHTML = `
            <i class="fas fa-credit-card mr-2"></i>
            Массовая выплата (${selectedCount})
        `;
    } else {
        massPaymentBtn.disabled = true;
        massPaymentBtn.innerHTML = `
            <i class="fas fa-credit-card mr-2"></i>
            Массовая выплата
        `;
    }
 }
 
 async function showSalaryDetail(userId) {
    try {
        const salaryItem = salaryData.find(item => item.user.id === userId);
        if (!salaryItem) {
            notifications.error('Данные о зарплате не найдены');
            return;
        }
        
        const user = salaryItem.user;
        const salary = salaryItem.salary;
        
        // Заголовок модального окна
        document.getElementById('salary-detail-title').textContent = 
            `Детальный расчет зарплаты - ${user.first_name} ${user.last_name}`;
        
        // Формируем детальный контент в зависимости от роли
        let detailContent = '';
        
        if (user.role === 'manager') {
            detailContent = `
                <div class="space-y-4">
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <h4 class="font-medium text-gray-900 mb-3">Структура зарплаты менеджера</h4>
                        
                        <div class="space-y-2">
                            <div class="flex justify-between">
                                <span class="text-sm text-gray-600">Фиксированная ставка:</span>
                                <span class="font-medium">${formatCurrency(salary.fixed_salary || 0)}</span>
                            </div>
                            
                            <div class="flex justify-between">
                                <span class="text-sm text-gray-600">За заказы (${salary.completed_orders_count || 0} × 250₽):</span>
                                <span class="font-medium">${formatCurrency(salary.orders_pay || 0)}</span>
                            </div>
                            
                            <div class="flex justify-between">
                                <span class="text-sm text-gray-600">За кондиционеры (20% от прибыли):</span>
                                <span class="font-medium">${formatCurrency(salary.conditioner_pay || 0)}</span>
                            </div>
                            
                            <div class="flex justify-between">
                                <span class="text-sm text-gray-600">За доп. услуги (30% от прибыли):</span>
                                <span class="font-medium">${formatCurrency(salary.additional_pay || 0)}</span>
                            </div>
                            
                            <hr class="my-3">
                            
                            <div class="flex justify-between text-lg font-bold">
                                <span>Итого к выплате:</span>
                                <span class="text-green-600">${formatCurrency(salary.total_salary || 0)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-blue-50 p-4 rounded-lg">
                        <h4 class="font-medium text-blue-900 mb-2">Статистика за период</h4>
                        <div class="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span class="text-blue-700">Завершенных заказов:</span>
                                <div class="font-bold">${salary.completed_orders_count || 0}</div>
                            </div>
                            <div>
                                <span class="text-blue-700">Продано кондиционеров:</span>
                                <div class="font-bold">${salary.conditioner_sales_count || 0}</div>
                            </div>
                            <div>
                                <span class="text-blue-700">Доп. услуг:</span>
                                <div class="font-bold">${salary.additional_sales_count || 0}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else if (user.role === 'installer') {
            detailContent = `
                <div class="space-y-4">
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <h4 class="font-medium text-gray-900 mb-3">Структура зарплаты монтажника</h4>
                        
                        <div class="space-y-2">
                            <div class="flex justify-between">
                                <span class="text-sm text-gray-600">За монтажи (${salary.completed_orders_count || 0} × 1,500₽):</span>
                                <span class="font-medium">${formatCurrency(salary.installation_pay || 0)}</span>
                            </div>
                            
                            <div class="flex justify-between">
                                <span class="text-sm text-gray-600">За доп. услуги (30% от прибыли):</span>
                                <span class="font-medium">${formatCurrency(salary.additional_pay || 0)}</span>
                            </div>
                            
                            <div class="flex justify-between text-red-600">
                                <span class="text-sm">Штрафы:</span>
                                <span class="font-medium">-${formatCurrency(salary.penalties || 0)}</span>
                            </div>
                            
                            <hr class="my-3">
                            
                            <div class="flex justify-between text-lg font-bold">
                                <span>Итого к выплате:</span>
                                <span class="text-green-600">${formatCurrency(salary.total_salary || 0)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-blue-50 p-4 rounded-lg">
                        <h4 class="font-medium text-blue-900 mb-2">Статистика за период</h4>
                        <div class="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span class="text-blue-700">Выполнено монтажей:</span>
                                <div class="font-bold">${salary.completed_orders_count || 0}</div>
                            </div>
                            <div>
                                <span class="text-blue-700">Доп. услуг:</span>
                                <div class="font-bold">${salary.additional_services_count || 0}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else if (user.role === 'owner') {
            detailContent = `
                <div class="space-y-4">
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <h4 class="font-medium text-gray-900 mb-3">Структура зарплаты владельца</h4>
                        
                        <div class="space-y-2">
                            <div class="flex justify-between">
                                <span class="text-sm text-gray-600">За монтажи (${salary.completed_orders_count || 0} × 1,500₽):</span>
                                <span class="font-medium">${formatCurrency(salary.installation_pay || 0)}</span>
                            </div>
                            
                            <div class="flex justify-between">
                                <span class="text-sm text-gray-600">Общая выручка:</span>
                                <span class="font-medium">${formatCurrency(salary.total_revenue || 0)}</span>
                            </div>
                            
                            <div class="flex justify-between">
                                <span class="text-sm text-gray-600">Себестоимость:</span>
                                <span class="font-medium text-red-600">-${formatCurrency(salary.total_cost_price || 0)}</span>
                            </div>
                            
                            <div class="flex justify-between">
                                <span class="text-sm text-gray-600">Выплаты персоналу:</span>
                                <span class="font-medium text-red-600">-${formatCurrency((salary.installers_pay || 0) + (salary.managers_pay || 0))}</span>
                            </div>
                            
                            <div class="flex justify-between">
                                <span class="text-sm text-gray-600">Оставшаяся прибыль:</span>
                                <span class="font-medium">${formatCurrency(salary.remaining_profit || 0)}</span>
                            </div>
                            
                            <hr class="my-3">
                            
                            <div class="flex justify-between text-lg font-bold">
                                <span>Итого к выплате:</span>
                                <span class="text-green-600">${formatCurrency(salary.total_salary || 0)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-blue-50 p-4 rounded-lg">
                        <h4 class="font-medium text-blue-900 mb-2">Общая статистика за период</h4>
                        <div class="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span class="text-blue-700">Завершено заказов:</span>
                                <div class="font-bold">${salary.completed_orders_count || 0}</div>
                            </div>
                            <div>
                                <span class="text-blue-700">Общая выручка:</span>
                                <div class="font-bold">${formatCurrency(salary.total_revenue || 0)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        document.getElementById('salary-detail-content').innerHTML = detailContent;
        
        // Сохраняем ID пользователя для обработки выплаты
        document.getElementById('salary-detail-modal').dataset.userId = userId;
        
        // Показываем модальное окно
        document.getElementById('salary-detail-modal').classList.remove('hidden');
        
    } catch (error) {
        console.error('Ошибка отображения деталей зарплаты:', error);
        notifications.error('Ошибка загрузки деталей');
    }
 }
 
 function closeSalaryDetailModal() {
    document.getElementById('salary-detail-modal').classList.add('hidden');
 }
 
 async function processPayment() {
    const userId = parseInt(document.getElementById('salary-detail-modal').dataset.userId);
    
    if (!userId) {
        notifications.error('Ошибка: не указан пользователь');
        return;
    }
    
    await processSinglePayment(userId);
    closeSalaryDetailModal();
 }
 
 async function processSinglePayment(userId) {
    try {
        const salaryItem = salaryData.find(item => item.user.id === userId);
        if (!salaryItem) {
            notifications.error('Данные о зарплате не найдены');
            return;
        }
        
        const user = salaryItem.user;
        const salary = salaryItem.salary;
        
        const confirmMessage = `Выплатить зарплату сотруднику ${user.first_name} ${user.last_name} в размере ${formatCurrency(salary.total_salary)}?`;
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        showLoading();
        
        // Создаем выплату зарплаты через API
        await api.submitModalData('salary-payment', {
            user: userId,
            amount: salary.total_salary,
            period_start: currentPeriod.start,
            period_end: currentPeriod.end
        }, userId);
        
        notifications.success(`Зарплата выплачена: ${user.first_name} ${user.last_name}`);
        
        // Пересчитываем данные
        await calculateSalaries();
        
    } catch (error) {
        console.error('Ошибка выплаты зарплаты:', error);
        notifications.apiError(error, 'Ошибка выплаты зарплаты');
    } finally {
        hideLoading();
    }
 }
 
 function massPayment() {
    if (selectedEmployees.size === 0) {
        notifications.warning('Выберите сотрудников для выплаты');
        return;
    }
    
    // Подсчитываем общую сумму и количество
    const selectedSalaries = salaryData.filter(item => 
        selectedEmployees.has(item.user.id) && item.salary !== null
    );
    
    const totalAmount = selectedSalaries.reduce((sum, item) => 
        sum + parseFloat(item.salary.total_salary || 0), 0
    );
    
    // Обновляем данные в модальном окне
    document.getElementById('mass-payment-count').textContent = selectedSalaries.length;
    document.getElementById('mass-payment-total').textContent = formatCurrency(totalAmount);
    
    // Устанавливаем комментарий по умолчанию
    const periodText = `${DateUtils.format(currentPeriod.start, 'dd.MM.yyyy')} - ${DateUtils.format(currentPeriod.end, 'dd.MM.yyyy')}`;
    document.getElementById('payment-comment').value = `Выплата зарплаты за период ${periodText}`;
    
    // Показываем модальное окно
    document.getElementById('mass-payment-modal').classList.remove('hidden');
 }
 
 function closeMassPaymentModal() {
    document.getElementById('mass-payment-modal').classList.add('hidden');
 }
 
 async function confirmMassPayment() {
    try {
        const comment = document.getElementById('payment-comment').value.trim();
        
        if (!comment) {
            notifications.warning('Укажите комментарий к выплате');
            return;
        }
        
        const selectedSalaries = salaryData.filter(item => 
            selectedEmployees.has(item.user.id) && item.salary !== null
        );
        
        if (selectedSalaries.length === 0) {
            notifications.error('Нет выбранных сотрудников для выплаты');
            return;
        }
        
        showLoading();
        closeMassPaymentModal();
        
        // Выполняем выплаты параллельно
        const paymentPromises = selectedSalaries.map(async (item) => {
            try {
                await api.submitModalData('salary-payment', {
                    user: item.user.id,
                    amount: item.salary.total_salary,
                    period_start: currentPeriod.start,
                    period_end: currentPeriod.end
                }, item.user.id);
                
                return { success: true, user: item.user };
            } catch (error) {
                console.error(`Ошибка выплаты для ${item.user.username}:`, error);
                return { success: false, user: item.user, error };
            }
        });
        
        const results = await Promise.all(paymentPromises);
        
        // Подсчитываем результаты
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        if (successful.length > 0) {
            notifications.success(`Выплачена зарплата ${successful.length} сотрудникам`);
        }
        
        if (failed.length > 0) {
            notifications.error(`Ошибка выплаты для ${failed.length} сотрудников`);
        }
        
        // Пересчитываем данные
        await calculateSalaries();
        
    } catch (error) {
        console.error('Ошибка массовой выплаты:', error);
        notifications.error('Ошибка массовой выплаты');
    } finally {
        hideLoading();
    }
 }
 
 async function exportSalaries() {
    try {
        if (salaryData.length === 0) {
            notifications.warning('Нет данных для экспорта');
            return;
        }
        
        // Подготавливаем данные для экспорта
        const exportData = salaryData
            .filter(item => item.salary !== null)
            .map(item => {
                const user = item.user;
                const salary = item.salary;
                
                return {
                    'ФИО': `${user.first_name} ${user.last_name}`,
                    'Роль': getRoleDisplayName(user.role),
                    'Базовая ставка': salary.fixed_salary || salary.installation_pay || 0,
                    'Бонусы': (salary.orders_pay || 0) + (salary.conditioner_pay || 0) + (salary.additional_pay || 0),
                    'Штрафы': salary.penalties || 0,
                    'Итого': salary.total_salary || 0,
                    'Период': `${currentPeriod.start} - ${currentPeriod.end}`
                };
            });
        
        // Создаем и скачиваем CSV
        const csvContent = convertToCSV(exportData);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `зарплаты_${currentPeriod.start}_${currentPeriod.end}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        notifications.success('Файл загружен');
        
    } catch (error) {
        console.error('Ошибка экспорта:', error);
        notifications.error('Ошибка экспорта данных');
    }
 }
 
 function convertToCSV(data) {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => 
            headers.map(header => {
                const value = row[header];
                // Экранируем запятые и кавычки
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',')
        )
    ].join('\n');
    
    return '\ufeff' + csvContent; // BOM для корректного отображения в Excel
 }
 
 function printSalaries() {
    if (salaryData.length === 0) {
        notifications.warning('Нет данных для печати');
        return;
    }
    
    // Создаем окно печати
    const printWindow = window.open('', '_blank');
    const printContent = generatePrintContent();
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
 }
 
 function generatePrintContent() {
    const validSalaries = salaryData.filter(item => item.salary !== null);
    const totalAmount = validSalaries.reduce((sum, item) => 
        sum + parseFloat(item.salary.total_salary || 0), 0
    );
    
    const tableRows = validSalaries.map(item => {
        const user = item.user;
        const salary = item.salary;
        
        return `
            <tr>
                <td>${user.first_name} ${user.last_name}</td>
                <td>${getRoleDisplayName(user.role)}</td>
                <td>${formatCurrency(salary.total_salary || 0)}</td>
            </tr>
        `;
    }).join('');
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Расчет зарплат</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .period { text-align: center; color: #666; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .total { font-weight: bold; margin-top: 20px; text-align: right; }
                @media print { .no-print { display: none; } }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Расчет зарплат</h1>
            </div>
            <div class="period">
                Период: ${DateUtils.format(currentPeriod.start, 'dd.MM.yyyy')} - ${DateUtils.format(currentPeriod.end, 'dd.MM.yyyy')}
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Сотрудник</th>
                        <th>Роль</th>
                        <th>Сумма к выплате</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
            <div class="total">
                Общая сумма к выплате: ${formatCurrency(totalAmount)}
            </div>
        </body>
        </html>
    `;
 }
 
 // Вспомогательные функции
 function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
 }
 
 function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount || 0);
 }
 
 // Экспорт функций для глобального использования
 window.initSalaryCalculationPage = initSalaryCalculationPage;
 window.calculateSalaries = calculateSalaries;
 window.toggleEmployeeSelection = toggleEmployeeSelection;
 window.toggleSelectAll = toggleSelectAll;
 window.selectAll = selectAll;
 window.deselectAll = deselectAll;
 window.showSalaryDetail = showSalaryDetail;
 window.closeSalaryDetailModal = closeSalaryDetailModal;
 window.processPayment = processPayment;
 window.processSinglePayment = processSinglePayment;
 window.massPayment = massPayment;
 window.closeMassPaymentModal = closeMassPaymentModal;
 window.confirmMassPayment = confirmMassPayment;
 window.exportSalaries = exportSalaries;
 window.printSalaries = printSalaries;
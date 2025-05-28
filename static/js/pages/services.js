// JavaScript для страницы услуг
let servicesData = [];
let filteredServices = [];
let currentSort = { field: 'name', order: 'asc' };
let currentView = 'grid';
let currentCategory = '';
let filters = {
    search: '',
    category: '',
    sort: 'name'
};

async function initServicesPage() {
    try {
        showLoading();
        await loadServices();
        await loadStats();
        await loadAnalytics();
        setupEventListeners();
        renderServices();
        
    } catch (error) {
        console.error('Ошибка инициализации страницы услуг:', error);
        notifications.error('Ошибка загрузки данных');
    } finally {
        hideLoading();
    }
}

async function loadServices() {
    try {
        const response = await api.getServices({
            page_size: 1000,
            ordering: `${currentSort.order === 'desc' ? '-' : ''}${currentSort.field}`
        });
        
        servicesData = response.results || [];
        filteredServices = [...servicesData];
        
        updateResultsCount();
        updateCategoryCounts();
        
    } catch (error) {
        console.error('Ошибка загрузки услуг:', error);
        throw error;
    }
}

async function loadStats() {
    try {
        // Загружаем статистику по категориям
        const categoryStats = await api.getServicesStatsByCategory();
        
        // Подсчитываем общие метрики
        const total = servicesData.length;
        
        // Популярные услуги (заглушка - услуги с высокой ценой продажи)
        const popular = servicesData.filter(service => 
            parseFloat(service.selling_price || 0) > 10000
        ).length;
        
        // Средняя маржа
        const averageMargin = servicesData.length > 0 
            ? servicesData.reduce((sum, service) => {
                const cost = parseFloat(service.cost_price || 0);
                const price = parseFloat(service.selling_price || 0);
                const margin = cost > 0 ? ((price - cost) / cost * 100) : 0;
                return sum + margin;
            }, 0) / servicesData.length
            : 0;
        
        // Общая выручка (заглушка)
        const totalRevenue = servicesData.reduce((sum, service) => 
            sum + parseFloat(service.selling_price || 0), 0
        );
        
        // Обновляем статистику
        updateElement('stats-total', total);
        updateElement('stats-popular', popular);
        updateElement('stats-margin', `${averageMargin.toFixed(1)}%`);
        updateElement('stats-revenue', formatCurrency(totalRevenue));
        
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

async function loadAnalytics() {
    try {
        // Загружаем популярные услуги
        const popularResponse = await api.getServicesStatsPopular();
        renderPopularServices(popularResponse.popular_services || []);
        
        // Рендерим топ по марже
        renderProfitableServices();
        
    } catch (error) {
        console.error('Ошибка загрузки аналитики:', error);
    }
}

function setupEventListeners() {
    // Поиск
    const searchInput = document.getElementById('search');
    searchInput.addEventListener('input', TimingUtils.debounce(handleSearch, 300));
    
    // Фильтры
    document.getElementById('category-filter').addEventListener('change', handleFilterChange);
    document.getElementById('sort-filter').addEventListener('change', handleSortChange);
    
    // Сортировка в таблице
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', handleTableSort);
    });
    
    // Очистка фильтров
    document.querySelector('[onclick="clearFilters()"]').onclick = clearFilters;
    
    // Экспорт
    document.querySelector('[onclick="exportServices()"]').onclick = exportServices;
}

function handleSearch(e) {
    filters.search = e.target.value.toLowerCase().trim();
    applyFilters();
}

function handleFilterChange(e) {
    filters.category = e.target.value;
    applyFilters();
}

function handleSortChange(e) {
    filters.sort = e.target.value;
    currentSort.field = e.target.value;
    applySorting();
    renderServices();
}

function handleTableSort(e) {
    const field = e.currentTarget.dataset.sort;
    
    if (currentSort.field === field) {
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.order = 'asc';
    }
    
    updateSortIcons();
    applySorting();
    renderServices();
}

function applyFilters() {
    filteredServices = servicesData.filter(service => {
        // Поиск по тексту
        if (filters.search) {
            const searchText = filters.search;
            const searchFields = [
                service.name || '',
                service.category_display || '',
                service.category || ''
            ].join(' ').toLowerCase();
            
            if (!searchFields.includes(searchText)) {
                return false;
            }
        }
        
        // Фильтр по категории
        if (filters.category && service.category !== filters.category) {
            return false;
        }
        
        // Фильтр по текущей активной категории из табов
        if (currentCategory && service.category !== currentCategory) {
            return false;
        }
        
        return true;
    });
    
    applySorting();
    updateResultsCount();
    renderServices();
}

function applySorting() {
    filteredServices.sort((a, b) => {
        let aVal, bVal;
        
        switch (currentSort.field) {
            case 'cost_price':
            case 'selling_price':
                aVal = parseFloat(a[currentSort.field]) || 0;
                bVal = parseFloat(b[currentSort.field]) || 0;
                break;
            case 'margin':
                aVal = calculateMargin(a);
                bVal = calculateMargin(b);
                break;
            case 'popularity':
                // Заглушка - сортируем по цене (чем дороже, тем популярнее)
                aVal = parseFloat(a.selling_price) || 0;
                bVal = parseFloat(b.selling_price) || 0;
                break;
            case 'created_at':
                aVal = new Date(a.created_at);
                bVal = new Date(b.created_at);
                break;
            default:
                aVal = (a[currentSort.field] || '').toLowerCase();
                bVal = (b[currentSort.field] || '').toLowerCase();
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

function renderServices() {
    if (currentView === 'grid') {
        renderGridView();
    } else {
        renderTableView();
    }
}

function renderGridView() {
    const container = document.getElementById('services-grid-container');
    
    if (filteredServices.length === 0) {
        document.getElementById('grid-view').classList.add('hidden');
        document.getElementById('empty-state').classList.remove('hidden');
        return;
    }
    
    document.getElementById('grid-view').classList.remove('hidden');
    document.getElementById('empty-state').classList.add('hidden');
    
    const html = filteredServices.map(service => {
        const margin = calculateMargin(service);
        const popularity = getPopularityStars(service);
        
        return `
            <div class="card card-hover group">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex-1">
                        <div class="flex items-center mb-2">
                            <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mr-3">
                                <i class="${getCategoryIcon(service.category)} text-white"></i>
                            </div>
                            <div>
                                <h3 class="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                    ${service.name}
                                </h3>
                                <span class="badge ${getCategoryBadgeClass(service.category)} text-xs">
                                    ${service.category_display}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    ${canEditService() ? `
                        <div class="opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                            <button onclick="editService(${service.id})" 
                                    class="text-blue-400 hover:text-blue-600 p-1" 
                                    title="Редактировать">
                                <i class="fas fa-edit text-sm"></i>
                            </button>
                            <button onclick="deleteService(${service.id})" 
                                    class="text-red-400 hover:text-red-600 p-1" 
                                    title="Удалить">
                                <i class="fas fa-trash text-sm"></i>
                            </button>
                        </div>
                    ` : ''}
                </div>
                
                <div class="space-y-3">
                    <!-- Ценообразование -->
                    <div class="bg-gray-50 rounded-lg p-3">
                        <div class="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <span class="text-gray-500">Себестоимость:</span>
                                <div class="font-medium text-gray-900">${formatCurrency(service.cost_price)}</div>
                            </div>
                            <div>
                                <span class="text-gray-500">Цена продажи:</span>
                                <div class="font-medium text-gray-900">${formatCurrency(service.selling_price)}</div>
                            </div>
                        </div>
                        
                        <div class="mt-2 pt-2 border-t border-gray-200">
                            <div class="flex items-center justify-between">
                                <span class="text-gray-500 text-sm">Маржа:</span>
                                <span class="font-semibold ${margin > 100 ? 'text-green-600' : margin > 50 ? 'text-yellow-600' : 'text-red-600'}">
                                    ${margin.toFixed(1)}%
                                </span>
                            </div>
                            <div class="mt-1 w-full bg-gray-200 rounded-full h-2">
                                <div class="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-300" 
                                     style="width: ${Math.min(margin, 200)}%"></div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Популярность -->
                    <div class="flex items-center justify-between">
                        <div class="flex items-center">
                            <span class="text-sm text-gray-500 mr-2">Популярность:</span>
                            <div class="flex text-yellow-400">
                                ${popularity}
                            </div>
                        </div>
                        <div class="text-sm text-gray-500">
                            ${getUsageCount(service)} раз
                        </div>
                    </div>
                    
                    <!-- Действия -->
                    <div class="pt-3 border-t border-gray-200">
                        <div class="flex space-x-2">
                            <button onclick="viewServiceDetails(${service.id})" 
                                    class="flex-1 btn btn-sm btn-outline">
                                <i class="fas fa-eye mr-1"></i>
                                Детали
                            </button>
                            ${canEditService() ? `
                                <button onclick="editService(${service.id})" 
                                        class="flex-1 btn btn-sm btn-primary">
                                    <i class="fas fa-edit mr-1"></i>
                                    Изменить
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

function renderTableView() {
    const tbody = document.getElementById('services-table-body');
    
    if (filteredServices.length === 0) {
        document.getElementById('table-view').classList.add('hidden');
        document.getElementById('empty-state').classList.remove('hidden');
        return;
    }
    
    document.getElementById('table-view').classList.remove('hidden');
    document.getElementById('empty-state').classList.add('hidden');
    
    const html = filteredServices.map(service => {
        const margin = calculateMargin(service);
        const popularity = getPopularityStars(service);
        
        return `
            <tr class="hover:bg-gray-50">
                <td>
                    <div class="flex items-center">
                        <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-md flex items-center justify-center mr-3">
                            <i class="${getCategoryIcon(service.category)} text-white text-sm"></i>
                        </div>
                        <div>
                            <div class="text-sm font-medium text-gray-900">${service.name}</div>
                            <div class="text-sm text-gray-500">ID: ${service.id}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge ${getCategoryBadgeClass(service.category)}">
                        ${service.category_display}
                    </span>
                </td>
                <td>
                    <div class="text-sm font-medium text-gray-900">${formatCurrency(service.cost_price)}</div>
                </td>
                <td>
                    <div class="text-sm font-medium text-gray-900">${formatCurrency(service.selling_price)}</div>
                </td>
                <td>
                    <div class="flex items-center">
                        <span class="text-sm font-medium ${margin > 100 ? 'text-green-600' : margin > 50 ? 'text-yellow-600' : 'text-red-600'}">
                           ${margin.toFixed(1)}%
                       </span>
                       <div class="ml-2 w-16 bg-gray-200 rounded-full h-2">
                           <div class="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full" 
                                style="width: ${Math.min(margin, 200)}%"></div>
                       </div>
                   </div>
               </td>
               <td>
                   <div class="flex items-center">
                       <div class="flex text-yellow-400 mr-2">
                           ${popularity}
                       </div>
                       <span class="text-sm text-gray-500">${getUsageCount(service)}</span>
                   </div>
               </td>
               <td class="text-right">
                   <div class="flex items-center justify-end space-x-2">
                       <button onclick="viewServiceDetails(${service.id})" 
                               class="text-gray-400 hover:text-gray-600" 
                               title="Просмотр">
                           <i class="fas fa-eye"></i>
                       </button>
                       ${canEditService() ? `
                           <button onclick="editService(${service.id})" 
                                   class="text-blue-400 hover:text-blue-600" 
                                   title="Редактировать">
                               <i class="fas fa-edit"></i>
                           </button>
                           <button onclick="deleteService(${service.id})" 
                                   class="text-red-400 hover:text-red-600" 
                                   title="Удалить">
                               <i class="fas fa-trash"></i>
                           </button>
                       ` : ''}
                   </div>
               </td>
           </tr>
       `;
   }).join('');
   
   tbody.innerHTML = html;
}

function renderPopularServices(popularServices) {
   const container = document.getElementById('popular-services');
   
   if (!popularServices || popularServices.length === 0) {
       container.innerHTML = '<p class="text-gray-500 text-center py-4">Нет данных</p>';
       return;
   }
   
   const html = popularServices.slice(0, 5).map((service, index) => `
       <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-3">
           <div class="flex items-center">
               <div class="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-white font-semibold text-sm mr-3">
                   ${index + 1}
               </div>
               <div>
                   <p class="font-medium text-gray-900">${service.service_name}</p>
                   <p class="text-sm text-gray-500">${service.category_display}</p>
               </div>
           </div>
           <div class="text-right">
               <p class="font-semibold text-gray-900">${service.count} раз</p>
           </div>
       </div>
   `).join('');
   
   container.innerHTML = html;
}

function renderProfitableServices() {
   const container = document.getElementById('profitable-services');
   
   // Сортируем услуги по марже
   const sortedByMargin = [...servicesData]
       .map(service => ({
           ...service,
           margin: calculateMargin(service)
       }))
       .sort((a, b) => b.margin - a.margin)
       .slice(0, 5);
   
   if (sortedByMargin.length === 0) {
       container.innerHTML = '<p class="text-gray-500 text-center py-4">Нет данных</p>';
       return;
   }
   
   const html = sortedByMargin.map((service, index) => `
       <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-3">
           <div class="flex items-center">
               <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-semibold text-sm mr-3">
                   ${index + 1}
               </div>
               <div>
                   <p class="font-medium text-gray-900">${service.name}</p>
                   <p class="text-sm text-gray-500">${service.category_display}</p>
               </div>
           </div>
           <div class="text-right">
               <p class="font-semibold text-green-600">${service.margin.toFixed(1)}%</p>
               <p class="text-sm text-gray-500">${formatCurrency(parseFloat(service.selling_price) - parseFloat(service.cost_price))}</p>
           </div>
       </div>
   `).join('');
   
   container.innerHTML = html;
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
   if (view === 'grid') {
       document.getElementById('grid-view').classList.remove('hidden');
       document.getElementById('table-view').classList.add('hidden');
   } else {
       document.getElementById('grid-view').classList.add('hidden');
       document.getElementById('table-view').classList.remove('hidden');
   }
   
   renderServices();
}

function filterByCategory(category) {
   currentCategory = category;
   
   // Обновляем активный таб
   document.querySelectorAll('.category-tab').forEach(tab => {
       tab.classList.remove('active', 'border-blue-500', 'text-blue-600');
       tab.classList.add('border-transparent', 'text-gray-500');
   });
   
   const activeTab = document.querySelector(`[data-category="${category}"]`);
   activeTab.classList.add('active', 'border-blue-500', 'text-blue-600');
   activeTab.classList.remove('border-transparent', 'text-gray-500');
   
   // Обновляем фильтр
   document.getElementById('category-filter').value = category;
   filters.category = category;
   
   applyFilters();
}

function updateCategoryCounts() {
   const counts = {
       conditioner: 0,
       installation: 0,
       dismantling: 0,
       maintenance: 0,
       additional: 0
   };
   
   servicesData.forEach(service => {
       if (counts.hasOwnProperty(service.category)) {
           counts[service.category]++;
       }
   });
   
   Object.entries(counts).forEach(([category, count]) => {
       const element = document.getElementById(`count-${category}`);
       if (element) {
           element.textContent = count;
       }
   });
}

function clearFilters() {
   filters = { search: '', category: '', sort: 'name' };
   currentCategory = '';
   
   document.getElementById('search').value = '';
   document.getElementById('category-filter').value = '';
   document.getElementById('sort-filter').value = 'name';
   
   // Сбрасываем активный таб
   filterByCategory('');
   
   filteredServices = [...servicesData];
   updateResultsCount();
   renderServices();
}

async function exportServices() {
   try {
       showLoading();
       await api.exportServices();
       notifications.success('Файл загружен');
   } catch (error) {
       console.error('Ошибка экспорта:', error);
       notifications.error('Ошибка экспорта данных');
   } finally {
       hideLoading();
   }
}

// Действия с услугами
function viewServiceDetails(id) {
   // Открыть модальное окно с деталями или перейти на страницу
   window.location.href = `/services/${id}/`;
}

async function editService(id) {
   try {
       await modal.show('edit-service', { 
           title: 'Редактировать услугу', 
           id: id 
       });
   } catch (error) {
       console.error('Ошибка открытия формы редактирования:', error);
       notifications.error('Ошибка открытия формы');
   }
}

async function deleteService(id) {
   if (!confirm('Вы уверены, что хотите удалить эту услугу?')) {
       return;
   }
   
   try {
       await api.deleteService(id);
       notifications.success('Услуга удалена');
       await refreshData();
   } catch (error) {
       console.error('Ошибка удаления услуги:', error);
       notifications.error('Ошибка удаления услуги');
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
   updateElement('total-count', filteredServices.length);
}

function calculateMargin(service) {
   const cost = parseFloat(service.cost_price || 0);
   const price = parseFloat(service.selling_price || 0);
   
   if (cost === 0) return 0;
   return ((price - cost) / cost * 100);
}

function getCategoryIcon(category) {
   const icons = {
       'conditioner': 'fas fa-snowflake',
       'installation': 'fas fa-tools',
       'dismantling': 'fas fa-wrench',
       'maintenance': 'fas fa-cog',
       'additional': 'fas fa-plus'
   };
   return icons[category] || 'fas fa-cog';
}

function getCategoryBadgeClass(category) {
   const classes = {
       'conditioner': 'badge-primary',
       'installation': 'badge-success',
       'dismantling': 'badge-warning',
       'maintenance': 'badge-gray',
       'additional': 'badge-purple'
   };
   return classes[category] || 'badge-gray';
}

function getPopularityStars(service) {
   // Заглушка - определяем популярность по цене
   const price = parseFloat(service.selling_price || 0);
   let stars = 1;
   
   if (price > 50000) stars = 5;
   else if (price > 30000) stars = 4;
   else if (price > 15000) stars = 3;
   else if (price > 5000) stars = 2;
   
   let html = '';
   for (let i = 1; i <= 5; i++) {
       html += `<i class="fas fa-star ${i <= stars ? '' : 'text-gray-300'}"></i>`;
   }
   return html;
}

function getUsageCount(service) {
   // Заглушка - случайное число от 0 до 50
   return Math.floor(Math.random() * 50);
}

function canEditService() {
   const userRole = getCurrentUserRole();
   return userRole === 'owner';
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

// Функция для обновления данных
window.refreshData = async function() {
   try {
       await loadServices();
       await loadStats();
       await loadAnalytics();
       renderServices();
       notifications.success('Данные обновлены');
   } catch (error) {
       console.error('Ошибка обновления данных:', error);
       notifications.error('Ошибка обновления данных');
   }
};

// Экспорт для глобального использования
window.initServicesPage = initServicesPage;
window.switchView = switchView;
window.filterByCategory = filterByCategory;
window.clearFilters = clearFilters;
window.exportServices = exportServices;
window.viewServiceDetails = viewServiceDetails;
window.editService = editService;
window.deleteService = deleteService;
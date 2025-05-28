// JavaScript для страницы заказов
class OrdersPage {
    constructor() {
        this.currentView = 'table';
        this.currentFilters = {};
        this.currentSort = { field: 'created_at', direction: 'desc' };
        this.currentPage = 1;
        this.pageSize = 20;
        this.orders = [];
        this.clients = [];
        this.managers = [];
        this.installers = [];
        this.services = [];
        this.sellers = [];
        this.currentOrderId = null;
        this.orderItems = [];
        this.selectedService = null;
        
        this.init();
    }

    async init() {
        try {
            showLoading();
            await this.loadInitialData();
            this.setupEventListeners();
            await this.loadOrders();
        } catch (error) {
            console.error('Ошибка инициализации страницы заказов:', error);
            notifications.error('Ошибка загрузки данных');
        } finally {
            hideLoading();
        }
    }

    async loadInitialData() {
        try {
            // Загружаем данные для фильтров и форм
            const [managersData, clientsData, installersData, servicesData] = await Promise.all([
                api.getUsers({ role: 'manager' }),
                api.getClients({ page_size: 100 }),
                api.getUsers({ role: 'installer' }),
                api.getServices({ page_size: 100 })
            ]);

            this.managers = managersData.results || [];
            this.clients = clientsData.results || [];
            this.installers = installersData.results || [];
            this.services = servicesData.results || [];
            
            // Продавцы = менеджеры + монтажники
            this.sellers = [...this.managers, ...this.installers];

            this.populateFilters();
        } catch (error) {
            console.error('Ошибка загрузки начальных данных:', error);
            throw error;
        }
    }

    populateFilters() {
        // Заполняем фильтр менеджеров
        const managerFilter = document.getElementById('manager-filter');
        managerFilter.innerHTML = '<option value="">Все менеджеры</option>';
        this.managers.forEach(manager => {
            const option = document.createElement('option');
            option.value = manager.id;
            option.textContent = `${manager.first_name} ${manager.last_name}`;
            managerFilter.appendChild(option);
        });
    }

    setupEventListeners() {
        // Фильтры
        document.getElementById('search-filter').addEventListener('input', 
            TimingUtils.debounce(() => this.loadOrders(), 500));
        
        // Переключение представлений
        document.getElementById('view-selector')?.addEventListener('change', (e) => {
            this.switchView(e.target.value);
        });

        // Закрытие модальных окон по клику вне их
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('bg-gray-500')) {
                this.closeOrderModal();
                this.closeAddServiceModal();
            }
        });

        // ESC для закрытия модальных окон
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeOrderModal();
                this.closeAddServiceModal();
            }
        });
    }

    async loadOrders() {
        try {
            // Собираем параметры фильтрации
            const params = {
                page: this.currentPage,
                page_size: this.pageSize,
                ordering: this.currentSort.direction === 'desc' ? `-${this.currentSort.field}` : this.currentSort.field,
                ...this.currentFilters
            };

            // Поиск
            const searchValue = document.getElementById('search-filter').value.trim();
            if (searchValue) {
                params.search = searchValue;
            }

            // Статус
            const statusValue = document.getElementById('status-filter').value;
            if (statusValue) {
                params.status = statusValue;
            }

            // Менеджер
            const managerValue = document.getElementById('manager-filter').value;
            if (managerValue) {
                params.manager = managerValue;
            }

            // Период
            const periodValue = document.getElementById('period-filter').value;
            if (periodValue) {
                const dates = this.getPeriodDates(periodValue);
                if (dates) {
                    params.created_at__gte = dates.start;
                    params.created_at__lte = dates.end;
                }
            }

            const response = await api.getOrders(params);
            this.orders = response.results || [];
            
            if (this.currentView === 'table') {
                this.renderTableView(response);
            } else {
                this.renderKanbanView();
            }

        } catch (error) {
            console.error('Ошибка загрузки заказов:', error);
            notifications.error('Ошибка загрузки заказов');
        }
    }

    getPeriodDates(period) {
        const now = new Date();
        let start, end;

        switch (period) {
            case 'today':
                start = DateUtils.startOfDay(now);
                end = DateUtils.endOfDay(now);
                break;
            case 'week':
                start = new Date(now);
                start.setDate(now.getDate() - now.getDay());
                start = DateUtils.startOfDay(start);
                end = DateUtils.endOfDay(now);
                break;
            case 'month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = DateUtils.endOfDay(now);
                break;
            default:
                return null;
        }

        return {
            start: DateUtils.format(start, 'yyyy-MM-dd'),
            end: DateUtils.format(end, 'yyyy-MM-dd')
        };
    }

    renderTableView(data) {
        const tbody = document.getElementById('orders-table-body');
        
        if (!this.orders.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-6 py-12 text-center text-gray-500">
                        <i class="fas fa-clipboard-list text-4xl mb-4"></i>
                        <p>Заказы не найдены</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.orders.map(order => `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <a href="/orders/${order.id}/" class="text-blue-600 hover:text-blue-800">
                        #${order.id}
                    </a>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${order.client_name || 'Не указан'}</div>
                    <div class="text-sm text-gray-500">${order.client_phone || ''}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${order.manager_name || 'Не назначен'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="badge status-${order.status}">
                        ${order.status_display || order.status}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${formatCurrency(parseFloat(order.total_cost || 0))}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${DateUtils.format(order.created_at, 'dd.MM.yyyy HH:mm')}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div class="flex space-x-2">
                        <button onclick="ordersPage.editOrder(${order.id})" 
                                class="text-blue-600 hover:text-blue-900" title="Редактировать">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="ordersPage.viewOrder(${order.id})" 
                                class="text-green-600 hover:text-green-900" title="Просмотр">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="ordersPage.deleteOrder(${order.id})" 
                                class="text-red-600 hover:text-red-900" title="Удалить">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        this.renderPagination(data);
    }

    renderKanbanView() {
        const statusGroups = ArrayUtils.groupBy(this.orders, 'status');
        
        // Очищаем колонки
        ['new', 'in_progress', 'completed', 'cancelled'].forEach(status => {
            const container = document.getElementById(`${status}-orders`);
            const countElement = document.getElementById(`${status}-count`);
            
            const orders = statusGroups[status] || [];
            countElement.textContent = orders.length;
            
            if (orders.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-clipboard text-2xl mb-2"></i>
                        <p class="text-sm">Нет заказов</p>
                    </div>
                `;
            } else {
                container.innerHTML = orders.map(order => `
                    <div class="kanban-card" onclick="ordersPage.viewOrder(${order.id})">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm font-medium text-gray-900">#${order.id}</span>
                            <span class="text-sm font-bold text-gray-900">
                                ${formatCurrency(parseFloat(order.total_cost || 0))}
                            </span>
                        </div>
                        <div class="mb-2">
                            <p class="text-sm font-medium text-gray-900">${order.client_name || 'Не указан'}</p>
                            <p class="text-xs text-gray-500">${order.client_phone || ''}</p>
                        </div>
                        <div class="mb-3">
                            <p class="text-xs text-gray-500">Менеджер: ${order.manager_name || 'Не назначен'}</p>
                            <p class="text-xs text-gray-500">
                                ${DateUtils.timeAgo(order.created_at)}
                            </p>
                        </div>
                        <div class="flex justify-between items-center">
                            <div class="flex space-x-1">
                                <button onclick="event.stopPropagation(); ordersPage.editOrder(${order.id})" 
                                        class="text-blue-600 hover:text-blue-900 text-xs" title="Редактировать">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="event.stopPropagation(); ordersPage.deleteOrder(${order.id})" 
                                        class="text-red-600 hover:text-red-900 text-xs" title="Удалить">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                            ${order.items && order.items.length > 0 ? 
                                `<span class="text-xs text-gray-500">${order.items.length} поз.</span>` : 
                                ''
                            }
                        </div>
                    </div>
                `).join('');
            }
        });
    }

    renderPagination(data) {
        const pagination = document.getElementById('table-pagination');
        if (!pagination || !data) return;

        const totalPages = Math.ceil(data.count / this.pageSize);
        const startItem = (this.currentPage - 1) * this.pageSize + 1;
        const endItem = Math.min(this.currentPage * this.pageSize, data.count);

        pagination.innerHTML = `
            <div class="flex-1 flex justify-between sm:hidden">
                <button onclick="ordersPage.previousPage()" 
                        ${!data.previous ? 'disabled' : ''} 
                        class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
                    Предыдущая
                </button>
                <button onclick="ordersPage.nextPage()" 
                        ${!data.next ? 'disabled' : ''} 
                        class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
                    Следующая
                </button>
            </div>
            <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                    <p class="text-sm text-gray-700">
                        Показано <span class="font-medium">${startItem}</span> - <span class="font-medium">${endItem}</span> из <span class="font-medium">${data.count}</span> результатов
                    </p>
                </div>
                <div>
                    <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button onclick="ordersPage.previousPage()" 
                                ${!data.previous ? 'disabled' : ''} 
                                class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        ${this.renderPageNumbers(totalPages)}
                        <button onclick="ordersPage.nextPage()" 
                                ${!data.next ? 'disabled' : ''} 
                                class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    </nav>
                </div>
            </div>
        `;
    }

    renderPageNumbers(totalPages) {
        const pages = [];
        const current = this.currentPage;
        
        // Показываем до 5 страниц
        let start = Math.max(1, current - 2);
        let end = Math.min(totalPages, start + 4);
        
        if (end - start < 4) {
            start = Math.max(1, end - 4);
        }

        for (let i = start; i <= end; i++) {
            pages.push(`
                <button onclick="ordersPage.goToPage(${i})" 
                        class="relative inline-flex items-center px-4 py-2 border ${
                            i === current 
                                ? 'border-blue-500 bg-blue-50 text-blue-600' 
                                : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
                        } text-sm font-medium">
                    ${i}
                </button>
            `);
        }

        return pages.join('');
    }

    // Навигация по страницам
    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.loadOrders();
        }
    }

    nextPage() {
        this.currentPage++;
        this.loadOrders();
    }

    goToPage(page) {
        this.currentPage = page;
        this.loadOrders();
    }

    // Переключение представлений
    switchView(view) {
        this.currentView = view;
        
        // Обновляем табы
        document.querySelectorAll('.view-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.view === view) {
                tab.classList.add('active');
            }
        });

        // Переключаем представления
        if (view === 'table') {
            document.getElementById('table-view').classList.remove('hidden');
            document.getElementById('kanban-view').classList.add('hidden');
            this.renderTableView({ results: this.orders });
        } else {
            document.getElementById('table-view').classList.add('hidden');
            document.getElementById('kanban-view').classList.remove('hidden');
            this.renderKanbanView();
        }
    }

    // Сортировка
    sortTable(field) {
        if (this.currentSort.field === field) {
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSort.field = field;
            this.currentSort.direction = 'asc';
        }
        
        this.currentPage = 1;
        this.loadOrders();
    }

    // Фильтры
    applyFilters() {
        this.currentPage = 1;
        this.loadOrders();
    }

    clearFilters() {
        document.getElementById('search-filter').value = '';
        document.getElementById('status-filter').value = '';
        document.getElementById('manager-filter').value = '';
        document.getElementById('period-filter').value = '';
        
        this.currentFilters = {};
        this.currentPage = 1;
        this.loadOrders();
    }

    // Работа с заказами
    async openCreateOrderModal() {
        this.currentOrderId = null;
        this.orderItems = [];
        
        document.getElementById('order-modal-title').textContent = 'Новый заказ';
        document.getElementById('order-form').reset();
        
        // Заполняем селекты
        this.populateOrderForm();
        
        // Очищаем позиции
        this.renderOrderItems();
        this.updateOrderTotal();
        
        this.showOrderModal();
    }

    async editOrder(orderId) {
        try {
            this.currentOrderId = orderId;
            
            document.getElementById('order-modal-title').textContent = 'Редактирование заказа';
            
            const order = await api.getOrder(orderId);
            
            // Заполняем форму
            this.populateOrderForm();
            
            document.getElementById('order-client').value = order.client || '';
            document.getElementById('order-manager').value = order.manager || '';
            document.getElementById('order-status').value = order.status || 'new';
            
            // Множественный выбор монтажников
            const installersSelect = document.getElementById('order-installers');
            Array.from(installersSelect.options).forEach(option => {
                option.selected = order.installers && order.installers.includes(parseInt(option.value));
            });
            
            // Загружаем позиции заказа
            this.orderItems = order.items || [];
            this.renderOrderItems();
            this.updateOrderTotal();
            
            this.showOrderModal();
            
        } catch (error) {
            console.error('Ошибка загрузки заказа:', error);
            notifications.error('Ошибка загрузки данных заказа');
        }
    }

    populateOrderForm() {
        // Клиенты
        const clientSelect = document.getElementById('order-client');
        clientSelect.innerHTML = '<option value="">Выберите клиента</option>';
        this.clients.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = `${client.name} (${client.phone})`;
            clientSelect.appendChild(option);
        });

        // Менеджеры
        const managerSelect = document.getElementById('order-manager');
        managerSelect.innerHTML = '<option value="">Выберите менеджера</option>';
        this.managers.forEach(manager => {
            const option = document.createElement('option');
            option.value = manager.id;
            option.textContent = `${manager.first_name} ${manager.last_name}`;
            managerSelect.appendChild(option);
        });

        // Монтажники
        const installersSelect = document.getElementById('order-installers');
        installersSelect.innerHTML = '';
        this.installers.forEach(installer => {
            const option = document.createElement('option');
            option.value = installer.id;
            option.textContent = `${installer.first_name} ${installer.last_name}`;
            installersSelect.appendChild(option);
        });
    }

    renderOrderItems() {
        const container = document.getElementById('order-items');
        const noItemsMessage = document.getElementById('no-items-message');
        
        if (this.orderItems.length === 0) {
            noItemsMessage.classList.remove('hidden');
            container.innerHTML = '';
            container.appendChild(noItemsMessage);
            return;
        }
        
        noItemsMessage.classList.add('hidden');
        
        container.innerHTML = this.orderItems.map((item, index) => `
            <div class="order-item">
                <div class="flex-1">
                    <div class="flex items-center justify-between mb-2">
                        <h5 class="font-medium text-gray-900">${item.service_name}</h5>
                        <span class="font-bold text-gray-900">${formatCurrency(parseFloat(item.price))}</span>
                    </div>
                    <div class="text-sm text-gray-500">
                        <span class="badge badge-primary">${item.service_category_display || item.service_category}</span>
                        <span class="ml-2">Продавец: ${item.seller_name}</span>
                        ${item.id ? `<span class="ml-2 text-xs">(ID: ${item.id})</span>` : '<span class="ml-2 text-xs">(новая)</span>'}
                    </div>
                </div>
                <button onclick="ordersPage.removeOrderItem(${index})" 
                        class="ml-4 text-red-600 hover:text-red-800" title="Удалить">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    }

    async removeOrderItem(index) {
        const item = this.orderItems[index];
        
        try {
            // Если редактируем существующий заказ и у позиции есть ID - удаляем через API
            if (this.currentOrderId && item.id) {
                // Предполагаем, что у нас есть API endpoint для удаления позиции
                // Если его нет, можно удалить через обновление всего заказа
                await fetch(`/api/orders/${this.currentOrderId}/items/${item.id}/`, {
                    method: 'DELETE',
                    headers: {
                        'X-CSRFToken': api.csrfToken,
                    },
                });
                
                // Перезагружаем заказ с сервера
                const order = await api.getOrder(this.currentOrderId);
                this.orderItems = order.items || [];
                
                notifications.success('Услуга удалена из заказа');
            } else {
                // Для нового заказа или локальных изменений просто удаляем из массива
                this.orderItems.splice(index, 1);
                notifications.success('Услуга удалена');
            }
            
            this.renderOrderItems();
            this.updateOrderTotal();
            
        } catch (error) {
            console.error('Ошибка удаления услуги:', error);
            notifications.error('Ошибка удаления услуги');
        }
    }

    updateOrderTotal() {
        const total = this.orderItems.reduce((sum, item) => sum + parseFloat(item.price || 0), 0);
        document.getElementById('order-total').textContent = formatCurrency(total);
    }

    async saveOrder() {
        try {
            const saveBtn = document.getElementById('save-order-btn');
            const saveText = saveBtn.querySelector('.save-text');
            const loadingSpinner = saveBtn.querySelector('.loading-spinner');
            
            // Показываем загрузку
            saveBtn.disabled = true;
            saveText.textContent = 'Сохранение...';
            loadingSpinner.classList.remove('hidden');
            
            // Собираем данные формы
            const formData = new FormData(document.getElementById('order-form'));
            const orderData = {
                client: parseInt(formData.get('client')),
                manager: parseInt(formData.get('manager')),
                status: formData.get('status') || 'new'
            };
            
            // Собираем выбранных монтажников
            const installersSelect = document.getElementById('order-installers');
            const selectedInstallers = Array.from(installersSelect.selectedOptions).map(option => parseInt(option.value));
            if (selectedInstallers.length > 0) {
                orderData.installers = selectedInstallers;
            }
            
            let order;
            if (this.currentOrderId) {
                // Обновляем существующий заказ (позиции уже добавлены через API)
                order = await api.updateOrder(this.currentOrderId, orderData);
                notifications.success('Заказ успешно обновлен');
            } else {
                // Создаем новый заказ
                order = await api.createOrder(orderData);
                
                // Добавляем позиции к новому заказу
                if (this.orderItems.length > 0) {
                    for (const item of this.orderItems) {
                        try {
                            console.log('Добавляем позицию:', {
                                order: order.id,
                                service: item.service,
                                price: item.price,
                                seller: item.seller
                            });
                            
                            await api.addOrderItem(order.id, {
                                order: order.id,  // Добавляем поле order
                                service: item.service,
                                price: parseFloat(item.price),
                                seller: parseInt(item.seller)
                            });
                        } catch (itemError) {
                            console.error('Ошибка добавления позиции:', itemError);
                            notifications.warning(`Не удалось добавить услугу "${item.service_name}": ${itemError.message}`);
                        }
                    }
                }
                
                notifications.success('Заказ успешно создан');
            }
            
            this.closeOrderModal();
            await this.loadOrders();
            
        } catch (error) {
            console.error('Ошибка сохранения заказа:', error);
            
            // Более детальная обработка ошибок
            if (error instanceof APIError && error.status === 400) {
                console.log('Validation error data:', error.data);
                
                if (error.data && typeof error.data === 'object') {
                    let errorMessage = 'Ошибки валидации:\n';
                    Object.entries(error.data).forEach(([field, errors]) => {
                        if (Array.isArray(errors)) {
                            errorMessage += `${field}: ${errors.join(', ')}\n`;
                        } else if (typeof errors === 'string') {
                            errorMessage += `${field}: ${errors}\n`;
                        } else {
                            errorMessage += `${field}: ${JSON.stringify(errors)}\n`;
                        }
                    });
                    notifications.error(errorMessage);
                } else {
                    notifications.error(error.message || 'Ошибка валидации данных');
                }
            } else if (error instanceof APIError) {
                notifications.error(error.message || `Ошибка сервера (${error.status})`);
            } else {
                notifications.error('Ошибка сохранения заказа');
            }
        } finally {
            const saveBtn = document.getElementById('save-order-btn');
            const saveText = saveBtn.querySelector('.save-text');
            const loadingSpinner = saveBtn.querySelector('.loading-spinner');
            
            saveBtn.disabled = false;
            saveText.textContent = 'Сохранить';
            loadingSpinner.classList.add('hidden');
        }
    }

    async deleteOrder(orderId) {
        if (!confirm('Вы уверены, что хотите удалить этот заказ?')) {
            return;
        }
        
        try {
            await api.deleteOrder(orderId);
            notifications.success('Заказ удален');
            await this.loadOrders();
        } catch (error) {
            console.error('Ошибка удаления заказа:', error);
            notifications.error('Ошибка удаления заказа');
        }
    }

    viewOrder(orderId) {
        // Переход на страницу просмотра заказа
        window.location.href = `/orders/${orderId}/`;
    }

    showOrderModal() {
        document.getElementById('order-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeOrderModal() {
        document.getElementById('order-modal').classList.add('hidden');
        document.body.style.overflow = '';
        this.currentOrderId = null;
        this.orderItems = [];
    }

    // Работа с услугами
    async openAddServiceModal() {
        await this.loadServicesForModal();
        this.populateServiceSellers();
        this.showAddServiceModal();
    }

    async loadServicesForModal() {
        try {
            // Загружаем все услуги если еще не загружены
            if (this.services.length === 0) {
                const response = await api.getServices({ page_size: 100 });
                this.services = response.results || [];
            }
            
            this.renderServicesList(this.services);
        } catch (error) {
            console.error('Ошибка загрузки услуг:', error);
            notifications.error('Ошибка загрузки услуг');
        }
    }

    renderServicesList(services) {
        const container = document.getElementById('services-list');
        
        if (services.length === 0) {
            container.innerHTML = `
                <div class="p-4 text-center text-gray-500">
                    <i class="fas fa-search text-2xl mb-2"></i>
                    <p>Услуги не найдены</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = services.map(service => `
            <div class="service-item" onclick="ordersPage.selectService(${service.id})" data-service-id="${service.id}">
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <h4 class="font-medium text-gray-900">${service.name}</h4>
                        <p class="text-sm text-gray-500">
                            <span class="badge badge-primary">${service.category_display || service.category}</span>
                            <span class="ml-2">Цена: ${formatCurrency(parseFloat(service.selling_price))}</span>
                        </p>
                    </div>
                    <i class="fas fa-chevron-right text-gray-400"></i>
                </div>
            </div>
        `).join('');
    }

    selectService(serviceId) {
        const service = this.services.find(s => s.id === serviceId);
        if (!service) return;
        
        this.selectedService = service;
        
        // Обновляем визуальное выделение
        document.querySelectorAll('.service-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelector(`[data-service-id="${serviceId}"]`).classList.add('selected');
        
        // Показываем детали выбранной услуги
        document.getElementById('selected-service').classList.remove('hidden');
        document.getElementById('selected-service-name').textContent = service.name;
        document.getElementById('selected-service-category').textContent = service.category_display || service.category;
        document.getElementById('service-price').value = service.selling_price;
    }

    clearSelectedService() {
        this.selectedService = null;
        document.getElementById('selected-service').classList.add('hidden');
        document.querySelectorAll('.service-item').forEach(item => {
            item.classList.remove('selected');
        });
    }

    populateServiceSellers() {
        const sellerSelect = document.getElementById('service-seller');
        sellerSelect.innerHTML = '<option value="">Выберите продавца</option>';
        
        this.sellers.forEach(seller => {
            const option = document.createElement('option');
            option.value = seller.id;
            option.textContent = `${seller.first_name} ${seller.last_name} (${seller.role === 'manager' ? 'Менеджер' : 'Монтажник'})`;
            sellerSelect.appendChild(option);
        });
    }

    filterServicesByCategory() {
        const category = document.getElementById('service-category').value;
        const filteredServices = category 
            ? this.services.filter(service => service.category === category)
            : this.services;
        
        this.renderServicesList(filteredServices);
        this.clearSelectedService();
    }

    searchServices() {
        const query = document.getElementById('service-search').value.toLowerCase().trim();
        const category = document.getElementById('service-category').value;
        
        let filteredServices = this.services;
        
        if (category) {
            filteredServices = filteredServices.filter(service => service.category === category);
        }
        
        if (query) {
            filteredServices = filteredServices.filter(service => 
                service.name.toLowerCase().includes(query)
            );
        }
        
        this.renderServicesList(filteredServices);
        this.clearSelectedService();
    }

    async addServiceToOrder() {
        if (!this.selectedService) {
            notifications.warning('Выберите услугу');
            return;
        }
        
        const price = document.getElementById('service-price').value;
        const seller = document.getElementById('service-seller').value;
        
        if (!price || !seller) {
            notifications.warning('Заполните все обязательные поля');
            return;
        }
        
        if (parseFloat(price) <= 0) {
            notifications.warning('Цена должна быть больше нуля');
            return;
        }
        
        // Проверяем, не добавлена ли уже эта услуга
        const existingItem = this.orderItems.find(item => item.service === this.selectedService.id);
        if (existingItem) {
            notifications.warning('Эта услуга уже добавлена в заказ');
            return;
        }
        
        // Находим данные продавца
        const sellerData = this.sellers.find(s => s.id === parseInt(seller));
        if (!sellerData) {
            notifications.error('Продавец не найден');
            return;
        }
        
        // Создаем объект позиции
        const orderItem = {
            service: this.selectedService.id,
            service_name: this.selectedService.name,
            service_category: this.selectedService.category,
            service_category_display: this.selectedService.category_display,
            price: parseFloat(price),
            seller: parseInt(seller),
            seller_name: `${sellerData.first_name} ${sellerData.last_name}`
        };
        
        try {
            // Если редактируем существующий заказ - добавляем услугу через API
            if (this.currentOrderId) {
                console.log('Добавляем услугу в существующий заказ:', {
                    order: this.currentOrderId,
                    service: this.selectedService.id,
                    price: parseFloat(price),
                    seller: parseInt(seller)
                });
                
                const response = await api.addOrderItem(this.currentOrderId, {
                    order: this.currentOrderId,  // Добавляем поле order
                    service: this.selectedService.id,
                    price: parseFloat(price),
                    seller: parseInt(seller)
                });
                
                // Проверяем формат ответа
                if (response && response.items) {
                    this.orderItems = response.items;
                } else if (response && response.item) {
                    // Если возвращается только добавленная позиция, обновляем заказ
                    const order = await api.getOrder(this.currentOrderId);
                    this.orderItems = order.items || [];
                } else {
                    // Если неясный формат ответа, перезагружаем заказ
                    const order = await api.getOrder(this.currentOrderId);
                    this.orderItems = order.items || [];
                }
                
                notifications.success('Услуга добавлена в заказ');
            } else {
                // Для нового заказа просто добавляем в локальный массив
                this.orderItems.push(orderItem);
                notifications.success('Услуга добавлена в заказ');
            }
            
            // Обновляем отображение
            this.renderOrderItems();
            this.updateOrderTotal();
            
            // Закрываем модальное окно
            this.closeAddServiceModal();
            
        } catch (error) {
            console.error('Ошибка добавления услуги:', error);
            
            // Детальная обработка ошибок
            if (error instanceof APIError) {
                if (error.status === 400) {
                    // Проверяем структуру данных ошибки
                    console.log('Error data:', error.data);
                    
                    if (error.data && typeof error.data === 'object') {
                        let errorMessage = 'Ошибки валидации:\n';
                        Object.entries(error.data).forEach(([field, errors]) => {
                            if (Array.isArray(errors)) {
                                errorMessage += `${field}: ${errors.join(', ')}\n`;
                            } else if (typeof errors === 'string') {
                                errorMessage += `${field}: ${errors}\n`;
                            } else {
                                errorMessage += `${field}: ${JSON.stringify(errors)}\n`;
                            }
                        });
                        notifications.error(errorMessage);
                    } else if (error.data && error.data.detail) {
                        notifications.error(error.data.detail);
                    } else {
                        notifications.error('Неверные данные услуги');
                    }
                } else if (error.status === 404) {
                    notifications.error('Заказ или услуга не найдены');
                } else if (error.status === 403) {
                    notifications.error('Недостаточно прав для добавления услуги');
                } else {
                    notifications.error(error.message || 'Ошибка добавления услуги');
                }
            } else {
                notifications.error('Ошибка сети при добавлении услуги');
            }
        }
    }

    showAddServiceModal() {
        document.getElementById('add-service-modal').classList.remove('hidden');
    }

    closeAddServiceModal() {
        document.getElementById('add-service-modal').classList.add('hidden');
        document.getElementById('add-service-form').reset();
        this.clearSelectedService();
    }

    // Создание клиента из формы заказа
    openCreateClientFromOrder() {
        // Сохраняем состояние формы заказа
        const orderFormData = new FormData(document.getElementById('order-form'));
        
        // Открываем модальное окно создания клиента
        openCreateClientModal();
        
        // После создания клиента обновляем список в форме заказа
        // Это будет обработано в callbacks модального окна клиента
    }

    // Экспорт заказов
    async exportOrders() {
        try {
            showLoading();
            await api.exportOrders();
            notifications.success('Файл экспорта готов к скачиванию');
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            notifications.error('Ошибка экспорта данных');
        } finally {
            hideLoading();
        }
    }

    // Обновление данных после создания клиента
    async refreshClientsData() {
        try {
            const response = await api.getClients({ page_size: 100 });
            this.clients = response.results || [];
            this.populateOrderForm();
        } catch (error) {
            console.error('Ошибка обновления списка клиентов:', error);
        }
    }
}

// Глобальные функции для использования в HTML
let ordersPage;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    ordersPage = new OrdersPage();
});

// Глобальные функции для вызова из HTML
window.openCreateOrderModal = () => ordersPage?.openCreateOrderModal();
window.editOrder = (id) => ordersPage?.editOrder(id);
window.deleteOrder = (id) => ordersPage?.deleteOrder(id);
window.viewOrder = (id) => ordersPage?.viewOrder(id);
window.saveOrder = () => ordersPage?.saveOrder();
window.closeOrderModal = () => ordersPage?.closeOrderModal();

window.openAddServiceModal = () => ordersPage?.openAddServiceModal();
window.addServiceToOrder = () => ordersPage?.addServiceToOrder();
window.closeAddServiceModal = () => ordersPage?.closeAddServiceModal();
window.filterServicesByCategory = () => ordersPage?.filterServicesByCategory();
window.searchServices = () => ordersPage?.searchServices();
window.clearSelectedService = () => ordersPage?.clearSelectedService();

window.openCreateClientFromOrder = () => ordersPage?.openCreateClientFromOrder();
window.exportOrders = () => ordersPage?.exportOrders();

window.switchView = (view) => ordersPage?.switchView(view);
window.sortTable = (field) => ordersPage?.sortTable(field);
window.applyFilters = () => ordersPage?.applyFilters();
window.clearFilters = () => ordersPage?.clearFilters();

// Функции для работы с формами заказов (для интеграции с существующей системой модальных окон)
window.refreshOrdersPage = () => ordersPage?.loadOrders();
window.refreshClientsInOrderForm = () => ordersPage?.refreshClientsData();

// Переопределяем функции модального окна клиента для интеграции
const originalOpenCreateClientModal = window.openCreateClientModal;
window.openCreateClientModal = function() {
    return originalOpenCreateClientModal?.call(this, {
        onSuccess: () => {
            // Обновляем список клиентов в форме заказа если она открыта
            if (ordersPage && !document.getElementById('order-modal').classList.contains('hidden')) {
                ordersPage.refreshClientsData();
            }
        }
    });
};

// Вспомогательные функции для улучшения UX
document.addEventListener('keydown', function(e) {
    // Быстрые клавиши
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case 'n':
                e.preventDefault();
                if (ordersPage) {
                    ordersPage.openCreateOrderModal();
                }
                break;
            case 'f':
                e.preventDefault();
                document.getElementById('search-filter')?.focus();
                break;
        }
    }
});

// Функция для обновления счетчиков в канбан-представлении
function updateKanbanCounters() {
    if (ordersPage && ordersPage.currentView === 'kanban') {
        ordersPage.renderKanbanView();
    }
}

// Автообновление данных каждые 5 минут
setInterval(() => {
    if (ordersPage && document.visibilityState === 'visible') {
        ordersPage.loadOrders();
    }
}, 5 * 60 * 1000);

// Обработка изменения видимости страницы
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && ordersPage) {
        // Обновляем данные при возврате на страницу
        ordersPage.loadOrders();
    }
});

// Функция для показа деталей заказа в канбан-карточке
function showOrderDetails(orderId) {
    const order = ordersPage?.orders.find(o => o.id === orderId);
    if (!order) return;
    
    // Создаем всплывающую подсказку с деталями
    const tooltip = document.createElement('div');
    tooltip.className = 'fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm';
    tooltip.innerHTML = `
        <div class="space-y-2">
            <div class="flex justify-between items-center">
                <h5 class="font-semibold">Заказ #${order.id}</h5>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" class="text-gray-400 hover:text-gray-600">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="text-sm text-gray-600">
                <p><strong>Клиент:</strong> ${order.client_name}</p>
                <p><strong>Телефон:</strong> ${order.client_phone || 'Не указан'}</p>
                <p><strong>Адрес:</strong> ${order.client_address || 'Не указан'}</p>
                <p><strong>Менеджер:</strong> ${order.manager_name || 'Не назначен'}</p>
                <p><strong>Сумма:</strong> ${formatCurrency(parseFloat(order.total_cost || 0))}</p>
                <p><strong>Создан:</strong> ${DateUtils.format(order.created_at, 'dd.MM.yyyy HH:mm')}</p>
            </div>
            ${order.items && order.items.length > 0 ? `
                <div class="border-t pt-2">
                    <p class="text-sm font-medium text-gray-700 mb-1">Позиции:</p>
                    <div class="text-xs text-gray-600 space-y-1">
                        ${order.items.slice(0, 3).map(item => `
                            <div class="flex justify-between">
                                <span>${item.service_name}</span>
                                <span>${formatCurrency(parseFloat(item.price))}</span>
                            </div>
                        `).join('')}
                        ${order.items.length > 3 ? `<div class="text-center">... и еще ${order.items.length - 3}</div>` : ''}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    
    document.body.appendChild(tooltip);
    
    // Позиционируем tooltip
    const rect = event.target.getBoundingClientRect();
    tooltip.style.left = `${rect.right + 10}px`;
    tooltip.style.top = `${rect.top}px`;
    
    // Автоматически удаляем через 5 секунд
    setTimeout(() => {
        if (tooltip.parentElement) {
            tooltip.remove();
        }
    }, 5000);
}

// Добавляем обработчики для drag & drop в канбан-доске (будущая функциональность)
function initDragAndDrop() {
    // Пока заглушка, можно будет реализовать позже
    console.log('Drag & Drop functionality placeholder');
}

// Функция для быстрого изменения статуса заказа
async function quickChangeStatus(orderId, newStatus) {
    try {
        await api.changeOrderStatus(orderId, newStatus);
        notifications.success('Статус заказа изменен');
        ordersPage?.loadOrders();
    } catch (error) {
        console.error('Ошибка изменения статуса:', error);
        notifications.error('Ошибка изменения статуса');
    }
}

// Добавляем вспомогательную функцию для проверки API
async function debugAPI() {
    console.log('=== API Debug Info ===');
    console.log('API base URL:', api.baseURL);
    console.log('CSRF Token:', api.csrfToken);
    
    try {
        // Проверяем доступность основных endpoints
        const endpoints = [
            'clients/',
            'services/',
            'users/',
            'orders/'
        ];
        
        for (const endpoint of endpoints) {
            try {
                const response = await api.get(endpoint, { page_size: 1 });
                console.log(`✅ ${endpoint}:`, response);
            } catch (error) {
                console.log(`❌ ${endpoint}:`, error);
            }
        }
    } catch (error) {
        console.error('Debug API error:', error);
    }
}

// Функция для тестирования конкретного заказа
async function debugOrder(orderId) {
    try {
        console.log('=== Order Debug ===');
        const order = await api.getOrder(orderId);
        console.log('Order data:', order);
        
        // Пробуем добавить тестовую позицию
        if (ordersPage && ordersPage.services.length > 0 && ordersPage.sellers.length > 0) {
            const testService = ordersPage.services[0];
            const testSeller = ordersPage.sellers[0];
            
            console.log('Trying to add test item:', {
                service: testService.id,
                price: 1000,
                seller: testSeller.id
            });
            
            const result = await api.addOrderItem(orderId, {
                service: testService.id,
                price: 1000,
                seller: testSeller.id
            });
            
            console.log('Add item result:', result);
        }
    } catch (error) {
        console.error('Debug order error:', error);
        if (error instanceof APIError) {
            console.error('Status:', error.status);
            console.error('Data:', error.data);
        }
    }
}

// Функция для проверки endpoint добавления позиции заказа
async function testAddOrderItem(orderId, serviceId, price, sellerId) {
    try {
        console.log('=== Testing Add Order Item ===');
        console.log('Order ID:', orderId);
        console.log('Service ID:', serviceId);
        console.log('Price:', price);
        console.log('Seller ID:', sellerId);
        
        // Проверяем разные варианты структуры данных
        const variants = [
            {
                order: orderId,
                service: serviceId,
                price: parseFloat(price),
                seller: sellerId
            },
            {
                order: orderId,
                service_id: serviceId,
                price: parseFloat(price),
                seller_id: sellerId
            },
            {
                order: orderId,
                service: serviceId,
                price: price.toString(),
                seller: sellerId
            },
            {
                service: serviceId,
                price: parseFloat(price),
                seller: sellerId
            }
        ];
        
        for (let i = 0; i < variants.length; i++) {
            console.log(`\nТестируем вариант ${i + 1}:`, variants[i]);
            
            try {
                const response = await fetch(`/api/orders/${orderId}/add_item/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': api.csrfToken,
                    },
                    body: JSON.stringify(variants[i])
                });
                
                console.log('Response status:', response.status);
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Успех с вариантом', i + 1, ':', result);
                    return result;
                } else {
                    const errorText = await response.text();
                    console.log('❌ Ошибка с вариантом', i + 1, ':', errorText);
                    
                    try {
                        const errorJson = JSON.parse(errorText);
                        console.log('Error JSON:', errorJson);
                    } catch (e) {
                        console.log('Error as text:', errorText);
                    }
                }
            } catch (error) {
                console.log('❌ Сетевая ошибка с вариантом', i + 1, ':', error);
            }
        }
        
    } catch (error) {
        console.error('Test error:', error);
    }
}

// Функция для проверки доступных услуг и продавцов
async function debugServicesAndSellers() {
    console.log('=== Services and Sellers Debug ===');
    
    if (ordersPage) {
        console.log('Services:', ordersPage.services);
        console.log('Sellers:', ordersPage.sellers);
        console.log('Managers:', ordersPage.managers);
        console.log('Installers:', ordersPage.installers);
    } else {
        console.log('OrdersPage not initialized');
    }
}

// Экспортируем функции отладки в window для доступа из консоли
window.debugAPI = debugAPI;
window.debugOrder = debugOrder;
window.testAddOrderItem = testAddOrderItem;
window.debugServicesAndSellers = debugServicesAndSellers;
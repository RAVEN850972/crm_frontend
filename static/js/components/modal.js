// Система модальных окон
class ModalManager {
    constructor() {
        this.container = document.getElementById('modal-container');
        this.modals = new Map();
        this.currentModal = null;
    }

    async show(modalType, options = {}) {
        const { id = null, title = '', size = 'md', data = {} } = options;
        
        try {
            // Загружаем данные для модального окна
            const modalData = await this.loadModalData(modalType, id);
            
            // Создаем модальное окно
            const modal = this.createModal(modalType, {
                ...options,
                data: { ...modalData, ...data }
            });

            this.modals.set(modalType, modal);
            this.currentModal = modalType;
            
            // Добавляем в DOM
            this.container.appendChild(modal.element);
            
            // Показываем с анимацией
            requestAnimationFrame(() => {
                modal.element.classList.remove('opacity-0');
                modal.backdrop.classList.remove('opacity-0');
                modal.content.classList.remove('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');
                modal.content.classList.add('opacity-100', 'translate-y-0', 'sm:scale-100');
            });

            // Фокусируемся на первое поле
            setTimeout(() => {
                const firstInput = modal.element.querySelector('input, select, textarea');
                if (firstInput) {
                    firstInput.focus();
                }
            }, 100);

            return modal;
            
        } catch (error) {
            console.error('Ошибка создания модального окна:', error);
            notifications.error('Ошибка загрузки формы');
            throw error;
        }
    }

    hide(modalType = null) {
        const typeToHide = modalType || this.currentModal;
        if (!typeToHide) return;

        const modal = this.modals.get(typeToHide);
        if (!modal) return;

        // Анимация скрытия
        modal.backdrop.classList.add('opacity-0');
        modal.content.classList.remove('opacity-100', 'translate-y-0', 'sm:scale-100');
        modal.content.classList.add('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');

        setTimeout(() => {
            if (modal.element.parentNode) {
                modal.element.parentNode.removeChild(modal.element);
            }
            this.modals.delete(typeToHide);
            if (this.currentModal === typeToHide) {
                this.currentModal = null;
            }
        }, 200);
    }

    async loadModalData(modalType, id = null) {
        switch (modalType) {
            case 'create-client':
            case 'edit-client':
                return await api.getModalData('client', id);
            
            case 'create-order':
            case 'edit-order':
                return await api.getModalData('order', id);
                
            case 'create-service':
            case 'edit-service':
                return await api.getModalData('service', id);
                
            case 'create-user':
            case 'edit-user':
                return await api.getModalData('user', id);
                
            case 'create-transaction':
            case 'edit-transaction':
                return await api.getModalData('transaction', id);
                
            case 'salary-payment':
                return await api.getModalData('salary-payment', id);
                
            default:
                return {};
        }
    }

    createModal(modalType, options) {
        const { title, size, data, id } = options;
        
        const sizeClasses = {
            sm: 'max-w-lg',
            md: 'max-w-2xl',
            lg: 'max-w-4xl',
            xl: 'max-w-6xl'
        };

        const element = document.createElement('div');
        element.className = 'fixed inset-0 z-10 overflow-y-auto opacity-0 transition-opacity duration-200';
        element.setAttribute('aria-labelledby', 'modal-title');
        element.setAttribute('role', 'dialog');
        element.setAttribute('aria-modal', 'true');

        const content = this.getModalContent(modalType, data, id);
        
        element.innerHTML = `
            <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity opacity-0" aria-hidden="true"></div>
                <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle ${sizeClasses[size]} sm:w-full opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
                    <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                ${title}
                            </h3>
                            <button type="button" class="rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500" onclick="modal.hide()">
                                <span class="sr-only">Закрыть</span>
                                <i class="fas fa-times h-6 w-6"></i>
                            </button>
                        </div>
                        <div class="modal-content">
                            ${content}
                        </div>
                    </div>
                    <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button type="button" id="modal-submit" class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm">
                            <span class="submit-text">Сохранить</span>
                            <span class="loading-spinner hidden ml-2">
                                <i class="fas fa-spinner fa-spin"></i>
                            </span>
                        </button>
                        <button type="button" class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm" onclick="modal.hide()">
                            Отмена
                        </button>
                    </div>
                </div>
            </div>
        `;

        const backdrop = element.querySelector('.fixed.inset-0.bg-gray-500');
        const contentElement = element.querySelector('.inline-block');
        
        // Обработчики событий
        backdrop.addEventListener('click', () => this.hide(modalType));
        
        // Обработка отправки формы
        const submitButton = element.querySelector('#modal-submit');
        submitButton.addEventListener('click', () => this.handleSubmit(modalType, id));

        // ESC для закрытия
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.hide(modalType);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        return {
            element,
            backdrop,
            content: contentElement,
            modalType,
            id
        };
    }

    getModalContent(modalType, data, id) {
        switch (modalType) {
            case 'create-client':
            case 'edit-client':
                return this.getClientModalContent(data, id);
                
            case 'create-order':
            case 'edit-order':
                return this.getOrderModalContent(data, id);
                
            case 'create-service':
            case 'edit-service':
                return this.getServiceModalContent(data, id);
                
            default:
                return '<p>Неизвестный тип модального окна</p>';
        }
    }

    getClientModalContent(data, id) {
        const client = data.client || {};
        const sources = data.sources || [];
        
        return `
            <form id="client-form" class="space-y-4">
                <div>
                    <label for="name" class="block text-sm font-medium text-gray-700">Имя *</label>
                    <input type="text" id="name" name="name" required 
                           value="${client.name || ''}"
                           class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm">
                </div>
                
                <div>
                    <label for="phone" class="block text-sm font-medium text-gray-700">Телефон *</label>
                    <input type="tel" id="phone" name="phone" required 
                           value="${client.phone || ''}"
                           class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm">
                </div>
                
                <div>
                    <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
                    <input type="email" id="email" name="email" 
                           value="${client.email || ''}"
                           class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm">
                </div>
                
                <div>
                    <label for="address" class="block text-sm font-medium text-gray-700">Адрес *</label>
                    <input type="text" id="address" name="address" required 
                           value="${client.address || ''}"
                           class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm">
                </div>
                
                <div>
                    <label for="source" class="block text-sm font-medium text-gray-700">Источник *</label>
                    <select id="source" name="source" required 
                            class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm">
                        <option value="">Выберите источник</option>
                        ${sources.map(source => 
                            `<option value="${source.value}" ${client.source === source.value ? 'selected' : ''}>${source.label}</option>`
                        ).join('')}
                    </select>
                </div>
            </form>
        `;
    }

    getOrderModalContent(data, id) {
        const order = data.order || {};
        const clients = data.clients || [];
        const managers = data.managers || [];
        const installers = data.installers || [];
        const statuses = data.statuses || [];
        
        return `
            <form id="order-form" class="space-y-4">
                <div>
                    <label for="client" class="block text-sm font-medium text-gray-700">Клиент *</label>
                    <select id="client" name="client" required 
                            class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm">
                        <option value="">Выберите клиента</option>
                        ${clients.map(client => 
                            `<option value="${client.id}" ${order.client === client.id ? 'selected' : ''}>${client.name} (${client.phone})</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div>
                    <label for="manager" class="block text-sm font-medium text-gray-700">Менеджер *</label>
                    <select id="manager" name="manager" required 
                            class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm">
                        <option value="">Выберите менеджера</option>
                        ${managers.map(manager => 
                            `<option value="${manager.id}" ${order.manager === manager.id ? 'selected' : ''}>${manager.first_name} ${manager.last_name}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div>
                    <label for="status" class="block text-sm font-medium text-gray-700">Статус</label>
                    <select id="status" name="status" 
                            class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm">
                        ${statuses.map(status => 
                            `<option value="${status.value}" ${order.status === status.value ? 'selected' : ''}>${status.label}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div>
                    <label for="installers" class="block text-sm font-medium text-gray-700">Монтажники</label>
                    <select id="installers" name="installers" multiple 
                            class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm">
                        ${installers.map(installer => 
                            `<option value="${installer.id}" ${order.installers && order.installers.includes(installer.id) ? 'selected' : ''}>${installer.first_name} ${installer.last_name}</option>`
                        ).join('')}
                    </select>
                    <p class="mt-1 text-sm text-gray-500">Удерживайте Ctrl для выбора нескольких</p>
                </div>
            </form>
        `;
    }

    getServiceModalContent(data, id) {
        const service = data.service || {};
        const categories = [
            { value: 'conditioner', label: 'Кондиционер' },
            { value: 'installation', label: 'Монтаж' },
            { value: 'dismantling', label: 'Демонтаж' },
            { value: 'maintenance', label: 'Обслуживание' },
            { value: 'additional', label: 'Доп услуга' }
        ];
        
        return `
            <form id="service-form" class="space-y-4">
                <div>
                    <label for="name" class="block text-sm font-medium text-gray-700">Название *</label>
                    <input type="text" id="name" name="name" required 
                           value="${service.name || ''}"
                           class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm">
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label for="cost_price" class="block text-sm font-medium text-gray-700">Себестоимость *</label>
                        <input type="number" id="cost_price" name="cost_price" required step="0.01" min="0"
                               value="${service.cost_price || ''}"
                               class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm">
                    </div>
                    
                    <div>
                        <label for="selling_price" class="block text-sm font-medium text-gray-700">Цена продажи *</label>
                        <input type="number" id="selling_price" name="selling_price" required step="0.01" min="0"
                               value="${service.selling_price || ''}"
                               class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm">
                    </div>
                </div>
                
                <div>
                    <label for="category" class="block text-sm font-medium text-gray-700">Категория *</label>
                    <select id="category" name="category" required 
                            class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm">
                        <option value="">Выберите категорию</option>
                        ${categories.map(category => 
                            `<option value="${category.value}" ${service.category === category.value ? 'selected' : ''}>${category.label}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div id="margin-info" class="hidden p-3 bg-gray-50 rounded-md">
                    <p class="text-sm text-gray-600">
                        <strong>Маржа:</strong> <span id="margin-value">0%</span>
                        (<span id="margin-amount">0</span> ₽)
                    </p>
                </div>
            </form>
        `;
    }

    async handleSubmit(modalType, id) {
        const submitButton = document.getElementById('modal-submit');
        const submitText = submitButton.querySelector('.submit-text');
        const loadingSpinner = submitButton.querySelector('.loading-spinner');
        
        // Показываем индикатор загрузки
        submitButton.disabled = true;
        submitText.textContent = 'Сохранение...';
        loadingSpinner.classList.remove('hidden');
        
        try {
            const formData = this.getFormData(modalType);
            let result;
            
            switch (modalType) {
                case 'create-client':
                    result = await api.createClient(formData);
                    notifications.success('Клиент успешно создан');
                    break;
                    
                case 'edit-client':
                    result = await api.updateClient(id, formData);
                    notifications.success('Клиент успешно обновлен');
                    break;
                    
                case 'create-order':
                    result = await api.createOrder(formData);
                    notifications.success('Заказ успешно создан');
                    break;
                    
                case 'edit-order':
                    result = await api.updateOrder(id, formData);
                    notifications.success('Заказ успешно обновлен');
                    break;
                    
                case 'create-service':
                    result = await api.createService(formData);
                    notifications.success('Услуга успешно создана');
                    break;
                    
                case 'edit-service':
                    result = await api.updateService(id, formData);
                    notifications.success('Услуга успешно обновлена');
                    break;
            }
            
            // Закрываем модальное окно
            this.hide(modalType);
            
            // Обновляем страницу или данные
            if (typeof window.refreshData === 'function') {
                window.refreshData();
            } else {
                // Перезагружаем страницу как fallback
                setTimeout(() => window.location.reload(), 500);
            }
            
        } catch (error) {
            console.error('Ошибка отправки формы:', error);
            notifications.apiError(error, 'Ошибка сохранения данных');
            
        } finally {
            // Восстанавливаем кнопку
            submitButton.disabled = false;
            submitText.textContent = 'Сохранить';
            loadingSpinner.classList.add('hidden');
        }
    }

    getFormData(modalType) {
        const formId = modalType.includes('client') ? 'client-form' :
                      modalType.includes('order') ? 'order-form' :
                      modalType.includes('service') ? 'service-form' : 'form';
                      
        const form = document.getElementById(formId);
        const formData = new FormData(form);
        const data = {};
        
        for (const [key, value] of formData.entries()) {
            if (key === 'installers') {
                // Обрабатываем множественный выбор
                if (!data[key]) data[key] = [];
                data[key].push(parseInt(value));
            } else if (value !== '') {
                // Преобразуем числовые поля
                if (['client', 'manager', 'service', 'cost_price', 'selling_price'].includes(key)) {
                    data[key] = key.includes('price') ? parseFloat(value) : parseInt(value);
                } else {
                    data[key] = value;
                }
            }
        }
        
        return data;
    }
}

// Создаем глобальный экземпляр менеджера модальных окон
window.modal = new ModalManager();

// Глобальные функции для удобства
window.showModal = (type, options = {}) => modal.show(type, options);
window.hideModal = (type = null) => modal.hide(type);

// Функции для быстрого создания модальных окон
window.openCreateClientModal = () => modal.show('create-client', { title: 'Новый клиент' });
window.openEditClientModal = (id) => modal.show('edit-client', { title: 'Редактировать клиента', id });
window.openCreateOrderModal = () => modal.show('create-order', { title: 'Новый заказ', size: 'lg' });
window.openEditOrderModal = (id) => modal.show('edit-order', { title: 'Редактировать заказ', id, size: 'lg' });
window.openCreateServiceModal = () => modal.show('create-service', { title: 'Новая услуга' });
window.openEditServiceModal = (id) => modal.show('edit-service', { title: 'Редактировать услугу', id });

// Обработчики для расчета маржи в форме услуг
document.addEventListener('input', function(e) {
    if (e.target.id === 'cost_price' || e.target.id === 'selling_price') {
        updateMarginInfo();
    }
});

function updateMarginInfo() {
    const costPrice = parseFloat(document.getElementById('cost_price')?.value) || 0;
    const sellingPrice = parseFloat(document.getElementById('selling_price')?.value) || 0;
    const marginInfo = document.getElementById('margin-info');
    const marginValue = document.getElementById('margin-value');
    const marginAmount = document.getElementById('margin-amount');
    
    if (costPrice > 0 && sellingPrice > 0) {
        const margin = ((sellingPrice - costPrice) / costPrice * 100).toFixed(1);
        const amount = (sellingPrice - costPrice).toFixed(0);
        
        marginValue.textContent = margin + '%';
        marginAmount.textContent = amount;
        marginInfo.classList.remove('hidden');
    } else {
        marginInfo.classList.add('hidden');
    }
}

// Экспортируем для использования в модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalManager;
}
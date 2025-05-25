// Главный JavaScript файл приложения
class App {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.currentPage = this.getCurrentPage();
        
        this.init();
    }

    async init() {
        // Инициализация приложения
        try {
            await this.loadUserInfo();
            this.setupEventListeners();
            this.initCurrentPage();
            
            console.log('Приложение инициализировано');
        } catch (error) {
            console.error('Ошибка инициализации приложения:', error);
        }
    }

    async loadUserInfo() {
        // Загружаем информацию о текущем пользователе из мета-тегов или API
        const userMeta = document.querySelector('meta[name="current-user"]');
        if (userMeta) {
            try {
                this.currentUser = JSON.parse(userMeta.content);
                this.isAuthenticated = true;
            } catch (e) {
                console.warn('Не удалось загрузить информацию о пользователе');
            }
        }
    }

    setupEventListeners() {
        // Глобальные обработчики событий
        
        // Обработка форм
        document.addEventListener('submit', this.handleFormSubmit.bind(this));
        
        // Обработка клавиш
        document.addEventListener('keydown', this.handleKeydown.bind(this));
        
        // Обработка ссылок с подтверждением
        document.addEventListener('click', this.handleConfirmActions.bind(this));
        
        // Обработка drag & drop
        this.setupDragAndDrop();
        
        // Автосохранение форм
        this.setupAutoSave();
        
        // Проверка интернет соединения
        this.setupConnectionCheck();
    }

    getCurrentPage() {
        const path = window.location.pathname;
        
        if (path === '/' || path.includes('dashboard')) return 'dashboard';
        if (path.includes('clients')) return 'clients';
        if (path.includes('orders')) return 'orders';
        if (path.includes('services')) return 'services';
        if (path.includes('calendar')) return 'calendar';
        if (path.includes('finance')) return 'finance';
        if (path.includes('users')) return 'users';
        if (path.includes('analytics')) return 'analytics';
        
        return 'unknown';
    }

    initCurrentPage() {
        // Инициализация специфичной логики для текущей страницы
        switch (this.currentPage) {
            case 'dashboard':
                this.initDashboard();
                break;
            case 'clients':
                this.initClients();
                break;
            case 'orders':
                this.initOrders();
                break;
            case 'services':
                this.initServices();
                break;
            case 'calendar':
                this.initCalendar();
                break;
            case 'finance':
                this.initFinance();
                break;
        }
    }

    // Инициализация страниц
    async initDashboard() {
        if (typeof initDashboard === 'function') {
            await initDashboard();
        }
    }

    async initClients() {
        if (typeof initClientsPage === 'function') {
            await initClientsPage();
        }
    }

    async initOrders() {
        if (typeof initOrdersPage === 'function') {
            await initOrdersPage();
        }
    }

    async initServices() {
        if (typeof initServicesPage === 'function') {
            await initServicesPage();
        }
    }

    async initCalendar() {
        if (typeof initCalendarPage === 'function') {
            await initCalendarPage();
        }
    }

    async initFinance() {
        if (typeof initFinancePage === 'function') {
            await initFinancePage();
        }
    }

    // Обработчики событий
    async handleFormSubmit(e) {
        const form = e.target;
        
        // Проверяем, нужно ли обрабатывать форму через AJAX
        if (form.dataset.ajax === 'true') {
            e.preventDefault();
            await this.submitFormAjax(form);
        }
    }

    async submitFormAjax(form) {
        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        
        try {
            // Показываем загрузку
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Отправка...';
            
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            const method = form.method.toUpperCase();
            const url = form.action;
            
            let response;
            if (method === 'POST') {
                response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.getCSRFToken(),
                    },
                    body: JSON.stringify(data),
                });
            }
            
            if (response.ok) {
                const result = await response.json();
                notifications.success('Данные успешно сохранены');
                
                // Перенаправление или обновление
                if (result.redirect) {
                    window.location.href = result.redirect;
                } else if (typeof window.refreshData === 'function') {
                    window.refreshData();
                }
            } else {
                throw new Error('Ошибка сервера');
            }
            
        } catch (error) {
            console.error('Ошибка отправки формы:', error);
            notifications.error('Ошибка сохранения данных');
            
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    }

    handleKeydown(e) {
        // Глобальные горячие клавиши
        
        // Ctrl+K или Cmd+K - фокус на поиск
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const searchInput = document.getElementById('global-search');
            if (searchInput) {
                searchInput.focus();
            }
        }
        
        // Escape - закрыть модальные окна
        if (e.key === 'Escape') {
            modal.hide();
        }
    }

    handleConfirmActions(e) {
        const element = e.target.closest('[data-confirm]');
        if (element) {
            e.preventDefault();
            
            const message = element.dataset.confirm;
            if (confirm(message)) {
                // Если это ссылка
                if (element.tagName === 'A') {
                    window.location.href = element.href;
                }
                // Если это форма
                else if (element.tagName === 'FORM') {
                    element.submit();
                }
                // Если это кнопка с onclick
                else if (element.onclick) {
                    element.onclick();
                }
            }
        }
    }

    setupDragAndDrop() {
        // Настройка drag & drop для файлов
        const dropZones = document.querySelectorAll('[data-drop-zone]');
        
        dropZones.forEach(zone => {
            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                zone.classList.add('drag-over');
            });
            
            zone.addEventListener('dragleave', () => {
                zone.classList.remove('drag-over');
            });
            
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('drag-over');
                
                const files = Array.from(e.dataTransfer.files);
                this.handleFileUpload(files, zone);
            });
        });
    }

    async handleFileUpload(files, zone) {
        const uploadUrl = zone.dataset.uploadUrl;
        if (!uploadUrl) {
            notifications.error('URL для загрузки не указан');
            return;
        }

        for (const file of files) {
            try {
                const formData = new FormData();
                formData.append('file', file);
                
                const response = await fetch(uploadUrl, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': this.getCSRFToken(),
                    },
                    body: formData,
                });
                
                if (response.ok) {
                    notifications.success(`Файл ${file.name} загружен успешно`);
                } else {
                    throw new Error('Ошибка загрузки');
                }
                
            } catch (error) {
                notifications.error(`Ошибка загрузки файла ${file.name}`);
            }
        }
    }

    setupAutoSave() {
        // Автосохранение форм в localStorage
        const autoSaveForms = document.querySelectorAll('[data-autosave]');
        
        autoSaveForms.forEach(form => {
            const formId = form.id || form.dataset.autosave;
            
            // Загружаем сохраненные данные
            this.loadFormData(form, formId);
            
            // Сохраняем при изменении
            form.addEventListener('input', debounce(() => {
                this.saveFormData(form, formId);
            }, 1000));
        });
    }

    saveFormData(form, formId) {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        localStorage.setItem(`form_${formId}`, JSON.stringify(data));
    }

    loadFormData(form, formId) {
        const savedData = localStorage.getItem(`form_${formId}`);
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                Object.entries(data).forEach(([name, value]) => {
                    const field = form.querySelector(`[name="${name}"]`);
                    if (field) {
                        field.value = value;
                    }
                });
            } catch (e) {
                console.warn('Ошибка загрузки сохраненных данных формы');
            }
        }
    }

    clearFormData(formId) {
        localStorage.removeItem(`form_${formId}`);
    }

    setupConnectionCheck() {
        // Проверка интернет соединения
        let isOnline = navigator.onLine;
        
        const updateConnectionStatus = () => {
            if (navigator.onLine && !isOnline) {
                notifications.success('Соединение восстановлено');
                isOnline = true;
            } else if (!navigator.onLine && isOnline) {
                notifications.warning('Нет соединения с интернетом', { duration: 0 });
                isOnline = false;
            }
        };
        
        window.addEventListener('online', updateConnectionStatus);
        window.addEventListener('offline', updateConnectionStatus);
    }

    // Утилиты
    getCSRFToken() {
        return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    }

    showLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
        }
    }

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    // Форматирование данных
    formatCurrency(amount) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0
        }).format(amount);
    }

    formatDate(date, options = {}) {
        const defaultOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        
        return new Intl.DateTimeFormat('ru-RU', { ...defaultOptions, ...options })
            .format(new Date(date));
    }

    formatPhone(phone) {
        // Форматирование телефона в российский формат
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 11 && cleaned.startsWith('7')) {
            return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9)}`;
        }
        return phone;
    }
}

// Утилиты
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, wait) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, wait);
        }
    };
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    window.app = new App();
});

// Глобальные функции для удобства
window.showLoading = () => app?.showLoading();
window.hideLoading = () => app?.hideLoading();
window.formatCurrency = (amount) => app?.formatCurrency(amount);
window.formatDate = (date, options) => app?.formatDate(date, options);
window.formatPhone = (phone) => app?.formatPhone(phone);
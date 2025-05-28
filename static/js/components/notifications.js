// Система уведомлений (Toast notifications)
class NotificationManager {
    constructor() {
        this.container = document.getElementById('notifications-container');
        this.notifications = new Map();
        this.idCounter = 0;
    }

    show(message, type = 'info', duration = 5000, options = {}) {
        const id = ++this.idCounter;
        const notification = this.createNotification(id, message, type, options);
        
        this.notifications.set(id, notification);
        this.container.appendChild(notification.element);
        
        // Анимация появления
        requestAnimationFrame(() => {
            notification.element.classList.remove('translate-y-2', 'opacity-0');
            notification.element.classList.add('translate-y-0', 'opacity-100');
        });

        // Автоматическое скрытие
        if (duration > 0) {
            notification.timeout = setTimeout(() => {
                this.hide(id);
            }, duration);
        }

        return id;
    }

    hide(id) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        // Анимация исчезновения
        notification.element.classList.remove('translate-y-0', 'opacity-100');
        notification.element.classList.add('translate-y-2', 'opacity-0');

        setTimeout(() => {
            if (notification.element.parentNode) {
                notification.element.parentNode.removeChild(notification.element);
            }
            if (notification.timeout) {
                clearTimeout(notification.timeout);
            }
            this.notifications.delete(id);
        }, 300);
    }

    createNotification(id, message, type, options) {
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };

        const element = document.createElement('div');
        element.className = `max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden transform translate-y-2 opacity-0 transition-all duration-300 mb-4`;
        
        element.innerHTML = `
            <div class="p-4">
                <div class="flex items-start">
                    <div class="flex-shrink-0">
                        <div class="${colors[type]} rounded-full p-1">
                            <i class="${icons[type]} h-4 w-4 text-white"></i>
                        </div>
                    </div>
                    <div class="ml-3 w-0 flex-1 pt-0.5">
                        <p class="text-sm font-medium text-gray-900">${options.title || this.getDefaultTitle(type)}</p>
                        <p class="text-sm text-gray-500">${message}</p>
                        ${options.action ? `
                            <div class="mt-3 flex space-x-2">
                                <button onclick="${options.action.callback}" class="bg-white rounded-md text-sm font-medium text-${type === 'success' ? 'green' : type === 'error' ? 'red' : type === 'warning' ? 'yellow' : 'blue'}-600 hover:text-${type === 'success' ? 'green' : type === 'error' ? 'red' : type === 'warning' ? 'yellow' : 'blue'}-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${type === 'success' ? 'green' : type === 'error' ? 'red' : type === 'warning' ? 'yellow' : 'blue'}-500">
                                    ${options.action.text}
                                </button>
                            </div>
                        ` : ''}
                    </div>
                    <div class="ml-4 flex-shrink-0 flex">
                        <button onclick="notifications.hide(${id})" class="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                            <span class="sr-only">Закрыть</span>
                            <i class="fas fa-times h-4 w-4"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        return {
            element,
            timeout: null
        };
    }

    getDefaultTitle(type) {
        const titles = {
            success: 'Успешно!',
            error: 'Ошибка!',
            warning: 'Внимание!',
            info: 'Информация'
        };
        return titles[type] || 'Уведомление';
    }

    // Удобные методы для разных типов уведомлений
    success(message, options = {}) {
        return this.show(message, 'success', 3000, options);
    }

    error(message, options = {}) {
        return this.show(message, 'error', 7000, options);
    }

    warning(message, options = {}) {
        return this.show(message, 'warning', 5000, options);
    }

    info(message, options = {}) {
        return this.show(message, 'info', 5000, options);
    }

    // Показать уведомление об ошибке API
    apiError(error, defaultMessage = 'Произошла ошибка') {
        let message = defaultMessage;
        
        if (error instanceof APIError) {
            if (error.data && typeof error.data === 'object') {
                // Обрабатываем ошибки валидации
                const errors = [];
                for (const [field, messages] of Object.entries(error.data)) {
                    if (Array.isArray(messages)) {
                        errors.push(...messages);
                    } else if (typeof messages === 'string') {
                        errors.push(messages);
                    }
                }
                message = errors.length > 0 ? errors.join('; ') : error.message;
            } else {
                message = error.message;
            }
        } else if (error.message) {
            message = error.message;
        }

        return this.error(message);
    }

    // Очистить все уведомления
    clear() {
        this.notifications.forEach((notification, id) => {
            this.hide(id);
        });
    }
}

// Создаем глобальный экземпляр менеджера уведомлений
window.notifications = new NotificationManager();

// Обработчик для показа уведомлений на основе URL параметров или данных сессии
document.addEventListener('DOMContentLoaded', function() {
    // Проверяем наличие сообщений Django
    const messages = document.querySelectorAll('.django-message');
    messages.forEach(message => {
        const type = message.dataset.type || 'info';
        const text = message.textContent.trim();
        notifications.show(text, type);
        message.remove();
    });

    // Проверяем URL параметры для уведомлений
    const urlParams = new URLSearchParams(window.location.search);
    const successMessage = urlParams.get('success');
    const errorMessage = urlParams.get('error');
    
    if (successMessage) {
        notifications.success(decodeURIComponent(successMessage));
        // Убираем параметр из URL
        urlParams.delete('success');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.history.replaceState({}, '', newUrl);
    }
    
    if (errorMessage) {
        notifications.error(decodeURIComponent(errorMessage));
        urlParams.delete('error');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.history.replaceState({}, '', newUrl);
    }
});

// Экспортируем для использования в модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationManager;
}
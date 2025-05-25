// Вспомогательные функции и утилиты

// Работа с датами
const DateUtils = {
    // Форматирование даты
    format(date, format = 'dd.MM.yyyy') {
        if (!date) return '';
        
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        
        return format
            .replace('dd', day)
            .replace('MM', month)
            .replace('yyyy', year)
            .replace('HH', hours)
            .replace('mm', minutes);
    },
    
    // Относительное время (например, "2 часа назад")
    timeAgo(date) {
        const now = new Date();
        const diff = now - new Date(date);
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days} дн. назад`;
        if (hours > 0) return `${hours} ч. назад`;
        if (minutes > 0) return `${minutes} мин. назад`;
        return 'только что';
    },
    
    // Проверка, является ли дата сегодняшней
    isToday(date) {
        const today = new Date();
        const d = new Date(date);
        return d.toDateString() === today.toDateString();
    },
    
    // Добавить дни к дате
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    },
    
    // Получить начало дня
    startOfDay(date) {
        const result = new Date(date);
        result.setHours(0, 0, 0, 0);
        return result;
    },
    
    // Получить конец дня
    endOfDay(date) {
        const result = new Date(date);
        result.setHours(23, 59, 59, 999);
        return result;
    }
};

// Работа с числами и валютой
const NumberUtils = {
    // Форматирование валюты
    formatCurrency(amount, currency = 'RUB') {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(amount);
    },
    
    // Форматирование больших чисел (1.2К, 1.5М)
    formatLargeNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'М';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'К';
        }
        return num.toString();
    },
    
    // Расчет процента
    percentage(part, total) {
        if (total === 0) return 0;
        return ((part / total) * 100).toFixed(1);
    },
    
    // Округление до определенного количества знаков
    round(num, decimals = 2) {
        return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
    }
};

// Работа со строками
const StringUtils = {
    // Обрезка строки с многоточием
    truncate(str, length = 50) {
        if (str.length <= length) return str;
        return str.substring(0, length) + '...';
    },
    
    // Первая буква заглавная
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },
    
    // Форматирование телефона
    formatPhone(phone) {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 11 && cleaned.startsWith('7')) {
            return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9)}`;
        }
        if (cleaned.length === 10) {
            return `+7 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 8)}-${cleaned.slice(8)}`;
        }
        return phone;
    },
    
    // Генерация случайного ID
    generateId(prefix = 'id') {
        return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
    },
    
    // Очистка HTML тегов
    stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }
};

// Работа с массивами
const ArrayUtils = {
    // Удаление дубликатов
    unique(array) {
        return [...new Set(array)];
    },
    
    // Группировка по ключу
    groupBy(array, key) {
        return array.reduce((groups, item) => {
            const group = item[key];
            if (!groups[group]) {
                groups[group] = [];
            }
            groups[group].push(item);
            return groups;
        }, {});
    },
    
    // Сортировка по ключу
    sortBy(array, key, order = 'asc') {
        return array.sort((a, b) => {
            const aVal = a[key];
            const bVal = b[key];
            
            if (order === 'desc') {
                return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
            }
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        });
    },
    
    // Поиск по массиву объектов
    search(array, query, fields) {
        const lowercaseQuery = query.toLowerCase();
        return array.filter(item => {
            return fields.some(field => {
                const value = item[field];
                return value && value.toString().toLowerCase().includes(lowercaseQuery);
            });
        });
    }
};

// Работа с DOM
const DOMUtils = {
    // Создание элемента с атрибутами
    createElement(tag, attributes = {}, content = '') {
        const element = document.createElement(tag);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'innerHTML') {
                element.innerHTML = value;
            } else {
                element.setAttribute(key, value);
            }
        });
        
        if (content) {
            element.textContent = content;
        }
        
        return element;
    },
    
    // Показать/скрыть элемент
    toggle(element, show = null) {
        if (show === null) {
            show = element.classList.contains('hidden');
        }
        
        if (show) {
            element.classList.remove('hidden');
        } else {
            element.classList.add('hidden');
        }
    },
    
    // Анимация изменения высоты
    slideToggle(element, duration = 300) {
        if (element.style.display === 'none' || element.style.height === '0px') {
            element.style.display = 'block';
            element.style.height = 'auto';
            const height = element.offsetHeight;
            element.style.height = '0px';
            element.style.transition = `height ${duration}ms ease`;
            setTimeout(() => {
                element.style.height = height + 'px';
            }, 10);
            setTimeout(() => {
                element.style.height = 'auto';
                element.style.transition = '';
            }, duration);
        } else {
            element.style.transition = `height ${duration}ms ease`;
            element.style.height = element.offsetHeight + 'px';
            setTimeout(() => {
                element.style.height = '0px';
            }, 10);
            setTimeout(() => {
                element.style.display = 'none';
                element.style.transition = '';
            }, duration);
        }
    },
    
    // Скролл к элементу
    scrollTo(element, offset = 0) {
        const elementPosition = element.offsetTop - offset;
        window.scrollTo({
            top: elementPosition,
            behavior: 'smooth'
        });
    }
};

// Работа с localStorage
const StorageUtils = {
    // Сохранение объекта
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Ошибка сохранения в localStorage:', e);
            return false;
        }
    },
    
    // Получение объекта
    get(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : defaultValue;
        } catch (e) {
            console.error('Ошибка чтения из localStorage:', e);
            return defaultValue;
        }
    },
    
    // Удаление
    remove(key) {
        localStorage.removeItem(key);
    },
    
    // Очистка всего хранилища
    clear() {
        localStorage.clear();
    }
};

// Валидация
const ValidationUtils = {
    // Проверка email
    isEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    },
    
    // Проверка телефона (российский формат)
    isPhone(phone) {
        const cleaned = phone.replace(/\D/g, '');
        return cleaned.length >= 10 && cleaned.length <= 11;
    },
    
    // Проверка на пустоту
    isEmpty(value) {
        return value === null || value === undefined || value === '' || 
               (Array.isArray(value) && value.length === 0) ||
               (typeof value === 'object' && Object.keys(value).length === 0);
    },
    
    // Проверка числа
    isNumber(value) {
        return !isNaN(value) && !isNaN(parseFloat(value));
    },
    
    // Проверка диапазона
    inRange(value, min, max) {
        const num = parseFloat(value);
        return num >= min && num <= max;
    }
};

// Работа с URL и параметрами
const URLUtils = {
    // Получение параметра из URL
    getParam(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    },
    
    // Установка параметра в URL
    setParam(name, value) {
        const url = new URL(window.location);
        url.searchParams.set(name, value);
        window.history.pushState({}, '', url);
    },
    
    // Удаление параметра из URL
    removeParam(name) {
        const url = new URL(window.location);
        url.searchParams.delete(name);
        window.history.pushState({}, '', url);
    },
    
    // Построение URL с параметрами
    buildUrl(base, params = {}) {
        const url = new URL(base, window.location.origin);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                url.searchParams.set(key, value);
            }
        });
        return url.toString();
    }
};

// Работа с файлами
const FileUtils = {
    // Получение расширения файла
    getExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    },
    
    // Проверка типа файла
    isImage(filename) {
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        return imageExtensions.includes(this.getExtension(filename));
    },
    
    // Форматирование размера файла
    formatSize(bytes) {
        if (bytes === 0) return '0 Б';
        
        const k = 1024;
        const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    // Скачивание файла
    download(data, filename, type = 'application/octet-stream') {
        const blob = new Blob([data], { type });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    }
};

// Дебаунс и троттлинг
const TimingUtils = {
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    throttle(func, wait) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, wait);
            }
        };
    },
    
    // Задержка
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

// Экспорт в глобальную область видимости
window.DateUtils = DateUtils;
window.NumberUtils = NumberUtils;
window.StringUtils = StringUtils;
window.ArrayUtils = ArrayUtils;
window.DOMUtils = DOMUtils;
window.StorageUtils = StorageUtils;
window.ValidationUtils = ValidationUtils;
window.URLUtils = URLUtils;
window.FileUtils = FileUtils;
window.TimingUtils = TimingUtils;

// Экспорт для модулей
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DateUtils,
        NumberUtils,
        StringUtils,
        ArrayUtils,
        DOMUtils,
        StorageUtils,
        ValidationUtils,
        URLUtils,
        FileUtils,
        TimingUtils
    };
}
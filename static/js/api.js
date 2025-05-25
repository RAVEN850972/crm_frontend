// API Client для работы с Django backend
class APIClient {
    constructor() {
        this.baseURL = '/api/';
        this.csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.csrfToken,
            },
            credentials: 'include',
        };

        const config = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers,
            },
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new APIError(response.status, errorData.detail || response.statusText, errorData);
            }

            // Для DELETE запросов может не быть контента
            if (response.status === 204) {
                return null;
            }

            return await response.json();
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError(0, 'Network error', { error: error.message });
        }
    }

    // GET запрос
    async get(endpoint, params = {}) {
        const searchParams = new URLSearchParams(params);
        const url = searchParams.toString() ? `${endpoint}?${searchParams}` : endpoint;
        
        return this.request(url, {
            method: 'GET',
        });
    }

    // POST запрос
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // PUT запрос
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    // PATCH запрос
    async patch(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    // DELETE запрос
    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE',
        });
    }

    // Клиенты
    async getClients(params = {}) {
        return this.get('clients/', params);
    }

    async getClient(id) {
        return this.get(`clients/${id}/`);
    }

    async createClient(data) {
        return this.post('clients/', data);
    }

    async updateClient(id, data) {
        return this.put(`clients/${id}/`, data);
    }

    async deleteClient(id) {
        return this.delete(`clients/${id}/`);
    }

    // Заказы
    async getOrders(params = {}) {
        return this.get('orders/', params);
    }

    async getOrder(id) {
        return this.get(`orders/${id}/`);
    }

    async createOrder(data) {
        return this.post('orders/', data);
    }

    async updateOrder(id, data) {
        return this.put(`orders/${id}/`, data);
    }

    async deleteOrder(id) {
        return this.delete(`orders/${id}/`);
    }

    async addOrderItem(orderId, data) {
        return this.post(`orders/${orderId}/add_item/`, data);
    }

    async changeOrderStatus(orderId, status) {
        return this.post(`orders/${orderId}/change_status/`, { status });
    }

    // Услуги
    async getServices(params = {}) {
        return this.get('services/', params);
    }

    async getService(id) {
        return this.get(`services/${id}/`);
    }

    async createService(data) {
        return this.post('services/', data);
    }

    async updateService(id, data) {
        return this.put(`services/${id}/`, data);
    }

    async deleteService(id) {
        return this.delete(`services/${id}/`);
    }

    // Пользователи
    async getUsers(params = {}) {
        return this.get('users/', params);
    }

    async getUser(id) {
        return this.get(`users/${id}/`);
    }

    async createUser(data) {
        return this.post('users/', data);
    }

    async updateUser(id, data) {
        return this.put(`users/${id}/`, data);
    }

    async deleteUser(id) {
        return this.delete(`users/${id}/`);
    }

    // Финансы
    async getTransactions(params = {}) {
        return this.get('transactions/', params);
    }

    async createTransaction(data) {
        return this.post('transactions/', data);
    }

    async getFinanceBalance() {
        return this.get('finance/balance/');
    }

    async getFinanceStats() {
        return this.get('finance/stats/');
    }

    async calculateSalary(userId, params = {}) {
        return this.get(`finance/calculate-salary/${userId}/`, params);
    }

    // Календарь
    async getCalendar(params = {}) {
        return this.get('calendar/', params);
    }

    async createSchedule(data) {
        return this.post('calendar/', data);
    }

    async updateSchedule(id, data) {
        return this.put(`calendar/schedule/${id}/`, data);
    }

    async deleteSchedule(id) {
        return this.delete(`calendar/schedule/${id}/`);
    }

    async startWork(scheduleId) {
        return this.post(`calendar/schedule/${scheduleId}/start/`);
    }

    async completeWork(scheduleId) {
        return this.post(`calendar/schedule/${scheduleId}/complete/`);
    }

    async checkAvailability(data) {
        return this.post('calendar/availability/check/', data);
    }

    async optimizeRoute(data) {
        return this.post('calendar/routes/optimize/', data);
    }

    async getRoute(params = {}) {
        return this.get('calendar/routes/', params);
    }

    // Статистика
    async getDashboardStats() {
        return this.get('dashboard/stats/');
    }

    async getClientsStatsBySource() {
        return this.get('clients/stats/by-source/');
    }

    async getOrdersStatsByStatus() {
        return this.get('orders/stats/by-status/');
    }

    async getOrdersStatsByManager() {
        return this.get('orders/stats/by-manager/');
    }

    // Модальные окна
    async getModalData(type, id = null) {
        const endpoint = id ? `modal/${type}/${id}/` : `modal/${type}/`;
        return this.get(endpoint);
    }

    async submitModalData(type, data, id = null) {
        const endpoint = id ? `modal/${type}/${id}/` : `modal/${type}/`;
        return id ? this.put(endpoint, data) : this.post(endpoint, data);
    }

    // Экспорт
    async exportClients() {
        return this.downloadFile('export/clients/');
    }

    async exportOrders() {
        return this.downloadFile('export/orders/');
    }

    async exportFinance() {
        return this.downloadFile('export/finance/');
    }

    // Скачивание файлов
    async downloadFile(endpoint) {
        const url = `${this.baseURL}${endpoint}`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'X-CSRFToken': this.csrfToken,
                },
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Ошибка скачивания файла');
            }

            const blob = await response.blob();
            const filename = this.getFilenameFromResponse(response) || 'export.xlsx';
            
            // Создаем ссылку для скачивания
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
            
            return true;
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            throw error;
        }
    }

    getFilenameFromResponse(response) {
        const contentDisposition = response.headers.get('Content-Disposition');
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="(.+)"/);
            return match ? match[1] : null;
        }
        return null;
    }
}

// Класс для ошибок API
class APIError extends Error {
    constructor(status, message, data = {}) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.data = data;
    }
}

// Создаем глобальный экземпляр API клиента
window.api = new APIClient();

// Экспортируем для использования в модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { APIClient, APIError };
}
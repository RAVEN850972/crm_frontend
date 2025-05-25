# CRM Кондиционеры - Полная API документация

## Содержание

1. [Общая информация](#общая-информация)
2. [Аутентификация и авторизация](#аутентификация-и-авторизация)
3. [Пользователи](#пользователи)
4. [Клиенты](#клиенты)
5. [Услуги](#услуги)
6. [Заказы](#заказы)
7. [Финансы](#финансы)
8. [Календарь и расписание](#календарь-и-расписание)
9. [Статистика и аналитика](#статистика-и-аналитика)
10. [Модальные окна](#модальные-окна)
11. [Экспорт данных](#экспорт-данных)
12. [Примеры использования](#примеры-использования)
13. [Обработка ошибок](#обработка-ошибок)

---

## Общая информация

### Базовые параметры
- **Base URL**: `http://localhost:8000/api/`
- **Формат данных**: JSON
- **Кодировка**: UTF-8
- **Аутентификация**: Session-based / JWT
- **CSRF Protection**: Требуется для всех POST/PUT/DELETE запросов

### Заголовки запросов
```http
Content-Type: application/json
X-CSRFToken: <csrf_token>
Authorization: Bearer <jwt_token> (опционально)
```

### Пагинация
Все списковые endpoint'ы поддерживают пагинацию:

**Параметры запроса:**
- `page` - номер страницы (по умолчанию 1)
- `page_size` - размер страницы (по умолчанию 20, максимум 100)

**Формат ответа:**
```json
{
  "count": 150,
  "next": "http://localhost:8000/api/orders/?page=2",
  "previous": null,
  "results": [...]
}
```

### Фильтрация и поиск
- **Фильтрация**: `?field_name=value&another_field=value`
- **Поиск**: `?search=текст`
- **Сортировка**: `?ordering=field_name` (по возрастанию) или `?ordering=-field_name` (по убыванию)

### Роли пользователей
- **owner** - Владелец (полный доступ)
- **manager** - Менеджер (управление заказами и клиентами)
- **installer** - Монтажник (просмотр расписания, отметки о работе)

---

## Аутентификация и авторизация

### Вход в систему

#### Стандартная форма входа
```http
POST /user_accounts/login/
Content-Type: application/x-www-form-urlencoded

username=manager1&password=password123
```

**Ответ (успех):**
```http
HTTP/1.1 302 Found
Location: /
Set-Cookie: sessionid=...; csrftoken=...
```

#### AJAX вход
```http
POST /user_accounts/login/
Content-Type: application/json
X-Requested-With: XMLHttpRequest

{
  "username": "manager1",
  "password": "password123"
}
```

**Ответ (успех):**
```json
{
  "success": true,
  "redirect": "/",
  "user": {
    "id": 1,
    "username": "manager1",
    "full_name": "Иван Иванов",
    "role": "manager"
  }
}
```

**Ответ (ошибка):**
```json
{
  "success": false,
  "error": "Неверное имя пользователя или пароль"
}
```

### Выход из системы
```http
POST /user_accounts/logout/
```

### Получение информации о текущем пользователе
Информация о пользователе доступна в meta-теге:
```html
<meta name="current-user" content='{"id": 1, "username": "manager1", "role": "manager"}'>
```

---

## Пользователи

### Список пользователей
```http
GET /api/users/
```

**Параметры запроса:**
- `role` - фильтр по роли (owner, manager, installer)
- `search` - поиск по имени/email/username
- `is_active` - фильтр по активности (true/false)

**Пример запроса:**
```http
GET /api/users/?role=manager&search=иван
```

**Ответ:**
```json
{
  "count": 5,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "username": "manager1",
      "first_name": "Иван",
      "last_name": "Иванов",
      "email": "ivan@example.com",
      "role": "manager",
      "phone": "+7900123456",
      "is_active": true,
      "date_joined": "2025-01-15T10:30:00Z"
    }
  ]
}
```

### Создание пользователя
```http
POST /api/users/
Content-Type: application/json

{
  "username": "new_manager",
  "first_name": "Петр",
  "last_name": "Петров",
  "email": "petr@example.com",
  "role": "manager",
  "phone": "+7900654321",
  "password": "securepassword"
}
```

**Ответ:**
```json
{
  "id": 5,
  "username": "new_manager",
  "first_name": "Петр",
  "last_name": "Петров",
  "email": "petr@example.com",
  "role": "manager",
  "phone": "+7900654321",
  "is_active": true,
  "date_joined": "2025-05-24T15:30:00Z"
}
```

### Обновление пользователя
```http
PUT /api/users/{id}/
Content-Type: application/json

{
  "first_name": "Петр",
  "last_name": "Петров",
  "email": "new_email@example.com",
  "phone": "+7900999888"
}
```

### Частичное обновление пользователя
```http
PATCH /api/users/{id}/
Content-Type: application/json

{
  "phone": "+7900999888"
}
```

### Получение пользователя
```http
GET /api/users/{id}/
```

### Удаление пользователя
```http
DELETE /api/users/{id}/
```

**Ответ:**
```http
HTTP/1.1 204 No Content
```

---

## Клиенты

### Список клиентов
```http
GET /api/clients/
```

**Параметры запроса:**
- `source` - фильтр по источнику (avito, vk, website, recommendations, other)
- `search` - поиск по имени/телефону/адресу
- `created_at__gte` - клиенты созданные после даты (YYYY-MM-DD)
- `created_at__lte` - клиенты созданные до даты (YYYY-MM-DD)

**Пример запроса:**
```http
GET /api/clients/?source=avito&search=иванов&page_size=10
```

**Ответ:**
```json
{
  "count": 25,
  "next": "http://localhost:8000/api/clients/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "name": "Петр Иванов",
      "address": "г. Москва, ул. Ленина, 10, кв. 5",
      "phone": "+7900123456",
      "source": "avito",
      "created_at": "2025-05-24T10:30:00Z"
    }
  ]
}
```

### Создание клиента
```http
POST /api/clients/
Content-Type: application/json

{
  "name": "Новый Клиент",
  "address": "г. Москва, ул. Новая, 5",
  "phone": "+7900654321",
  "source": "website"
}
```

### Обновление клиента
```http
PUT /api/clients/{id}/
Content-Type: application/json

{
  "name": "Обновленное Имя",
  "address": "г. Москва, ул. Обновленная, 10",
  "phone": "+7900999888",
  "source": "recommendations"
}
```

### Получение клиента
```http
GET /api/clients/{id}/
```

### Удаление клиента
```http
DELETE /api/clients/{id}/
```

### Статистика клиентов по источникам
```http
GET /api/clients/stats/by-source/
```

**Ответ:**
```json
{
  "sources": [
    {
      "source": "avito",
      "source_display": "Авито",
      "count": 15
    },
    {
      "source": "website",
      "source_display": "Сайт",
      "count": 8
    },
    {
      "source": "vk",
      "source_display": "ВК",
      "count": 12
    }
  ]
}
```

### Статистика клиентов по месяцам
```http
GET /api/clients/stats/by-month/
```

**Ответ:**
```json
{
  "months": [
    {
      "month": "2025-04",
      "count": 12
    },
    {
      "month": "2025-05",
      "count": 18
    }
  ]
}
```

---

## Услуги

### Список услуг
```http
GET /api/services/
```

**Параметры запроса:**
- `category` - фильтр по категории (conditioner, installation, dismantling, maintenance, additional)
- `search` - поиск по названию

**Ответ:**
```json
{
  "results": [
    {
      "id": 1,
      "name": "Кондиционер LG 12000 BTU",
      "cost_price": "25000.00",
      "selling_price": "35000.00",
      "category": "conditioner",
      "category_display": "Кондиционер",
      "created_at": "2025-05-01T12:00:00Z"
    },
    {
      "id": 2,
      "name": "Монтаж сплит-системы",
      "cost_price": "3000.00",
      "selling_price": "5000.00",
      "category": "installation",
      "category_display": "Монтаж",
      "created_at": "2025-05-01T12:05:00Z"
    }
  ]
}
```

### Создание услуги
```http
POST /api/services/
Content-Type: application/json

{
  "name": "Обслуживание кондиционера",
  "cost_price": "1500.00",
  "selling_price": "3000.00",
  "category": "maintenance"
}
```

### Статистика услуг по категориям
```http
GET /api/services/stats/by-category/
```

**Ответ:**
```json
{
  "categories": [
    {
      "category": "conditioner",
      "category_display": "Кондиционер",
      "count": 25
    },
    {
      "category": "installation",
      "category_display": "Монтаж",
      "count": 5
    }
  ]
}
```

### Популярные услуги
```http
GET /api/services/stats/popular/
```

**Ответ:**
```json
{
  "popular_services": [
    {
      "service_id": 1,
      "service_name": "Монтаж кондиционера",
      "category": "installation",
      "category_display": "Монтаж",
      "count": 45
    },
    {
      "service_id": 2,
      "service_name": "Кондиционер LG",
      "category": "conditioner",
      "category_display": "Кондиционер",
      "count": 32
    }
  ]
}
```

---

## Заказы

### Список заказов
```http
GET /api/orders/
```

**Параметры запроса:**
- `status` - фильтр по статусу (new, in_progress, completed)
- `manager` - ID менеджера
- `client` - ID клиента
- `installers` - ID монтажника
- `search` - поиск по имени клиента или ID заказа
- `created_at__gte` - заказы созданные после даты
- `completed_at__gte` - заказы завершенные после даты

**Пример запроса:**
```http
GET /api/orders/?status=new&manager=2&search=иванов
```

**Ответ:**
```json
{
  "count": 45,
  "results": [
    {
      "id": 1,
      "client": 1,
      "client_name": "Петр Иванов",
      "client_phone": "+7900123456",
      "client_address": "г. Москва, ул. Ленина, 10",
      "manager": 2,
      "manager_name": "Иван Менеджеров",
      "status": "new",
      "status_display": "Новый",
      "installers": [3, 4],
      "installers_names": [
        {"id": 3, "name": "Алексей Монтажников"},
        {"id": 4, "name": "Михаил Установщиков"}
      ],
      "total_cost": "45000.00",
      "created_at": "2025-05-24T10:00:00Z",
      "completed_at": null,
      "items": [
        {
          "id": 1,
          "service": 1,
          "service_name": "Кондиционер LG 12000 BTU",
          "service_category": "conditioner",
          "service_category_display": "Кондиционер",
          "service_cost_price": "25000.00",
          "price": "35000.00",
          "seller": 2,
          "seller_name": "Иван Менеджеров",
          "created_at": "2025-05-24T10:05:00Z"
        },
        {
          "id": 2,
          "service": 2,
          "service_name": "Монтаж сплит-системы",
          "service_category": "installation",
          "service_category_display": "Монтаж",
          "service_cost_price": "3000.00",
          "price": "10000.00",
          "seller": 2,
          "seller_name": "Иван Менеджеров",
          "created_at": "2025-05-24T10:06:00Z"
        }
      ]
    }
  ]
}
```

### Создание заказа
```http
POST /api/orders/
Content-Type: application/json

{
  "client": 1,
  "manager": 2,
  "status": "new",
  "installers": [3, 4]
}
```

### Получение заказа
```http
GET /api/orders/{id}/
```

### Обновление заказа
```http
PUT /api/orders/{id}/
Content-Type: application/json

{
  "client": 1,
  "manager": 2,
  "status": "in_progress",
  "installers": [3]
}
```

### Добавление позиции в заказ
```http
POST /api/orders/{order_id}/add_item/
Content-Type: application/json

{
  "service": 1,
  "price": "35000.00",
  "seller": 2
}
```

**Ответ:**
```json
{
  "id": 1,
  "client": 1,
  "total_cost": "45000.00",
  "items": [
    {
      "id": 3,
      "service": 1,
      "service_name": "Кондиционер LG 12000 BTU",
      "price": "35000.00",
      "seller": 2,
      "seller_name": "Иван Менеджеров"
    }
  ]
}
```

### Изменение статуса заказа
```http
POST /api/orders/{order_id}/change_status/
Content-Type: application/json

{
  "status": "completed"
}
```

### Статистика заказов по статусам
```http
GET /api/orders/stats/by-status/
```

**Ответ:**
```json
{
  "statuses": [
    {
      "status": "new",
      "status_display": "Новый",
      "count": 15
    },
    {
      "status": "in_progress",
      "status_display": "В работе",
      "count": 8
    },
    {
      "status": "completed",
      "status_display": "Завершен",
      "count": 120
    }
  ]
}
```

### Статистика заказов по месяцам
```http
GET /api/orders/stats/by-month/
```

**Ответ:**
```json
{
  "months": [
    {
      "month": "2025-04",
      "count": 18,
      "revenue": 485000.00
    },
    {
      "month": "2025-05",
      "count": 25,
      "revenue": 675000.00
    }
  ]
}
```

### Статистика заказов по менеджерам
```http
GET /api/orders/stats/by-manager/
```

**Ответ:**
```json
{
  "managers": [
    {
      "manager_id": 2,
      "manager_name": "Иван Менеджеров",
      "orders_count": 25,
      "revenue": 675000.00
    },
    {
      "manager_id": 3,
      "manager_name": "Петр Продавцов",
      "orders_count": 18,
      "revenue": 485000.00
    }
  ]
}
```

---

## Финансы

### Список транзакций
```http
GET /api/transactions/
```

**Параметры запроса:**
- `type` - фильтр по типу (income, expense)
- `search` - поиск по описанию
- `created_at__gte` - транзакции после даты
- `order` - транзакции связанные с заказом

**Ответ:**
```json
{
  "results": [
    {
      "id": 1,
      "type": "income",
      "type_display": "Доход",
      "amount": "45000.00",
      "description": "Доход от завершения заказа #1 - Петр Иванов",
      "order": 1,
      "order_display": "Заказ #1 - Петр Иванов",
      "created_at": "2025-05-24T15:30:00Z"
    },
    {
      "id": 2,
      "type": "expense",
      "type_display": "Расход",
      "amount": "28000.00",
      "description": "Себестоимость заказа #1 - Петр Иванов",
      "order": 1,
      "order_display": "Заказ #1 - Петр Иванов",
      "created_at": "2025-05-24T15:30:00Z"
    }
  ]
}
```

### Создание транзакции
```http
POST /api/transactions/
Content-Type: application/json

{
  "type": "expense",
  "amount": "5000.00",
  "description": "Расходы на материалы",
  "order": null
}
```

### Баланс компании
```http
GET /api/finance/balance/
```

**Ответ:**
```json
{
  "balance": 325650.50,
  "monthly_stats": [
    {
      "month": "2025-03",
      "income": 120000.00,
      "expense": 65000.00,
      "profit": 55000.00
    },
    {
      "month": "2025-04",
      "income": 180000.00,
      "expense": 85000.00,
      "profit": 95000.00
    },
    {
      "month": "2025-05",
      "income": 225000.00,
      "expense": 98000.00,
      "profit": 127000.00
    }
  ]
}
```

### Расширенная финансовая статистика
```http
GET /api/finance/stats/
```

**Параметры запроса:**
- `days` - количество дней для анализа (по умолчанию 30)

**Ответ:**
```json
{
  "income_this_month": 225000.00,
  "expense_this_month": 98000.00,
  "profit_this_month": 127000.00,
  "daily_stats": [
    {
      "date": "2025-05-23",
      "income": 15000.00,
      "expense": 3500.00,
      "profit": 11500.00
    },
    {
      "date": "2025-05-24",
      "income": 45000.00,
      "expense": 28000.00,
      "profit": 17000.00
    }
  ]
}
```

### Расчет зарплаты
```http
GET /api/finance/calculate-salary/{user_id}/
```

**Параметры запроса:**
- `start_date` - начальная дата (YYYY-MM-DD)
- `end_date` - конечная дата (YYYY-MM-DD)

**Ответ для монтажника:**
```json
{
  "salary": {
    "installation_pay": 15000.00,
    "additional_pay": 2500.00,
    "penalties": 0.00,
    "total_salary": 17500.00,
    "completed_orders_count": 10,
    "additional_services_count": 5
  }
}
```

**Ответ для менеджера:**
```json
{
  "salary": {
    "fixed_salary": 30000.00,
    "orders_pay": 5000.00,
    "conditioner_pay": 8000.00,
    "additional_pay": 3000.00,
    "total_salary": 46000.00,
    "completed_orders_count": 20,
    "conditioner_sales_count": 8,
    "additional_sales_count": 6
  }
}
```

**Ответ для владельца:**
```json
{
  "salary": {
    "installation_pay": 45000.00,
    "total_revenue": 675000.00,
    "total_cost_price": 385000.00,
    "installers_pay": 95000.00,
    "managers_pay": 76000.00,
    "remaining_profit": 74000.00,
    "total_salary": 119000.00,
    "completed_orders_count": 30
  }
}
```

### Выплаты зарплат
```http
GET /api/salary-payments/
```

**Параметры запроса:**
- `user` - ID пользователя
- `period_start__gte` - период начиная с даты
- `period_end__lte` - период до даты

**Ответ:**
```json
{
  "results": [
    {
      "id": 1,
      "user": 3,
      "user_name": "Алексей Монтажников",
      "amount": "17500.00",
      "period_start": "2025-05-01",
      "period_end": "2025-05-31",
      "created_at": "2025-06-01T10:00:00Z"
    }
  ]
}
```

### Создание выплаты зарплаты
```http
POST /api/salary-payments/
Content-Type: application/json

{
  "user": 3,
  "amount": "17500.00",
  "period_start": "2025-05-01",
  "period_end": "2025-05-31"
}
```

---

## Календарь и расписание

### Получение календаря
```http
GET /api/calendar/
```

**Параметры запроса:**
- `start_date` - начальная дата (YYYY-MM-DD)
- `end_date` - конечная дата (YYYY-MM-DD)
- `installer_id` - ID монтажника (опционально)

**Пример запроса:**
```http
GET /api/calendar/?start_date=2025-05-24&end_date=2025-05-30&installer_id=3
```

**Ответ:**
```json
{
  "calendar": {
    "2025-05-24": [
      {
        "id": 1,
        "order_id": 1,
        "client_name": "Петр Иванов",
        "client_address": "г. Москва, ул. Ленина, 10",
        "client_phone": "+7900123456",
        "manager": "Иван Менеджеров",
        "start_time": "09:00",
        "end_time": "12:00",
        "status": "scheduled",
        "status_display": "Запланировано",
        "priority": "normal",
        "priority_display": "Обычный",
        "installers": [
          {"id": 3, "name": "Алексей Монтажников"}
        ],
        "notes": "Третий этаж, домофон 123",
        "is_overdue": false,
        "estimated_duration": "3:00:00"
      }
    ],
    "2025-05-25": [
      {
        "id": 2,
        "order_id": 5,
        "client_name": "Мария Петрова",
        "client_address": "г. Москва, ул. Пушкина, 15",
        "client_phone": "+7900654321",
        "manager": "Иван Менеджеров",
        "start_time": "14:00",
        "end_time": "17:00",
        "status": "scheduled",
        "status_display": "Запланировано",
        "priority": "high",
        "priority_display": "Высокий",
        "installers": [
          {"id": 3, "name": "Алексей Монтажников"},
          {"id": 4, "name": "Михаил Установщиков"}
        ],
        "notes": "Срочный заказ",
        "is_overdue": false,
        "estimated_duration": "2:30:00"
      }
    ]
  },
  "total_schedules": 15
}
```

### Создание расписания
```http
POST /api/calendar/
Content-Type: application/json

{
  "order_id": 1,
  "scheduled_date": "2025-05-25",
  "start_time": "10:00",
  "end_time": "13:00",
  "installer_ids": [3, 4],
  "priority": "high",
  "notes": "Срочный монтаж",
  "estimated_duration": "2:30:00"
}
```

**Ответ:**
```json
{
  "id": 5,
  "order": 1,
  "scheduled_date": "2025-05-25",
  "scheduled_time_start": "10:00:00",
  "scheduled_time_end": "13:00:00",
  "installers": [3, 4],
  "status": "scheduled",
  "priority": "high",
  "estimated_duration": "2:30:00",
  "notes": "Срочный монтаж",
  "created_at": "2025-05-24T16:00:00Z"
}
```

### Детали расписания
```http
GET /api/calendar/schedule/{schedule_id}/
```

### Обновление расписания
```http
PUT /api/calendar/schedule/{schedule_id}/
Content-Type: application/json

{
  "scheduled_date": "2025-05-26",
  "start_time": "11:00",
  "end_time": "14:00",
  "priority": "urgent",
  "notes": "Изменен приоритет"
}
```

### Удаление расписания
```http
DELETE /api/calendar/schedule/{schedule_id}/
```

### Начало работы
```http
POST /api/calendar/schedule/{schedule_id}/start/
```

**Ответ:**
```json
{
  "message": "Работа начата",
  "actual_start_time": "2025-05-24T09:15:00Z",
  "status": "in_progress"
}
```

### Завершение работы
```http
POST /api/calendar/schedule/{schedule_id}/complete/
```

**Ответ:**
```json
{
  "message": "Работа завершена",
  "actual_end_time": "2025-05-24T11:45:00Z",
  "duration": "2:30:00",
  "status": "completed"
}
```

### Проверка доступности монтажников
```http
POST /api/calendar/availability/check/
Content-Type: application/json

{
  "installer_ids": [3, 4],
  "date": "2025-05-25",
  "start_time": "10:00",
  "end_time": "13:00"
}
```

**Ответ:**
```json
{
  "available": false,
  "conflicts": ["Алексей Монтажников"],
  "message": "Конфликты: Алексей Монтажников"
}
```

### Расписание конкретного монтажника
```http
GET /api/calendar/installer/{installer_id}/schedule/
```

**Параметры запроса:**
- `start_date` - начальная дата
- `end_date` - конечная дата

**Ответ:**
```json
{
  "installer_id": 3,
  "start_date": "2025-05-24",
  "end_date": "2025-05-30",
  "schedule": [
    {
      "id": 1,
      "order_id": 1,
      "client_name": "Петр Иванов",
      "client_address": "г. Москва, ул. Ленина, 10",
      "client_phone": "+7900123456",
      "date": "2025-05-24",
      "start_time": "09:00",
      "end_time": "12:00",
      "status": "scheduled",
      "priority": "normal",
      "notes": "Третий этаж"
    }
  ]
}
```

### Оптимизация маршрута
```http
GET /api/calendar/routes/
```

**Параметры запроса:**
- `installer_id` - ID монтажника
- `date` - дата (YYYY-MM-DD)

**Ответ:**
```json
{
  "route_id": 1,
  "installer": "Алексей Монтажников",
  "date": "2025-05-25",
  "total_distance": 45.7,
  "total_travel_time": "2:15:00",
  "is_optimized": true,
  "start_location": "Склад компании",
  "points": [
    {
      "sequence": 1,
      "arrival_time": "08:30",
      "departure_time": "11:00",
      "client_name": "Петр Иванов",
      "client_address": "г. Москва, ул. Ленина, 10",
      "client_phone": "+7900123456",
      "order_id": 1,
      "status": "scheduled",
      "priority": "high",
      "travel_distance": 12.5,
      "travel_time": "0:25:00"
    },
    {
      "sequence": 2,
      "arrival_time": "11:45",
      "departure_time": "14:30",
      "client_name": "Мария Петрова",
      "client_address": "г. Москва, ул. Пушкина, 15",
      "client_phone": "+7900654321",
      "order_id": 5,
      "status": "scheduled",
      "priority": "normal",
      "travel_distance": 18.2,
      "travel_time": "0:35:00"
    }
  ]
}
```

### Создание оптимизированного маршрута
```http
POST /api/calendar/routes/optimize/
Content-Type: application/json

{
  "installer_id": 3,
  "date": "2025-05-25"
}
```

**Ответ:**
```json
{
  "message": "Маршрут успешно оптимизирован",
  "route": {
    "route_id": 1,
    "installer": "Алексей Монтажников",
    "date": "2025-05-25",
    "total_distance": 45.7,
    "total_travel_time": "2:15:00",
    "is_optimized": true,
    "points": [...]
  }
}
```

---

## Статистика и аналитика

### Статистика дашборда
```http
GET /api/dashboard/stats/
```

**Ответ:**
```json
{
  "total_orders": 156,
  "completed_orders": 120,
  "orders_this_month": 25,
  "total_clients": 89,
  "clients_this_month": 12,
  "company_balance": 325650.50,
  "income_this_month": 225000.00,
  "expense_this_month": 98000.00,
  "orders_by_month": [
    {
      "month": "2025-04",
      "count": 18,
      "revenue": 485000.00
    },
    {
      "month": "2025-05",
      "count": 25,
      "revenue": 675000.00
    }
  ],
  "top_managers": [
    {
      "id": 2,
      "name": "Иван Менеджеров",
      "orders_count": 25,
      "revenue": 675000.00
    },
    {
      "id": 3,
      "name": "Петр Продавцов",
      "orders_count": 18,
      "revenue": 485000.00
    }
  ],
  "recent_orders": [
    {
      "id": 156,
      "client_name": "Новый Клиент",
      "total_cost": "45000.00",
      "status": "new",
      "status_display": "Новый",
      "created_at": "2025-05-24T14:30:00Z"
    }
  ]
}
```

---

## Модальные окна

Система предоставляет специальные API для работы с модальными окнами, которые загружают все необходимые данные для форм.

### Данные для модального окна клиента

#### Создание клиента
```http
GET /api/modal/client/
```

**Ответ:**
```json
{
  "sources": [
    {"value": "avito", "label": "Авито"},
    {"value": "vk", "label": "ВК"},
    {"value": "website", "label": "Сайт"},
    {"value": "recommendations", "label": "Рекомендации"},
    {"value": "other", "label": "Другое"}
  ]
}
```

#### Редактирование клиента
```http
GET /api/modal/client/{client_id}/
```

**Ответ:**
```json
{
  "id": 1,
  "name": "Петр Иванов",
  "address": "г. Москва, ул. Ленина, 10",
  "phone": "+7900123456",
  "source": "avito",
  "created_at": "2025-05-24T10:30:00Z"
}
```

#### Создание/обновление клиента через модальное окно
```http
POST /api/modal/client/
Content-Type: application/json

{
  "name": "Новый Клиент",
  "address": "г. Москва, ул. Новая, 5",
  "phone": "+7900654321",
  "source": "website"
}
```

```http
PUT /api/modal/client/{client_id}/
Content-Type: application/json

{
  "name": "Обновленное Имя",
  "phone": "+7900999888"
}
```

### Данные для модального окна заказа

#### Создание заказа
```http
GET /api/modal/order/
```

**Ответ:**
```json
{
  "clients": [
    {"id": 1, "name": "Петр Иванов", "phone": "+7900123456"},
    {"id": 2, "name": "Мария Петрова", "phone": "+7900654321"}
  ],
  "managers": [
    {"id": 2, "first_name": "Иван", "last_name": "Менеджеров"},
    {"id": 3, "first_name": "Петр", "last_name": "Продавцов"}
  ],
  "installers": [
    {"id": 4, "first_name": "Алексей", "last_name": "Монтажников"},
    {"id": 5, "first_name": "Михаил", "last_name": "Установщиков"}
  ],
  "statuses": [
    {"value": "new", "label": "Новый"},
    {"value": "in_progress", "label": "В работе"},
    {"value": "completed", "label": "Завершен"}
  ]
}
```

#### Редактирование заказа
```http
GET /api/modal/order/{order_id}/
```

**Ответ:**
```json
{
  "order": {
    "id": 1,
    "client": 1,
    "client_name": "Петр Иванов",
    "manager": 2,
    "status": "new",
    "installers": [4, 5],
    "total_cost": "45000.00"
  },
  "items": [
    {
      "id": 1,
      "service": 1,
      "service_name": "Кондиционер LG",
      "price": "35000.00",
      "seller": 2,
      "seller_name": "Иван Менеджеров"
    }
  ],
  "clients": [...],
  "managers": [...],
  "installers": [...],
  "statuses": [...],
  "services": [...],
  "sellers": [...]
}
```

### Работа с позициями заказа в модальном окне

#### Получение данных для добавления позиции
```http
GET /api/modal/order/{order_id}/items/
```

**Ответ:**
```json
{
  "order": {
    "id": 1,
    "client_name": "Петр Иванов",
    "total_cost": "35000.00"
  },
  "services": [
    {
      "id": 1,
      "name": "Кондиционер LG 12000 BTU",
      "category": "conditioner",
      "category_display": "Кондиционер",
      "selling_price": "35000.00"
    },
    {
      "id": 2,
      "name": "Монтаж сплит-системы",
      "category": "installation",
      "category_display": "Монтаж", 
      "selling_price": "10000.00"
    }
  ],
  "sellers": [
    {"id": 2, "first_name": "Иван", "last_name": "Менеджеров", "role": "manager"},
    {"id": 4, "first_name": "Алексей", "last_name": "Монтажников", "role": "installer"}
  ]
}
```

#### Добавление позиции в заказ
```http
POST /api/modal/order/{order_id}/items/
Content-Type: application/json

{
  "service": 1,
  "price": "35000.00",
  "seller": 2
}
```

**Ответ:**
```json
{
  "item": {
    "id": 5,
    "order": 1,
    "service": 1,
    "price": "35000.00",
    "seller": 2,
    "created_at": "2025-05-24T16:30:00Z",
    "service_name": "Кондиционер LG 12000 BTU",
    "service_category": "conditioner",
    "service_category_display": "Кондиционер",
    "service_cost_price": "25000.00",
    "seller_name": "Иван Менеджеров"
  },
  "order": {
    "id": 1,
    "total_cost": "70000.00",
    "items": [...updated items...]
  }
}
```

#### Удаление позиции из заказа
```http
DELETE /api/modal/order/{order_id}/items/{item_id}/
```

**Ответ:**
```json
{
  "order": {
    "id": 1,
    "total_cost": "35000.00",
    "items": [...updated items...]
  },
  "message": "Позиция успешно удалена"
}
```

### Данные для модального окна транзакции

#### Создание транзакции
```http
GET /api/modal/transaction/
```

**Ответ:**
```json
{
  "types": [
    {"value": "income", "label": "Доход"},
    {"value": "expense", "label": "Расход"}
  ],
  "orders": [
    {"id": 1, "client__name": "Петр Иванов"},
    {"id": 5, "client__name": "Мария Петрова"}
  ]
}
```

#### Редактирование транзакции
```http
GET /api/modal/transaction/{transaction_id}/
```

**Ответ:**
```json
{
  "transaction": {
    "id": 1,
    "type": "income",
    "amount": "45000.00",
    "description": "Доход от заказа",
    "order": 1
  },
  "types": [...],
  "orders": [...]
}
```

### Данные для модального окна выплаты зарплаты
```http
GET /api/modal/salary-payment/{user_id}/
```

**Ответ:**
```json
{
  "user": {
    "id": 3,
    "username": "installer1",
    "first_name": "Алексей",
    "last_name": "Монтажников",
    "role": "installer"
  },
  "salary_data": {
    "installation_pay": 15000.00,
    "additional_pay": 2500.00,
    "penalties": 0.00,
    "total_salary": 17500.00,
    "completed_orders_count": 10
  }
}
```

#### Создание выплаты зарплаты
```http
POST /api/modal/salary-payment/{user_id}/
Content-Type: application/json

{
  "amount": "17500.00",
  "period_start": "2025-05-01",
  "period_end": "2025-05-31"
}
```

---

## Экспорт данных

### Экспорт клиентов
```http
GET /api/export/clients/
```

**Ответ:** Файл Excel (.xlsx) с таблицей клиентов

**Заголовки ответа:**
```http
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="clients_20250524_163000.xlsx"
```

### Экспорт заказов
```http
GET /api/export/orders/
```

**Ответ:** Файл Excel (.xlsx) с двумя листами:
- "Заказы" - основная информация о заказах
- "Позиции заказов" - детальная информация о позициях

### Экспорт финансов
```http
GET /api/export/finance/
```

**Ответ:** Файл Excel (.xlsx) с транзакциями

---

## Примеры использования

### Создание полного заказа с позициями

```javascript
// 1. Получаем данные для формы
const modalData = await fetch('/api/modal/order/').then(r => r.json());

// 2. Создаем заказ
const orderResponse = await fetch('/api/orders/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRFToken': getCsrfToken()
  },
  body: JSON.stringify({
    client: 1,
    manager: 2,
    installers: [3, 4]
  })
});
const order = await orderResponse.json();

// 3. Добавляем позиции
await fetch(`/api/orders/${order.id}/add_item/`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRFToken': getCsrfToken()
  },
  body: JSON.stringify({
    service: 1,
    price: "35000.00",
    seller: 2
  })
});

await fetch(`/api/orders/${order.id}/add_item/`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRFToken': getCsrfToken()
  },
  body: JSON.stringify({
    service: 2,
    price: "10000.00",
    seller: 2
  })
});
```

### Планирование монтажа с проверкой доступности

```javascript
// 1. Проверяем доступность монтажников
const availabilityResponse = await fetch('/api/calendar/availability/check/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRFToken': getCsrfToken()
  },
  body: JSON.stringify({
    installer_ids: [3, 4],
    date: "2025-05-25",
    start_time: "10:00",
    end_time: "13:00"
  })
});

const availability = await availabilityResponse.json();

// 2. Если доступны, создаем расписание
if (availability.available) {
  await fetch('/api/calendar/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken()
    },
    body: JSON.stringify({
      order_id: 1,
      scheduled_date: "2025-05-25",
      start_time: "10:00",
      end_time: "13:00",
      installer_ids: [3, 4],
      priority: "normal",
      notes: "Обычный монтаж"
    })
  });
}
```

### Работа с модальными окнами

```javascript
// Функция для открытия модального окна создания клиента
async function openCreateClientModal() {
  try {
    // Загружаем данные для формы
    const response = await fetch('/api/modal/client/');
    const data = await response.json();
    
    // Создаем форму
    const form = createClientForm(data);
    showModal('Новый клиент', form);
    
  } catch (error) {
    console.error('Ошибка:', error);
  }
}

// Функция для отправки формы клиента
async function submitClientForm(formData, clientId = null) {
  const url = clientId ? `/api/modal/client/${clientId}/` : '/api/modal/client/';
  const method = clientId ? 'PUT' : 'POST';
  
  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken()
      },
      body: JSON.stringify(formData)
    });
    
    if (response.ok) {
      const result = await response.json();
      closeModal();
      showNotification('Клиент успешно сохранен', 'success');
      refreshClientsList();
    } else {
      const errors = await response.json();
      showFormErrors(errors);
    }
  } catch (error) {
    showNotification('Ошибка сохранения', 'error');
  }
}
```

### Получение статистики для дашборда

```javascript
async function loadDashboardData() {
  try {
    // Загружаем основную статистику
    const [dashboardStats, financeStats] = await Promise.all([
      fetch('/api/dashboard/stats/').then(r => r.json()),
      fetch('/api/finance/stats/').then(r => r.json())
    ]);
    
    // Обновляем интерфейс
    updateDashboard(dashboardStats, financeStats);
    
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
  }
}

function updateDashboard(dashboardStats, financeStats) {
  // Основные метрики
  document.getElementById('total-orders').textContent = dashboardStats.total_orders;
  document.getElementById('monthly-income').textContent = formatCurrency(financeStats.income_this_month);
  
  // График
  renderFinanceChart(financeStats.daily_stats);
  
  // Топ менеджеры
  renderTopManagers(dashboardStats.top_managers);
}
```

---

## Обработка ошибок

### Коды ошибок HTTP

- **200 OK** - Успешный запрос
- **201 Created** - Ресурс создан
- **204 No Content** - Ресурс удален
- **400 Bad Request** - Ошибка валидации или неверный запрос
- **401 Unauthorized** - Требуется аутентификация
- **403 Forbidden** - Доступ запрещен
- **404 Not Found** - Ресурс не найден
- **500 Internal Server Error** - Внутренняя ошибка сервера

### Формат ошибок валидации

**Запрос:**
```http
POST /api/clients/
Content-Type: application/json

{
  "name": "",
  "phone": "invalid",
  "source": "invalid_source"
}
```

**Ответ (400 Bad Request):**
```json
{
  "name": ["Это поле обязательно."],
  "phone": ["Введите корректный номер телефона."],
  "source": ["Выберите корректный вариант."]
}
```

### Обработка ошибок доступа

**Ответ (403 Forbidden):**
```json
{
  "detail": "У вас недостаточно прав для выполнения данного действия."
}
```

### Обработка ошибок "не найдено"

**Ответ (404 Not Found):**
```json
{
  "detail": "Страница не найдена."
}
```

### Универсальная функция обработки ошибок

```javascript
async function apiRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
        ...options.headers
      },
      ...options
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new APIError(response.status, errorData);
    }
    
    if (response.status === 204) {
      return null; // No content
    }
    
    return await response.json();
    
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError(0, { detail: 'Ошибка сети' });
  }
}

class APIError extends Error {
  constructor(status, data) {
    super(data.detail || 'Неизвестная ошибка');
    this.status = status;
    this.data = data;
  }
  
  getValidationErrors() {
    if (this.status === 400 && typeof this.data === 'object') {
      return this.data;
    }
    return null;
  }
}

// Использование
try {
  const client = await apiRequest('/api/clients/', {
    method: 'POST',
    body: JSON.stringify(clientData)
  });
  showNotification('Клиент создан', 'success');
} catch (error) {
  if (error instanceof APIError) {
    const validationErrors = error.getValidationErrors();
    if (validationErrors) {
      showFormErrors(validationErrors);
    } else {
      showNotification(error.message, 'error');
    }
  }
}
```

### Получение CSRF токена

```javascript
function getCsrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || '';
}
```

### Рекомендации по обработке ошибок в UI

1. **Валидация форм**: Показывайте ошибки валидации рядом с соответствующими полями
2. **Сетевые ошибки**: Показывайте общие уведомления о проблемах с соединением
3. **Ошибки прав доступа**: Перенаправляйте на страницу входа или показывайте соответствующее сообщение
4. **404 ошибки**: Показывайте страницу "не найдено" или возвращайте к списку
5. **Тайм-ауты**: Предоставляйте возможность повторить запрос

### Примеры уведомлений пользователю

```javascript
// Успешные операции
showNotification('Клиент успешно создан', 'success');
showNotification('Заказ обновлен', 'success');
showNotification('Расписание сохранено', 'success');

// Ошибки
showNotification('Ошибка сохранения данных', 'error');
showNotification('Нет доступа к этому ресурсу', 'warning');
showNotification('Проверьте подключение к интернету', 'info');

// Информационные сообщения
showNotification('Данные загружаются...', 'info');
showNotification('Файл экспорта готов', 'success');
```

---

## Заключение

Данная документация описывает полный API функционал CRM-системы для кондиционеров. Она включает в себя:

- **Полные спецификации** всех доступных endpoint'ов
- **Примеры запросов и ответов** в реальном формате
- **Детальное описание модальных окон** и их интеграции
- **Руководство по обработке ошибок** и edge cases
- **Практические примеры** реализации основных сценариев
- **Рекомендации по архитектуре** фронтенд-приложения

Используя эту документацию, любой frontend-разработчик сможет создать полнофункциональный интерфейс для данной CRM-системы без необходимости изучения серверного кода.
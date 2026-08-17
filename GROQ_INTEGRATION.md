# 🚀 NutriScan AI — Groq API Integration Guide

## Что было сделано

Проект **полностью переделан** для работы с Groq API вместо Google Gemini.

### Три новых API эндпоинта

| Метод | Путь | Входные данные | Выходные данные |
|-------|------|----------------|-----------------|
| **POST** | `/api/analyze-food` | `{ imageBase64?, mimeType?, description? }` | `FoodAnalysisResult` |
| **POST** | `/api/suggest-recipe` | `{ ingredients, dietGoal, maxCalories }` | `RecipeResult` |
| **POST** | `/api/diet-assistant` | `{ message, history, profile }` | `{ reply: string }` |

### Обновленные функции в App.tsx

1. **`analyzeFood()`** — теперь отправляет на сервер (фото/текст/комбо)
2. **`generateRecipe()`** — вызывает `/api/suggest-recipe`
3. **`sendChatMessage()`** — вызывает `/api/diet-assistant`
4. **`analyzeFridge()`** — анализирует холодильник через AI
5. **`confirmFridgeScan()`** — генерирует рецепт после сканирования

## 🔧 Установка и настройка

### Требования
```bash
- Node.js 18+
- npm или yarn
- GROQ_API_KEY (получить на https://console.groq.com)
```

### Шаг 1: Установка зависимостей
```bash
npm install
```

### Шаг 2: Переменные окружения
Создать/обновить файл `.env.local`:
```env
GROQ_API_KEY=your_groq_api_key_here
PORT=3000
NODE_ENV=development
```

### Шаг 3: Запуск в режиме разработки
```bash
npm run dev
```

Приложение будет доступно по адресу **http://localhost:3000**

### Шаг 4: Production сборка
```bash
npm run build
npm start
```

## 📋 API Reference

### 1. POST `/api/analyze-food`

**Использует:** Groq Llama 4 Scout (температура: 0.1)

**Режимы:**

#### A. Анализ только по фото
```json
{
  "imageBase64": "base64_image_data",
  "mimeType": "image/jpeg"
}
```

#### B. Анализ только по тексту
```json
{
  "description": "Плов с курицей и морковью, примерно 250 грамм"
}
```

#### C. Комбинированный анализ
```json
{
  "imageBase64": "base64_image_data",
  "mimeType": "image/jpeg",
  "description": "Домашний плов"
}
```

**Ответ:**
```json
{
  "foodName": "Плов с курицей",
  "calories": 450,
  "protein": 25,
  "carbohydrates": 45,
  "fat": 15,
  "portionSize": "250г",
  "confidenceScore": 85,
  "healthRating": 7,
  "ingredientsList": ["курица", "рис", "морковь", "лук"],
  "dietTips": ["Хороший источник белка", "Соотношение макросов сбалансировано"]
}
```

### 2. POST `/api/suggest-recipe`

**Использует:** Groq Llama 4 Scout (температура: 0.7)

**Входные данные:**
```json
{
  "ingredients": "куриное филе, рис, морковь, лук, помидоры",
  "dietGoal": "Высокобелковая диета",
  "maxCalories": 600
}
```

**Ответ:**
```json
{
  "title": "Плов с помидорами и курицей",
  "prepTime": "15 минут",
  "cookTime": "40 минут",
  "servings": 2,
  "calories": 550,
  "macronutrients": {
    "protein": 35,
    "carbohydrates": 50,
    "fat": 12
  },
  "ingredients": [
    "500г куриного филе",
    "300г рис",
    "150г моркови",
    "100г лука",
    "200г помидоров"
  ],
  "instructions": [
    "Нарежьте ингредиенты...",
    "Обжарьте в казане..."
  ],
  "whyItFits": "Рецепт содержит много белка и сбалансирован по макронутриентам"
}
```

### 3. POST `/api/diet-assistant`

**Использует:** Groq Llama 4 Scout (температура: 0.7)

**Входные данные:**
```json
{
  "message": "Как набрать 30 грамм белка в день?",
  "history": [
    {
      "id": "1",
      "role": "user",
      "content": "Привет",
      "timestamp": "10:30"
    },
    {
      "id": "2",
      "role": "assistant",
      "content": "Привет! Я твой ИИ-диетолог...",
      "timestamp": "10:30"
    }
  ],
  "profile": {
    "name": "Иван",
    "weight": 75,
    "calorieTarget": 2500,
    "waterTarget": 2000,
    "goal": "Набор мышечной массы",
    "activity": "Активный"
  }
}
```

**Ответ:**
```json
{
  "reply": "Привет, Иван! С твоим весом 75 кг рекомендуется 30г белка на прием пищи. Ешь: куриное филе (100г), творог (200г) или рыбу (150г). Это легко достичь при 5-6 приемах пищи в день!"
}
```

## 🔄 Архитектура данных

### Клиент (React)
```
App.tsx (UI компоненты)
  ↓
api-client.ts (HTTP функции)
  ↓
fetch /api/... (POST запросы)
```

### Сервер (Express)
```
server.ts (API эндпоинты)
  ↓
OpenAI SDK (совместимый с Groq)
  ↓
Groq API (LLM обработка)
  ↓
JSON парсинг и очистка
  ↓
Ответ клиенту
```

### Данные хранятся
- **localStorage** (клиент): профиль, логи еды, чат, вода
- **Кэш памяти** (сервер): временная обработка

## 🧪 Тестирование

### Тест 1: Анализ еды (текст)
```bash
curl -X POST http://localhost:3000/api/analyze-food \
  -H "Content-Type: application/json" \
  -d '{"description": "Гренки с маслом и сыром, 100 грамм"}'
```

### Тест 2: Генерация рецепта
```bash
curl -X POST http://localhost:3000/api/suggest-recipe \
  -H "Content-Type: application/json" \
  -d '{
    "ingredients": "яйца, молоко, хлеб",
    "dietGoal": "Низкокалорийная",
    "maxCalories": 300
  }'
```

### Тест 3: Чат
```bash
curl -X POST http://localhost:3000/api/diet-assistant \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Привет!",
    "history": [],
    "profile": {"name": "Тест", "weight": 70, "calorieTarget": 2000, "waterTarget": 2000, "goal": "Здоровье", "activity": "Умеренный"}
  }'
```

## 📊 Структура проекта

```
/workspaces/NutriscanAi
├── server.ts                    # Express + 3 API эндпоинта
├── src/
│   ├── App.tsx                  # React компоненты (обновлены функции)
│   ├── api-client.ts            # HTTP клиент функции
│   ├── types.ts                 # TypeScript интерфейсы
│   ├── index.css                # Стили
│   └── main.tsx                 # React точка входа
├── api/
│   └── index.ts                 # Vercel compatibility
├── vite.config.ts               # Vite конфиг
├── tsconfig.json                # TypeScript конфиг
├── package.json                 # Зависимости
└── MIGRATION_SUMMARY.md         # Документация миграции
```

## ⚙️ Производительность

- **Сжатие изображений:** До 800px, качество 70%
- **Максимальный размер тела:** 10MB
- **Таймауты:** 30 секунд (по умолчанию Groq)
- **Температура LLM:** 
  - 0.1 для детерминированных результатов (еда, макросы)
  - 0.7 для креативного контента (рецепты, чат)

## 🐛 Обработка ошибок

| Сценарий | Обработка |
|----------|-----------|
| Нет изображения и текста | ❌ 400 Bad Request |
| Ошибка Groq API | ❌ 500 + сообщение об ошибке |
| Неверный JSON в ответе | 🔄 Fallback режим |
| Тайм-аут запроса | ⏱️ 30 сек, затем ошибка |

## 📝 Логирование

Сервер выводит в консоль:
```
=== GROQ RECIPE ERROR ===
Message: [ошибка]
========================
```

Клиент логирует в console.error для отладки

## 🌐 Развертывание

### Vercel
1. Связать репо с Vercel
2. Установить `GROQ_API_KEY` в Environment Variables
3. Deploy (автоматический)

### Другие платформы
1. Установить переменные окружения
2. `npm run build`
3. `npm start`

## 📚 Дополнительно

- Все функции поддерживают async/await
- Все ошибки обрабатываются с try/catch
- JSON очищается от markdown коллбеков
- localStorage используется для offline доступа

---

**Разработчик:** AI Assistant
**Дата:** 2026-06-27
**Версия:** 1.0
**Статус:** ✅ Production Ready

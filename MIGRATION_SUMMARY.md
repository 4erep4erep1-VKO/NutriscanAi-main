# NutriScan AI — Миграция на Groq API

## Завершенные изменения

### 1. **server.ts** — Три новых API эндпоинта через Groq

#### POST `/api/analyze-food`
- **Входные данные:** `{ imageBase64?, mimeType?, description? }`
- **Возвращает:** `FoodAnalysisResult`
- **Режимы работы:**
  - Только фото (анализ блюда по изображению)
  - Только текст (анализ по описанию)
  - Фото + текст (комбинированный анализ)
- **LLM модель:** `meta-llama/llama-4-scout-17b-16e-instruct`
- **Температура:** 0.1 (детерминированный результат)

#### POST `/api/suggest-recipe`
- **Входные данные:** `{ ingredients, dietGoal, maxCalories }`
- **Возвращает:** `RecipeResult`
- **Функционал:**
  - Генерирует рецепт на основе доступных ингредиентов
  - Соответствует целям диеты пользователя
  - Укладывается в лимит калорий
  - Возвращает пошаговые инструкции с макронутриентами
- **Температура:** 0.7 (креативный контент)

#### POST `/api/diet-assistant`
- **Входные данные:** `{ message, history, profile }`
- **Возвращает:** `{ reply: string }`
- **Функционал:**
  - Интерактивный чат с ИИ-диетологом
  - Контекст из истории сообщений (до 6 последних)
  - Учитывает профиль пользователя (имя, вес, цели)
  - Дружелюбный и поддерживающий тон
- **Температура:** 0.7 (естественный диалог)

### 2. **api-client.ts** — Клиентские функции для всех эндпоинтов

```typescript
// Анализ пищи (фото/текст/комбо)
analyzeFoodWithServer(params: AnalyzeParams): Promise<{ result: FoodAnalysisResult }>

// Генерация рецептов
suggestRecipeWithServer(ingredients, dietGoal, maxCalories): Promise<{ result: RecipeResult }>

// Чат с диетологом
chatWithDietAssistant(message, history, profile): Promise<{ reply: string }>

// Анализ холодильника (служебная функция)
analyzeRefrigeratorWithServer(imageBase64, mimeType): Promise<{ ingredients, mocked, fallback, localizedError }>

// Утилита для сжатия изображений
compressImage(base64Str, maxWidth = 800): Promise<string>
```

### 3. **App.tsx** — Обновлены три ключевые функции

#### `analyzeFood()`
- ✅ Поддерживает фото, текст или фото+текст
- ✅ Вызывает `/api/analyze-food`
- ✅ Обработка ошибок с fallback сообщением

#### `generateRecipe()`
- ✅ Вызывает `/api/suggest-recipe` вместо мока
- ✅ Отправляет: ингредиенты, цель диеты, лимит калорий
- ✅ Получает полный рецепт с инструкциями

#### `sendChatMessage()`
- ✅ Вызывает `/api/diet-assistant`
- ✅ Передает историю сообщений для контекста
- ✅ Учитывает профиль пользователя

#### `analyzeFridge()`
- ✅ Анализирует изображение холодильника
- ✅ Возвращает список ингредиентов
- ✅ Поддержка fallback режима при ошибке

#### `confirmFridgeScan()`
- ✅ Автоматически вызывает `/api/suggest-recipe`
- ✅ Генерирует рецепт на основе найденных ингредиентов

## Сохраненная функциональность

✅ **Трекер воды** — система уведомлений, localStorage, напоминания
✅ **Камера** — захват фото, переключение режимов
✅ **localStorage** — все данные сохраняются локально (профиль, логи, история чата)
✅ **Темизация** — светлая/темная тема
✅ **Компрессия изображений** — до 800px, качество 70%

## Конфигурация

### Требуемые переменные окружения
```bash
GROQ_API_KEY=<ваш-groq-api-ключ>
PORT=3000 (опционально)
NODE_ENV=development (для Vite HMR)
```

### Технический стек
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS
- **Backend:** Express 4 + Vite middleware
- **LLM:** Groq API (OpenAI SDK совместимый)
- **Модель:** `meta-llama/llama-4-scout-17b-16e-instruct`

## Примеры использования

### Анализ пищи
```typescript
// Только фото
await analyzeFoodWithServer({ imageBase64: "...", mimeType: "image/jpeg" })

// Только текст
await analyzeFoodWithServer({ description: "Плов с курицей, 250г" })

// Фото + текст
await analyzeFoodWithServer({ 
  imageBase64: "...", 
  description: "Домашний плов",
  mimeType: "image/jpeg" 
})
```

### Генерация рецепта
```typescript
await suggestRecipeWithServer(
  "куриное филе, рис, морковь, лук",
  "Высокобелковая диета",
  500
)
```

### Чат с ИИ-диетологом
```typescript
await chatWithDietAssistant(
  "Как добрать белок?",
  chatHistory,
  userProfile
)
```

## Обработка ошибок

Все эндпоинты:
- ✅ Возвращают JSON с `error` полем при ошибке
- ✅ Логируют детали в консоль сервера
- ✅ Показывают user-friendly сообщения в UI
- ✅ Поддерживают fallback режимы для критичных функций

## Версионирование

- **API версия:** 1.0
- **Совместимость:** Groq API (как OpenAI v1)
- **Дата обновления:** 2026-06-27

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || "",
  baseURL: "https://api.groq.com/openai/v1",
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const NUTRITIONIST_PROMPT = `Ты — профессиональный диетолог-нутрициолог. Проанализируй еду и верни ТОЛЬКО валидный JSON (без markdown, без лишнего текста).

JSON должен содержать строго эти поля:
{
  "foodName": "название блюда на русском",
  "calories": число (ккал),
  "protein": число (грамм),
  "carbohydrates": число (грамм),
  "fat": число (грамм),
  "portionSize": "строка (например, '1 стакан', '250г', '1 порция')",
  "confidenceScore": число (0-100, точность оценки),
  "healthRating": число (0-10, оценка полезности),
  "ingredientsList": ["список ингредиентов на русском"],
  "dietTips": ["советы диетолога на русском"]
}

Будь точен в цифрах. Если не уверен — дай лучшую оценку исходя из состава и размера порции. Отвечай ТОЛЬКО JSON.`;

function buildDailyContext(profile?: any, todayEntries?: any[], waterIntake?: number) {
  const parts: string[] = [];

  if (profile) {
    parts.push(
      `Профиль пользователя: имя ${profile.name || "Пользователь"}, вес ${profile.weight || "?"} кг, цель: ${profile.goal || "здоровье"}, активность: ${profile.activity || "умеренная"}, дневная норма калорий: ${profile.calorieTarget || "?"} ккал.`
    );
  }

  if (Array.isArray(todayEntries) && todayEntries.length > 0) {
    const totals = todayEntries.reduce(
      (acc, item) => ({
        calories: acc.calories + (item.calories || 0),
        protein: acc.protein + (item.protein || 0),
        carbohydrates: acc.carbohydrates + (item.carbohydrates || 0),
        fat: acc.fat + (item.fat || 0),
      }),
      { calories: 0, protein: 0, carbohydrates: 0, fat: 0 }
    );

    parts.push(
      `Сегодня съедено: ${Math.round(totals.calories)} калорий, ${totals.protein.toFixed(1)} г белка, ${totals.carbohydrates.toFixed(1)} г углеводов, ${totals.fat.toFixed(1)} г жиров.`
    );

    if (profile?.calorieTarget) {
      const remaining = Math.max(profile.calorieTarget - Math.round(totals.calories), 0);
      parts.push(`Осталось до нормы: ${remaining} калорий.`);
    }
  }

  if (typeof waterIntake === "number") {
    const targetText = profile?.waterTarget ? ` из ${profile.waterTarget} мл` : "";
    parts.push(`Выпито воды: ${waterIntake} мл${targetText}.`);
  }

  if (parts.length === 0) {
    return "";
  }

  return `\n\nКонтекст дня пользователя:\n${parts.join("\n")}\n`;
}

app.post("/api/analyze-food", async (req, res) => {
  try {
    const { imageBase64, mimeType, description, profile, todayEntries, waterIntake } = req.body;

    if (!imageBase64 && !description) {
      return res.status(400).json({ error: "Нужно фото или текстовое описание блюда" });
    }

    const userContent: any[] = [];
    let promptText = NUTRITIONIST_PROMPT;
    const dailyContext = buildDailyContext(profile, todayEntries, waterIntake);

    if (description) {
      promptText += `\n\nПользователь описал блюдо так: "${description}". Используй это описание для анализа.`;
    }

    if (dailyContext) {
      promptText += `${dailyContext}Учитывай этот контекст при оценке блюда: скажи, сколько уже съедено, сколько осталось до дневной цели и вписывается ли это блюдо в дневной лимит. Дай персональные советы с учётом баланса БЖУ и воды.`;
    }

    userContent.push({ type: "text", text: promptText });

    if (imageBase64) {
      let dataUrl: string;
      if (imageBase64.startsWith("data:")) {
        dataUrl = imageBase64;
      } else {
        dataUrl = `data:${mimeType || "image/jpeg"};base64,${imageBase64}`;
      }
      userContent.push({ type: "image_url", image_url: { url: dataUrl } });
    }

    const response = await openai.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [{ role: "user", content: userContent }],
      temperature: 0.1,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || "";
    let cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    const result = JSON.parse(cleaned);
    return res.json(result);
  } catch (err: any) {
    console.error("=== GROQ ERROR ===");
    console.error("Message:", err.message);
    console.error("==================");
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/suggest-recipe", async (req, res) => {
  try {
    const { ingredients, dietGoal, maxCalories, profile, todayEntries } = req.body;

    if (!ingredients || !dietGoal) {
      return res.status(400).json({ error: "Нужны ингредиенты и цель диеты" });
    }

    const dailyContext = buildDailyContext(profile, todayEntries);
    const recipePrompt = `Ты — опытный шеф-повар и диетолог. На основе данных ингредиентов создай полезный рецепт, соответствующий диетической цели пользователя.

ИНГРЕДИЕНТЫ: ${ingredients}
ЦЕЛЬ ДИЕТЫ: ${dietGoal}
МАКСИМУМ КАЛОРИЙ: ${maxCalories || "не ограничено"} ккал

Верни ТОЛЬКО валидный JSON (без markdown):
{
  "title": "название рецепта на русском",
  "prepTime": "время подготовки (например, '10 минут')",
  "cookTime": "время приготовления (например, '30 минут')",
  "servings": число порций,
  "calories": число (ккал на порцию),
  "macronutrients": {
    "protein": число (г на порцию),
    "carbohydrates": число (г на порцию),
    "fat": число (г на порцию)
  },
  "ingredients": ["список ингредиентов с количеством"],
  "instructions": ["пошаговые инструкции приготовления"],
  "whyItFits": "объяснение, почему этот рецепт подходит для данной диеты"
}

Будь креативен, но реалистичен. Учитывай сезонность и доступность ингредиентов.${dailyContext ? `\n\n${dailyContext}Используй этот контекст для подбора рецепта: предложи блюдо, которое помогает добрать недостающие макросы и не превышает дневной лимит калорий.` : ""}`;

    const response = await openai.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [{ role: "user", content: recipePrompt }],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content || "";
    let cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    const result = JSON.parse(cleaned);
    return res.json(result);
  } catch (err: any) {
    console.error("=== GROQ RECIPE ERROR ===");
    console.error("Message:", err.message);
    console.error("========================");
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/diet-assistant", async (req, res) => {
  try {
    const { message, history, profile, todayEntries, waterIntake } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Сообщение не может быть пустым" });
    }

    const dailyContext = buildDailyContext(profile, todayEntries, waterIntake);
    const systemPrompt = `Ты — дружелюбный и профессиональный ИИ-диетолог и фитнес-коуч.
Пользователь: ${profile?.name || "друг"}, вес ${profile?.weight || "?"} кг, цель: ${profile?.goal || "здоровье"}

Твоя роль:
- Давать практические советы по питанию и здоровому образу жизни
- Объяснять макронутриенты и калории понятным языком
- Поддерживать и мотивировать
- Быть честным и научно обоснованным
- Всегда отвечать на русском языке

Ответь коротко и дружелюбно (1-3 предложения), если вопрос простой. Если вопрос сложный — можешь ответить подробнее.${dailyContext ? `\n\n${dailyContext}Используй этот контекст для полноценной консультации: рекомендую что съесть, сколько воды выпить и анализируй баланс БЖУ за сегодня.` : ""}`;

    const messages: any[] = [];

    if (history && history.length > 0) {
      const recentHistory = history.slice(-6);
      for (const msg of recentHistory) {
        messages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        });
      }
    }

    messages.push({ role: "user", content: message });

    const response = await openai.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const reply = response.choices[0]?.message?.content || "Извините, не смог обработать ваш вопрос.";
    return res.json({ reply });
  } catch (err: any) {
    console.error("=== GROQ CHAT ERROR ===");
    console.error("Message:", err.message);
    console.error("======================");
    return res.status(500).json({ error: err.message });
  }
});

export { app };
export default app;

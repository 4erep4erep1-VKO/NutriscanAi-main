import { FoodAnalysisResult, RecipeResult, ChatMessage, UserProfile, FoodEntry } from "./types";

interface AnalyzeParams {
  imageBase64?: string;
  mimeType?: string;
  description?: string;
  profile?: UserProfile;
  todayEntries?: FoodEntry[];
  waterIntake?: number;
}

// Helper to compress images to reduce payload size
export function compressImage(base64Str: string, maxWidth = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ratio = Math.min(1, maxWidth / img.width);
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Unable to get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => {
      reject(new Error("Failed to load image for compression"));
    };
    img.src = base64Str;
  });
}

export async function analyzeFoodWithServer(params: AnalyzeParams): Promise<{ result: FoodAnalysisResult }> {
  const requestPayload: AnalyzeParams = {};

  // Process image if provided - compress and prepare
  if (params.imageBase64) {
    // Convert clean base64 back to Data URL for compressImage function
    const dataUrl = `data:${params.mimeType || "image/jpeg"};base64,${params.imageBase64}`;
    const compressedDataUrl = await compressImage(dataUrl);
    
    // Extract clean base64 from compressed Data URL
    requestPayload.imageBase64 = compressedDataUrl.replace(
      /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
      ""
    );
    requestPayload.mimeType = params.mimeType || "image/jpeg";
  }

  // Add description if provided
  if (params.description) {
    requestPayload.description = params.description;
  }

  if (params.profile) {
    requestPayload.profile = params.profile;
  }

  if (params.todayEntries) {
    requestPayload.todayEntries = params.todayEntries;
  }

  if (typeof params.waterIntake === "number") {
    requestPayload.waterIntake = params.waterIntake;
  }

  const response = await fetch("/api/analyze-food", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestPayload),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Server error");
  }

  const data = await response.json();
  return { result: data };
}

export async function suggestRecipeWithServer(
  ingredients: string,
  dietGoal: string,
  maxCalories: number,
  profile?: UserProfile,
  todayEntries?: FoodEntry[],
  previousTitles: string[] = []
): Promise<{ result: RecipeResult }> {
  const response = await fetch("/api/suggest-recipe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ingredients,
      dietGoal,
      maxCalories,
      profile,
      todayEntries,
      previousTitles,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Server error");
  }

  const data = await response.json();
  return { result: data };
}

export async function chatWithDietAssistant(
  message: string,
  history: ChatMessage[],
  profile?: UserProfile,
  todayEntries?: FoodEntry[],
  waterIntake?: number
): Promise<{ reply: string }> {
  const response = await fetch("/api/diet-assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      history,
      profile,
      todayEntries,
      waterIntake,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Server error");
  }

  const data = await response.json();
  return data;
}

export async function analyzeRefrigeratorWithServer(
  imageBase64: string,
  mimeType?: string
): Promise<{ ingredients: string[]; mocked: boolean; fallback: boolean; localizedError: string | null }> {
  const requestPayload: AnalyzeParams = {};

  // Process image
  if (imageBase64) {
    const dataUrl = `data:${mimeType || "image/jpeg"};base64,${imageBase64}`;
    const compressedDataUrl = await compressImage(dataUrl);

    requestPayload.imageBase64 = compressedDataUrl.replace(
      /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
      ""
    );
    requestPayload.mimeType = mimeType || "image/jpeg";
    requestPayload.description =
      "Проанализируй содержимое холодильника на этом изображении. Верни список всех видимых ингредиентов.";
  }

  try {
    const response = await fetch("/api/analyze-food", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      throw new Error("Server error");
    }

    const data = await response.json();
    return {
      ingredients: data.ingredientsList || [],
      mocked: false,
      fallback: false,
      localizedError: null,
    };
  } catch (err) {
    return {
      ingredients: [],
      mocked: false,
      fallback: true,
      localizedError: "Не удалось проанализировать изображение холодильника. Пожалуйста, попробуйте позже или добавьте ингредиенты вручную.",
    };
  }
}
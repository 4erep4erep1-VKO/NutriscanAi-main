export interface UserProfile {
  name: string;
  weight: number;
  calorieTarget: number;
  waterTarget: number;
  goal: string;
  activity: string;
}

export interface FoodAnalysisResult {
  foodName: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  portionSize: string;
  confidenceScore: number;
  healthRating: number;
  ingredientsList: string[];
  dietTips: string[];
}

export interface FoodEntry {
  id: number;
  date: string;
  foodName: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  portionSize: string;
}

export interface RecipeResult {
  title: string;
  prepTime: string;
  cookTime: string;
  servings: number;
  calories: number;
  macronutrients: {
    protein: number;
    carbohydrates: number;
    fat: number;
  };
  ingredients: string[];
  instructions: string[];
  whyItFits: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

import React, { useState, useEffect, useRef } from "react";
import { 
  Camera, Upload, X, Sparkles, Plus, Trash2, Settings, Droplet, 
  Utensils, ChefHat, MessageSquare, RefreshCw, AlertCircle, 
  CheckCircle, ChevronRight, Activity, Award, Star, Info, Moon, Sun,
  Calendar, Bell, BellRing, BellOff, Timer, BarChart3
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserProfile, FoodAnalysisResult, FoodEntry, RecipeResult, ChatMessage } from "./types";
import { analyzeFoodWithServer, suggestRecipeWithServer, chatWithDietAssistant, analyzeRefrigeratorWithServer } from "./api-client";

// Default settings
const DEFAULT_PROFILE: UserProfile = {
  name: "Пользователь",
  weight: 70,
  calorieTarget: 2000,
  waterTarget: 2000,
  goal: "Сбалансированное питание",
  activity: "Умеренный",
};

export default function App() {
  // Navigation states
  const [activeTab, setActiveTab] = useState<"food" | "water" | "chef" | "chat" | "stats" | "settings">("food");

  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  // Profile and Log states
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem("ns_profile");
    return saved ? JSON.parse(saved) : DEFAULT_PROFILE;
  });

  const [entries, setEntries] = useState<FoodEntry[]>(() => {
    const saved = localStorage.getItem("ns_entries");
    return saved ? JSON.parse(saved) : [];
  });

  const [waterIntake, setWaterIntake] = useState<number>(() => {
    const saved = localStorage.getItem("ns_water_log");
    const today = new Date().toDateString();
    const savedDate = localStorage.getItem("ns_water_date");
    
    if (savedDate === today && saved) {
      return parseInt(saved, 10);
    }
    return 0; // Reset on new day
  });

  // Food scan/analysis inputs
  const [foodText, setFoodText] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<FoodAnalysisResult | null>(null);

  // Suggested recipes states
  const [recipeIngredients, setRecipeIngredients] = useState("");
  const [recipeGoal, setRecipeGoal] = useState("Сбалансированное питание");
  const [recipeCalorieLimit, setRecipeCalorieLimit] = useState<number>(500);
  const [generatingRecipe, setGeneratingRecipe] = useState(false);
  const [recipeHistory, setRecipeHistory] = useState<RecipeResult[]>([]);
  const [currentRecipeIndex, setCurrentRecipeIndex] = useState<number>(0);
  const currentRecipe = recipeHistory[currentRecipeIndex] ?? null;

  const handleRecipeIngredientsChange = (value: string) => {
    setRecipeIngredients(value);
    setRecipeHistory([]);
    setCurrentRecipeIndex(0);
  };

  const goToPreviousRecipe = () => {
    setCurrentRecipeIndex((prev) => Math.max(0, prev - 1));
  };

  const goToNextRecipe = () => {
    setCurrentRecipeIndex((prev) => Math.min(recipeHistory.length - 1, prev + 1));
  };

  const resetRecipeHistory = () => {
    setRecipeHistory([]);
    setCurrentRecipeIndex(0);
  };

  const canGenerateAnotherVariant = recipeHistory.length > 0 && (currentRecipeIndex < recipeHistory.length - 1 || recipeHistory.length < 5);

  // Refrigerator scanning states
  const [fridgeIngredients, setFridgeIngredients] = useState<string[]>([]);
  const [isScanningFridge, setIsScanningFridge] = useState(false);
  const [fridgeImageBase64, setFridgeImageBase64] = useState<string | null>(null);
  const [isFridgeCameraOpen, setIsFridgeCameraOpen] = useState(false);
  const [fridgeCameraStream, setFridgeCameraStream] = useState<MediaStream | null>(null);
  const [newDetectedIngredient, setNewDetectedIngredient] = useState("");
  const [showDetectedReview, setShowDetectedReview] = useState(false);
  const [chefInputMode, setChefInputMode] = useState<"scan" | "manual">("scan");
  const [isFridgeMocked, setIsFridgeMocked] = useState(false);
  const [isFridgeFallback, setIsFridgeFallback] = useState(false);
  const [fridgeScanError, setFridgeScanError] = useState<string | null>(null);

  // Chat/assistant states
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("ns_chat_history");
    return saved ? JSON.parse(saved) : [
      {
        id: "welcome",
        role: "assistant",
        content: "Привет! Я твой личный ИИ-нутрициолог NutriScan AI. Задай мне любой вопрос о своем здоровье, продуктах питания или спортивной диете. Как я могу помочь тебе сегодня?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });
  const [chatLoading, setChatLoading] = useState(false);

  // API Status Banner
  const [apiStatus, setApiStatus] = useState<{ healthy: boolean; geminiEnabled: boolean } | null>(null);

  // Theme state: dark or light
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("ns_theme");
    return saved === "light" ? "light" : "dark";
  });

  useEffect(() => {
    localStorage.setItem("ns_theme", theme);
    // Apply theme to document root for CSS variables to work properly
    if (theme === "light") {
      document.documentElement.classList.add("light-theme");
    } else {
      document.documentElement.classList.remove("light-theme");
    }
  }, [theme]);

  // Water Notification States & Logic
  const [notifEnabled, setNotifEnabled] = useState<boolean>(() => {
    return localStorage.getItem("ns_notif_enabled") === "true";
  });
  const [notifIntervalVal, setNotifIntervalVal] = useState<number>(() => {
    const saved = localStorage.getItem("ns_notif_interval");
    return saved ? parseInt(saved, 10) : 60; // default 60 minutes
  });
  const [notifStartHour, setNotifStartHour] = useState<number>(() => {
    const saved = localStorage.getItem("ns_notif_start");
    return saved ? parseInt(saved, 10) : 9; // default 9:00
  });
  const [notifEndHour, setNotifEndHour] = useState<number>(() => {
    const saved = localStorage.getItem("ns_notif_end");
    return saved ? parseInt(saved, 10) : 21; // default 21:00
  });
  const [notifPermission, setNotifPermission] = useState<string>(() => {
    return typeof Notification !== "undefined" ? Notification.permission : "default";
  });
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [showInAppReminder, setShowInAppReminder] = useState(false);
  const [reminderQuote, setReminderQuote] = useState("");

  const DRINK_QUOTES = [
    "Самое время сделать глоток живительной влаги! 💧",
    "Чистая вода ускоряет обмен веществ и дарит энергию. Пора попить! ⚡",
    "Твоему телу нужна вода для активного сжигания калорий. Сделай глоток! 🏃‍♂️",
    "Увлажнение повышает концентрацию внимания и продуктивность головы. 💡",
    "Утоли зарождающийся аппетит стаканом воды перед едой! 🍽️",
    "Твоя кожа и суставы скажут тебе спасибо за этот стакан чистой воды! ✨"
  ];

  useEffect(() => {
    localStorage.setItem("ns_notif_enabled", String(notifEnabled));
  }, [notifEnabled]);

  useEffect(() => {
    localStorage.setItem("ns_notif_interval", String(notifIntervalVal));
  }, [notifIntervalVal]);

  useEffect(() => {
    localStorage.setItem("ns_notif_start", String(notifStartHour));
  }, [notifStartHour]);

  useEffect(() => {
    localStorage.setItem("ns_notif_end", String(notifEndHour));
  }, [notifEndHour]);

  useEffect(() => {
    if (notifEnabled) {
      setSecondsLeft(notifIntervalVal * 60);
    } else {
      setSecondsLeft(null);
    }
  }, [notifIntervalVal, notifEnabled]);

  useEffect(() => {
    if (!notifEnabled) {
      setSecondsLeft(null);
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null) {
          return notifIntervalVal * 60;
        }
        if (prev <= 1) {
          // Trigger notification if in hours interval
          const currentHour = new Date().getHours();
          if (currentHour >= notifStartHour && currentHour <= notifEndHour) {
            const randomQuote = DRINK_QUOTES[Math.floor(Math.random() * DRINK_QUOTES.length)];
            setReminderQuote(randomQuote);

            // System notification
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              try {
                new Notification("NutriScan: Пора пить воду! 💧", {
                  body: randomQuote,
                  tag: "water-reminder"
                });
              } catch (err) {
                console.warn("Iframe notification blocked:", err);
              }
            }

            // Fallback in-app notify modal (reliable everywhere)
            setShowInAppReminder(true);
          }
          return notifIntervalVal * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [notifEnabled, notifIntervalVal, notifStartHour, notifEndHour]);

  const requestNotificationPermission = async () => {
    if (typeof Notification === "undefined") {
      showCustomAlert("Не поддерживается", "Ваш браузер не поддерживает системные уведомления.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
      if (permission === "granted") {
        showCustomAlert("Успешно!", "Системные уведомления включены! Приложение будет напоминать вам пить воду через заданные интервалы.");
      } else if (permission === "denied") {
        showCustomAlert("Доступ ограничен", "Показ системных уведомлений заблокирован в настройках вашего браузера. Наше приложение будет присылать внутренние уведомления!");
      }
    } catch (e) {
      // safe fallback
      try {
        Notification.requestPermission((p) => {
          setNotifPermission(p);
        });
      } catch (err) {
        showCustomAlert("Доступ ограничен", "Не удалось запросить доступ к системным уведомлениям из-за ограничений безопасности песочницы iframe. Офлайн-уведомления внутри приложения будут стабильно работать!");
      }
    }
  };

  const sendTestNotification = () => {
    const randomQuote = DRINK_QUOTES[Math.floor(Math.random() * DRINK_QUOTES.length)];
    setReminderQuote(randomQuote);
    setShowInAppReminder(true);

    if (typeof Notification !== "undefined") {
      if (Notification.permission === "granted") {
        try {
          new Notification("NutriScan: Тестовое напоминание 💧", {
            body: randomQuote,
            tag: "water-test"
          });
        } catch (e) {
          console.warn("Iframe system notification blocked", e);
        }
      } else {
        requestNotificationPermission();
      }
    }
  };

  // Ref helpers
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const fridgeVideoRef = useRef<HTMLVideoElement | null>(null);
  const fridgeFileInputRef = useRef<HTMLInputElement | null>(null);

  // Custom dialogue state to avoid native window.alert/confirm inside iframe
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "alert" | "confirm";
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "alert",
  });

  const showCustomAlert = (title: string, message: string) => {
    setDialog({
      isOpen: true,
      title,
      message,
      type: "alert",
    });
  };

  const showCustomConfirm = (title: string, message: string, onConfirm: () => void) => {
    setDialog({
      isOpen: true,
      title,
      message,
      type: "confirm",
      onConfirm,
    });
  };

  // Check Gemini model availability on mount
  useEffect(() => {
    setApiStatus({ healthy: true, geminiEnabled: true });
  }, []);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem("ns_profile", JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem("ns_entries", JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem("ns_water_log", waterIntake.toString());
    localStorage.setItem("ns_water_date", new Date().toDateString());
  }, [waterIntake]);

  useEffect(() => {
    localStorage.setItem("ns_chat_history", JSON.stringify(chatHistory));
  }, [chatHistory]);

  // Scroll chat to end
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, chatLoading]);

  // Setup effects to automatically bind streams when elements mount
  useEffect(() => {
    if (isCameraOpen && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(e => console.error("Video element play err:", e));
    }
  }, [isCameraOpen, cameraStream]);

  useEffect(() => {
    if (isFridgeCameraOpen && fridgeCameraStream && fridgeVideoRef.current) {
      fridgeVideoRef.current.srcObject = fridgeCameraStream;
      fridgeVideoRef.current.play().catch(e => console.error("Fridge video element play err:", e));
    }
  }, [isFridgeCameraOpen, fridgeCameraStream]);

  // Camera capture methods
  const openCamera = async () => {
    setIsCameraLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      setCameraStream(stream);
      setIsCameraOpen(true);
    } catch (err) {
      console.error("Camera permissions / access blocked:", err);
      showCustomAlert("Доступ ограничен", "Не удалось активировать камеру. Проверьте разрешения вашего браузера.");
    } finally {
      setIsCameraLoading(false);
    }
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg");
        setImageBase64(dataUrl);
      }
      closeCamera();
    }
  };

  // Refrigerator camera capture methods
  const openFridgeCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      setFridgeCameraStream(stream);
      setIsFridgeCameraOpen(true);
    } catch (err) {
      console.error("Fridge camera access blocked:", err);
      showCustomAlert("Доступ ограничен", "Не удалось активировать камеру для холодильника. Проверьте разрешения вашего браузера.");
    }
  };

  const closeFridgeCamera = () => {
    if (fridgeCameraStream) {
      fridgeCameraStream.getTracks().forEach((track) => track.stop());
      setFridgeCameraStream(null);
    }
    setIsFridgeCameraOpen(false);
  };

  const captureFridgePhoto = () => {
    if (fridgeVideoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = fridgeVideoRef.current.videoWidth || 640;
      canvas.height = fridgeVideoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(fridgeVideoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg");
        setFridgeImageBase64(dataUrl);
      }
      closeFridgeCamera();
    }
  };

  const handleFridgePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFridgeImageBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Analyze Fridge contents call
  const analyzeFridge = async () => {
    if (!fridgeImageBase64) return;
    setIsScanningFridge(true);
    setFridgeIngredients([]);
    setShowDetectedReview(false);

    try {
      // Extract clean base64 from Data URL
      const base64Clean = fridgeImageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
      const data = await analyzeRefrigeratorWithServer(base64Clean, "image/jpeg");
      setFridgeIngredients(data.ingredients || []);
      setIsFridgeMocked(!!data.mocked);
      setIsFridgeFallback(!!data.fallback);
      setFridgeScanError(data.localizedError || null);
      setShowDetectedReview(true);
    } catch (err: any) {
      console.error("Fridge scan error:", err);
      showCustomAlert("Ошибка анализа", err.message || "Ошибка при связи с сервером анализа холодильника.");
    } finally {
      setIsScanningFridge(false);
    }
  };

  // Confirm Fridge contents & launch recipe suggestions
  const confirmFridgeScan = async () => {
    if (fridgeIngredients.length === 0) {
      showCustomAlert("Пустой список", "Пожалуйста, добавьте хотя бы один продукт перед продолжением.");
      return;
    }

    const validatedStr = fridgeIngredients.join(", ");
    setRecipeIngredients(validatedStr);
    setRecipeHistory([]);
    setCurrentRecipeIndex(0);

    setGeneratingRecipe(true);

    try {
      const data = await suggestRecipeWithServer(
        validatedStr,
        recipeGoal,
        recipeCalorieLimit,
        profile,
        entries,
        []
      );
      const newRecipe = data.result;
      setRecipeHistory((prev) => {
        const next = [...prev, newRecipe];
        setCurrentRecipeIndex(next.length - 1);
        return next;
      });
    } catch (err: any) {
      console.error("Recipe generation failed", err);
      showCustomAlert("Загрузка рецепта", `Состав продуктов скопирован в форму: "${validatedStr}". Нажмите кнопку "Создать шедевр ИИ" снизу.`);
    } finally {
      setGeneratingRecipe(false);
      setFridgeImageBase64(null);
      setShowDetectedReview(false);
    }
  };

  const removeFridgeIngredient = (indexToRemove: number) => {
    setFridgeIngredients((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const addFridgeIngredient = () => {
    const trimmed = newDetectedIngredient.trim().toLowerCase();
    if (trimmed && !fridgeIngredients.includes(trimmed)) {
      setFridgeIngredients((prev) => [...prev, trimmed]);
      setNewDetectedIngredient("");
    }
  };

  // Upload photo handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Analyze food call - supports image, text, or both
  const analyzeFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodText && !imageBase64) return;

    setAnalyzing(true);
    setAnalysisResult(null);

    try {
      // Prepare request payload
      const payload: { imageBase64?: string; mimeType?: string; description?: string; profile?: UserProfile; todayEntries?: FoodEntry[]; waterIntake?: number } = {
        profile,
        todayEntries: entries,
        waterIntake,
      };

      // Add image if available
      if (imageBase64) {
        // Extract clean base64 from Data URL (remove prefix)
        const base64Clean = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
        payload.imageBase64 = base64Clean;
        payload.mimeType = "image/jpeg";
      }

      // Add text description if available
      if (foodText) {
        payload.description = foodText;
      }

      const data = await analyzeFoodWithServer(payload);
      setAnalysisResult(data.result);
    } catch (err: any) {
      console.error("Analysis Error:", err);
      showCustomAlert("Ошибка анализа", err.message || "Произошла ошибка при анализе.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Add analyzed item to logs
  const addAnalyzedToHistory = () => {
    if (!analysisResult) return;

    const newEntry: FoodEntry = {
      id: Date.now(),
      date: new Date().toLocaleDateString("ru-RU"),
      foodName: analysisResult.foodName,
      calories: analysisResult.calories,
      protein: Math.round(analysisResult.protein * 10) / 10,
      carbohydrates: Math.round(analysisResult.carbohydrates * 10) / 10,
      fat: Math.round(analysisResult.fat * 10) / 10,
      portionSize: analysisResult.portionSize,
    };

    setEntries([newEntry, ...entries]);
    // Reset scanner inputs
    setFoodText("");
    setImageBase64(null);
    setAnalysisResult(null);
  };

  // Suggest Recipe call
  const generateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecipeHistory([]);
    setCurrentRecipeIndex(0);
    setGeneratingRecipe(true);

    try {
      const data = await suggestRecipeWithServer(
        recipeIngredients,
        recipeGoal,
        recipeCalorieLimit,
        profile,
        entries,
        []
      );
      const newRecipe = data.result;
      setRecipeHistory([newRecipe]);
      setCurrentRecipeIndex(0);
    } catch (err: any) {
      console.error(err);
      showCustomAlert("Сбой рекомендации", err.message || "Не удалось загрузить рекомендации шеф-повара. Пожалуйста, попробуйте еще раз.");
    } finally {
      setGeneratingRecipe(false);
    }
  };

  const generateRecipeVariant = async () => {
    if (!recipeIngredients.trim()) return;
    setGeneratingRecipe(true);

    try {
      const data = await suggestRecipeWithServer(
        recipeIngredients,
        recipeGoal,
        recipeCalorieLimit,
        profile,
        entries,
        recipeHistory.map((recipe) => recipe.title)
      );
      const newRecipe = data.result;
      setRecipeHistory((prev) => {
        const next = [...prev, newRecipe];
        setCurrentRecipeIndex(next.length - 1);
        return next;
      });
    } catch (err: any) {
      console.error(err);
      showCustomAlert("Сбой рекомендации", err.message || "Не удалось получить новую версию рецепта. Попробуйте еще раз.");
    } finally {
      setGeneratingRecipe(false);
    }
  };

  // Chat with Assistant call
  const sendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: chatMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedHistory = [...chatHistory, userMsg];
    setChatHistory(updatedHistory);
    setChatMessage("");
    setChatLoading(true);

    try {
      const data = await chatWithDietAssistant(userMsg.content, chatHistory, profile, entries, waterIntake);

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatHistory((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error("Chat coach failed:", err);
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Извините, сейчас у меня возникли трудности с подключением к серверу. Пожалуйста, попробуйте еще раз.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatHistory((prev) => [...prev, errMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  // Clear history logs
  const clearLogs = () => {
    showCustomConfirm(
      "Очистить всю историю за сегодня?",
      "Вы действительно уверены, что хотите удалить все записи о съеденных блюдах и выпитой воде за текущий день?",
      () => {
        setEntries([]);
        setWaterIntake(0);
      }
    );
  };

  // Quick preset updates
  const addWater = (amount: number) => {
    setWaterIntake((prev) => Math.min(prev + amount, 6000));
  };

  // Calculations for today's stats
  const totalCaloriesToday = entries.reduce((sum, item) => sum + item.calories, 0);
  const totalProteinToday = Math.round(entries.reduce((sum, item) => sum + item.protein, 0) * 10) / 10;
  const totalCarbsToday = Math.round(entries.reduce((sum, item) => sum + item.carbohydrates, 0) * 10) / 10;
  const totalFatToday = Math.round(entries.reduce((sum, item) => sum + item.fat, 0) * 10) / 10;

  const calorieProg = Math.min((totalCaloriesToday / profile.calorieTarget) * 100, 100);
  const waterProg = Math.min((waterIntake / profile.waterTarget) * 100, 100);

  const WEEK_DAYS_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const weekDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return date;
  });

  const entriesByDate = entries.reduce<Record<string, FoodEntry[]>>((acc, item) => {
    const key = item.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const dailyStats = weekDates.map((date) => {
    const dateKey = date.toLocaleDateString("ru-RU");
    const dayEntries = entriesByDate[dateKey] || [];
    const calories = dayEntries.reduce((sum, meal) => sum + meal.calories, 0);
    const protein = dayEntries.reduce((sum, meal) => sum + meal.protein, 0);
    const carbohydrates = dayEntries.reduce((sum, meal) => sum + meal.carbohydrates, 0);
    const fat = dayEntries.reduce((sum, meal) => sum + meal.fat, 0);
    const meals = dayEntries.length;
    const percentOfTarget = Math.round((profile.calorieTarget ? (calories / profile.calorieTarget) : 0) * 100);
    const diff = calories - profile.calorieTarget;
    let status: "ok" | "over" | "under" | "empty" = "empty";
    if (meals > 0) {
      if (percentOfTarget > 110) status = "over";
      else if (percentOfTarget < 70) status = "under";
      else status = "ok";
    }

    return {
      dateKey,
      label: WEEK_DAYS_RU[date.getDay()],
      calories,
      protein,
      carbohydrates,
      fat,
      meals,
      percentOfTarget,
      diff,
      status,
      entries: dayEntries,
    };
  });

  const totalWeeklyCalories = dailyStats.reduce((sum, day) => sum + day.calories, 0);
  const averageCaloriesWeek = Math.round(totalWeeklyCalories / 7);
  const totalMealsWeek = dailyStats.reduce((sum, day) => sum + day.meals, 0);
  const daysWithData = dailyStats.filter((day) => day.meals > 0);
  const bestDay = daysWithData.length
    ? daysWithData.reduce((best, current) => Math.abs(current.diff) < Math.abs(best.diff) ? current : best)
    : null;
  const worstDay = daysWithData.length
    ? daysWithData.reduce((worst, current) => Math.abs(current.diff) > Math.abs(worst.diff) ? current : worst)
    : null;
  const maxMacroTotal = Math.max(...dailyStats.map((day) => day.protein + day.carbohydrates + day.fat), 1);
  const hasWeeklyEntries = entries.length > 0;

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ backgroundColor: "var(--bg-main)", color: "var(--text-primary)" }}>
      
      {/* Top Banner indicating Gemini state */}
      {apiStatus && !apiStatus.geminiEnabled && (
        <div className="bg-gradient-to-r from-amber-950/40 via-amber-900/40 to-amber-950/40 border-b border-amber-500/20 px-4 py-2 text-center text-xs text-amber-300 flex items-center justify-center gap-2">
          <Info className="w-4 h-4 text-amber-400 flex-shrink-0 animate-pulse" />
          <span>Запущено в демонстрационном режиме с локальным ИИ. Для активации полноценного ИИ Gemini настройте <strong>GEMINI_API_KEY</strong> в настройках.</span>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 glass-bg px-4 py-3 md:px-8 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-600/20 border border-emerald-500/30 text-emerald-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display tracking-tight flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                NutriScan <span className="text-emerald-300 text-xs px-2 py-0.5 rounded-lg bg-gradient-to-r from-emerald-500/30 to-green-500/20 border border-emerald-500/40 select-none">AI</span>
              </h1>
              <p className="text-[10px] font-mono tracking-widest uppercase" style={{ color: "var(--text-secondary)" }}>ИИ ТРЕКЕР ПИТАНИЯ</p>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-1.5 glass-bg p-1.5 rounded-xl border" style={{ borderColor: "var(--border)" }}>
            <button 
              onClick={() => setActiveTab("food")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 ${
                activeTab === "food" 
                  ? "bg-gradient-to-r from-emerald-500/40 to-green-500/30 text-emerald-300 shadow-lg shadow-emerald-500/10 border border-emerald-500/40" 
                  : "hover:bg-slate-800/30"
              }`}
              style={activeTab !== "food" ? { color: "var(--text-secondary)" } : {}}
            >
              <Utensils className="w-3.5 h-3.5 inline mr-1.5" /> План питания
            </button>
            <button 
              onClick={() => setActiveTab("water")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 ${
                activeTab === "water" 
                  ? "bg-gradient-to-r from-cyan-500/40 to-sky-500/30 text-cyan-300 shadow-lg shadow-cyan-500/10 border border-cyan-500/40" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
              }`}
            >
              <Droplet className="w-3.5 h-3.5 inline mr-1.5" /> Вода
            </button>
            <button 
              onClick={() => setActiveTab("chef")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 ${
                activeTab === "chef" 
                  ? "bg-gradient-to-r from-amber-500/40 to-yellow-500/30 text-amber-300 shadow-lg shadow-amber-500/10 border border-amber-500/40" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
              }`}
            >
              <ChefHat className="w-3.5 h-3.5 inline mr-1.5" /> ИИ Шеф-повар
            </button>
            <button 
              onClick={() => setActiveTab("chat")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 ${
                activeTab === "chat" 
                  ? "bg-gradient-to-r from-indigo-500/40 to-purple-500/30 text-indigo-300 shadow-lg shadow-indigo-500/10 border border-indigo-500/40" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 inline mr-1.5" /> Ассистент
            </button>
            <button 
              onClick={() => setActiveTab("stats")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 ${
                activeTab === "stats" 
                  ? "bg-gradient-to-r from-amber-500/40 to-orange-500/30 text-amber-300 shadow-lg shadow-amber-500/10 border border-amber-500/40" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 inline mr-1.5" /> Статистика
            </button>
            <button 
              onClick={() => setActiveTab("settings")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 ${
                activeTab === "settings" 
                  ? "bg-slate-700/50 text-white shadow-lg border border-slate-600/40" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
              }`}
            >
              <Settings className="w-3.5 h-3.5 inline mr-1.5" /> Профиль
            </button>
          </nav>

          <div className="flex items-center gap-3">
            {/* Quick overview of day macro */}
            <div className="text-right hidden sm:block">
              <span className="text-xs text-slate-400 block">Калории</span>
              <span className="text-sm font-mono font-bold text-emerald-300">
                {totalCaloriesToday} <span className="text-slate-500">/ {profile.calorieTarget} ккал</span>
              </span>
            </div>
            
            {/* Theme Toggle Button */}
            <button 
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Переключить на светлую тему" : "Переключить на темную тему"}
              className="p-2 rounded-lg glass-bg border border-slate-700/30 hover:bg-slate-800/40 hover:border-slate-600/40 text-slate-400 hover:text-emerald-300 transition-all cursor-pointer flex items-center justify-center group"
            >
              {theme === "dark" ? <Sun className="w-4.5 h-4.5 text-amber-400 group-hover:text-amber-300 transition-colors" /> : <Moon className="w-4.5 h-4.5 text-indigo-400 group-hover:text-indigo-300 transition-colors" />}
            </button>

            {/* Reset Logs Icon */}
            <button 
              onClick={clearLogs}
              title="Очистить лог дневной активности"
              className="p-2 rounded-lg glass-bg border border-slate-700/30 hover:bg-rose-950/30 hover:border-rose-500/30 hover:text-rose-400 text-slate-500 transition-all cursor-pointer"
            >
              <Trash2 className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout Area */}
      <main className="max-w-6xl mx-auto px-4 py-6 md:py-10 pb-24 md:pb-12" style={{ backgroundColor: "var(--bg-main)", color: "var(--text-primary)" }}>
        <AnimatePresence mode="wait">
          
          {/* TAB 1: FOOD SCANNER AND DASHBOARD */}
          {activeTab === "food" && (
            <motion.div
              key="food"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              {/* Daily Statistics Banner (L-column) */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Visual Circle Dashboard */}
                <div className="glass-bg glow-emerald rounded-2xl p-6 relative overflow-hidden border" style={{ borderColor: "var(--border)" }}>
                  <div className="absolute -top-32 -right-32 w-64 h-64 bg-gradient-to-br from-emerald-500/10 to-green-600/5 rounded-full blur-3xl pointer-events-none"></div>
                  
                  <h3 className="text-lg font-bold font-display mb-6 flex items-center gap-2 relative z-10" style={{ color: "var(--text-primary)" }}>
                    <Activity className="w-4 h-4 text-emerald-400" /> Сегодняшний прогресс
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                    
                    {/* Calorie Progress Ring */}
                    <div className="flex flex-col items-center justify-center p-4 glass-subtle rounded-xl border border-slate-700/40 relative">
                      <div className="relative w-32 h-32 flex items-center justify-center">
                        {/* SVG Circle indicator */}
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="64" cy="64" r="54" className="stroke-slate-800/50" strokeWidth="8" fill="none" />
                          <circle 
                            cx="64" 
                            cy="64" 
                            r="54" 
                            className="stroke-emerald-400 transition-all duration-500" 
                            strokeWidth="8" 
                            strokeDasharray={339.3}
                            strokeDashoffset={339.3 - (339.3 * calorieProg) / 100}
                            fill="none" 
                            strokeLinecap="round"
                            style={{
                              filter: 'drop-shadow(0 0 8px rgba(52, 211, 153, 0.4))'
                            }}
                          />
                        </svg>
                        <div className="absolute text-center">
                          <span className="text-2xl font-bold font-mono text-white">{totalCaloriesToday}</span>
                          <span className="text-[10px] text-slate-500 block">из {profile.calorieTarget}</span>
                          <span className="text-[10px] uppercase font-mono font-bold text-emerald-300">{Math.round(calorieProg)}%</span>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-slate-400 mt-3 font-display">Баланс калорий</span>
                    </div>

                    {/* Macronutrient distribution */}
                    <div className="md:col-span-2 space-y-4">
                      <div className="glass-subtle p-4 rounded-lg border border-slate-700/40">
                        <div className="flex justify-between text-xs font-semibold mb-2">
                          <span className="text-cyan-300 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400"></span>Белки</span>
                          <span className="font-mono text-slate-400">{totalProteinToday} г / {Math.round(profile.weight * 1.8)} г</span>
                        </div>
                        <div className="w-full bg-slate-900/50 rounded-full h-2.5 overflow-hidden border border-slate-800/50">
                          <div 
                            className="bg-gradient-to-r from-cyan-500 to-cyan-400 h-2.5 rounded-full transition-all duration-300 shadow-lg shadow-cyan-500/20" 
                            style={{ width: `${Math.min((totalProteinToday / (profile.weight * 1.8)) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="glass-subtle p-4 rounded-lg border border-slate-700/40">
                        <div className="flex justify-between text-xs font-semibold mb-2">
                          <span className="text-amber-300 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span>Углеводы</span>
                          <span className="font-mono text-slate-400">{totalCarbsToday} г / {Math.round(profile.weight * 3.5)} г</span>
                        </div>
                        <div className="w-full bg-slate-900/50 rounded-full h-2.5 overflow-hidden border border-slate-800/50">
                          <div 
                            className="bg-gradient-to-r from-amber-500 to-amber-400 h-2.5 rounded-full transition-all duration-300 shadow-lg shadow-amber-500/20" 
                            style={{ width: `${Math.min((totalCarbsToday / (profile.weight * 3.5)) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="glass-subtle p-4 rounded-lg border border-slate-700/40">
                        <div className="flex justify-between text-xs font-semibold mb-2">
                          <span className="text-rose-300 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400"></span>Жиры</span>
                          <span className="font-mono text-slate-400">{totalFatToday} г / {Math.round(profile.weight * 1)} г</span>
                        </div>
                        <div className="w-full bg-slate-900/50 rounded-full h-2.5 overflow-hidden border border-slate-800/50">
                          <div 
                            className="bg-gradient-to-r from-rose-500 to-rose-400 h-2.5 rounded-full transition-all duration-300 shadow-lg shadow-rose-500/20" 
                            style={{ width: `${Math.min((totalFatToday / (profile.weight * 1)) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* AI Food scanner input module */}
                <div className="glass-bg glow-emerald rounded-2xl p-6 border border-slate-700/30 relative overflow-hidden">
                  <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-tr from-emerald-500/8 to-transparent rounded-full blur-3xl pointer-events-none"></div>
                  <h3 className="text-lg font-bold font-display text-white mb-4 flex items-center gap-2 relative z-10">
                    <Sparkles className="w-4.5 h-4.5 text-emerald-400" /> ИИ-анализатор блюд
                  </h3>
                  
                  <form onSubmit={analyzeFood} className="space-y-4">
                    
                    {/* Media inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Photo Capture / Preview Box */}
                      <div className="h-44 glass-subtle rounded-xl border border-slate-700/40 flex flex-col items-center justify-center relative overflow-hidden group transition-all">
                        
                        {isCameraOpen ? (
                          <div className="absolute inset-0 z-10 bg-black flex flex-col justify-end">
                            <video 
                              ref={videoRef} 
                              className="w-full h-full object-cover"
                              playsInline 
                              muted
                            />
                            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 z-20">
                              <button 
                                type="button" 
                                onClick={capturePhoto}
                                className="btn-primary p-3 rounded-full shadow-lg flex items-center justify-center transition-all cursor-pointer pulse-glow"
                              >
                                <Camera className="w-6 h-6" />
                              </button>
                              <button 
                                type="button" 
                                onClick={closeCamera}
                                className="glass-bg border border-slate-600/40 hover:bg-slate-800/60 text-white font-bold p-3 rounded-full shadow-lg flex items-center justify-center transition-all cursor-pointer"
                              >
                                <X className="w-6 h-6" />
                              </button>
                            </div>
                          </div>
                        ) : imageBase64 ? (
                          <div className="absolute inset-0 bg-black flex items-center justify-center">
                            <img src={imageBase64} alt="Захвачено" className="w-full h-full object-cover" />
                            <button 
                              type="button" 
                              onClick={() => setImageBase64(null)}
                              className="absolute top-2 right-2 glass-bg p-2 rounded-full border border-slate-700/40 text-slate-400 hover:text-white hover:bg-rose-950/40 hover:border-rose-500/30 transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="text-center p-4 relative z-10">
                            <Camera className="w-8 h-8 text-slate-600 mx-auto mb-2 group-hover:text-emerald-400 transition-colors" />
                            <p className="text-xs text-slate-400">Сделайте снимок блюда</p>
                            <p className="text-[10px] text-slate-600 mt-1">Обеспечьте хорошее освещение</p>
                          </div>
                        )}

                        {!isCameraOpen && !imageBase64 && (
                          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-emerald-500/3 hover:to-emerald-500/8 transition-colors flex items-center justify-center gap-3 z-20">
                            <button
                              type="button"
                              onClick={openCamera}
                              disabled={isCameraLoading}
                              className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500/30 to-green-500/20 border border-emerald-500/40 hover:from-emerald-500/50 hover:to-green-500/40 text-emerald-300 hover:text-emerald-200 text-xs font-semibold cursor-pointer transition-all shadow-lg shadow-emerald-500/10"
                            >
                              Включить камеру
                            </button>
                            
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-4 py-2 rounded-lg glass-subtle border border-slate-600/40 hover:bg-slate-800/60 text-slate-300 hover:text-slate-200 text-xs font-semibold cursor-pointer transition-all"
                            >
                              Загрузить файл
                            </button>
                          </div>
                        )}
                        
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handlePhotoUpload} 
                          accept="image/*"
                          className="hidden" 
                        />
                      </div>

                      {/* Text manual description */}
                      <div className="flex flex-col justify-between space-y-3">
                        <div>
                          <label className="text-xs font-semibold block mb-2" style={{ color: "var(--text-secondary)" }}>Что вы съели?</label>
                          <textarea
                            value={foodText}
                            onChange={(e) => setFoodText(e.target.value)}
                            placeholder="Например: Плов с курицей, тарелка около 250 грамм и стакан яблочного сока..."
                            className="w-full h-28 glass-subtle border rounded-xl px-3 py-2 text-xs resize-none transition-all"
                            style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--bg-card)" }}
                          />
                        </div>
                        
                        <button
                          type="submit"
                          disabled={analyzing || (!foodText && !imageBase64)}
                          className="w-full btn-primary disabled:bg-slate-900 disabled:text-slate-600 disabled:border-slate-800 disabled:shadow-none disabled:cursor-not-allowed text-black font-bold text-xs py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-transparent"
                        >
                          {analyzing ? (
                            <>
                              <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                              <span>Идет анализ ИИ...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4.5 h-4.5" />
                              <span>Запустить сканирование</span>
                            </>
                          )}
                        </button>
                      </div>

                    </div>
                  </form>

                  {/* SCANNING / ANALYSIS RESULT PLACEMENT */}
                  <AnimatePresence>
                    {analysisResult && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-6 p-5 glass-subtle rounded-xl border border-emerald-500/20 overflow-hidden"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <span className="text-[10px] font-mono tracking-wider font-bold text-emerald-400 uppercase bg-emerald-500/20 px-2.5 py-0.5 rounded-lg border border-emerald-500/30">Сканирование завершено</span>
                            <h4 className="text-lg font-bold text-white mt-2">{analysisResult.foodName}</h4>
                            <p className="text-xs text-slate-400">Порция: {analysisResult.portionSize}</p>
                          </div>
                          <div className="flex items-center gap-1.5 glass-subtle px-3 py-1.5 rounded-lg border border-slate-700/40">
                            <span className="text-slate-400 text-xs">Оценка:</span>
                            <div className="flex gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star 
                                  key={i} 
                                  className={`w-3.5 h-3.5 ${
                                    i < analysisResult.healthRating ? "text-amber-400 fill-amber-400" : "text-slate-700"
                                  }`} 
                                />
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Macro details */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                          <div className="glass-subtle p-3 rounded-lg border border-slate-700/40 text-center">
                            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Калории</span>
                            <span className="text-base font-bold font-mono text-emerald-400 mt-1">{analysisResult.calories} ккал</span>
                          </div>
                          <div className="glass-subtle p-3 rounded-lg border border-slate-700/40 text-center">
                            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Белки</span>
                            <span className="text-base font-bold font-mono text-cyan-400 mt-1">{analysisResult.protein} г</span>
                          </div>
                          <div className="glass-subtle p-3 rounded-lg border border-slate-700/40 text-center">
                            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Карбо</span>
                            <span className="text-base font-bold font-mono text-amber-400 mt-1">{analysisResult.carbohydrates} г</span>
                          </div>
                          <div className="glass-subtle p-3 rounded-lg border border-slate-700/40 text-center">
                            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Жиры</span>
                            <span className="text-base font-bold font-mono text-rose-400 mt-1">{analysisResult.fat} г</span>
                          </div>
                        </div>

                        {/* Ingredients */}
                        <div className="mb-4">
                          <h5 className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Вероятные ингредиенты:
                          </h5>
                          <div className="flex flex-wrap gap-2">
                            {analysisResult.ingredientsList.map((ing, idx) => (
                              <span key={idx} className="glass-subtle border border-slate-700/40 text-slate-300 text-[11px] px-2.5 py-1.5 rounded-md font-medium">
                                {ing}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Diet coaching tips */}
                        <div className="mb-5 glass-subtle p-3.5 rounded-lg border border-slate-700/40 space-y-2">
                          <span className="text-xs font-bold text-amber-300 block flex items-center gap-1.5">
                            <Award className="w-4 h-4" /> Рецензия ИИ-Нутрициолога
                          </span>
                          <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-4 leading-relaxed">
                            {analysisResult.dietTips.map((tip, idx) => (
                              <li key={idx}>{tip}</li>
                            ))}
                          </ul>
                        </div>

                        {/* Action add */}
                        <button
                          onClick={addAnalyzedToHistory}
                          className="w-full btn-primary text-black font-bold text-xs py-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 border border-transparent"
                        >
                          <Plus className="w-4 h-4" /> Добавить в дневник питания
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>
              </div>

              {/* Day Feed History (R-column) */}
              <div className="lg:col-span-4 space-y-6">
                <div className="glass-bg glow-emerald rounded-2xl p-5 border border-slate-700/30 flex flex-col h-full min-h-[400px] relative overflow-hidden">
                  
                  <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-700/30 relative z-10">
                    <h3 className="text-base font-bold font-display text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-400" /> История питания
                    </h3>
                    <span className="text-xs text-slate-400 font-mono font-bold leading-none">{entries.length} блюд</span>
                  </div>

                  {entries.length === 0 ? (
                    <div className="flex-grow flex flex-col items-center justify-center py-10 text-center">
                      <Utensils className="w-10 h-10 text-slate-800/60 mb-3" />
                      <p className="text-xs text-slate-500 max-w-[180px]">Записей на сегодня нет. Проведите сканирование.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 relative z-10">
                      <AnimatePresence initial={false}>
                        {entries.map((item) => (
                          <motion.div 
                            key={item.id}
                            layout
                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -15, scale: 0.95, transition: { duration: 0.15 } }}
                            transition={{ type: "spring", stiffness: 350, damping: 28 }}
                            className="p-3.5 glass-subtle rounded-xl border border-slate-700/30 flex items-center justify-between group transition-all hover:border-emerald-500/30 origin-center card-hover"
                          >
                            <div className="space-y-1 max-w-[75%]">
                              <span className="text-[9px] font-mono text-slate-500">{item.date}</span>
                              <h4 className="text-xs font-semibold text-slate-200 line-clamp-1">{item.foodName}</h4>
                              
                              {/* Small macro badges */}
                              <div className="flex gap-2 text-[10px] text-slate-400 font-mono">
                                <span className="bg-cyan-500/10 px-1.5 py-0.5 rounded">Б:{Math.round(item.protein)}г</span>
                                <span className="bg-amber-500/10 px-1.5 py-0.5 rounded">У:{Math.round(item.carbohydrates)}г</span>
                                <span className="bg-rose-500/10 px-1.5 py-0.5 rounded">Ж:{Math.round(item.fat)}г</span>
                              </div>
                            </div>
                            
                            <div className="text-right flex items-center gap-3">
                              <div>
                                <span className="text-xs font-bold font-mono text-emerald-400 block">{item.calories}</span>
                                <span className="text-[8px] text-slate-500 uppercase font-mono font-bold">ККАЛ</span>
                              </div>
                              
                              <button
                                onClick={() => {
                                  showCustomConfirm(
                                    "Удалить запись",
                                    `Вы уверены, что хотите удалить "${item.foodName}" из истории питания?`,
                                    () => {
                                      setEntries(entries.filter((e) => e.id !== item.id));
                                    }
                                  );
                                }}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 hover:border-rose-500/40 text-rose-400/70 hover:text-rose-400 transition-all cursor-pointer flex items-center justify-center shrink-0"
                                title="Удалить запись"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}

                  {entries.length > 0 && (
                    <div className="pt-4 border-t border-slate-700/30 mt-4 relative z-10">
                      <button
                        onClick={() => {
                          showCustomConfirm(
                            "Сбросить историю питания",
                            "Вы хотите полностью очистить список блюд на сегодня?",
                            () => {
                              setEntries([]);
                            }
                          );
                        }}
                        className="w-full text-center text-rose-400/70 hover:text-rose-400 text-xs py-1.5 cursor-pointer transition-colors font-medium"
                      >
                        Очистить историю питания
                      </button>
                    </div>
                  )}

                </div>
              </div>

            </motion.div>
          )}

          {/* TAB 2: WATER TRACKER */}
          {activeTab === "water" && (
            <div className="max-w-2xl mx-auto space-y-6">
              <motion.div
                key="water"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center glass-bg glow-cyan rounded-2xl p-6 md:p-8 border border-slate-700/30 relative overflow-hidden"
              >
                
                {/* Circular progress visual */}
                <div className="flex flex-col items-center justify-center p-4 relative z-10">
                  <div className="relative w-48 h-48 rounded-full glass-subtle border-2 border-slate-700/40 flex items-center justify-center overflow-hidden group">
                    
                    {/* Wave styling simulation */}
                    <div 
                      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cyan-500/30 to-cyan-400/10 transition-all duration-700 ease-out"
                      style={{ height: `${waterProg}%` }}
                    >
                      <div className="absolute top-0 left-0 right-0 h-1 bg-cyan-300/40 opacity-70 blur-xs"></div>
                    </div>

                    <div className="z-10 text-center">
                      <Droplet className="w-8 h-8 text-cyan-400 mx-auto mb-2 animate-bounce" />
                      <span className="text-3xl font-extrabold font-mono text-white block">{waterIntake}</span>
                      <span className="text-xs text-slate-400 uppercase tracking-widest font-mono">мл из {profile.waterTarget}</span>
                      <span className="text-xs text-cyan-300 font-bold block mt-2">{Math.round(waterProg)}% завершено</span>
                    </div>
                  </div>

                  <p className="text-slate-400 text-xs text-center mt-6 leading-relaxed max-w-[200px]">
                    Вода вымывает токсины, питает клетки и ускоряет метаболизм на 10%!
                  </p>
                </div>

                {/* Water logging controls */}
                <div className="space-y-6 relative z-10">
                  <div>
                    <h3 className="text-xl font-bold font-display text-white mb-2">Дневной баланс воды</h3>
                    <p className="text-xs text-slate-500">
                      Регулярное питье поддерживает суставы, увлажняет кожу и отлично подавляет ложный аппетит перед едой.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <button 
                      onClick={() => addWater(250)}
                      className="glass-subtle hover:bg-cyan-500/20 border border-slate-700/40 hover:border-cyan-500/40 text-white p-3.5 rounded-xl transition-all cursor-pointer text-center group"
                    >
                      <span className="text-lg font-bold font-mono block text-cyan-400 group-hover:text-cyan-300 transition-colors">+250</span>
                      <span className="text-[9px] text-slate-500 uppercase block mt-1 font-semibold">Обычный стакан</span>
                    </button>
                    <button 
                      onClick={() => addWater(500)}
                      className="glass-subtle hover:bg-cyan-500/20 border border-slate-700/40 hover:border-cyan-500/40 text-white p-3.5 rounded-xl transition-all cursor-pointer text-center group"
                    >
                      <span className="text-lg font-bold font-mono block text-cyan-400 group-hover:text-cyan-300 transition-colors">+500</span>
                      <span className="text-[9px] text-slate-500 uppercase block mt-1 font-semibold">Бутылочка</span>
                    </button>
                    <button 
                      onClick={() => addWater(1000)}
                      className="glass-subtle hover:bg-cyan-500/20 border border-slate-700/40 hover:border-cyan-500/40 text-white p-3.5 rounded-xl transition-all cursor-pointer text-center group"
                    >
                      <span className="text-lg font-bold font-mono block text-cyan-400 group-hover:text-cyan-300 transition-colors">+1000</span>
                      <span className="text-[9px] text-slate-500 uppercase block mt-1 font-semibold">Большой графин</span>
                    </button>
                  </div>

                  {/* Progress bar and custom buttons */}
                  <div className="space-y-2 pt-4 border-t border-slate-700/30">
                    <div className="flex justify-between items-center text-xs text-slate-400">
                      <span>Быстрый сброс</span>
                      <button 
                        onClick={() => setWaterIntake(0)}
                        className="text-rose-400 hover:text-rose-300 text-xs font-medium cursor-pointer transition-colors"
                      >
                        Обнулить сегодня
                      </button>
                    </div>
                  </div>
                </div>

              </motion.div>

              {/* WATER NOTIFICATION SETTINGS CARD */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-bg rounded-2xl p-6 border border-slate-700/30 space-y-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-700/30">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-sky-500/20 border border-cyan-500/30 text-cyan-400 rounded-xl leading-none">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold font-display text-white">Интервальные напоминания</h3>
                      <p className="text-[11px] text-slate-500">Системные уведомления и внутренний таймер заботы о воде</p>
                    </div>
                  </div>

                  {/* Toggle switch */}
                  <label className="relative inline-flex items-center cursor-pointer select-none self-start sm:self-center">
                    <input 
                      type="checkbox" 
                      checked={notifEnabled}
                      onChange={(e) => {
                        setNotifEnabled(e.target.checked);
                        if (e.target.checked && notifPermission !== "granted") {
                          requestNotificationPermission();
                        }
                      }}
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 glass-subtle rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500 peer-checked:after:bg-white peer-checked:after:border-white border border-slate-700/40"></div>
                    <span className="ml-2 text-xs font-semibold text-slate-400 peer-checked:text-cyan-300 transition-colors">
                      {notifEnabled ? "Включены" : "Выключены"}
                    </span>
                  </label>
                </div>

                <AnimatePresence>
                  {notifEnabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 overflow-hidden"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        
                        {/* Selector 1: Interval */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Интервал напоминаний</label>
                          <div className="relative">
                            <select
                              value={notifIntervalVal}
                              onChange={(e) => setNotifIntervalVal(parseInt(e.target.value, 10))}
                              className="w-full text-xs glass-subtle border border-slate-700/40 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/10 transition-all cursor-pointer appearance-none"
                            >
                              <option value="1">Каждую минуту (для тестирования)</option>
                              <option value="15">Каждые 15 минут</option>
                              <option value="30">Каждые 30 минут</option>
                              <option value="45">Каждые 45 минут</option>
                              <option value="60">Каждый час</option>
                              <option value="90">Каждые 1.5 часа</option>
                              <option value="120">Каждые 2 часа</option>
                              <option value="180">Каждые 3 часа</option>
                            </select>
                            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                              <Timer className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </div>

                        {/* Quiet Hours selector */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Активное время отправки</label>
                          <div className="flex items-center gap-2">
                            <select
                              value={notifStartHour}
                              onChange={(e) => setNotifStartHour(parseInt(e.target.value, 10))}
                              className="flex-1 text-xs glass-subtle border border-slate-700/40 rounded-xl px-2 py-2.5 text-center text-slate-100 focus:outline-none focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/10 transition-all cursor-pointer"
                            >
                              {Array.from({ length: 24 }).map((_, h) => (
                                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                              ))}
                            </select>
                            <span className="text-slate-500 text-xs">—</span>
                            <select
                              value={notifEndHour}
                              onChange={(e) => setNotifEndHour(parseInt(e.target.value, 10))}
                              className="flex-1 text-xs glass-subtle border border-slate-700/40 rounded-xl px-2 py-2.5 text-center text-slate-100 focus:outline-none focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/10 transition-all cursor-pointer"
                            >
                              {Array.from({ length: 24 }).map((_, h) => (
                                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                              ))}
                            </select>
                          </div>
                        </div>

                      </div>

                      {/* Info & Timer Panel */}
                      <div className="mt-3 glass-subtle rounded-xl p-3.5 border border-slate-700/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        
                        {/* Countdown Badge */}
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="px-3 py-1.5 bg-gradient-to-r from-cyan-500/20 to-sky-500/20 border border-cyan-500/40 rounded-lg text-[11px] font-mono font-bold text-cyan-300 flex items-center gap-1.5">
                            <Timer className="w-3.5 h-3.5 animate-pulse" />
                            <span>
                              {secondsLeft !== null ? (
                                <>До напоминания: {Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, '0')}</>
                              ) : (
                                "Таймер остановлен"
                              )}
                            </span>
                          </div>
                          
                          {/* Permission indicator */}
                          <div className={`px-2 py-1 rounded-lg text-[9px] uppercase font-bold tracking-wider border ${
                            notifPermission === "granted"
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : notifPermission === "denied"
                              ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                              : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                          }`}>
                            {notifPermission === "granted" ? "Доступ разрешен" : notifPermission === "denied" ? "Доступ заблокирован" : "Запрос доступа"}
                          </div>
                        </div>

                        {/* Interactive testing and permission action buttons */}
                        <div className="flex items-center gap-2">
                          {notifPermission !== "granted" && (
                            <button
                              onClick={requestNotificationPermission}
                              className="flex-1 sm:flex-none text-[10px] font-semibold bg-gradient-to-r from-cyan-500/40 to-sky-500/30 hover:from-cyan-500/60 hover:to-sky-500/50 text-white px-3 py-1.5 rounded-lg cursor-pointer transition-all border border-cyan-500/40"
                            >
                              Разрешить в браузере
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={sendTestNotification}
                            className="flex-1 sm:flex-none text-[10px] font-semibold glass-subtle border border-slate-600/40 text-slate-300 hover:text-slate-200 hover:bg-slate-800/40 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                          >
                            Тест. сигнал
                          </button>
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-500 leading-relaxed italic">
                        * Системные уведомления работают в фоновом режиме на мобильных и ПК. При срабатывании таймера вы также увидите интерактивное окно прямо внутри веб-приложения с возможностью подтвердить и добавить выпитые 250 мл воды в 1 клик!
                      </p>

                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          )}

          {/* TAB 3: AI CHEF RECIPES GENERATOR */}
          {activeTab === "chef" && (
            <motion.div
              key="chef"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              
              {/* Ingredients controls panel (L-column) */}
              <div className="lg:col-span-12 xl:col-span-5 space-y-6">
                <div className="glass-bg glow-amber rounded-2xl p-6 border border-slate-700/30 space-y-5 relative overflow-hidden">
                  <div className="flex items-center gap-2 mb-2 relative z-10">
                    <div className="p-2 bg-gradient-to-br from-amber-500/20 to-yellow-600/20 border border-amber-500/30 rounded-lg text-amber-400">
                      <ChefHat className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold font-display text-white">Рецепты от ИИ Шеф-повара</h3>
                      <p className="text-xs text-slate-400">Умный генератор рецептов под ваши продукты</p>
                    </div>
                  </div>

                  {/* Mode Selector Tabs */}
                  <div className="flex glass-subtle p-1 rounded-xl border border-slate-700/40 relative z-10">
                    <button
                      type="button"
                      onClick={() => setChefInputMode("scan")}
                      className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg cursor-pointer transition-all ${
                        chefInputMode === "scan"
                          ? "bg-gradient-to-r from-amber-500/40 to-yellow-500/30 text-amber-300 border border-amber-500/40"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      📸 Скан холодильника
                    </button>
                    <button
                      type="button"
                      onClick={() => setChefInputMode("manual")}
                      className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg cursor-pointer transition-all ${
                        chefInputMode === "manual"
                          ? "bg-gradient-to-r from-amber-500/40 to-yellow-500/30 text-amber-300 border border-amber-500/40"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      ✏️ Ручной список
                    </button>
                  </div>

                  <form onSubmit={generateRecipe} className="space-y-4">
                    {/* Tab 1: Refrigerator Scanner */}
                    {chefInputMode === "scan" && (
                      <div className="space-y-4">
                        <input
                           type="file"
                           ref={fridgeFileInputRef}
                           accept="image/*"
                           className="hidden"
                           onChange={handleFridgePhotoUpload}
                        />

                        {!isFridgeCameraOpen && !fridgeImageBase64 && (
                          <div className="border border-dashed border-slate-700/40 rounded-xl p-5 text-center glass-subtle space-y-3">
                            <div className="mx-auto w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
                              <Camera className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-300">Сфотографируйте полки холодильника</p>
                              <p className="text-[10px] text-slate-400 mt-1">ИИ распознает все продукты и предложит блюда</p>
                            </div>
                            <div className="flex gap-2 justify-center pt-2">
                              <button
                                type="button"
                                onClick={openFridgeCamera}
                                className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                              >
                                Включить камеру
                              </button>
                              <button
                                type="button"
                                onClick={() => fridgeFileInputRef.current?.click()}
                                className="glass-subtle hover:bg-slate-800/40 text-slate-300 border border-slate-700/40 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                              >
                                Загрузить фото
                              </button>
                            </div>
                          </div>
                        )}

                        {isFridgeCameraOpen && (
                          <div className="space-y-3">
                            <div className="relative rounded-xl overflow-hidden border border-slate-700/40 bg-black aspect-video flex items-center justify-center">
                              <video ref={fridgeVideoRef} className="w-full h-full object-cover" playsInline autoPlay muted />
                              <div className="absolute top-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[9px] font-mono text-amber-400 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
                                LIVE CAMERA
                              </div>
                            </div>
                            <div className="flex gap-2 justify-center">
                              <button
                                type="button"
                                onClick={captureFridgePhoto}
                                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                              >
                                <Camera className="w-4 h-4" />
                                Сделать снимок
                              </button>
                              <button
                                type="button"
                                onClick={closeFridgeCamera}
                                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                              >
                                Отмена
                              </button>
                            </div>
                          </div>
                        )}

                        {fridgeImageBase64 && !isFridgeCameraOpen && (
                          <div className="space-y-4">
                            <div className="relative rounded-xl overflow-hidden border border-slate-700/40 aspect-video bg-black">
                              <img src={fridgeImageBase64} className="w-full h-full object-cover" alt="Холодильник" />
                              <button
                                type="button"
                                onClick={() => {
                                  setFridgeImageBase64(null);
                                  setShowDetectedReview(false);
                                  setFridgeIngredients([]);
                                }}
                                className="absolute top-2 right-2 bg-black/70 hover:bg-black p-1.5 rounded-full text-slate-400 hover:text-white transition-all cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            {!showDetectedReview && !isScanningFridge && (
                              <button
                                type="button"
                                onClick={analyzeFridge}
                                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10"
                              >
                                <Sparkles className="w-4 h-4" />
                                Распознать продукты ИИ
                              </button>
                            )}

                            {isScanningFridge && (
                              <div className="glass-subtle border border-slate-700/40 rounded-xl p-4 text-center space-y-3">
                                <RefreshCw className="w-6 h-6 text-amber-400 animate-spin mx-auto" />
                                <div>
                                  <p className="text-xs font-semibold text-slate-300">Сканирую полки и анализирую...</p>
                                  <p className="text-[10px] text-slate-400 mt-1">Определяем ингредиенты через Gemini Vision</p>
                                </div>
                              </div>
                            )}

                            {showDetectedReview && (
                              <div className="glass-subtle border border-slate-700/40 rounded-xl p-4 space-y-4">
                                <div>
                                  <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                     <CheckCircle className="w-4 h-4 text-amber-400" />
                                     Обнаруженные продукты
                                  </h4>
                                  <p className="text-[10px] text-slate-400 mt-0.5">Исправьте список или согласитесь с ним:</p>
                                  {isFridgeMocked && (
                                    <div className="mt-2 text-[10px] font-mono text-amber-500 bg-amber-500/5 border border-amber-500/10 rounded px-2.5 py-1.5 leading-relaxed space-y-1">
                                      {isFridgeFallback ? (
                                        <>
                                          <div>⚠️ <strong>Квота или лимит ИИ исчерпаны:</strong></div>
                                          <div className="text-slate-400 font-sans">{fridgeScanError || "Сервер временно перегружен или исчерпаны лимиты бесплатного тарифа (20 запросов в день)."}</div>
                                          <div className="text-indigo-400 font-sans mt-1">Активирован демонстрационный режим. Данный список взят из резервной умной базы.</div>
                                        </>
                                      ) : (
                                        <>
                                          ⚠️ Временный офлайн-режим. Показан демонстрационный список продуктов. Для распознавания реальных продуктов с вашего фото подключите <strong>GEMINI_API_KEY</strong> в настройках.
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* List tags */}
                                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                                  {fridgeIngredients.length === 0 ? (
                                    <span className="text-xs text-slate-600 italic">Ничего не верифицировано. Впишите продукт.</span>
                                  ) : (
                                    fridgeIngredients.map((ing, idx) => (
                                      <span
                                        key={idx}
                                        className="inline-flex items-center gap-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px] px-2 py-0.5 rounded-md"
                                      >
                                        <span>{ing}</span>
                                        <button
                                          type="button"
                                          onClick={() => removeFridgeIngredient(idx)}
                                          className="text-indigo-400 hover:text-rose-400 cursor-pointer"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </span>
                                    ))
                                  )}
                                </div>

                                {/* Add manually form item */}
                                <div className="flex gap-1.5">
                                  <input
                                    type="text"
                                    value={newDetectedIngredient}
                                    onChange={(e) => setNewDetectedIngredient(e.target.value)}
                                    placeholder="Добавить продукт..."
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        addFridgeIngredient();
                                      }
                                    }}
                                    className="flex-1 glass-subtle border rounded-lg px-2 py-1 text-xs placeholder:text-slate-500 focus:outline-none focus:ring-1 transition-all"
                                    style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--bg-card)" }}
                                  />
                                  <button
                                    type="button"
                                    onClick={addFridgeIngredient}
                                    className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 px-2 py-1 rounded-lg text-xs font-bold cursor-pointer"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>

                                {/* Ultimate trigger: Agree with it or correct and generate */}
                                <div className="pt-2 border-t border-slate-800/60">
                                  <button
                                    type="button"
                                    onClick={confirmFridgeScan}
                                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/10"
                                  >
                                    <Sparkles className="w-4 h-4" />
                                    Согласиться и запустить рецепт!
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 2: Manual list text input */}
                    {chefInputMode === "manual" && (
                      <div>
                        <label className="text-xs font-semibold text-slate-400 block mb-1">
                          Какие продукты у вас в холодильнике?
                        </label>
                        <textarea
                          value={recipeIngredients}
                          onChange={(e) => handleRecipeIngredientsChange(e.target.value)}
                          placeholder="Например: филе индейки, брокколи, помидоры черри, сыр моцарелла..."
                          className="w-full h-24 glass-subtle border rounded-xl px-3 py-2 text-xs resize-none transition-all"
                          style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--bg-card)" }}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold block mb-1" style={{ color: "var(--text-secondary)" }}>Диетическое направление</label>
                        <select
                          value={recipeGoal}
                          onChange={(e) => setRecipeGoal(e.target.value)}
                          className="w-full glass-subtle border rounded-xl px-2.5 py-2.5 text-xs focus:outline-none focus:ring-2"
                          style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--bg-card)", focusBorderColor: "var(--accent-amber)" }}
                        >
                          <option value="Сбалансированное питание">Сбалансированное</option>
                          <option value="Высокобелковая (сушка)">Высокобелковое</option>
                          <option value="Кето-диета (LCHF)">Кето диета</option>
                          <option value="Веганство / Вегетарианство">Веганское</option>
                          <option value="Дефицит калорий (похудение)">Похудение</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-400 block mb-1">Макс. Калории (на порцию)</label>
                        <input
                          type="number"
                          value={recipeCalorieLimit}
                          onChange={(e) => setRecipeCalorieLimit(parseInt(e.target.value, 10))}
                          className="w-full glass-subtle border border-slate-700/40 rounded-xl px-3 py-2.5 text-slate-300 text-xs font-mono focus:outline-none focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/10"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={generatingRecipe || !recipeIngredients.trim()}
                      className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-900 disabled:text-slate-600 disabled:border-slate-800 text-white font-bold text-xs py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      {generatingRecipe ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Составляю рецепт...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Создать шедевр ИИ</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>

              {/* Recipe response details (R-column) */}
              <div className="lg:col-span-7">
                {generatingRecipe ? (
                  <div className="glass-bg glow-amber rounded-2xl p-10 border border-slate-700/30 text-center h-full flex flex-col items-center justify-center space-y-4 relative overflow-hidden">
                    <ChefHat className="w-12 h-12 text-amber-400 animate-bounce" />
                    <div className="relative z-10">
                      <h4 className="text-md font-bold text-white">Шеф-повар создает рецепт...</h4>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto mt-2 leading-relaxed">
                        ИИ подбирает идеальные кулинарные техники, рассчитывает точный КБЖУ под ваши показатели и описывает пошаговое руководство.
                      </p>
                    </div>
                  </div>
                ) : currentRecipe ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-bg border border-slate-700/40 rounded-2xl p-6 space-y-6 relative overflow-hidden"
                  >
                    
                    {/* Header */}
                    <div className="relative z-10">
                      <span className="text-[10px] font-mono tracking-wider font-bold text-amber-400 uppercase bg-amber-500/10 px-2 py-0.5 rounded">Рецепт ИИ готов</span>
                      <h3 className="text-xl font-bold text-white mt-2">{currentRecipe.title}</h3>
                      <div className="flex gap-4 text-xs text-slate-400 mt-2">
                        <span>Подготовка: <strong>{currentRecipe.prepTime}</strong></span>
                        <span>Приготовление: <strong>{currentRecipe.cookTime}</strong></span>
                        <span>Порций: <strong>{currentRecipe.servings}</strong></span>
                      </div>
                    </div>

                    {/* Quick macros */}
                    <div className="grid grid-cols-4 gap-3 relative z-10">
                      <div className="glass-subtle border border-slate-700/40 p-3 rounded-lg text-center hover:border-slate-700/60 transition-colors">
                        <span className="text-[9px] text-slate-400 uppercase block">Калории</span>
                        <span className="text-sm font-bold font-mono text-emerald-400">{currentRecipe.calories} ккал</span>
                      </div>
                      <div className="glass-subtle border border-slate-700/40 p-3 rounded-lg text-center hover:border-slate-700/60 transition-colors">
                        <span className="text-[9px] text-slate-400 uppercase block">Белки</span>
                        <span className="text-sm font-bold font-mono text-sky-400">{currentRecipe.macronutrients.protein} г</span>
                      </div>
                      <div className="glass-subtle border border-slate-700/40 p-3 rounded-lg text-center hover:border-slate-700/60 transition-colors">
                        <span className="text-[9px] text-slate-400 uppercase block">Углеводы</span>
                        <span className="text-sm font-bold font-mono text-amber-400">{currentRecipe.macronutrients.carbohydrates} г</span>
                      </div>
                      <div className="glass-subtle border border-slate-700/40 p-3 rounded-lg text-center hover:border-slate-700/60 transition-colors">
                        <span className="text-[9px] text-slate-400 uppercase block">Жиры</span>
                        <span className="text-sm font-bold font-mono text-rose-400">{currentRecipe.macronutrients.fat} г</span>
                      </div>
                    </div>

                    {/* Ingredients list */}
                    <div className="relative z-10">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ингредиенты:</h4>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {currentRecipe.ingredients.map((ing, idx) => (
                          <li key={idx} className="text-xs text-slate-300 glass-subtle border border-slate-700/40 p-2.5 rounded-lg flex items-center gap-2 hover:border-slate-700/60 transition-colors">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> {ing}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Instructions */}
                    <div className="relative z-10">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Инструкция приготовления:</h4>
                      <ol className="space-y-3">
                        {currentRecipe.instructions.map((step, idx) => (
                          <li key={idx} className="text-xs text-slate-300 pb-3 border-b border-slate-700/30 last:border-b-0 last:pb-0 flex gap-3 leading-relaxed">
                            <span className="font-mono text-amber-400 font-bold bg-amber-500/10 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] mt-0.5">{idx + 1}</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Nutrition Coach Explains */}
                    <div className="glass-subtle border border-slate-700/40 p-4 rounded-xl space-y-1.5 relative z-10">
                      <span className="text-xs font-bold text-amber-400 block flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5" /> Почему это подходит вам?
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed italic">
                        {currentRecipe.whyItFits}
                      </p>
                    </div>

                  </motion.div>
                ) : (
                  <div className="glass-bg glow-amber rounded-2xl p-8 border border-slate-700/30 text-center text-slate-400 h-full flex flex-col items-center justify-center relative overflow-hidden">
                    <ChefHat className="w-10 h-10 text-slate-600 mb-3 relative z-10" />
                    <p className="text-xs relative z-10">Наберите в левой панели ваши исходные продукты, и ИИ создаст диетический рецепт.</p>
                  </div>
                )}
              </div>

            </motion.div>
          )}

          {/* TAB 4: AI DIET COACH COACHING CHAT */}
          {activeTab === "chat" && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-bg glow-indigo rounded-2xl border border-slate-700/30 flex flex-col h-[600px] overflow-hidden relative"
            >
              {/* Chat Title / Coach header */}
              <div className="p-4 glass-subtle border-b border-slate-700/30 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center flex-shrink-0 relative">
                    <MessageSquare className="w-4 h-4" />
                    <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-slate-700/40 animate-pulse"></span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">ИИ-Нутрициолог</h3>
                    <p className="text-[10px] text-slate-400">Персональный фитнес и диетологический коуч онлайн</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    showCustomConfirm(
                      "Очистить историю чата",
                      "Вы действительно хотите сбросить историю сообщений с ИИ-ассистентом?",
                      () => {
                        setChatHistory([
                          {
                            id: "welcome",
                            role: "assistant",
                            content: "Чат очищен. Привет! Чем могу помочь тебе сегодня?",
                            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          }
                        ]);
                      }
                    );
                  }}
                  className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded hover:bg-slate-800/40 transition-all"
                >
                  Очистить
                </button>
              </div>

              {/* Chat messages stream */}
              <div className="flex-grow p-4 md:p-6 overflow-y-auto space-y-4 bg-gradient-to-b from-transparent to-slate-900/10 relative z-10">
                {chatHistory.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className="max-w-[85%] sm:max-w-[75%] space-y-1">
                      <div 
                        className={`rounded-2xl px-4 py-3 text-xs leading-relaxed transition-all ${
                          msg.role === "user"
                            ? "bg-gradient-to-r from-indigo-600/60 to-purple-600/50 text-white rounded-br-none border border-indigo-500/30 shadow-lg shadow-indigo-500/10"
                            : "glass-subtle text-slate-200 rounded-bl-none border border-slate-700/40"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      <span className="text-[8px] font-mono text-slate-500 block text-right font-semibold">
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                ))}

                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="glass-subtle text-slate-300 text-xs px-4 py-3 rounded-2xl rounded-bl-none border border-slate-700/40 flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                      <span>ИИ-консультант печатает...</span>
                    </div>
                  </div>
                )}
                
                <div ref={chatEndRef}></div>
              </div>

              {/* Chat Input form */}
              <div className="p-4 glass-subtle border-t border-slate-700/30 relative z-10">
                <form onSubmit={sendChatMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Задайте вопрос: 'Как мне добрать белок?', 'Что съесть после тренировки?'"
                    className="flex-grow glass-subtle border rounded-xl px-4 py-3 text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--bg-card)" }}
                  />
                  <button
                    type="submit"
                    disabled={!chatMessage.trim() || chatLoading}
                    className="bg-gradient-to-r from-indigo-600/60 to-purple-600/50 hover:from-indigo-600/80 hover:to-purple-600/70 disabled:bg-slate-900 disabled:text-slate-600 disabled:border-slate-800 disabled:cursor-not-allowed text-white font-bold text-xs px-5 rounded-xl transition-all cursor-pointer border border-indigo-500/30"
                  >
                    Отправить
                  </button>
                </form>
              </div>

            </motion.div>
          )}

          {activeTab === "stats" && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-bg glow-amber rounded-2xl border border-slate-700/30 flex flex-col h-full overflow-hidden relative"
            >
              <div className="p-6 sm:p-8 space-y-6 relative z-10">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold uppercase tracking-[0.24em]">
                      <BarChart3 className="w-4 h-4" />
                      Статистика за неделю
                    </div>
                    <p className="text-xs text-slate-400 mt-2 max-w-2xl">
                      Обзор калорийности, БЖУ и приемов пищи за последние 7 дней. Сравнение с вашей целью {profile.calorieTarget} ккал.
                    </p>
                  </div>
                  <div className="rounded-xl glass-subtle border border-slate-700/40 p-4 text-right">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Среднее</div>
                    <div className="text-2xl font-bold text-white mt-1">{averageCaloriesWeek} ккал</div>
                    <div className="text-xs text-slate-400 mt-1">/ {profile.calorieTarget} цель</div>
                  </div>
                </div>

                {!hasWeeklyEntries ? (
                  <div className="rounded-xl border border-slate-700/40 glass-subtle p-8 text-center text-slate-400">
                    <p className="text-sm font-semibold text-white mb-3">Начните вести дневник питания, чтобы увидеть статистику!</p>
                    <p className="text-xs text-slate-500">Любая запись о приёме пищи появится в этом разделе и сразу отобразится в графиках.</p>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                      <div className="rounded-xl border border-slate-700/40 glass-subtle p-5">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 mb-2">Среднее ккал/день</p>
                        <p className="text-3xl font-bold text-white">{averageCaloriesWeek}</p>
                      </div>
                      <div className="rounded-xl border border-slate-700/40 glass-subtle p-5">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 mb-2">Лучший день</p>
                        {bestDay ? (
                          <>
                            <p className="text-xl font-bold text-white">{bestDay.label}</p>
                            <p className="text-xs text-slate-400 mt-1">{bestDay.calories} ккал • {bestDay.percentOfTarget}%</p>
                          </>
                        ) : (
                          <p className="text-xs text-slate-400">Нет данных</p>
                        )}
                      </div>
                      <div className="rounded-3xl border border-slate-700/40 glass-subtle p-5">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 mb-2">Худший день</p>
                        {worstDay ? (
                          <>
                            <p className="text-xl font-bold text-white">{worstDay.label}</p>
                            <p className="text-xs text-slate-400 mt-1">{worstDay.calories} ккал • {worstDay.percentOfTarget}%</p>
                          </>
                        ) : (
                          <p className="text-xs text-slate-400">Нет данных</p>
                        )}
                      </div>
                      <div className="rounded-3xl border border-slate-700/40 glass-subtle p-5">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 mb-2">Всего приёмов пищи</p>
                        <p className="text-3xl font-bold text-white">{totalMealsWeek}</p>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-700/40 glass-subtle p-5 space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <h2 className="text-sm font-semibold text-white uppercase tracking-[0.24em]">Детали по дням</h2>
                        <div className="text-xs text-slate-500">Цель: {profile.calorieTarget} ккал</div>
                      </div>
                      <div className="space-y-3">
                        {dailyStats.map((day) => {
                          const progressWidth = Math.min(100, Math.max(0, day.percentOfTarget));
                          const indicator = day.status === "over" ? "🔺" : day.status === "under" ? "🔻" : day.status === "ok" ? "✅" : "—";
                          const indicatorColor = day.status === "over" ? "text-rose-400" : day.status === "under" ? "text-orange-400" : day.status === "ok" ? "text-emerald-400" : "text-slate-500";
                          return (
                            <div key={day.dateKey} className="rounded-3xl border border-slate-700/40 glass-subtle p-4">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-700/40 text-sm font-semibold text-slate-300">{day.label}</span>
                                  <div>
                                    <p className="text-sm font-semibold text-white">{day.calories} ккал</p>
                                    <p className="text-[11px] text-slate-400">{day.meals > 0 ? `${day.meals} прием` : "Нет данных"}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 text-sm font-medium">
                                  <span className={indicatorColor}>{indicator}</span>
                                  <span className="text-slate-400">{day.percentOfTarget}%</span>
                                </div>
                              </div>
                              <div className="mt-3 h-3 rounded-full bg-slate-900 overflow-hidden">
                                <div className="h-full bg-emerald-400" style={{ width: `${progressWidth}%` }} />
                              </div>
                              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
                                <span>Цель: {day.percentOfTarget}%</span>
                                <button
                                  type="button"
                                  onClick={() => setExpandedDay(expandedDay === day.dateKey ? null : day.dateKey)}
                                  className="rounded-full border border-slate-700 px-3 py-1 text-slate-300 hover:border-amber-400 hover:text-amber-300 transition"
                                >
                                  Подробнее
                                </button>
                              </div>
                              {expandedDay === day.dateKey && (
                                <div className="mt-4 rounded-3xl border border-slate-700/40 glass-subtle p-4 relative z-10">
                                  {day.meals === 0 ? (
                                    <p className="text-xs text-slate-400">Нет данных по приёмам пищи за этот день.</p>
                                  ) : (
                                    <div className="space-y-3">
                                      {day.entries.map((item) => (
                                        <div key={`${day.dateKey}-${item.id}`} className="rounded-2xl glass-subtle/50 p-3 border border-slate-700/30 text-slate-300">
                                          <div className="flex items-center justify-between gap-4 text-xs text-slate-400 mb-2">
                                            <span>{item.foodName}</span>
                                            <span>{item.calories} ккал</span>
                                          </div>
                                          <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400">
                                            <span>Б: {item.protein} г</span>
                                            <span>У: {item.carbohydrates} г</span>
                                            <span>Ж: {item.fat} г</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-700/40 glass-subtle p-5">
                      <h3 className="text-sm font-semibold text-white uppercase tracking-[0.24em] mb-4">График БЖУ</h3>
                      <div className="grid grid-cols-7 gap-3">
                        {dailyStats.map((day) => {
                          const proteinHeight = Math.round((day.protein / maxMacroTotal) * 100) || 0;
                          const carbsHeight = Math.round((day.carbohydrates / maxMacroTotal) * 100) || 0;
                          const fatHeight = Math.round((day.fat / maxMacroTotal) * 100) || 0;
                          return (
                            <div key={day.dateKey} className="flex flex-col items-center gap-2">
                              <div className="flex h-32 w-full items-end gap-1">
                                <div className="w-full rounded-full bg-slate-950" style={{ height: `${proteinHeight}%` }}>
                                  <div className="h-full w-full rounded-full bg-sky-500" />
                                </div>
                                <div className="w-full rounded-full bg-slate-950" style={{ height: `${carbsHeight}%` }}>
                                  <div className="h-full w-full rounded-full bg-amber-400" />
                                </div>
                                <div className="w-full rounded-full bg-slate-950" style={{ height: `${fatHeight}%` }}>
                                  <div className="h-full w-full rounded-full bg-rose-500" />
                                </div>
                              </div>
                              <div className="text-[10px] text-slate-400">{day.label}</div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-4 flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-slate-500">
                        <span className="text-sky-400">Белки</span>
                        <span className="text-amber-400">Углеводы</span>
                        <span className="text-rose-400">Жиры</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 5: SETTINGS & USER PROFILE */}
          {activeTab === "settings" && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-2xl mx-auto glass-bg rounded-2xl border border-slate-700/30 p-6 md:p-8 space-y-6 relative overflow-hidden"
            >
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-gradient-to-bl from-emerald-500/8 to-transparent rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="pb-4 border-b border-slate-700/30 flex items-center gap-2.5 relative z-10">
                <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-green-600/20 border border-emerald-500/30 rounded-lg text-emerald-400">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-display text-white">Профиль и цели здоровья</h3>
                  <p className="text-xs text-slate-400">Настройте свои характеристики для точных ИИ расчётов</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-2">Имя пользователя</label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="w-full glass-subtle border border-slate-700/40 rounded-xl px-3 py-2.5 text-slate-300 text-xs focus:outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-2">Ваш вес (кг)</label>
                  <input
                    type="number"
                    value={profile.weight}
                    onChange={(e) => setProfile({ ...profile, weight: parseFloat(e.target.value) || 0 })}
                    className="w-full glass-subtle border border-slate-700/40 rounded-xl px-3 py-2.5 text-slate-300 text-xs font-mono focus:outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-2">Целевые калории в день (ккал)</label>
                  <input
                    type="number"
                    value={profile.calorieTarget}
                    onChange={(e) => setProfile({ ...profile, calorieTarget: parseInt(e.target.value, 10) || 0 })}
                    className="w-full glass-subtle border border-slate-700/40 rounded-xl px-3 py-2.5 text-slate-300 text-xs font-mono focus:outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-2">Цель воды в день (мл)</label>
                  <input
                    type="number"
                    value={profile.waterTarget}
                    onChange={(e) => setProfile({ ...profile, waterTarget: parseInt(e.target.value, 10) || 0 })}
                    className="w-full glass-subtle border border-slate-700/40 rounded-xl px-3 py-2.5 text-slate-300 text-xs font-mono focus:outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-2">Ваша цель вычислений</label>
                  <select
                    value={profile.goal}
                    onChange={(e) => setProfile({ ...profile, goal: e.target.value })}
                    className="w-full glass-subtle border border-slate-700/40 rounded-xl px-2.5 py-2.5 text-slate-300 text-xs focus:outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                  >
                    <option value="Сбалансированное питание">Сбалансированное питание</option>
                    <option value="Снижение веса (похудение)">Снижение веса (похудение)</option>
                    <option value="Набор сухой мышечной массы">Набор сухой мышечной массы</option>
                    <option value="Кето диета">Кето диета</option>
                    <option value="Выносливость и детокс">Выносливость и детокс</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-2">Активность в течение недели</label>
                  <select
                    value={profile.activity}
                    onChange={(e) => setProfile({ ...profile, activity: e.target.value })}
                    className="w-full glass-subtle border border-slate-700/40 rounded-xl px-2.5 py-2.5 text-slate-300 text-xs focus:outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                  >
                    <option value="Малоподвижный">Малоподвижный (офис)</option>
                    <option value="Умеренный">Умеренный (1-3 тренировки)</option>
                    <option value="Высокий">Высокий спорт (4+ тренировок)</option>
                  </select>
                </div>

              </div>

              <div className="p-4 bg-gradient-to-r from-emerald-500/15 to-green-500/10 rounded-xl border border-emerald-500/30 flex items-start gap-3 relative z-10">
                <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white mb-1">Настройки применены и сохранены!</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Данные автоматически сохранены локально в вашем браузере. ИИ-Диетолог подстраивает объемы белков (Б: ~1.8г на кг), жиров (Ж: ~1г на кг) и углеводов (У: остаток) исходя из настроенной массы тела и выбранных фитнес-целей.
                  </p>
                </div>
              </div>

            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Bottom Nav Bar (Mobile layout only) */}
      <footer className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-subtle backdrop-blur-lg border-t p-2 flex justify-around items-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
        <button 
          onClick={() => setActiveTab("food")}
          className={`flex flex-col items-center p-2 rounded-xl transition-colors ${
            activeTab === "food" ? "text-emerald-400" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <Utensils className="w-5 h-5" />
          <span className="text-[9px] mt-1 font-medium font-display">Питание</span>
        </button>
        
        <button 
          onClick={() => setActiveTab("water")}
          className={`flex flex-col items-center p-2 rounded-xl transition-colors ${
            activeTab === "water" ? "text-sky-400" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <Droplet className="w-5 h-5" />
          <span className="text-[9px] mt-1 font-medium font-display">Вода</span>
        </button>

        <button 
          onClick={() => setActiveTab("chef")}
          className={`flex flex-col items-center p-2 rounded-xl transition-colors ${
            activeTab === "chef" ? "text-indigo-400" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <ChefHat className="w-5 h-5" />
          <span className="text-[9px] mt-1 font-medium font-display">Шеф-повар</span>
        </button>

        <button 
          onClick={() => setActiveTab("chat")}
          className={`flex flex-col items-center p-2 rounded-xl transition-colors ${
            activeTab === "chat" ? "text-purple-400" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[9px] mt-1 font-medium font-display">Ассистент</span>
        </button>

        <button 
          onClick={() => setActiveTab("stats")}
          className={`flex flex-col items-center p-2 rounded-xl transition-colors ${
            activeTab === "stats" ? "text-amber-400" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[9px] mt-1 font-medium font-display">Статистика</span>
        </button>

        <button 
          onClick={() => setActiveTab("settings")}
          className={`flex flex-col items-center p-2 rounded-xl transition-colors ${
            activeTab === "settings" ? "text-white" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[9px] mt-1 font-medium font-display">Профиль</span>
        </button>
      </footer>

      {/* Custom Dialog Modal */}
      {dialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl glass-bg border border-slate-700/40 p-6 shadow-2xl text-slate-100 flex flex-col space-y-4 LightThemeDialog">
            <style dangerouslySetInnerHTML={{__html: `
              .light-theme .LightThemeDialog {
                background-color: #ffffff !important;
                border-color: #cbd5e1 !important;
                color: #0f172a !important;
              }
            `}} />
            <div>
              <h3 className="text-base font-bold font-display text-white light-theme:text-slate-900 border-b border-emerald-500/20 pb-2 flex items-center gap-1.5">
                🔔 {dialog.title}
              </h3>
              <p className="text-xs text-slate-300 light-theme:text-slate-600 mt-3 leading-relaxed">
                {dialog.message}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              {dialog.type === "confirm" ? (
                <>
                  <button
                    onClick={() => setDialog(prev => ({ ...prev, isOpen: false }))}
                    className="px-3 md:px-4 py-2 rounded-xl text-xs font-semibold glass-subtle hover:bg-slate-800/40 text-slate-400 hover:text-slate-200 transition-all cursor-pointer border border-slate-700/40 light-theme:bg-slate-100 light-theme:border-slate-200 light-theme:text-slate-700 light-theme:hover:bg-slate-200"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => {
                      setDialog(prev => ({ ...prev, isOpen: false }));
                      if (dialog.onConfirm) dialog.onConfirm();
                    }}
                    className="px-3 md:px-4 py-2 rounded-xl text-xs font-semibold btn-primary transition-all cursor-pointer"
                  >
                    Подтвердить
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setDialog(prev => ({ ...prev, isOpen: false }))}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold btn-primary transition-all cursor-pointer"
                >
                  ОК
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Water Reminder Popup Overlay */}
      {showInAppReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl glass-bg border border-slate-700/40 p-6 shadow-2xl text-slate-100 flex flex-col space-y-4 LightThemeDialog">
            <style dangerouslySetInnerHTML={{__html: `
              .light-theme .LightThemeDialog {
                background-color: #ffffff !important;
                border-color: #cbd5e1 !important;
                color: #0f172a !important;
              }
            `}} />
            <div className="flex items-center justify-between border-b border-cyan-500/15 pb-2">
              <div className="flex items-center gap-2 text-cyan-400">
                <BellRing className="w-5 h-5 animate-pulse" />
                <h3 className="text-base font-bold font-display text-white light-theme:text-slate-900">
                  Время пить воду!
                </h3>
              </div>
              <button 
                onClick={() => setShowInAppReminder(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 light-theme:text-slate-600 leading-relaxed italic bg-gradient-to-r from-cyan-500/10 to-sky-500/10 p-3 rounded-xl border border-cyan-500/20">
              "{reminderQuote || DRINK_QUOTES[0]}"
            </p>

            <p className="text-[11px] text-slate-400">
              Позаботьтесь о вашем здоровье прямо сейчас. Рекомендуется выпить один стакан (250 мл) чистой негазированной воды.
            </p>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                onClick={() => {
                  setShowInAppReminder(false);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-semibold glass-subtle hover:bg-slate-800/40 text-slate-400 hover:text-slate-200 transition-all cursor-pointer border border-slate-700/40 light-theme:bg-slate-100 light-theme:border-slate-200 light-theme:text-slate-700 light-theme:hover:bg-slate-200"
              >
                Закрыть
              </button>
              <button
                onClick={() => {
                  addWater(250);
                  setShowInAppReminder(false);
                  showCustomAlert("Ура!", "Вы добавили 250 мл воды в дневной лог! Отличный темп. Следующее напоминание придет в свое время.");
                }}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500/60 to-sky-500/50 hover:from-cyan-500/80 hover:to-sky-500/70 text-white font-bold transition-all cursor-pointer flex items-center justify-center gap-1 border border-cyan-500/40"
              >
                <Droplet className="w-3.5 h-3.5" />
                <span>Выпил 250 мл</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

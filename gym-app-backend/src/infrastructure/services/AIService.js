const { GoogleGenerativeAI } = require('@google/generative-ai');
const aiCacheService = require('../cache/aiCacheService');

class AIService {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('⚠️  GEMINI_API_KEY bulunamadı. AI özellikleri çalışmayacak.');
      this.genAI = null;
    } else {
      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }

    // gemini-2.0-* yeni API anahtarlarında 404 (artık sunulmuyor); yalnızca 2.5 ailesi.
    // Öncelik: Flash → Pro
    this.modelNames = ['gemini-2.5-flash', 'gemini-2.5-pro'];
    
    // Çalışan modeli cache'le (performans için)
    this.cachedWorkingModel = null;
    this.cachedModelName = null;
    this.ttlConfig = {
      answerNutritionQuestion: Number(process.env.REDIS_TTL_ANSWER_SECONDS || 1800),
      generateNutritionPlan: Number(process.env.REDIS_TTL_NUTRITION_PLAN_SECONDS || 3600),
      suggestFoods: Number(process.env.REDIS_TTL_SUGGEST_FOODS_SECONDS || 1800),
      generateExerciseProgram: Number(process.env.REDIS_TTL_EXERCISE_PROGRAM_SECONDS || 3600),
      translateStructuredContent: Number(process.env.REDIS_TTL_TRANSLATE_SECONDS || 86400),
    };
  }

  _normalizeLocale(locale = 'tr') {
    const code = String(locale || 'tr').trim().toLowerCase().replace('_', '-');
    if (code.startsWith('tr')) return 'tr';
    if (code.startsWith('en')) return 'en';
    return code.split('-')[0] || 'tr';
  }

  _languageName(locale = 'tr') {
    const code = this._normalizeLocale(locale);
    const names = {
      tr: 'Turkish',
      en: 'English',
      de: 'German',
      fr: 'French',
      es: 'Spanish',
      it: 'Italian',
      ar: 'Arabic',
      ru: 'Russian',
    };
    return names[code] || code;
  }

  _localizedInstruction(locale = 'tr') {
    const languageName = this._languageName(locale);
    return `All user-facing text values must be written in ${languageName}. Keep JSON object keys, schema, numeric values, IDs, and canonical weekday keys exactly as requested.`;
  }

  /**
   * Yardımcı Metod: JSON stringini temizler
   */
  _cleanJsonString(text) {
    let cleaned = text.trim();
    // Markdown code block'larını temizle (```json ... ```)
    if (cleaned.includes('```')) {
      cleaned = cleaned.replace(/```json/g, '').replace(/```/g, '');
    }

    // Model bazen JSON dışında açıklama/etiket döndürebiliyor.
    // Büyük ihtimalle JSON bir nesne olduğu için ilk '{' ve son '}' arasını alıyoruz.
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    return cleaned.trim();
  }

  /**
   * Retry mekanizması ile API çağrısı yapar (optimize edilmiş - sadece network/503 hataları için)
   * @param {Function} apiCall - API çağrısı yapan fonksiyon
   * @param {number} maxRetries - Maksimum deneme sayısı (varsayılan: 2 - daha az retry)
   * @param {number} baseDelay - Başlangıç bekleme süresi (ms)
   */
  async _retryWithBackoff(apiCall, maxRetries = 2, baseDelay = 500) {
    let lastError = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        lastError = error;
        const isRetryable = this._isRetryableError(error);
        
        // Retry edilebilir değilse veya son denemeyse, hemen fırlat
        if (!isRetryable || attempt === maxRetries - 1) {
          throw error;
        }
        
        // Sadece network/503 hataları için kısa bir bekleme (500ms, 1s)
        const delay = baseDelay * Math.pow(2, attempt);
        // Sessiz retry - kullanıcıya gereksiz log gösterme
        await this._sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Hatanın retry edilebilir olup olmadığını kontrol eder
   */
  _isRetryableError(error) {
    if (!error) return false;
    
    const errorMessage = error.message || '';
    const errorStatus = error.status || error.response?.status;
    
    // 503 (Service Unavailable), 429 (Rate Limit), 500 (Server Error) retry edilebilir
    if (errorStatus === 503 || errorStatus === 429 || errorStatus === 500) {
      return true;
    }
    
    // Timeout ve network hataları retry edilebilir
    if (errorMessage.includes('timeout') || 
        errorMessage.includes('ECONNRESET') || 
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('overloaded') ||
        errorMessage.includes('network')) {
      return true;
    }
    
    return false;
  }

  /**
   * Bekleme fonksiyonu
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** Haftalık takvim anahtarlarını Pazartesi…Pazar olarak düzenler */
  _normalizeWeekSchedule(ws) {
    const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    const o = {};
    DAYS.forEach((d) => {
      const arr = ws?.[d] ?? ws?.[d.toLowerCase()];
      o[d] = Array.isArray(arr) ? arr : [];
    });
    return o;
  }

  /**
   * AI çıktısını 4 haftalık tek yapıya çevirir (eksik haftaları önceki haftadan türetir).
   */
  _sanitizeMonthlyExerciseProgram(parsed, programConfig = {}, locale = 'tr') {
    const normalizedLocale = this._normalizeLocale(locale);
    let weeksArr = [];
    if (Array.isArray(parsed.weeks) && parsed.weeks.length > 0) {
      weeksArr = parsed.weeks.map((w, i) => ({
        weekNumber: Number(w.weekNumber) || i + 1,
        weekLabel: w.weekLabel || `${i + 1}. Hafta`,
        focus: typeof w.focus === 'string' ? w.focus : '',
        weeklySummary: typeof w.weeklySummary === 'string' ? w.weeklySummary : '',
        weeklySchedule: this._normalizeWeekSchedule(w.weeklySchedule || {}),
      }));
    } else if (parsed.weeklySchedule) {
      weeksArr = [
        {
          weekNumber: 1,
          weekLabel: '1. Hafta',
          focus: 'Adaptasyon',
          weeklySummary: parsed.weeklySummary || '',
          weeklySchedule: this._normalizeWeekSchedule(parsed.weeklySchedule),
        },
      ];
    } else {
      throw new Error('Geçersiz egzersiz programı: weeks veya weeklySchedule yok');
    }

    while (weeksArr.length < 4) {
      const prev = weeksArr[weeksArr.length - 1];
      const n = weeksArr.length + 1;
      weeksArr.push({
        weekNumber: n,
        weekLabel: `${n}. Hafta`,
        focus: 'İlerleme',
        weeklySummary: `Hafta ${n}: Bir önceki haftaya göre tekrar veya setleri kontrollü şekilde artırın; notes’taki progressive overload önerilerini izleyin.`,
        weeklySchedule: JSON.parse(JSON.stringify(prev.weeklySchedule)),
      });
    }

    weeksArr = weeksArr.slice(0, 4).map((w, i) => ({
      ...w,
      weekNumber: i + 1,
      weekLabel: w.weekLabel || `${i + 1}. Hafta`,
    }));

    const monthlySummary =
      typeof parsed.monthlySummary === 'string' && parsed.monthlySummary.trim()
        ? parsed.monthlySummary.trim()
        : (typeof parsed.weeklySummary === 'string' ? parsed.weeklySummary : 'Dört haftalık kademeli plan');

    return {
      version: 2,
      locale: normalizedLocale,
      monthlySummary,
      weeks: weeksArr,
    };
  }

  /**
   * Kullanıcının beslenme sorusuna AI ile cevap verir
   */
  async answerNutritionQuestion(question, userContext = {}, locale = 'tr') {
    if (!this.genAI) throw new Error('Gemini API key yapılandırılmamış.');
    const normalizedLocale = this._normalizeLocale(locale);

    const systemPrompt = `Sen bir beslenme uzmanı ve fitness koçusun. ${this._localizedInstruction(normalizedLocale)}
    Kullanıcı: Cinsiyet: ${userContext.gender || '-'}, Yaş: ${userContext.age ?? '-'}, Hedef: ${userContext.goal || '-'}, Boy: ${userContext.height || '-'} cm, Kilo: ${userContext.weight || '-'} kg, Durum: ${userContext.injuries?.join(', ') || 'Yok'}
    Kurallar: Bilimsel, kişiselleştirilmiş, kısa (max 300 kelime) cevap ver. Cinsiyet ve yaş varsa kalori/makro önerilerinde dikkate al.`;

    const cachePayload = { question, userContext, locale: normalizedLocale };
    const cachedAnswer = await aiCacheService.get('nutrition-question', cachePayload);
    if (cachedAnswer) {
      return cachedAnswer;
    }

    // Önce cache'lenmiş çalışan modeli dene
    if (this.cachedWorkingModel && this.cachedModelName) {
      try {
        const result = await this._retryWithBackoff(async () => {
          return await this.cachedWorkingModel.generateContent(`${systemPrompt}\n\nSoru: ${question}`);
        }, 2, 500); // Sadece 2 retry, 500ms delay
        
        const answer = result.response.text();
        await aiCacheService.set(
          'nutrition-question',
          cachePayload,
          answer,
          this.ttlConfig.answerNutritionQuestion
        );
        return answer;
      } catch (error) {
        // Cache'lenmiş model başarısız oldu, cache'i temizle ve diğer modelleri dene
        console.warn(`⚠️  Cache'lenmiş model (${this.cachedModelName}) başarısız, diğer modeller deneniyor...`);
        this.cachedWorkingModel = null;
        this.cachedModelName = null;
      }
    }

    // Cache yoksa veya başarısız olduysa, modelleri sırayla dene
    let lastError = null;
    for (const modelName of this.modelNames) {
      try {
        const result = await this._retryWithBackoff(async () => {
          const model = this.genAI.getGenerativeModel({ model: modelName });
          return await model.generateContent(`${systemPrompt}\n\nSoru: ${question}`);
        }, 2, 500); // Sadece 2 retry, 500ms delay
        
        // Başarılı modeli cache'le
        this.cachedWorkingModel = this.genAI.getGenerativeModel({ model: modelName });
        this.cachedModelName = modelName;
        console.log(`✅ Model ${modelName} ile yanıt alındı (cache'lendi).`);
        const answer = result.response.text();
        await aiCacheService.set(
          'nutrition-question',
          cachePayload,
          answer,
          this.ttlConfig.answerNutritionQuestion
        );
        return answer;
      } catch (error) {
        lastError = error;
        // Sadece gerçekten kritik hatalar için log
        if (!this._isRetryableError(error)) {
          console.warn(`⚠️  Model ${modelName} başarısız: ${error.message}`);
        }
        continue;
      }
    }

    this._handleError(lastError);
  }

  /**
   * Kişiselleştirilmiş haftalık beslenme planı oluşturur.
   * Dönen format: { summary: { dailyCalories, protein, carb, fat, recommendations }, week: { Pazartesi: { meals }, ... } }
   */
  async generateNutritionPlan(userContext = {}, locale = 'tr') {
    if (!this.genAI) throw new Error('Gemini API key yapılandırılmamış.');
    const normalizedLocale = this._normalizeLocale(locale);

    const systemPrompt = `Sen bir diyetisyensin. Aşağıdaki kullanıcı için 7 günlük (haftalık) beslenme planı hazırla.
${this._localizedInstruction(normalizedLocale)}
Kullanıcı bilgileri (cinsiyet, hedef, boy, kilo, sağlık durumu planı kişiselleştirmek için kullanılacak): ${JSON.stringify(userContext)}
Cinsiyet ve yaş varsa kalori ve makro dağılımını buna göre ayarla.

ZORUNLU KURALLAR:
1. Hafta günü object key'leri uygulama sözleşmesidir; mutlaka şu Türkçe canonical key'ler olsun ve değişmesin: Pazartesi, Salı, Çarşamba, Perşembe, Cuma, Cumartesi, Pazar.
2. Pazartesi, Salı, Çarşamba, Perşembe, Cuma, Cumartesi, Pazar olmak üzere 7 günün HEPSİNİ doldur.
3. HER GÜN için 3 ANA öğün zorunlu. Buna ek olarak HER GÜN 1 veya 2 ARA ÖĞÜN ekle. Öğün başlıkları, yemek adları, birimler ve öneri metinleri hedef dilde olmalı. Ara öğünler ana öğünlerden küçük olmalı (genelde 100–250 kcal arası); toplamda o günün tüm öğün kalorileri summary.dailyCalories ile uyumlu olmalı.
4. Her öğünde "items" dizisine somut yemek isimleri koy. Hiçbir günü boş bırakma, hiçbir öğünde items boş array olmasın.
5. Günlük kaloriyi summary.dailyCalories'e göre ana öğünlere VE ara öğünlere böl (ör. 2200 kcal ise ana öğünler ~450–650, ara öğünler ~120–200 gibi; toplam günlük ≈ dailyCalories).
6. Çıktı SADECE aşağıdaki JSON olmalı, başka metin veya yorum yazma.

HER BESİN SATIRI için "items" içinde NESNE kullan: name (yemek adı), quantity (sayı), unit (örn: "adet", "g", "dilim", "ml"), calories (BU SATIRDAKİ TOPLAM kalori; verdiğin miktara göre).
Örnek yapı (her gün böyle DOLU olmalı):
"Pazartesi": {
  "meals": [
    {"title": "Kahvaltı", "items": [
      {"name": "Haşlanmış yumurta", "quantity": 2, "unit": "adet", "calories": 156},
      {"name": "Beyaz peynir", "quantity": 40, "unit": "g", "calories": 120},
      {"name": "Tam buğday ekmeği", "quantity": 1, "unit": "dilim", "calories": 90}
    ], "calories": 420},
    {"title": "Ara öğün (kuşluk)", "items": [
      {"name": "Meyve (elma)", "quantity": 1, "unit": "adet", "calories": 95},
      {"name": "Badem", "quantity": 15, "unit": "g", "calories": 90}
    ], "calories": 185},
    {"title": "Öğle", "items": [
      {"name": "Izgara tavuk göğsü", "quantity": 150, "unit": "g", "calories": 248},
      {"name": "Bulgur pilavı", "quantity": 120, "unit": "g", "calories": 200},
      {"name": "Yeşil salata", "quantity": 1, "unit": "kase", "calories": 45}
    ], "calories": 580},
    {"title": "Ara öğün (ikindi)", "items": [
      {"name": "Yoğurt", "quantity": 150, "unit": "g", "calories": 95},
      {"name": "Yulaf ezmesi", "quantity": 20, "unit": "g", "calories": 75}
    ], "calories": 170},
    {"title": "Akşam", "items": [
      {"name": "Somon fileto", "quantity": 180, "unit": "g", "calories": 280},
      {"name": "Fırın sebze", "quantity": 200, "unit": "g", "calories": 120},
      {"name": "Mevsim salata", "quantity": 1, "unit": "kase", "calories": 40}
    ], "calories": 500}
  ]
}

Her öğündeki meal.calories, o öğündeki items içindeki calories toplamına yakın olmalı (±50 kcal tolerans).
Salı, Çarşamba, Perşembe, Cuma, Cumartesi, Pazar için de aynı şekilde: her gün 3 ana öğün + 1–2 ara öğün, farklı ama gerçek yemeklerle. Öğün başlıkları hedef dilde olsun; günlük toplam kalori summary.dailyCalories ile uyumlu olsun.

Döndürülecek JSON formatı:
{
  "locale": "${normalizedLocale}",
  "summary": {
    "dailyCalories": (kullanıcı hedefine uygun sayı, örn 2200),
    "protein": "120g",
    "carb": "250g",
    "fat": "65g",
    "recommendations": "Kısa öneri metni (hedef dilde)."
  },
  "week": {
    "Pazartesi": { "meals": [ {"title": "Kahvaltı", ...}, {"title": "Ara öğün (...)", ...}, {"title": "Öğle", ...}, {"title": "Ara öğün (...)", ...}, {"title": "Akşam", ...} ] },
    "Salı": { "meals": [ ... ] },
    "Çarşamba": { "meals": [ ... ] },
    "Perşembe": { "meals": [ ... ] },
    "Cuma": { "meals": [ ... ] },
    "Cumartesi": { "meals": [ ... ] },
    "Pazar": { "meals": [ ... ] }
  }
}`;

    // Haftalık plan önbelleği kapatıldı: aynı userContext ile tekrar istekte
    // kullanıcıya hep aynı JSON dönüyordu (yeni plan "eski plan" gibi görünüyordu).

    // Önce cache'lenmiş çalışan modeli dene
    if (this.cachedWorkingModel && this.cachedModelName) {
      try {
        const result = await this._retryWithBackoff(async () => {
          return await this.cachedWorkingModel.generateContent(systemPrompt);
        }, 2, 500);
        
        const text = this._cleanJsonString(result.response.text());
        const parsed = JSON.parse(text);
        const normalizedPlan = this._normalizeWeeklyPlan(parsed, normalizedLocale);
        return normalizedPlan;
      } catch (error) {
        // Cache'lenmiş model başarısız oldu, cache'i temizle
        this.cachedWorkingModel = null;
        this.cachedModelName = null;
      }
    }

    let lastError = null;
    for (const modelName of this.modelNames) {
      try {
        const result = await this._retryWithBackoff(async () => {
          const generationConfig = { responseMimeType: "application/json" };
          const model = this.genAI.getGenerativeModel({ 
              model: modelName,
              generationConfig: generationConfig
          });
          return await model.generateContent(systemPrompt);
        }, 2, 500);

        const text = this._cleanJsonString(result.response.text());
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch (parseError) {
          console.warn(
            `⚠️ Nutrition plan JSON parse hatası (${modelName}). İlk 300 karakter:`,
            text.slice(0, 300)
          );
          throw parseError;
        }
        
        // Başarılı modeli cache'le
        const generationConfig = { responseMimeType: "application/json" };
        this.cachedWorkingModel = this.genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: generationConfig
        });
        this.cachedModelName = modelName;
        console.log(`✅ Model ${modelName} ile haftalık plan oluşturuldu.`);
        const normalizedPlan = this._normalizeWeeklyPlan(parsed, normalizedLocale);
        return normalizedPlan;
      } catch (error) {
        lastError = error;
        if (!this._isRetryableError(error)) {
          console.warn(`⚠️  Model ${modelName} ile JSON hatası: ${error.message}`);
        }
        continue;
      }
    }

    this._handleError(lastError);
  }

  /**
   * AI yanıtını haftalık plan formatına normalize eder.
   * Eksik veya boş günleri: önce dolu bir günün öğünlerini kopyalar, yoksa boş meals bırakır.
   */
  _normalizeWeeklyPlan(parsed, locale = 'tr') {
    const normalizedLocale = this._normalizeLocale(locale || parsed?.locale);
    const dayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    const summary = parsed.summary || {
      dailyCalories: parsed.dailyCalories || 2000,
      protein: parsed.protein || '100g',
      carb: parsed.carb || '250g',
      fat: parsed.fat || '65g',
      recommendations: parsed.recommendations || ''
    };
    let week = parsed.week || {};

    // Dolu öğünlere sahip ilk günü bul (fallback için)
    let templateDay = null;
    for (const day of dayNames) {
      const meals = week[day]?.meals;
      if (Array.isArray(meals) && meals.length > 0 && meals.some(m => m.items?.length > 0)) {
        templateDay = { meals: meals.map(m => ({ ...m, items: [...(m.items || [])] })) };
        break;
      }
    }

    dayNames.forEach(day => {
      const meals = week[day]?.meals;
      const hasContent = Array.isArray(meals) && meals.length > 0 && meals.some(m => m.items?.length > 0);
      if (!hasContent && templateDay) {
        week[day] = { meals: templateDay.meals.map(m => ({ ...m, items: [...(m.items || [])] })) };
      } else if (!week[day] || !Array.isArray(week[day].meals)) {
        week[day] = { meals: [] };
      }
    });

    dayNames.forEach((day) => {
      if (week[day]?.meals?.length) {
        week[day] = { meals: this._normalizeDayMeals(week[day].meals) };
      }
    });

    return { locale: normalizedLocale, summary, week };
  }

  /**
   * Metin veya yarı yapılandırılmış besin satırını { name, quantity, unit, calories } yapar.
   */
  _parseStringFoodItem(str) {
    const t = String(str).trim();
    const m = t.match(
      /^(\d+(?:[.,]\d+)?)\s*(adet|Adet|g|G|gram|ml|mL|dilim|Dilim|bardak|Bardak|porsiyon|Porsiyon|kase|Kase|yaprak|Yaprak)?\s+(.+)$/i
    );
    if (m) {
      const qty = parseFloat(String(m[1]).replace(',', '.'));
      const unit = (m[2] || 'adet').trim();
      const name = (m[3] || '').trim();
      return { name: name || t, quantity: qty > 0 ? qty : 1, unit: unit || 'adet', calories: 0 };
    }
    return { name: t, quantity: 1, unit: 'porsiyon', calories: 0 };
  }

  _normalizeMeal(meal) {
    const rawItems = meal.items || [];
    const mealCal = Number(meal.calories) || 0;
    const items = rawItems.map((it) => {
      if (it && typeof it === 'object' && it.name != null) {
        const qty = parseFloat(it.quantity);
        const quantity = Number.isFinite(qty) && qty > 0 ? qty : 1;
        const cal = Number(it.calories);
        const calories = Number.isFinite(cal) && cal >= 0 ? Math.round(cal) : 0;
        return {
          name: String(it.name).trim(),
          quantity,
          unit: String(it.unit || 'adet').trim(),
          calories,
        };
      }
      if (typeof it === 'string') {
        return this._parseStringFoodItem(it);
      }
      return { name: '?', quantity: 1, unit: 'porsiyon', calories: 0 };
    });
    const hasItemCals = items.some((i) => i.calories > 0);
    if (!hasItemCals && mealCal > 0 && items.length > 0) {
      const per = Math.max(1, Math.round(mealCal / items.length));
      items.forEach((i) => {
        i.calories = per;
      });
    }
    const sumItems = items.reduce((s, i) => s + i.calories, 0);
    return {
      ...meal,
      items,
      calories: meal.calories != null && meal.calories !== '' ? Number(meal.calories) : sumItems,
    };
  }

  _normalizeDayMeals(meals) {
    if (!Array.isArray(meals)) return [];
    return meals.map((m) => this._normalizeMeal(m));
  }

  /**
   * Yemek önerileri getirir
   */
  async suggestFoods(criteria, userContext = {}) {
    if (!this.genAI) throw new Error('Gemini API key yapılandırılmamış.');

    const systemPrompt = `Kullanıcı için yemek önerisi ver. Kriter: ${criteria}.
    Kullanıcı: Cinsiyet: ${userContext.gender || '-'}, Yaş: ${userContext.age ?? '-'}, Hedef: ${userContext.goal || '-'}, Durum: ${userContext.injuries?.join(', ') || 'Yok'}
    
    SADECE şu JSON formatında cevap ver:
    {
      "foods": [{"name": "Yemek", "calories": 100, "protein": 10, "carb": 5, "fat": 2, "description": "Açıklama"}]
    }`;

    const cachePayload = { criteria, userContext };
    const cachedFoods = await aiCacheService.get('food-suggestions', cachePayload);
    if (cachedFoods) {
      return cachedFoods;
    }

    // Önce cache'lenmiş çalışan modeli dene
    if (this.cachedWorkingModel && this.cachedModelName) {
      try {
        const result = await this._retryWithBackoff(async () => {
          return await this.cachedWorkingModel.generateContent(systemPrompt);
        }, 2, 500);
        
        const text = this._cleanJsonString(result.response.text());
        const parsed = JSON.parse(text);
        const foods = parsed.foods || [];
        await aiCacheService.set(
          'food-suggestions',
          cachePayload,
          foods,
          this.ttlConfig.suggestFoods
        );
        return foods;
      } catch (error) {
        this.cachedWorkingModel = null;
        this.cachedModelName = null;
      }
    }

    let lastError = null;
    for (const modelName of this.modelNames) {
      try {
        const result = await this._retryWithBackoff(async () => {
          const generationConfig = modelName.includes('1.5') ? { responseMimeType: "application/json" } : undefined;
          const model = this.genAI.getGenerativeModel({ 
              model: modelName,
              generationConfig: generationConfig
          });
          return await model.generateContent(systemPrompt);
        }, 2, 500);

        const text = this._cleanJsonString(result.response.text());
        const parsed = JSON.parse(text);
        
        // Başarılı modeli cache'le
        const generationConfig = modelName.includes('1.5') ? { responseMimeType: "application/json" } : undefined;
        this.cachedWorkingModel = this.genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: generationConfig
        });
        this.cachedModelName = modelName;
        console.log(`✅ Model ${modelName} ile öneri alındı (cache'lendi).`);
        const foods = parsed.foods || [];
        await aiCacheService.set(
          'food-suggestions',
          cachePayload,
          foods,
          this.ttlConfig.suggestFoods
        );
        return foods;
      } catch (error) {
        lastError = error;
        if (!this._isRetryableError(error)) {
          console.warn(`⚠️  Model ${modelName} başarısız: ${error.message}`);
        }
        continue;
      }
    }

    this._handleError(lastError);
  }

  /**
   * AI ile kişiselleştirilmiş egzersiz programı oluşturur (profil + anket cevapları)
   */
  async generateExerciseProgram(userContext = {}, programConfig = {}) {
    if (!this.genAI) throw new Error('Gemini API key yapılandırılmamış.');

    const { difficulty = 'beginner', daysPerWeek = 3, survey = {} } = programConfig;
    const normalizedLocale = this._normalizeLocale(programConfig.locale || 'tr');
    const { height, weight, age, goal, injuries = [] } = userContext;

    const equipmentStr = Array.isArray(survey.equipment)
      ? survey.equipment.join(', ')
      : (survey.equipment || '');
    const focusMuscleStr = Array.isArray(survey.focusMuscle)
      ? survey.focusMuscle.join(', ')
      : (survey.focusMuscle || '');
    const surveyLines = [
      survey.place ? `Antrenman yeri: ${survey.place}` : null,
      equipmentStr ? `Ekipman (kullanılacaklar): ${equipmentStr}` : null,
      survey.focus ? `Odak hedefi: ${survey.focus}` : null,
      survey.duration ? `Tercih edilen süre: ${survey.duration}` : null,
      focusMuscleStr ? `Öncelik verilecek kas bölgeleri: ${focusMuscleStr}` : null,
    ].filter(Boolean);
    const surveyBlock = surveyLines.length > 0
      ? `Anket Cevapları:\n${surveyLines.join('\n')}`
      : 'Anket cevabı yok (varsayılan tercihlerle hazırla).';

    const systemPrompt = `Sen bir fitness antrenörüsün. Aşağıdaki kullanıcı ve anket bilgilerine göre **4 haftalık (1 ay)** kademeli egzersiz programı üret.
${this._localizedInstruction(normalizedLocale)}

Kullanıcı Bilgileri (Profil):
- Cinsiyet: ${userContext.gender || 'Bilinmiyor'}
- Boy: ${height || 'Bilinmiyor'} cm
- Kilo: ${weight || 'Bilinmiyor'} kg
- Yaş: ${age || 'Bilinmiyor'}
- Hedef: ${goal || 'Genel Fitness'}
- Sağlık Durumu: ${injuries.length > 0 ? injuries.join(', ') : 'Yok'}

Seviye: ${difficulty}
Haftalık antrenman günü sayısı: ${daysPerWeek} (her hafta aynı sayıda antrenman günü kullan)

${surveyBlock}

KURALLAR:
- Tam **4 hafta** üret; her haftanın weeklySchedule'ı ayrı olmalı.
- weeklySchedule içindeki gün object key'leri uygulama sözleşmesidir; mutlaka şu Türkçe canonical key'ler olsun ve değişmesin: Pazartesi, Salı, Çarşamba, Perşembe, Cuma, Cumartesi, Pazar.
- muscle_group değerleri canonical enum olarak kalsın: Göğüs, Sırt, Bacak, Omuz, Biceps, Triceps, Core, Kalça. Bu alan uygulama eşleştirmesi için kullanılır.
- monthlySummary, focus, weeklySummary, exercise name içindeki açıklayıcı parantezler ve notes alanları hedef dilde olmalı.
- **Kademeli ilerleme (progressive overload):** 1. hafta form ve adaptasyon; 2. hafta tekrar veya set hafif artışı veya aynı hareketlerde küçük artış; 3. hafta bir önceki haftaya göre tekrar/set veya dinlenme süresinde kontrollü ilerleme; 4. hafta konsolidasyon veya hafif hacim/tekrar zirvesi (seviyeye göre). notes alanında haftaya özel ipucu yaz.
- Sakatlık varsa o bölgelere alternatif ver. Ekipman kısıtına uy.
- Her haftada yalnızca **${daysPerWeek}** günü antrenmanla doldur; diğer günler **boş array** [].

Çıktı SADECE şu JSON (yorum/markdown yok):
{
  "locale": "${normalizedLocale}",
  "monthlySummary": "Tüm ayın özeti ve genel uyarılar (hedef dilde, kısa)",
  "weeks": [
    {
      "weekNumber": 1,
      "weekLabel": "1. Hafta",
      "focus": "Kısa odak (ör. form, temel kuvvet)",
      "weeklySummary": "Bu haftanın özeti (hedef dilde)",
      "weeklySchedule": {
        "Pazartesi": [{"name": "...", "muscle_group": "Göğüs", "sets": 3, "reps": "10-12", "rest_time": 60, "notes": "..."}],
        "Salı": [],
        "Çarşamba": [],
        "Perşembe": [],
        "Cuma": [],
        "Cumartesi": [],
        "Pazar": []
      }
    },
    { "weekNumber": 2, "weekLabel": "2. Hafta", "focus": "...", "weeklySummary": "...", "weeklySchedule": { } },
    { "weekNumber": 3, "weekLabel": "3. Hafta", "focus": "...", "weeklySummary": "...", "weeklySchedule": { } },
    { "weekNumber": 4, "weekLabel": "4. Hafta", "focus": "...", "weeklySummary": "...", "weeklySchedule": { } }
  ]
}

Alanlar:
- muscle_group: Göğüs, Sırt, Bacak, Omuz, Biceps, Triceps, Core, Kalça
- sets: sayı, reps: string ("10-12"), rest_time: saniye, notes: hedef dilde kısa metin
- weeks dizisi **tam 4 eleman** ve her birinde tüm gün anahtarları bulunmalı.`;

    const cachePayload = { userContext, programConfig, locale: normalizedLocale, format: 'monthly_v2' };
    const cachedProgram = await aiCacheService.get('exercise-program', cachePayload);
    if (cachedProgram) {
      return cachedProgram;
    }

    // Önce cache'lenmiş çalışan modeli dene
    if (this.cachedWorkingModel && this.cachedModelName) {
      try {
        const result = await this._retryWithBackoff(async () => {
          return await this.cachedWorkingModel.generateContent(systemPrompt);
        }, 2, 500);
        
        const text = this._cleanJsonString(result.response.text());
        const raw = JSON.parse(text);
        const program = this._sanitizeMonthlyExerciseProgram(raw, programConfig, normalizedLocale);
        await aiCacheService.set(
          'exercise-program',
          cachePayload,
          program,
          this.ttlConfig.generateExerciseProgram
        );
        return program;
      } catch (error) {
        this.cachedWorkingModel = null;
        this.cachedModelName = null;
      }
    }

    let lastError = null;
    for (const modelName of this.modelNames) {
      try {
        const result = await this._retryWithBackoff(async () => {
          const generationConfig = modelName.includes('1.5') ? { responseMimeType: "application/json" } : undefined;
          const model = this.genAI.getGenerativeModel({ 
              model: modelName,
              generationConfig: generationConfig
          });
          return await model.generateContent(systemPrompt);
        }, 2, 500);

        const text = this._cleanJsonString(result.response.text());
        const raw = JSON.parse(text);
        const program = this._sanitizeMonthlyExerciseProgram(raw, programConfig, normalizedLocale);

        // Başarılı modeli cache'le
        const generationConfig = modelName.includes('1.5') ? { responseMimeType: "application/json" } : undefined;
        this.cachedWorkingModel = this.genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: generationConfig
        });
        this.cachedModelName = modelName;
        console.log(`✅ Model ${modelName} ile egzersiz programı oluşturuldu (cache'lendi).`);
        await aiCacheService.set(
          'exercise-program',
          cachePayload,
          program,
          this.ttlConfig.generateExerciseProgram
        );
        return program;
      } catch (error) {
        lastError = error;
        if (!this._isRetryableError(error)) {
          console.warn(`⚠️  Model ${modelName} başarısız: ${error.message}`);
        }
        continue;
      }
    }

    this._handleError(lastError);
  }

  async translateStructuredContent(content, type = 'generic', targetLocale = 'tr', sourceLocale = null) {
    if (!this.genAI) throw new Error('Gemini API key yapılandırılmamış.');
    const normalizedTarget = this._normalizeLocale(targetLocale);
    const normalizedSource = sourceLocale ? this._normalizeLocale(sourceLocale) : null;
    if (!content || typeof content !== 'object') {
      throw new Error('Çevrilecek içerik geçersiz.');
    }

    const cachePayload = {
      type,
      targetLocale: normalizedTarget,
      sourceLocale: normalizedSource,
      content,
    };
    const cached = await aiCacheService.get('translate-structured-content', cachePayload);
    if (cached) return cached;

    const schemaRules =
      type === 'exercise-program'
        ? `- Keep weeklySchedule weekday keys exactly as they are, especially Pazartesi, Salı, Çarşamba, Perşembe, Cuma, Cumartesi, Pazar.
- Keep muscle_group canonical enum values unchanged: Göğüs, Sırt, Bacak, Omuz, Biceps, Triceps, Core, Kalça.
- Translate monthlySummary, focus, weeklySummary, notes, and user-facing exercise name parentheticals. Exercise names that are already standard English may remain unchanged.`
        : type === 'nutrition-plan'
          ? `- Keep week weekday keys exactly as they are, especially Pazartesi, Salı, Çarşamba, Perşembe, Cuma, Cumartesi, Pazar.
- Translate summary.recommendations, meal titles, food item names, and visible unit strings.
- Do not change calories, macros, quantities, or item counts.`
          : '- Translate only user-facing string values. Keep identifiers and structural keys unchanged.';

    const prompt = `Translate this ${type} JSON to ${this._languageName(normalizedTarget)}.
${normalizedSource ? `Source language hint: ${this._languageName(normalizedSource)}.` : ''}

STRICT RULES:
- Return ONLY valid JSON. No markdown, no explanations.
- Preserve the full JSON shape exactly.
- Do NOT rename object keys.
- Do NOT change numbers, booleans, nulls, array lengths, calories, sets, reps, rest_time, completion data, IDs, or dates.
- Add or update top-level "locale" to "${normalizedTarget}".
${schemaRules}

JSON:
${JSON.stringify(content)}`;

    let lastError = null;
    for (const modelName of this.modelNames) {
      try {
        const result = await this._retryWithBackoff(async () => {
          const model = this.genAI.getGenerativeModel({
            model: modelName,
            generationConfig: { responseMimeType: 'application/json' },
          });
          return await model.generateContent(prompt);
        }, 2, 500);
        const parsed = JSON.parse(this._cleanJsonString(result.response.text()));
        const translated = { ...parsed, locale: normalizedTarget };
        await aiCacheService.set(
          'translate-structured-content',
          cachePayload,
          translated,
          this.ttlConfig.translateStructuredContent
        );
        return translated;
      } catch (error) {
        lastError = error;
        if (!this._isRetryableError(error)) {
          console.warn(`⚠️ Structured translation failed (${modelName}): ${error.message}`);
        }
      }
    }

    this._handleError(lastError);
  }

  /**
   * Resim (tabak fotoğrafı) içeriğini analiz eder; beslenme değerlerini JSON döner.
   * @param {Buffer} imageBuffer
   * @param {string} mimeType - Örn. 'image/jpeg', 'image/png'
   * @param {string} userPrompt - Sisteme verilecek prompt (JSON şeması içerir)
   * @returns {Promise<object>} Parsed JSON
   */
  async analyzePlatePhoto(imageBuffer, mimeType, userPrompt) {
    if (!this.genAI) throw new Error('Gemini API key yapılandırılmamış.');
    if (!imageBuffer || imageBuffer.length === 0) throw new Error('Resim verisi boş.');

    const prompt = userPrompt && userPrompt.trim()
      ? userPrompt.trim()
      : 'Bu fotoğrafı incele ve beslenme tahminlerini JSON formatında döndür.';

    const base64Image = imageBuffer.toString('base64');
    const parts = [
      {
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: base64Image,
        },
      },
      { text: prompt },
    ];

    const modelNamesForImage = ['gemini-2.5-flash', 'gemini-2.5-pro'];
    let lastError = null;

    for (const modelName of modelNamesForImage) {
      try {
        const model = this.genAI.getGenerativeModel({ model: modelName });
        const result = await this._retryWithBackoff(async () => {
          return await model.generateContent(parts);
        }, 2, 500);

        const text = result.response.text();
        const cleaned = this._cleanJsonString(text);
        const parsed = JSON.parse(cleaned);
        return parsed;
      } catch (error) {
        lastError = error;
        if (!this._isRetryableError(error)) {
          console.warn(`⚠️ Model ${modelName} tabak analizinde başarısız: ${error.message}`);
        }
        continue;
      }
    }

    this._handleError(lastError);
  }

  /**
   * Video içeriğini analiz eder; egzersiz formu, beslenme vb. hakkında yorum döner.
   * @param {Buffer} videoBuffer - Video dosyası buffer
   * @param {string} mimeType - Örn. 'video/mp4', 'video/quicktime'
   * @param {string} userPrompt - Kullanıcının sorusu veya analiz talebi (örn. "Bu egzersizde formum nasıl?")
   * @returns {Promise<string>} AI yanıt metni
   */
  async analyzeVideo(videoBuffer, mimeType, userPrompt = '') {
    if (!this.genAI) throw new Error('Gemini API key yapılandırılmamış.');
    if (!videoBuffer || videoBuffer.length === 0) throw new Error('Video verisi boş.');

    const prompt = userPrompt && userPrompt.trim()
      ? userPrompt.trim()
      : 'Bu videoyu incele. Egzersiz / antrenman / beslenme veya genel içerik açısından kısa, yapıcı bir yorum ve öneriler yaz. Türkçe cevap ver.';

    const base64Video = videoBuffer.toString('base64');
    const parts = [
      {
        inlineData: {
          mimeType: mimeType || 'video/mp4',
          data: base64Video
        }
      },
      { text: prompt }
    ];

    const modelNamesForVideo = ['gemini-2.5-flash', 'gemini-2.5-pro'];
    let lastError = null;

    for (const modelName of modelNamesForVideo) {
      try {
        const model = this.genAI.getGenerativeModel({ model: modelName });
        const result = await this._retryWithBackoff(async () => {
          return await model.generateContent(parts);
        }, 2, 500);
        const text = result.response.text();
        if (text) {
          console.log(`✅ Video analizi tamamlandı (${modelName}).`);
          return text;
        }
      } catch (error) {
        lastError = error;
        if (!this._isRetryableError(error)) {
          console.warn(`⚠️ Model ${modelName} video analizinde başarısız: ${error.message}`);
        }
        continue;
      }
    }

    this._handleError(lastError);
  }

  /**
   * Hata yönetimi yardımcısı
   */
  _handleError(error) {
    console.error('Gemini API Kritik Hata:', error);
    
    if (error && (error.status === 429 || error.message?.includes('429'))) {
      throw new Error('Servis şu an çok yoğun, lütfen biraz bekleyip tekrar deneyin (Kota Aşıldı).');
    }
    if (error && (error.status === 503 || error.message?.includes('503') || error.message?.includes('overloaded'))) {
      throw new Error('AI servisi şu an aşırı yüklü. Lütfen birkaç saniye bekleyip tekrar deneyin.');
    }
    if (error && (error.status === 401 || error.status === 403)) {
      throw new Error('API Anahtarı hatası.');
    }
    if (
      error &&
      (error.status === 404 ||
        String(error.message || '').includes('404') ||
        String(error.message || '').includes('no longer available'))
    ) {
      throw new Error(
        'Seçilen AI modeli bu API anahtarı için kullanılamıyor. Lütfen daha sonra tekrar deneyin veya yöneticiye bildirin.'
      );
    }
    if (error && (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT'))) {
      throw new Error('İstek zaman aşımına uğradı. Lütfen tekrar deneyin.');
    }
    if (error && (error.message?.includes('network') || error.message?.includes('ECONNRESET'))) {
      throw new Error('Ağ bağlantı hatası. İnternet bağlantınızı kontrol edin ve tekrar deneyin.');
    }
    throw new Error('AI servisi şu an yanıt veremiyor. Lütfen daha sonra tekrar deneyin.');
  }
}

module.exports = AIService;

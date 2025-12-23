
import { GoogleGenAI, Type } from "@google/genai";
import { Achievement } from "../types.ts";

export const DEFAULT_AFFIRMATIONS = [
  "你是你人生的主角",
  "你值得美好的事物",
  "你总能如愿以偿",
  "你被爱和支持包围着",
  "你能克服任何挑战",
  "你简直是全世界最好看的人",
  "你的魅力威慑众生",
  "你迷人到离谱",
  "你散发着万人迷气质",
  "你天生就是富贵命",
  "你是金钱磁铁",
  "你能够轻松吸引金钱"
];

export class GeminiService {
  private ai: GoogleGenAI | null;

  constructor() {
    const apiKey =
      import.meta.env?.VITE_GEMINI_API_KEY ||
      import.meta.env?.GEMINI_API_KEY ||
      (typeof process !== "undefined" ? process.env.API_KEY || process.env.GEMINI_API_KEY : undefined);

    if (!apiKey) {
      this.ai = null;
      console.warn("Gemini API key missing, falling back to local responses.");
      return;
    }

    try {
      this.ai = new GoogleGenAI({ apiKey });
    } catch (error) {
      console.warn("Gemini client init failed, falling back:", error);
      this.ai = null;
    }
  }

  /**
   * 智能拆分成就：识别无标点长句中的独立事件
   */
  async parseAchievements(rawText: string): Promise<string[]> {
    try {
      if (!this.ai) {
        return rawText.split(/[，。, \n]/).filter(s => s.trim().length > 0);
      }
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: rawText,
        config: {
          systemInstruction: "你是一个成就提取专家。将输入拆分为JSON字符串数组。如输入'去健身吃了沙拉'，输出['自律健身', '吃了美味沙拉']。严禁输出Markdown文字，只输出JSON数组本身。",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
      });

      const items = JSON.parse(response.text.trim());
      return Array.isArray(items) ? items : [rawText];
    } catch (error) {
      console.warn("Gemini parse failed, falling back:", error);
      return rawText.split(/[，。, \n]/).filter(s => s.trim().length > 0);
    }
  }

  /**
   * 生成即时定制赞美
   */
  async generatePraise(achievements: Achievement[], lastInput?: string): Promise<string> {
    const fallback = () => DEFAULT_AFFIRMATIONS[Math.floor(Math.random() * DEFAULT_AFFIRMATIONS.length)];
    const context = lastInput || achievements.slice(-2).map(a => a.text).join("，");
    
    try {
      if (!this.ai) {
        return fallback();
      }
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `针对成就给出狂妄的赞美：${context}`,
        config: {
          systemInstruction: "你是一个霸道总裁。针对用户成就给出一句15字以内的称赞。必须'你'开头，语气绝对肯定、狂妄。直接输出文字，不要引号。",
        }
      });

      let praiseText = response.text.trim().replace(/[“”、"']/g, '');
      if (!praiseText.startsWith('你')) praiseText = '你' + praiseText;
      return praiseText.length > 25 ? praiseText.slice(0, 25) : praiseText;
    } catch (error) {
      console.error("Gemini praise generation error:", error);
      return fallback();
    }
  }
}

export const geminiService = new GeminiService();

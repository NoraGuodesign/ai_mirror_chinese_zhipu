
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

const ZHIPU_API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const FALLBACK_API_KEY = "f46e1d0826984e90a695e389b79df8f4.r7JXgTivdaHiWdAb";

type ZhipuMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ZhipuCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export class GeminiService {
  private apiKey: string | null;

  constructor() {
    const apiKey =
      import.meta.env?.VITE_ZHIPU_API_KEY ||
      import.meta.env?.ZHIPU_API_KEY ||
      import.meta.env?.VITE_GLM_API_KEY ||
      (typeof process !== "undefined"
        ? process.env.ZHIPU_API_KEY || process.env.GLM_API_KEY || process.env.API_KEY
        : undefined) ||
      FALLBACK_API_KEY;

    if (!apiKey) {
      this.apiKey = null;
      console.warn("Zhipu API key missing, falling back to local responses.");
      return;
    }

    this.apiKey = apiKey;
  }

  private async requestCompletion(messages: ZhipuMessage[], options?: { temperature?: number; maxTokens?: number }) {
    if (!this.apiKey) {
      throw new Error("Missing Zhipu API key.");
    }

    const response = await fetch(ZHIPU_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "glm-4.5-flash",
        messages,
        stream: false,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 512,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Zhipu API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as ZhipuCompletionResponse;
    return data.choices?.[0]?.message?.content ?? "";
  }

  /**
   * 智能拆分成就：识别无标点长句中的独立事件
   */
  async parseAchievements(rawText: string): Promise<string[]> {
    try {
      if (!this.apiKey) {
        return rawText.split(/[，。, \n]/).filter(s => s.trim().length > 0);
      }
      const content = await this.requestCompletion(
        [
          {
            role: "system",
            content:
              "你是一个成就提取专家。将输入拆分为JSON字符串数组。如输入'去健身吃了沙拉'，输出['自律健身', '吃了美味沙拉']。严禁输出Markdown文字，只输出JSON数组本身。",
          },
          { role: "user", content: rawText },
        ],
        { temperature: 0.2, maxTokens: 256 },
      );

      const items = JSON.parse(content.trim());
      return Array.isArray(items) ? items : [rawText];
    } catch (error) {
      console.warn("Zhipu parse failed, falling back:", error);
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
      if (!this.apiKey) {
        return fallback();
      }
      const content = await this.requestCompletion(
        [
          {
            role: "system",
            content:
              "你是一个霸道总裁。针对用户成就给出一句15字以内的称赞。必须'你'开头，语气绝对肯定、狂妄。直接输出文字，不要引号。",
          },
          { role: "user", content: `针对成就给出狂妄的赞美：${context}` },
        ],
        { temperature: 0.7, maxTokens: 64 },
      );

      let praiseText = content.trim().replace(/[“”、"']/g, "");
      if (!praiseText.startsWith('你')) praiseText = '你' + praiseText;
      return praiseText.length > 25 ? praiseText.slice(0, 25) : praiseText;
    } catch (error) {
      console.error("Zhipu praise generation error:", error);
      return fallback();
    }
  }
}

export const geminiService = new GeminiService();

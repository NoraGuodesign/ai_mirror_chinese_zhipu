
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
        return rawText
          .split(/[，。, \n]/)
          .map(item => item.trim())
          .filter(item => item.length > 0)
          .map(item => this.normalizeAchievementText(item))
          .filter(item => item.length > 0);
      }
      const content = await this.requestCompletion(
        [
          {
            role: "system",
            content:
              "你是成就提取专家，用户像和朋友聊天。请从文段中提取多个积极正面的“小事件”，每条清晰、有行动或结果、简短自然，不要复述原话。只输出JSON字符串数组本身，严禁Markdown。",
          },
          {
            role: "system",
            content:
              "示例：输入“今天心情不太好但还是去跑步了，晚饭自己做了沙拉，还把方案改完了”输出[\"坚持跑步\",\"自制健康沙拉\",\"完成方案修改\"]",
          },
          { role: "user", content: rawText },
        ],
        { temperature: 0.2, maxTokens: 256 },
      );

      const items = this.parseJsonArray(content.trim());
      const normalized = Array.isArray(items) ? items : [rawText];
      return normalized
        .map((item) => this.normalizeAchievementText(String(item)))
        .filter((item) => item.length > 0);
    } catch (error) {
      console.warn("Zhipu parse failed, falling back:", error);
      return rawText
        .split(/[，。, \n]/)
        .map(item => item.trim())
        .filter(item => item.length > 0)
        .map(item => this.normalizeAchievementText(item))
        .filter(item => item.length > 0);
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
              "你是贴心的朋友。根据用户输入生成一句新的赞美，内容贴合当下细节，语气自然真诚、像朋友夸奖。必须以“你”开头，控制在20字以内。直接输出文字，不要引号。",
          },
          { role: "user", content: `根据输入给出夸奖：${context}` },
        ],
        { temperature: 0.7, maxTokens: 64 },
      );

      let praiseText = content.trim().replace(/[“”、"']/g, "");
      if (!praiseText.startsWith('你')) praiseText = '你' + praiseText;
      if (!praiseText.trim()) return fallback();
      return praiseText.length > 25 ? praiseText.slice(0, 25) : praiseText;
    } catch (error) {
      console.error("Zhipu praise generation error:", error);
      return fallback();
    }
  }

  private normalizeAchievementText(text: string): string {
    const trimmed = text.replace(/[。！？!?,，]+/g, "").trim();
    const cleaned = trimmed
      .replace(/^(我|今天|刚刚|刚才|然后|之后|后来|其实|就是|一下|一下子|又|还|只是|不过|但是|可是|而且|并且|于是|所以)\s*/g, "")
      .replace(/(了|啦|呀|呢)$/g, "")
      .trim();
    return cleaned || trimmed;
  }

  private parseJsonArray(content: string): unknown {
    try {
      return JSON.parse(content);
    } catch (error) {
      const start = content.indexOf("[");
      const end = content.lastIndexOf("]");
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(content.slice(start, end + 1));
        } catch (innerError) {
          console.warn("Zhipu JSON array parse failed:", innerError);
        }
      }
      throw error;
    }
  }
}

export const geminiService = new GeminiService();

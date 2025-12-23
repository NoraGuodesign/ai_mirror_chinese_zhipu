
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
              "你是一个成就提取专家。用户像在和朋友聊天，请从文段中提取多个积极正面的“小事件”，每条保持简短、有行动结果。输出JSON字符串数组。如输入“今天好累但还是去跑步了，还做了沙拉”，输出[\"坚持跑步\",\"做了健康沙拉\"]。严禁输出Markdown文字，只输出JSON数组本身。",
          },
          { role: "user", content: rawText },
        ],
        { temperature: 0.2, maxTokens: 256 },
      );

      const items = JSON.parse(content.trim());
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
    const pickHighlight = (input?: string) => {
      if (!input) return '';
      const cleaned = input.replace(/[“”、"'`]/g, '').replace(/\s+/g, '').trim();
      if (!cleaned) return '';
      const fragment = cleaned.split(/[，。,；;！？!?]/).filter(Boolean)[0] || cleaned;
      return fragment.length > 12 ? fragment.slice(0, 12) : fragment;
    };

    const buildLocalPraise = () => {
      const highlight = pickHighlight(lastInput);
      if (highlight) {
        const templates = [
          `你发现${highlight}，真会享受生活`,
          `你注意到${highlight}，心思很细腻`,
          `你记录了${highlight}，生活感满满`,
          `你感受到${highlight}，真懂得照顾自己`,
          `你留意到${highlight}，这份温柔很珍贵`,
        ];
        return templates[Math.floor(Math.random() * templates.length)];
      }
      return DEFAULT_AFFIRMATIONS[Math.floor(Math.random() * DEFAULT_AFFIRMATIONS.length)];
    };

    const fallback = buildLocalPraise;
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
              "你是一个贴心的朋友。根据用户输入生成一句新的赞美，语气自然真诚、有针对性。避免机械套句或复述原话，禁止使用“你把xxx做得很棒”结构。必须以“你”开头，15-20字以内。直接输出文字，不要引号。",
          },
          { role: "user", content: `根据输入给出夸奖：${context}` },
        ],
        { temperature: 0.7, maxTokens: 64 },
      );

      let praiseText = content.trim().replace(/[“”、"']/g, "");
      if (!praiseText.startsWith('你')) praiseText = '你' + praiseText;
      if (/你把.+做[得的]很棒/.test(praiseText)) {
        return fallback();
      }
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
}

export const geminiService = new GeminiService();

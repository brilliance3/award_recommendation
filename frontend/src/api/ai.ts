import { api } from "./client";
import type { AIResponse } from "../types";

export const aiApi = {
  ping: () => api.get<AIResponse>("/api/ai/ping").then((r) => r.data),

  polish: (text: string, target_style = "행정문서") =>
    api
      .post<AIResponse>("/api/ai/polish", { text, target_style })
      .then((r) => r.data),

  summarize: (text: string, max_chars = 50) =>
    api
      .post<AIResponse>("/api/ai/summarize", { text, max_chars })
      .then((r) => r.data),

  polishAB: (text: string) =>
    api
      .post<{ a: AIResponse; b: AIResponse }>("/api/ai/polish-ab", { text })
      .then((r) => r.data),
};

// Muse Wonder 1.0 via the Meta API (OpenAI-compatible chat completions). The model reasons internally:
// we only forward `content` deltas (never reasoning) and drop any <think> blocks that leak into content.
const BASE_URL = () => (process.env.MUSE_BASE_URL || "https://api.meta.ai/v1").replace(/\/$/, "");
export const MUSE_MODEL = () => process.env.MUSE_MODEL || "muse-wonder-1.0";

export interface Msg {
  role: "system" | "user" | "assistant";
  content: string;
}

function request(messages: Msg[], stream: boolean, maxTokens: number) {
  const key = process.env.MUSE_API_KEY;
  if (!key) throw new Error("MUSE_API_KEY is not set");
  return fetch(`${BASE_URL()}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MUSE_MODEL(),
      messages,
      stream,
      max_tokens: maxTokens,
      reasoning_effort: "low",
    }),
  });
}

const stripThink = (t: string) => t.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/^[\s\S]*<\/think>/, "");

export async function* museStream(messages: Msg[], maxTokens = 24000): AsyncGenerator<string> {
  const r = await request(messages, true, maxTokens);
  if (!r.ok || !r.body) throw new Error(`Muse error ${r.status}: ${await r.text()}`);
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let inThink = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
      let t = "";
      try {
        t = JSON.parse(line.slice(6))?.choices?.[0]?.delta?.content || "";
      } catch {
        continue;
      }
      if (t.includes("<think>")) inThink = true;
      if (inThink) {
        if (!t.includes("</think>")) continue;
        inThink = false;
        t = t.split("</think>").pop() || "";
      }
      if (t) yield t;
    }
  }
}

export async function museComplete(messages: Msg[], maxTokens = 24000): Promise<string> {
  const r = await request(messages, false, maxTokens);
  if (!r.ok) throw new Error(`Muse error ${r.status}: ${await r.text()}`);
  return stripThink((await r.json())?.choices?.[0]?.message?.content ?? "");
}

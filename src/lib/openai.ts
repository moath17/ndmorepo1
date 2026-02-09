import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY environment variable is not set. " +
          "Please add it to your .env.local file."
      );
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

export function getVectorStoreId(): string | null {
  return process.env.OPENAI_VECTOR_STORE_ID || null;
}

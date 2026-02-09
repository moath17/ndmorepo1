import { getOpenAIClient, getVectorStoreId } from "./openai";

let cachedVectorStoreId: string | null = null;

/**
 * Get or create the Vector Store ID.
 * First checks env var, then cached value, then creates a new one.
 */
export async function ensureVectorStore(): Promise<string> {
  // Check env var first
  const envId = getVectorStoreId();
  if (envId) {
    cachedVectorStoreId = envId;
    return envId;
  }

  // Return cached if available
  if (cachedVectorStoreId) {
    return cachedVectorStoreId;
  }

  // Create a new vector store
  const client = getOpenAIClient();
  const vectorStore = await client.vectorStores.create({
    name: "ndmo-document-assistant",
  });

  cachedVectorStoreId = vectorStore.id;

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `Created new Vector Store: ${vectorStore.id}. ` +
        `Set OPENAI_VECTOR_STORE_ID=${vectorStore.id} in .env.local to reuse it.`
    );
  }

  return vectorStore.id;
}

/**
 * Upload a text content as a file to OpenAI and add it to the vector store.
 */
export async function uploadToVectorStore(
  filename: string,
  content: string,
  vectorStoreId: string
): Promise<string> {
  const client = getOpenAIClient();

  // Create a File object from the text content
  const blob = new Blob([content], { type: "text/plain" });
  const file = new File([blob], filename.replace(".pdf", ".txt"), {
    type: "text/plain",
  });

  // Upload file to OpenAI
  const fileResponse = await client.files.create({
    file: file,
    purpose: "assistants",
  });

  // Add file to vector store
  await client.vectorStores.files.create(vectorStoreId, {
    file_id: fileResponse.id,
  });

  // Wait for processing to complete
  let status = "in_progress";
  let attempts = 0;
  const maxAttempts = 60; // Max 5 minutes (5s intervals)

  while (status === "in_progress" && attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const fileStatus = await client.vectorStores.files.retrieve(
      vectorStoreId,
      fileResponse.id
    );
    status = fileStatus.status;
    attempts++;
  }

  if (status !== "completed") {
    throw new Error(
      `File processing did not complete. Final status: ${status}`
    );
  }

  return fileResponse.id;
}

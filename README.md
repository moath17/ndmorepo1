# NDMO Document Assistant

A production-ready bilingual (Arabic + English) AI-powered document chat application. Upload PDF documents and ask questions — the AI answers **only** from your documents with strict grounding (no hallucinations).

Built with Next.js 14+, TypeScript, Tailwind CSS, and OpenAI's Responses API with file_search.

---

## Features

- **RAG Chat**: Upload PDFs and chat with an AI that answers only from your documents
- **Strict Grounding**: Temperature 0, no outside knowledge, refuses when evidence is insufficient
- **Page-Level Citations**: Every answer includes source document name and page numbers
- **Bilingual**: Full Arabic (RTL) and English support with language toggle
- **SEO-Optimized**: Proper metadata, hreflang, canonical URLs, sitemap, robots.txt
- **Large PDF Support**: Handles 1000+ page documents via page-by-page preprocessing
- **Multi-Document**: Upload multiple PDFs; the AI picks the most relevant one per question
- **No Login Required**: Users land on the chat page and start immediately
- **Rate Limited**: Built-in protection against abuse
- **Production Ready**: Clean error handling, input validation, filename sanitization

---

## Prerequisites

- **Node.js** 18.17 or later
- **OpenAI API Key** with access to the Responses API and file_search tool

---

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd NDMO
npm install
```

### 2. Get an OpenAI API Key

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click **"Create new secret key"**
3. Copy the key (starts with `sk-`)

### 3. (Optional) Create a Vector Store

A vector store will be **auto-created** on first PDF upload if you skip this step.

To create one manually:

1. Go to [platform.openai.com/storage/vector-stores](https://platform.openai.com/storage/vector-stores)
2. Click **"Create"**
3. Name it (e.g., "ndmo-documents")
4. Copy the Vector Store ID (starts with `vs_`)

### 4. Configure Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
OPENAI_API_KEY=sk-your-key-here
OPENAI_VECTOR_STORE_ID=vs_your-store-id-here   # Optional
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 5. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## How It Works

### PDF Upload Flow

1. User uploads one or more PDFs via the sidebar
2. Server extracts text page-by-page using `pdf-parse`
3. Each page is tagged with markers: `[DOCUMENT: filename | PAGE: N]`
4. The tagged text file is uploaded to OpenAI's Files API
5. The file is added to the Vector Store for indexing
6. File metadata is saved locally for the UI

### Chat Flow

1. User sends a question
2. Server calls OpenAI Responses API with `file_search` tool
3. OpenAI automatically retrieves the most relevant chunks from the Vector Store
4. The model generates an answer **only** from retrieved content
5. Sources (document name + page numbers) are extracted from the page markers
6. Answer + sources are returned to the client

### No Hallucination Policy

The system prompt enforces:
- **Temperature 0**: Deterministic, no creative generation
- **Grounded-only answers**: Only use retrieved document content
- **Refusal**: If evidence is insufficient, respond with "Not found in the provided documents."
- **Mandatory citations**: Every answer must include source document and page numbers
- **No fabrication**: Never invent document names or page numbers

---

## Project Structure

```
src/
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx          # i18n layout (RTL, fonts, metadata)
│   │   └── page.tsx            # Chat page
│   ├── api/
│   │   ├── chat/route.ts       # Chat endpoint
│   │   ├── upload/route.ts     # PDF upload endpoint
│   │   └── files/route.ts      # List uploaded files
│   ├── layout.tsx              # Root layout
│   ├── sitemap.ts              # Dynamic sitemap
│   └── robots.ts               # Robots.txt
├── components/
│   ├── ChatInterface.tsx       # Main chat orchestrator
│   ├── MessageList.tsx         # Chat messages display
│   ├── ChatInput.tsx           # Message input
│   ├── FileUpload.tsx          # PDF upload with drag-and-drop
│   ├── LanguageToggle.tsx      # AR/EN language switcher
│   └── UploadedFilesList.tsx   # Uploaded documents list
├── lib/
│   ├── openai.ts               # OpenAI client singleton
│   ├── pdf-processor.ts        # PDF text extraction with page markers
│   ├── rate-limiter.ts         # In-memory rate limiter
│   ├── sanitize.ts             # Filename sanitizer
│   ├── system-prompt.ts        # AI system prompt
│   ├── vector-store.ts         # Vector store management
│   └── uploaded-files.ts       # File tracking persistence
├── i18n/
│   ├── config.ts               # Locale configuration
│   ├── dictionaries.ts         # Dictionary loader
│   ├── ar.json                 # Arabic translations
│   └── en.json                 # English translations
├── types/
│   ├── index.ts                # Shared TypeScript types
│   └── pdf-parse.d.ts          # pdf-parse type declarations
└── middleware.ts               # Locale detection middleware
```

---

## API Reference

### POST /api/upload

Upload PDF files for indexing.

**Request**: `multipart/form-data` with field `files` (one or more PDF files)

**Limits**:
- Max file size: 100MB per file
- Max files per request: 10
- Accepted types: `application/pdf` only

**Response**:
```json
{
  "success": true,
  "files": [
    {
      "id": "1707000000_abc1234",
      "originalName": "document.pdf",
      "sanitizedName": "document.pdf",
      "openaiFileId": "file-abc123",
      "pageCount": 42,
      "uploadedAt": "2025-02-04T10:00:00.000Z"
    }
  ]
}
```

### POST /api/chat

Send a message to the chatbot.

**Request**:
```json
{
  "message": "What does chapter 3 discuss?",
  "locale": "en"
}
```

**Response**:
```json
{
  "answer": "Chapter 3 discusses the methodology used in the study...",
  "sources": [
    { "document": "research-paper.pdf", "page": 45 },
    { "document": "research-paper.pdf", "page": 46 }
  ]
}
```

### GET /api/files

List all uploaded files.

**Response**:
```json
{
  "files": [...]
}
```

---

## Deployment

### Deploy to Vercel

1. Push your code to a GitHub repository

2. Go to [vercel.com](https://vercel.com) and import your repository

3. Set environment variables in Vercel's dashboard:
   - `OPENAI_API_KEY`
   - `OPENAI_VECTOR_STORE_ID` (recommended for production)
   - `NEXT_PUBLIC_BASE_URL` (your production domain, e.g., `https://yourdomain.com`)

4. Deploy

### Custom Domain

1. In Vercel dashboard, go to your project **Settings** > **Domains**
2. Add your custom domain (e.g., `chat.yourdomain.com`)
3. Update DNS records as instructed by Vercel:
   - **A Record**: `76.76.21.21`
   - **CNAME**: `cname.vercel-dns.com`
4. Update `NEXT_PUBLIC_BASE_URL` to match your domain

---

## Security Notes

- No PDF contents or user questions are logged in production
- Filenames are sanitized to prevent path traversal attacks
- File type and size are validated server-side
- Rate limiting: 20 chat requests/min, 10 uploads/min per IP
- OpenAI API key is server-side only (never exposed to client)

---

## System Prompt

The exact system prompt used for strict grounding is in `src/lib/system-prompt.ts`. Key rules:

1. ONLY use retrieved document chunks — never outside knowledge
2. Refuse with exact message if evidence is insufficient
3. Answer in the same language as the question
4. Always provide citations with document name and page numbers
5. Never fabricate sources

---

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI**: OpenAI Responses API with file_search tool
- **PDF Processing**: pdf-parse
- **Icons**: Lucide React

---

## License

MIT

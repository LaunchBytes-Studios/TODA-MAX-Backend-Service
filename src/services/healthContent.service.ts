import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";

type Chunk = {
  id: string;
  source: string;
  text: string;
  tokens: Set<string>;
};

const DEFAULT_CHUNK_SIZE = 600;
const DEFAULT_CHUNK_OVERLAP = 80;
const DEFAULT_LIMIT = 2;

const HEALTH_CONTENT_DIR =
  process.env.HEALTH_CONTENT_DIR ?? path.resolve(process.cwd(), "health-content");

let cachedChunks: Chunk[] | null = null;
let loadingPromise: Promise<Chunk[]> | null = null;

const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

const tokenize = (value: string): string[] => {
  const matches = value.toLowerCase().match(/[a-z0-9]+/g);
  return matches ?? [];
};

const chunkText = (text: string): string[] => {
  const words = text.split(/\s+/g).filter(Boolean);
  if (words.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  const step = Math.max(1, DEFAULT_CHUNK_SIZE - DEFAULT_CHUNK_OVERLAP);

  for (let index = 0; index < words.length; index += step) {
    const slice = words.slice(index, index + DEFAULT_CHUNK_SIZE);
    if (slice.length === 0) {
      continue;
    }
    chunks.push(slice.join(" "));
  }

  return chunks;
};

const scoreChunk = (queryTokens: Set<string>, chunkTokens: Set<string>) => {
  if (queryTokens.size === 0 || chunkTokens.size === 0) {
    return { score: 0, overlap: 0, matchedTokens: [] as string[] };
  }

  let overlap = 0;
  const matchedTokens: string[] = [];
  for (const token of queryTokens) {
    if (chunkTokens.has(token)) {
      overlap += 1;
      matchedTokens.push(token);
    }
  }

  return {
    score: overlap / Math.sqrt(chunkTokens.size + 1),
    overlap,
    matchedTokens,
  };
};

const extractTextFromFile = async (filePath: string): Promise<string> => {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".docx") {
    const { value } = await mammoth.extractRawText({ path: filePath });
    return value;
  }

  return "";
};

const loadHealthContent = async (): Promise<Chunk[]> => {
  const dirEntries = await fs.readdir(HEALTH_CONTENT_DIR, { withFileTypes: true });
  const files = dirEntries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(HEALTH_CONTENT_DIR, entry.name));

  const chunks: Chunk[] = [];

  for (const filePath of files) {
    const rawText = await extractTextFromFile(filePath);
    const normalized = normalizeWhitespace(rawText);
    if (!normalized) {
      continue;
    }

    const source = path.basename(filePath);
    const slices = chunkText(normalized);
    slices.forEach((slice, index) => {
      const chunkTextValue = normalizeWhitespace(slice);
      if (!chunkTextValue) {
        return;
      }
      chunks.push({
        id: `${source}-${index + 1}`,
        source,
        text: chunkTextValue,
        tokens: new Set(tokenize(chunkTextValue)),
      });
    });
  }

  return chunks;
};

const getChunks = async (): Promise<Chunk[]> => {
  if (cachedChunks) {
    return cachedChunks;
  }

  if (!loadingPromise) {
    loadingPromise = loadHealthContent()
      .then((loaded) => {
        cachedChunks = loaded;
        return loaded;
      })
      .finally(() => {
        loadingPromise = null;
      });
  }

  return loadingPromise;
};

export const getHealthContext = async (query: string, limit = DEFAULT_LIMIT) => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return "";
  }

  const chunks = await getChunks();
  if (chunks.length === 0) {
    return "";
  }

  const queryTokens = new Set(tokenize(trimmedQuery));
  const scored = chunks
    .map((chunk) => {
      const { score, overlap, matchedTokens } = scoreChunk(queryTokens, chunk.tokens);
      return { chunk, score, overlap, matchedTokens };
    })
    .filter((item) => {
      if (item.overlap === 0) {
        return false;
      }

      if (item.overlap >= 2) {
        return true;
      }

      if (queryTokens.size <= 2) {
        return item.matchedTokens.some((token) => token.length >= 6);
      }

      return false;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.chunk);

  if (scored.length === 0) {
    return "";
  }

  return scored
    .map((chunk) => `Source: ${chunk.source}\n${chunk.text}`)
    .join("\n\n---\n\n");
};

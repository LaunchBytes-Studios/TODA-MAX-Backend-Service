import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises');
vi.mock('mammoth');

type MockDirent = {
  name: string;
  isFile: () => boolean;
};

const createMockDirent = (name: string, isFile = true): MockDirent => ({
  name,
  isFile: () => isFile,
});

const asReaddirResult = <T>(value: T) =>
  value as unknown as Awaited<ReturnType<(typeof import('node:fs/promises'))['readdir']>>;

describe('healthContent.service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('getHealthContext', () => {
    it('should return empty string for empty query', async () => {
      const { getHealthContext } = await import('../healthContent.service.js');
      const result = await getHealthContext('');
      expect(result).toBe('');
    });

    it('should return empty string for whitespace-only query', async () => {
      const { getHealthContext } = await import('../healthContent.service.js');
      const result = await getHealthContext('   ');
      expect(result).toBe('');
    });

    it('should return empty string when no health content files exist', async () => {
      const fs = await import('node:fs/promises');
      vi.mocked(fs.readdir).mockResolvedValueOnce(asReaddirResult([]));

      const { getHealthContext } = await import('../healthContent.service.js');
      const result = await getHealthContext('diabetes treatment');
      expect(result).toBe('');
    });

    it('should return empty string when extracted text is empty', async () => {
      const fs = await import('node:fs/promises');
      const mammoth = await import('mammoth');

      const mockDirEntry = createMockDirent('empty-file.docx');
      vi.mocked(fs.readdir).mockResolvedValueOnce(asReaddirResult([mockDirEntry]));
      vi.mocked(mammoth.extractRawText).mockResolvedValueOnce({ value: '', messages: [] });

      const { getHealthContext } = await import('../healthContent.service.js');
      const result = await getHealthContext('some query');
      expect(result).toBe('');
    });

    it('should extract and return context from docx files', async () => {
      const fs = await import('node:fs/promises');
      const mammoth = await import('mammoth');

      const mockDirEntry = createMockDirent('health-guide.docx');
      const healthContent =
        'Diabetes is a chronic condition affecting blood sugar levels. Treatment includes medication.';

      vi.mocked(fs.readdir).mockResolvedValueOnce(asReaddirResult([mockDirEntry]));
      vi.mocked(mammoth.extractRawText).mockResolvedValueOnce({
        value: healthContent,
        messages: [],
      });

      const { getHealthContext } = await import('../healthContent.service.js');
      const result = await getHealthContext('diabetes treatment');
      expect(result).toBeTruthy();
      expect(result).toContain('health-guide.docx');
    });

    it('should normalize whitespace in extracted content', async () => {
      const fs = await import('node:fs/promises');
      const mammoth = await import('mammoth');

      const mockDirEntry = createMockDirent('health-guide.docx');
      const healthContent = `
        Diabetes    is    a    chronic    condition
        Treatment   requires   careful   management
      `;

      vi.mocked(fs.readdir).mockResolvedValueOnce(asReaddirResult([mockDirEntry]));
      vi.mocked(mammoth.extractRawText).mockResolvedValueOnce({
        value: healthContent,
        messages: [],
      });

      const { getHealthContext } = await import('../healthContent.service.js');
      const result = await getHealthContext('diabetes chronic');
      expect(result).not.toContain('   ');
    });

    it('should return empty string for non-matching queries', async () => {
      const fs = await import('node:fs/promises');
      const mammoth = await import('mammoth');

      const mockDirEntry = createMockDirent('health-guide.docx');
      const healthContent = 'The quick brown fox jumps over the lazy dog.';

      vi.mocked(fs.readdir).mockResolvedValueOnce(asReaddirResult([mockDirEntry]));
      vi.mocked(mammoth.extractRawText).mockResolvedValueOnce({
        value: healthContent,
        messages: [],
      });

      const { getHealthContext } = await import('../healthContent.service.js');
      const result = await getHealthContext('diabetes insulin');
      expect(result).toBe('');
    });

    it('should process only file entries and skip directories', async () => {
      const fs = await import('node:fs/promises');
      const mammoth = await import('mammoth');

      const mockEntries = [
        createMockDirent('diabetes-guide.docx', true),
        createMockDirent('some-folder', false),
      ];

      vi.mocked(fs.readdir).mockResolvedValueOnce(asReaddirResult(mockEntries));
      vi.mocked(mammoth.extractRawText).mockResolvedValueOnce({
        value: 'Diabetes treatment with insulin and medication management.',
        messages: [],
      });

      const { getHealthContext } = await import('../healthContent.service.js');
      const result = await getHealthContext('diabetes insulin');
      expect(result).toBeTruthy();
      expect(vi.mocked(mammoth.extractRawText)).toHaveBeenCalledTimes(1);
    });

    it('should include source filename in returned content', async () => {
      const fs = await import('node:fs/promises');
      const mammoth = await import('mammoth');

      const mockDirEntry = createMockDirent('diabetes-treatment.docx');

      vi.mocked(fs.readdir).mockResolvedValueOnce(asReaddirResult([mockDirEntry]));
      vi.mocked(mammoth.extractRawText).mockResolvedValueOnce({
        value: 'Diabetes treatment involves insulin therapy and medication.',
        messages: [],
      });

      const { getHealthContext } = await import('../healthContent.service.js');
      const result = await getHealthContext('diabetes');
      expect(result).toContain('Source: diabetes-treatment.docx');
    });

    it('should handle queries with long tokens', async () => {
      const fs = await import('node:fs/promises');
      const mammoth = await import('mammoth');

      const mockDirEntry = createMockDirent('health-guide.docx');

      vi.mocked(fs.readdir).mockResolvedValueOnce(asReaddirResult([mockDirEntry]));
      vi.mocked(mammoth.extractRawText).mockResolvedValueOnce({
        value: 'Patient education and pharmaceutical interventions.',
        messages: [],
      });

      const { getHealthContext } = await import('../healthContent.service.js');
      const result = await getHealthContext('pharmaceutical');
      expect(result).toBeTruthy();
    });

    it('should respect the limit parameter', async () => {
      const fs = await import('node:fs/promises');
      const mammoth = await import('mammoth');

      const mockDirEntry = createMockDirent('health-guide.docx');
      const healthContent = `
        Diabetes treatment with insulin therapy.
        Hypertension management with medication.
        Blood pressure monitoring and control.
      `;

      vi.mocked(fs.readdir).mockResolvedValueOnce(asReaddirResult([mockDirEntry]));
      vi.mocked(mammoth.extractRawText).mockResolvedValueOnce({
        value: healthContent,
        messages: [],
      });

      const { getHealthContext } = await import('../healthContent.service.js');
      const result = await getHealthContext('diabetes', 1);
      expect(result).toBeTruthy();
    });

    it('should handle errors from extractRawText gracefully', async () => {
      const fs = await import('node:fs/promises');
      const mammoth = await import('mammoth');

      const mockDirEntry = createMockDirent('corrupt-file.docx');

      vi.mocked(fs.readdir).mockResolvedValueOnce(asReaddirResult([mockDirEntry]));
      vi.mocked(mammoth.extractRawText).mockRejectedValueOnce(new Error('Failed to read docx'));

      const { getHealthContext } = await import('../healthContent.service.js');
      const result = await getHealthContext('diabetes');
      expect(result).toBe('');
    });

    it('should filter chunks with insufficient token overlap', async () => {
      const fs = await import('node:fs/promises');
      const mammoth = await import('mammoth');

      const mockDirEntry = createMockDirent('health-guide.docx');
      const healthContent = 'Lorem ipsum dolor sit amet consectetur adipiscing.';

      vi.mocked(fs.readdir).mockResolvedValueOnce(asReaddirResult([mockDirEntry]));
      vi.mocked(mammoth.extractRawText).mockResolvedValueOnce({
        value: healthContent,
        messages: [],
      });

      const { getHealthContext } = await import('../healthContent.service.js');
      const result = await getHealthContext('pharmacology treatment');
      expect(result).toBe('');
    });
  });
});

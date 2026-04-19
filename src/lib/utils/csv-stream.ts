import type { ZodType } from 'zod';

import { parseCsvLine, sanitizeHeader } from './csv';

type CsvRow = Record<string, string>;

export const forEachCsvRow = async <T>(
  stream: ReadableStream<Uint8Array>,
  schema: ZodType<T, any, any>,
  onRow: (row: T) => Promise<void> | void,
  onInvalidRow?: (row: CsvRow, error: unknown) => void,
) => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let headers: string[] | null = null;
  let buffer = '';
  let currentLine = '';
  let insideQuotes = false;

  const processLogicalLine = async (line: string) => {
    if (line.trim() === '') {
      return;
    }

    const values = parseCsvLine(line);
    if (!headers) {
      headers = values.map(sanitizeHeader);
      return;
    }

    const row = headers.reduce<CsvRow>((acc, header, i) => {
      acc[header] = values[i] ?? '';
      return acc;
    }, {});

    const parsed = schema.safeParse(row);
    if (!parsed.success) {
      onInvalidRow?.(row, parsed.error);
      return;
    }

    await onRow(parsed.data);
  };

  const processRawLine = async (rawLine: string) => {
    currentLine = insideQuotes ? `${currentLine}\n${rawLine}` : rawLine;

    const quoteCount = (rawLine.match(/"/g) || []).length;
    if (quoteCount % 2 === 1) {
      insideQuotes = !insideQuotes;
    }

    if (!insideQuotes) {
      await processLogicalLine(currentLine.replace(/\r$/, ''));
      currentLine = '';
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const rawLines = buffer.split('\n');
    buffer = rawLines.pop() ?? '';

    for (const rawLine of rawLines) {
      await processRawLine(rawLine);
    }
  }

  buffer += decoder.decode();

  if (buffer !== '') {
    await processRawLine(buffer);
  }

  if (insideQuotes) {
    throw new Error('CSV ended inside a quoted field');
  }
};

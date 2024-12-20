import { ZodSchema } from 'zod';

export const parseCsv = <T>(
  csv: string,
  schema: ZodSchema<T>,
): [T[], boolean] => {
  const lines = parseCsvLines(csv);
  if (lines.length < 2) {
    return [[], true];
  }

  // @ts-expect-error - clearly checking for length above
  const headers = parseCsvLine(lines[0]).map(sanitizeHeader);
  const rows: T[] = [];
  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line);

    const row = headers.reduce<Record<string, string>>((acc, header, i) => {
      acc[header] = values[i] ?? '';
      return acc;
    }, {});

    try {
      const validatedRow = schema.parse(row);
      rows.push(validatedRow);
    } catch (e) {
      console.error('Error parsing row: ', row, e);
      return [[], true];
    }
  }

  return [rows, false];
};

const parseCsvLines = (csv: string) => {
  const lines: string[] = [];
  let currentLine = '';

  const rawLines = csv.split('\n').filter((line) => line.trim() !== '');
  let insideQuotes = false;

  for (const rawLine of rawLines) {
    if (insideQuotes) {
      currentLine += '\n' + rawLine;
    } else {
      currentLine = rawLine;
    }

    const quoteCount = (rawLine.match(/"/g) || []).length;

    if (quoteCount % 2 === 1) {
      insideQuotes = !insideQuotes;
    }

    if (!insideQuotes) {
      lines.push(currentLine);
      currentLine = '';
    }
  }

  return lines;
};

const parseCsvLine = (line: string): string[] => {
  const regex = /(?:,|\r?\n|^)(?:"([^"]*(?:""[^"]*)*)"|([^",\r\n]*))/g;
  const fields: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    const value =
      match[1] !== undefined
        ? match[1].replace(/""/g, '"') // Unescape double quotes inside quoted fields
        : match[2];
    fields.push(value || '');
  }

  return fields;
};

const sanitizeHeader = (header: string) => {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_/, '')
    .replace(/_$/, '');
};

type CsvCell = string | number | object | null | undefined;

export const generateCsv = (data: Record<string, CsvCell>[]) => {
  if (!data[0]) {
    return '';
  }

  const headers = Object.keys(data[0]);
  const headerRow = headers.map((header) => `"${header}"`).join(',') + '\n';

  const rows = data.map((row) => {
    return headers
      .map((header) => {
        if (typeof row[header] === 'object' && row[header] !== null) {
          return stringify(row[header]);
        }
        return `"${row[header] ?? ''}"`;
      })
      .join(',');
  });

  return headerRow + rows.join('\n');
};

const stringify = (value: object) => {
  return `"${JSON.stringify(value).replace(/,/g, '\\,')}"`;
};

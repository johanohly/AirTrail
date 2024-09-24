import { ZodSchema } from 'zod';

export const parseCsv = <T>(
  csv: string,
  schema: ZodSchema<T>,
): [T[], boolean] => {
  const lines = csv.split('\n').filter((line) => line.trim() !== '');
  if (lines.length < 2) {
    return [[], true];
  }

  // @ts-expect-error - clearly checking for length above
  const headers = lines[0].split(',').map(sanitizeHeader);
  const rows: T[] = [];
  for (const line of lines.slice(1)) {
    const values = line.split(',').map(sanitizeValue);

    const row = headers.reduce<Record<string, string>>((acc, header, i) => {
      acc[header] = values[i] ?? '';
      return acc;
    }, {});

    try {
      const validatedRow = schema.parse(row);
      rows.push(validatedRow);
    } catch (e) {
      console.error(e);
      return [[], true];
    }
  }

  return [rows, false];
};

const sanitizeValue = (value: string) => {
  return value.replace(/^["']/g, '').replace(/["']$/g, '');
};

const sanitizeHeader = (header: string) => {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_/, '')
    .replace(/_$/, '');
};

type CsvCell = string | number | object | null;

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

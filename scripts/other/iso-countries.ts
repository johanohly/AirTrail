import * as fs from 'node:fs';

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

function lineToArray(text) {
  let p = '',
    row = [''],
    ret = [row],
    i = 0,
    r = 0,
    s = !0,
    l;
  for (l of text) {
    if ('"' === l) {
      if (s && l === p) row[i] += l;
      s = !s;
    } else if (',' === l && s) l = row[++i] = '';
    else if ('\n' === l && s) {
      if ('\r' === p) row[i] = row[i].slice(0, -1);
      row = ret[++r] = [(l = '')];
      i = 0;
    } else row[i] += l;
    p = l;
  }
  return ret;
}

const fileContent = fs.readFileSync('./Country Data Codes.csv', 'utf8');
const lines = lineToArray(fileContent);
// @ts-expect-error - clearly checking for length above
const headers = lines[0].map(sanitizeHeader);
const rows = [];
for (const line of lines.slice(1)) {
  const values = line.map(sanitizeValue);

  const rawRow = headers.reduce<Record<string, string>>((acc, header, i) => {
    acc[header] = values[i] ?? '';
    return acc;
  }, {});

  if (rawRow['iso_3166'] === '-') {
    continue;
  }
  const [alpha2, alpha3, numeric] = rawRow['iso_3166'].split('|');

  rows.push({
    name: rawRow['name'],
    alpha2,
    alpha3,
    numeric: +numeric,
  });
}

const dataJson = JSON.stringify(rows, null);
const ts = `export const COUNTRIES = ${dataJson};`;
fs.writeFileSync('../../src/lib/data/countries.ts', ts);

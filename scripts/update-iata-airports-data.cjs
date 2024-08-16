var fs = require('fs');

const IGNORED_FIELDS = [
  'elevation', 'url', 'city_code', 'city', 'state', 'county', 'type',
];

(async () => {
  const res = await fetch('https://raw.githubusercontent.com/lxndrblz/Airports/main/airports.csv');
  const data = await res.text();

  const airports = data
    .split('\n')
    .filter((row) => row.trim() !== '')
    .map((row) =>
      row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((cell) => sanitizeValue(cell.trim())),
    );
  const headers = airports.shift();

  const airportsData = airports.map(row => {
    const airport = {};
    row.forEach((cell_, i) => {
      if (IGNORED_FIELDS.includes(headers[i])) {
        return;
      }

      let cell = cell_ === '' ? null : cell_;
      if (!isNaN(+cell) && cell !== null) {
        cell = +cell;
      }
      airport[headers[i]] = cell;
    });
    return airport;
  });

  const airportsDataJson = JSON.stringify(airportsData, null);
  const airportsTs = `export const AIRPORTS = ${airportsDataJson};`;
  fs.writeFileSync('../src/lib/data/airports.ts', airportsTs);
})();

const sanitizeValue = (value) => {
  return value.replace(/^["']/g, '').replace(/["']$/g, '');
};
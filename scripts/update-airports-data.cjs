var fs = require('fs');

const IGNORED_FIELDS = ["GPS", "LOCAL", "type", "restriction", "alt", "gmt_offset", "region", "municipality", "activation", "service", "home"];

(async () => {
  const res = await fetch('https://raw.githubusercontent.com/komed3/airportmap-database/master/airport.csv');
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

      let cell = cell_ === '' || cell_ === 'NULL' ? null : cell_;
      if (!isNaN(+cell) && cell !== null) {
        cell = +cell;
      }
      airport[headers[i]] = cell;
    });
    return airport;
  }).filter(airport => airport.tier > 3 && airport.ICAO.length === 4);

  const airportsDataJson = JSON.stringify(airportsData, null);
  const airportsTs = `export const AIRPORTS = ${airportsDataJson};`;
  fs.writeFileSync('../src/lib/data/airports.ts', airportsTs);
})();

const sanitizeValue = (value) => {
  return value.replace(/^["']/g, '').replace(/["']$/g, '');
};
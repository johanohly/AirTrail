var fs = require('fs');

const IGNORED_FIELDS = [
  'LOCAL',
  'type',
  'restriction',
  'alt',
  'timezone',
  'region',
  'municipality',
  'activation',
  'service',
  'home',
];

(async () => {
  const res = await fetch(
    'https://raw.githubusercontent.com/komed3/airportmap-database/master/airport.csv',
  );
  const data = await res.text();

  const airports = data
    .split('\n')
    .filter((row) => row.trim() !== '')
    .map((row) =>
      row
        .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
        .map((cell) => sanitizeValue(cell.trim())),
    );
  const headers = airports.shift();

  const airportsData = airports
    .map((row) => {
      const airport = {};
      row.forEach((cell_, i) => {
        if (IGNORED_FIELDS.includes(headers[i])) {
          return;
        }
        const header = headers[i] === 'gmt_offset' ? 'tz' : headers[i];

        let cell = cell_ === '' || cell_ === 'NULL' ? null : cell_;
        if (!isNaN(+cell) && cell !== null) {
          cell = +cell;
        }

        if (i === 2 && airport['ICAO'].length !== 4 && cell?.length === 4) {
          airport['ICAO'] = cell;
        } else {
          airport[header] = cell;
        }
      });
      return airport;
    })
    .filter((airport) => airport.tier > 3 && airport.ICAO.length === 4);

  const airportsDataJson = JSON.stringify(airportsData, null);
  const airportsTs = `export const AIRPORTS = ${airportsDataJson};`;
  fs.writeFileSync('../../src/lib/data/airports.ts', airportsTs);
})();

const sanitizeValue = (value) => {
  return value.replace(/^["']/g, '').replace(/["']$/g, '');
};

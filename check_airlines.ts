import { AIRLINES as OLD_AIRLINES } from './old_airlines';
import { AIRLINES as NEW_AIRLINES } from './new_airlines';

const oldIcaoCodes = OLD_AIRLINES.map(airline => airline.icao);
const newIcaoCodes = NEW_AIRLINES.map(airline => airline.icao);

const missingIcaoCodes = oldIcaoCodes.filter(icao => !newIcaoCodes.includes(icao));

if (missingIcaoCodes.length > 0) {
  console.log('Missing ICAO codes:', missingIcaoCodes);
} else {
  console.log('No ICAO codes are missing.');
}
console.log(oldIcaoCodes.length);

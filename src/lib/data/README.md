## Airport Data

The list of airports used by AirTrail is a modified version of the [Airportmap](https://airportmap.de/airports) data
set (last fetched 2024-10-24).
The data has been parsed
using [this script](https://github.com/johanohly/AirTrail/blob/main/scripts/other/update-airports-data.cjs) which, along
with a few other things, filters out very small airports and airports without proper ICAO codes.

The data has been further modified over time, for example by adding missing airports or fixing errors in the original.

| List of changes             |
|-----------------------------|
| IATA `KIV` changed to `RMO` |

The data is stored in
the [src/lib/data/airports.ts](https://github.com/johanohly/AirTrail/blob/main/src/lib/data/airports.ts) file.

## Airline Data

The list of airlines used by AirTrail is a combination of various sources including
the [IATA airline codes](https://en.wikipedia.org/wiki/List_of_airline_codes) and
the [OpenFlights](https://github.com/jpatokal/openflights/tree/master/data) data set.
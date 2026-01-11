# AirTrail Data

Reference data for airlines and aircraft.
This is the default content in new AirTrail installations, and existing installations can sync their internal data via the `Settings -> Data -> [Airlines | Aircraft] -> Sync` feature.

## Contents

List of airlines in `airlines.json`, list of aircraft models in `aircraft.json` and airline icons in `icons/airlines/`.

## Schema

### airlines.json

```json
{
  "id": "american-airlines",
  "name": "American Airlines",
  "icao": "AAL",
  "iata": "AA",
  "defunct": false
}
```

| Field     | Type           | Required | Description                            |
| --------- | -------------- | -------- | -------------------------------------- |
| `id`      | string         | Yes      | URL-friendly slug (lowercase, hyphens) |
| `name`    | string         | Yes      | Display name                           |
| `icao`    | string         | Yes      | 3-letter ICAO code                     |
| `iata`    | string \| null | Yes      | 2-letter IATA code                     |
| `defunct` | boolean        | Yes      | `true` if airline no longer operates   |

### aircraft.json

```json
{
  "id": "boeing-737-800",
  "name": "Boeing 737-800",
  "icao": "B738"
}
```

| Field  | Type   | Required | Description          |
| ------ | ------ | -------- | -------------------- |
| `id`   | string | Yes      | URL-friendly slug    |
| `name` | string | Yes      | Display name         |
| `icao` | string | Yes      | ICAO type designator |

## Contributing Data

### Adding or updating entries

1. Edit the relevant JSON file
2. Run `bun run data:format` to sort and format
3. Submit a PR

### Adding airline icons

Place SVG files in `icons/airlines/` named by the airline's `id`:

```
icons/airlines/american-airlines.svg
```

Requirements:

- SVG format preferred (PNG/JPEG accepted)
- Square aspect ratio preferred
- Named exactly as the airline's `id` field

### Formatting

JSON files must be sorted alphabetically by `id`.

```bash
bun run data:format     # Format files
bun run data:check      # Check formatting
```

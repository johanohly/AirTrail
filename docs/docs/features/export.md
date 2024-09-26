---
sidebar_position: 3
---

# Export

The export feature allows you to export your flight data from AirTrail.

## Export flights

To export your flights, follow these steps:

1. Go to the AirTrail application.
2. Go to the settings page.
3. Click on the "Export" tab.
4. Choose your desired export format (CSV or JSON).

## Export formats

### CSV

The CSV export option allows you to export your flights as a CSV file, which can be opened in any spreadsheet
application like Microsoft Excel or Google Sheets. It is a simple and easy-to-use format that can be used to
analyze your flight data.

#### Format

The CSV file contains the following columns:

- `date`: The date of the flight (YYYY-MM-DD format).
- `from`: The IATA code of the departure airport.
- `to`: The IATA code of the arrival airport.
- `departure`: The departure time in ISO 8601 format (if available).
- `arrival`: The arrival time in ISO 8601 format (if available).
- `duration`: The duration of the flight in seconds.
- `flightNumber`: The flight number (if available).
- `flightReason`: The reason for the flight (if provided).
- `airline`: The airline operating the flight (if available).
- `aircraft`: The type of aircraft used (if available).
- `aircraftReg`: The registration number of the aircraft (if available).
- `note`: Any additional notes about the flight.
- `seat`: The type of seat (e.g., window, aisle, etc.).
- `seatNumber`: The seat number (if available).
- `seatClass`: The class of the seat (e.g., economy, business).

### JSON

:::tip
The JSON format can be reimported into AirTrail using the import feature.
:::

The JSON export option provides a more structured format that is ideal for developers or when integrating the data into
other systems. It contains nested objects for each flight and detailed data for each user and their seat information.

#### Format

The JSON file follows this structure:

```json
{
  "users": [
    {
      "id": "user_id",
      "displayName": "User Name",
      "username": "username"
    }
  ],
  "flights": [
    {
      "date": "YYYY-MM-DD",
      "from": "ICAO_CODE",
      "to": "ICAO_CODE",
      "departure": "ISO_8601_DATETIME",
      "arrival": "ISO_8601_DATETIME",
      "duration": flight_duration_in_seconds,
      "flightNumber": "FLIGHT_NUMBER",
      "flightReason": "FLIGHT_REASON",
      "airline": "ICAO_AIRLINE_CODE",
      "aircraft": "ICAO_AIRCRAFT_TYPE",
      "aircraftReg": "AIRCRAFT_REGISTRATION",
      "note": "FLIGHT_NOTE",
      "seats": [
        {
          "userId": "USER_ID",
          "guestName": "GUEST_NAME",
          "seat": "SEAT_TYPE",
          "seatNumber": "SEAT_NUMBER",
          "seatClass": "SEAT_CLASS"
        }
      ]
    }
  ]
}
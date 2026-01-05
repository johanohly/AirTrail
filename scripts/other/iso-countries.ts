import { writeFileSync } from 'fs';

interface RawCountry {
    name: string;
    'alpha-2': string;
    'alpha-3': string;
    'country-code': string;
    region: string;
    "intermediate-region": string
}

interface Country {
    name: string;
    alpha2: string;
    alpha3: string;
    numeric: number;
    continent: string;
}

function mapContinentFromRawCountry(country: RawCountry): string {
    if (country.region !== "Americas") return country.region;
    return country['intermediate-region'] === "South America" ? "South America" : "North America"
}

async function main() {
    const url = "https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.json";

    // Download the json
    let res: Response | undefined;
    try {
        res = await fetch(url);
    } catch (error) {
        throw new Error(`Failed to fetch countries from GitHub: ${error instanceof Error ? error.message : 'Network error'}`);
    }

    if (!res.ok) {
        throw new Error(`Failed to fetch countries from GitHub: HTTP ${res.status} ${res.statusText}`);
    }

    let json: RawCountry[];
    try {
        json = await res.json();
    } catch (error) {
        throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
    }

    // Transform the data
    const countries: Country[] = json.map(country => ({
        name: country.name,
        alpha2: country['alpha-2'],
        alpha3: country['alpha-3'],
        numeric: parseInt(country['country-code'], 10),
        continent: mapContinentFromRawCountry(country)
    }));

    // Generate the TypeScript file content
    const fileContent = `// Auto-generated from ISO-3166-Countries-with-Regional-Codes
// Source: https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes

export interface Country {
    name: string;
    alpha2: string;
    alpha3: string;
    numeric: number;
    continent: string;
}

export const COUNTRIES: Country[] = ${JSON.stringify(countries, null, 2)};
`;

    // Write to file
    const outputPath = '../../src/lib/data/countries.ts';
    writeFileSync(outputPath, fileContent, 'utf-8');

    console.log(`✓ Generated countries.ts with ${countries.length} countries`);
}

main().catch((error) => {
    console.error('Error generating countries file:', error.message);
    process.exit(1);
});

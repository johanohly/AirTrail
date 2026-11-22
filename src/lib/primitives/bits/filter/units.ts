import type { DurationUnit, ParsedNumberInput } from "./types.js";

const MS_DIVISORS: Record<DurationUnit, number> = {
	ms: 1,
	milliseconds: 1,
	seconds: 1_000,
	minutes: 60_000,
	hours: 3_600_000,
	days: 86_400_000,
};

const DURATION_UNITS: Record<string, DurationUnit> = {
	ms: "ms",
	millisecond: "milliseconds",
	milliseconds: "milliseconds",
	s: "seconds",
	sec: "seconds",
	secs: "seconds",
	second: "seconds",
	seconds: "seconds",
	m: "minutes",
	min: "minutes",
	mins: "minutes",
	minute: "minutes",
	minutes: "minutes",
	h: "hours",
	hr: "hours",
	hrs: "hours",
	hour: "hours",
	hours: "hours",
	d: "days",
	day: "days",
	days: "days",
};

function parseSingleValue(
	input: string,
	baseUnit: DurationUnit
): { value: number; hasDurationUnit: boolean } | null {
	const trimmed = input.trim();
	if (!trimmed) return null;

	const durationMatch = trimmed.match(/^(-?(?:\d+\.?\d*|\.\d+))\s*([a-zA-Z]+)$/);
	if (durationMatch) {
		const value = Number.parseFloat(durationMatch[1]!);
		const unit = DURATION_UNITS[durationMatch[2]!.toLowerCase()];
		if (!Number.isNaN(value) && unit) {
			const convertedValue = (value * MS_DIVISORS[unit]) / MS_DIVISORS[baseUnit];
			return { value: convertedValue, hasDurationUnit: true };
		}
	}

	const plainNumber = Number.parseFloat(trimmed);
	if (!Number.isNaN(plainNumber)) {
		return { value: plainNumber, hasDurationUnit: false };
	}

	return null;
}

export function parseNumberInput(
	input: string,
	baseUnit: DurationUnit = "ms"
): ParsedNumberInput | null {
	const trimmed = input.trim();
	if (!trimmed) return null;

	const rangePatterns = [/^(.+?)\.\.(.+)$/, /^(.+?)\s+to\s+(.+)$/i, /^([^-]+)-(.+)$/];

	for (const pattern of rangePatterns) {
		const match = trimmed.match(pattern);
		if (!match) continue;

		const minStr = match[1];
		const maxStr = match[2];
		if (!minStr || !maxStr) continue;

		const minResult = parseSingleValue(minStr, baseUnit);
		const maxResult = parseSingleValue(maxStr, baseUnit);
		if (!minResult || !maxResult) continue;

		const [min, max] =
			minResult.value <= maxResult.value
				? [minResult.value, maxResult.value]
				: [maxResult.value, minResult.value];

		return {
			value: min,
			hasDurationUnit: minResult.hasDurationUnit || maxResult.hasDurationUnit,
			isRange: true,
			rangeValues: [min, max],
		};
	}

	const singleResult = parseSingleValue(trimmed, baseUnit);
	if (!singleResult) return null;

	return {
		value: singleResult.value,
		hasDurationUnit: singleResult.hasDurationUnit,
		isRange: false,
	};
}

export function formatNumberWithUnit(value: number, unit: DurationUnit): string {
	const unitLabels: Record<DurationUnit, string> = {
		ms: "ms",
		milliseconds: "ms",
		seconds: "s",
		minutes: "min",
		hours: "hr",
		days: "d",
	};
	const roundedValue = Math.round(value * 1000) / 1000;
	return `${roundedValue}${unitLabels[unit]}`;
}

export function convertDuration(value: number, fromUnit: DurationUnit, toUnit: DurationUnit): number {
	const msValue = value * MS_DIVISORS[fromUnit];
	return msValue / MS_DIVISORS[toUnit];
}

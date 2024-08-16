import { isLargeScreen } from '$lib/utils/size';
import { get } from 'svelte/store';

export const calculateZoomLevel = (
	data: ({ from: number[]; to: number[] } | null)[],
): {
	center: [number, number];
	zoom: number;
} => {
	const latitudes = data.map((d) => d.from[0]).concat(data.map((d) => d.to[0]));
	const longitudes = data
		.map((d) => d.from[1])
		.concat(data.map((d) => d.to[1]));

	const minLat = Math.min(...latitudes);
	const maxLat = Math.max(...latitudes);
	const minLng = Math.min(...longitudes);
	const maxLng = Math.max(...longitudes);

	const centerLat = (minLat + maxLat) / 2;
	const centerLng = (minLng + maxLng) / 2;

	const latRange = maxLat - minLat;
	const lngRange = maxLng - minLng;
	const maxRange = Math.max(latRange, lngRange);
	let zoom = Math.log2(360 / maxRange) + 1;
	if (!get(isLargeScreen)) {
		zoom -= 1;
	}

	return {
		center: [centerLat, centerLng],
		zoom,
	};
};

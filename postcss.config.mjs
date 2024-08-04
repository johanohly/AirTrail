import autoprefixer from 'autoprefixer';
import tailwind from 'tailwindcss';

/** @type {import('postcss-load-config').Config} */
const config = {
	plugins: [tailwind, autoprefixer],
};

export default config;

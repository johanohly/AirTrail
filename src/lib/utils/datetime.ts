export const isUsingAmPm = () => {
	return new Date().toLocaleTimeString().match(/am|pm/i) !== null;
}
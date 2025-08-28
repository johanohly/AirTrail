export const toTitleCase = (str: string) => {
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase();
  });
};

export const snakeToTitleCase = (str: string) => {
  return toTitleCase(str.replace(/_/g, ' '));
};

export const pluralize = (count: number, singular: string, plural?: string) => {
  return count === 1 ? singular : (plural ?? `${singular}s`);
};

export const quantify = (count: number, singular: string, plural?: string) => {
  return `${count} ${pluralize(count, singular, plural)}`;
};

export const leq = (a: string, b: string) => {
  return a.toLowerCase() === b.toLowerCase();
};

export const generateRandomString = (length: number = 12): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

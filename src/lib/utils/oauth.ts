export const isOAuthCallback = (location: Location) => {
  const search = location.search;
  return search.includes('code=') || search.includes('error=');
};

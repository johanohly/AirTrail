export const isOAuthCallback = (searchParams: string) => {
  return searchParams.includes('code=') || searchParams.includes('error=');
};

export const isPathname = (pathname: string) => {
  return (url: URL) => url.pathname === pathname;
};

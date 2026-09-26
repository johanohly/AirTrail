/*
 * Login and setup are full-screen flows: no navigation chrome. Declared here
 * rather than as a path list in the root layout, so a new full-screen route is
 * a new file instead of another clause in a growing condition.
 */
export const load = () => ({ chrome: false });

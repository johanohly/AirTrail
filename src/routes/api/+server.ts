/*
 * Discovery is mirrored at the API root so a client that only knows the origin
 * can find it. Same document as /api/v1.
 */
export { GET } from '../api/v1/+server';

import { lucia } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';

export const GET = async ({ locals }) => {
	if (locals.session) await lucia.invalidateSession(locals.session.id);
	redirect(302, '/');
};

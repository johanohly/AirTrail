import { OAuth2RequestError } from 'arctic';
import { generateId } from 'lucia';
import { twitch, lucia } from '$lib/server/auth';
import { db } from '$lib/db';
import { CLIENT_ID } from '$env/static/private';

export const GET = async (event) => {
	const code = event.url.searchParams.get('code');
	const state = event.url.searchParams.get('state');
	const storedState = event.cookies.get('oauth_state') ?? null;

	if (!code || !state || !storedState || state !== storedState) {
		return new Response(null, {
			status: 400,
		});
	}

	try {
		const tokens = await twitch.validateAuthorizationCode(code);
		const twitchUser = await fetch('https://api.twitch.tv/helix/users', {
			headers: {
				Authorization: `Bearer ${tokens.accessToken}`,
				'Client-ID': CLIENT_ID,
			},
		})
			.then((r) => r.json() as Promise<TwitchUser>)
			.then((u) => u.data[0]);

		// Replace this with your own DB client.
		const existingUser = await db
			.selectFrom('User')
			.select('id')
			.where('twitch_id', '=', twitchUser.id)
			.executeTakeFirst();

		if (existingUser) {
			const session = await lucia.createSession(existingUser.id, {});
			const sessionCookie = lucia.createSessionCookie(session.id);
			event.cookies.set(sessionCookie.name, sessionCookie.value, {
				path: '.',
				...sessionCookie.attributes,
			});
		} else {
			const userId = generateId(15);

			// Replace this with your own DB client.
			await db
				.insertInto('User')
				.values({
					id: userId,
					twitch_id: twitchUser.id,
					username: twitchUser.display_name,
				})
				.execute();

			const session = await lucia.createSession(userId, {});
			const sessionCookie = lucia.createSessionCookie(session.id);
			event.cookies.set(sessionCookie.name, sessionCookie.value, {
				path: '.',
				...sessionCookie.attributes,
			});
		}
		return new Response(null, {
			status: 302,
			headers: {
				Location: '/',
			},
		});
	} catch (e) {
		// the specific error message depends on the provider
		if (e instanceof OAuth2RequestError) {
			// invalid code
			return new Response(null, {
				status: 400,
			});
		}
		return new Response(null, {
			status: 500,
		});
	}
};

interface TwitchUser {
	data: [
		{
			id: string;
			login: string;
			display_name: string;
			type: 'admin' | 'global_mod' | 'staff' | '';
			broadcaster_type: 'partner' | 'affiliate' | '';
			description: string;
			profile_image_url: string;
			offline_image_url: string;
			created_at: string;
		},
	];
}

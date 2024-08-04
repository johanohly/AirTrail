declare global {
	namespace App {
		// interface Platform {}
		interface Locals {
			user: import('lucia').User | null;
			session: import('lucia').Session | null;
		}
		// interface Error {}
		// interface Session {}
		// interface Stuff {}
	}
}

export {};

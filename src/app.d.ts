declare global {
  namespace App {
    interface Locals {
      user: import('lucia').User | null;
      session: import('lucia').Session | null;
    }

    interface PageData {
      user: import('$lib/db/types').PageUser | null;
      users: import('$lib/db/types').PublicUser[];
    }

    namespace Superforms {
      type Message = { type: 'success' | 'error'; text: string; id?: number };
    }
  }
}

export {};

/// <reference types="vite-plugin-pwa/client" />

declare global {
  namespace App {
    interface Locals {
      user: import('lucia').User | null;
      session: import('lucia').Session | null;
      authorization:
        import('$lib/server/authorization/context').AuthorizationContext | null;
    }

    interface PageData {
      user: import('$lib/db/types').PageUser | null;
      users: import('$lib/db/types').DirectoryUser[];
      authorization:
        import('$lib/server/authorization/context').ClientAuthorization | null;
    }

    namespace Superforms {
      type Message = { type: 'success' | 'error'; text: string; id?: number };
    }
  }
}

export {};

import type { AppConfig } from '$lib/db/types';

declare global {
  namespace App {
    interface Locals {
      user: import('lucia').User | null;
      session: import('lucia').Session | null;
      appConfig: AppConfig | null;
    }
    interface PageData {
      user: import('lucia').User | null;
    }

    namespace Superforms {
      type Message = { type: 'success' | 'error'; text: string };
    }
  }
}

export {};

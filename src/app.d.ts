declare global {
  namespace App {
    interface Locals {
      user: import('lucia').User | null;
      session: import('lucia').Session | null;
    }

    interface PageData {
      user: import('lucia').User | null;
      users: Omit<import('lucia').User, 'password'>[];
    }

    namespace Superforms {
      type Message = { type: 'success' | 'error'; text: string; id?: number };
    }
  }
}

export {};

import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'bun ./prisma/seed',
  },
  datasource: {
    url: env('DB_URL'),
  },
});

import { db } from '$lib/db';
import { z } from 'zod';
import { appConfigSchema, clientAppConfigSchema } from '$lib/zod/config';
import { deepMerge, removeUndefined } from '$lib/utils/other';

export type FullAppConfig = z.infer<typeof appConfigSchema>;
export type ClientAppConfig = z.infer<typeof clientAppConfigSchema>;

export class AppConfig {
  #appConfig: FullAppConfig | null = null;

  async get({ withCache = true } = {}) {
    if (this.#appConfig && withCache) {
      return this.#appConfig;
    }

    this.#appConfig = await this.load();
    return this.#appConfig;
  }

  async getClientConfig() {
    const config = await this.get();
    if (!config) {
      return null;
    }

    return clientAppConfigSchema.parse(config);
  }

  async set(config: Partial<FullAppConfig>) {
    const currentConfig = await this.get();
    if (!currentConfig) {
      return false;
    }

    // Remove undefined values from the new config, as only unchanged values are undefined
    const merged = deepMerge(currentConfig, removeUndefined(config));
    const newConfig = appConfigSchema.parse(merged);

    const result = await db
      .updateTable('appConfig')
      .set('config', newConfig)
      .execute();
    if (!result) {
      return false;
    }

    this.#appConfig = newConfig;
    return true;
  }

  async load() {
    const result = await db
      .selectFrom('appConfig')
      .select('config')
      .executeTakeFirst();
    if (!result || !result.config) {
      return null;
    }

    return appConfigSchema.parse(result.config);
  }
}

export const appConfig = new AppConfig();

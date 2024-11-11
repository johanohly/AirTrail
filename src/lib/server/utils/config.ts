import { db } from '$lib/db';
import { z } from 'zod';
import { appConfigSchema, clientAppConfigSchema } from '$lib/zod/config';
import { deepMerge, removeUndefined } from '$lib/utils/other';
import { env } from '$env/dynamic/private';
import { type DeepBoolean, deepSetAllValues } from '$lib/utils';

export type FullAppConfig = z.infer<typeof appConfigSchema>;
export type ClientAppConfig = z.infer<typeof clientAppConfigSchema>;
type ConfigPath<T> = T extends object
  ? { [K in keyof T]: [K, ...ConfigPath<T[K]>] }[keyof T]
  : [];
type AppConfigPath = ConfigPath<FullAppConfig>;

export class AppConfig {
  #appConfig: FullAppConfig | null = null;
  envConfigured: DeepBoolean<FullAppConfig, boolean> | null = null;

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

  #extractAllKeys(
    schema: z.ZodObject<any>,
    parentPath: string[] = [],
  ): string[][] {
    const paths: string[][] = [];

    for (const [key, value] of Object.entries(schema.shape)) {
      const snakeKey = key.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
      const fullPath = [...parentPath, snakeKey];

      if (value instanceof z.ZodObject) {
        paths.push(...this.#extractAllKeys(value, fullPath));
      } else {
        paths.push(fullPath);
      }
    }

    return paths;
  }

  #parseEnvValue(value: string) {
    value = value.trim().toLowerCase();
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;

    const numberValue = Number(value);
    if (!isNaN(numberValue)) return numberValue;

    return value;
  }

  async loadFromEnv() {
    const configPaths = this.#extractAllKeys(appConfigSchema);
    const envEntries = Object.entries(env).reduce<
      Record<string, string | undefined>
    >((acc, [key, value]) => {
      acc[key.toLowerCase()] = value ? this.#parseEnvValue(value) : true;
      return acc;
    }, {});

    function setNestedValue(
      obj: Record<string, any>,
      keys: string[],
      value: any,
    ) {
      let current = obj;
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!current[key]) current[key] = {};
        current = current[key];
      }
      current[keys[keys.length - 1]] = value;
    }

    const envConfig: Record<string, any> = {};

    for (const path of configPaths) {
      const keyPathString = path.join('_').toLowerCase();
      if (keyPathString in envEntries) {
        const camelPath = path.map((key) => {
          return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        });
        setNestedValue(envConfig, camelPath, envEntries[keyPathString]);
      }
    }

    const currentConfig = await this.get();
    const merged = deepMerge(currentConfig, envConfig);
    const validConfig = appConfigSchema.safeParse(merged);
    if (!validConfig.success) {
      console.error('Invalid app config in .env:', validConfig.error.issues);
      process.exit(-1);
    }

    await db.updateTable('appConfig').set('config', validConfig.data).execute();
    this.#appConfig = validConfig.data;

    const allFields = deepSetAllValues(this.#appConfig, false);
    const envConfiguredFields = deepSetAllValues(envConfig, true);
    this.envConfigured = deepMerge(allFields, envConfiguredFields);

    console.log('Loaded config from .env');
  }

  isEnvConfigured<Path extends AppConfigPath>(configPath: Path): boolean {
    if (!this.envConfigured) {
      return false;
    }

    let current: any = this.envConfigured;

    for (const key of configPath) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return false;
      }
    }

    return current === true;
  }
}

export const appConfig = new AppConfig();

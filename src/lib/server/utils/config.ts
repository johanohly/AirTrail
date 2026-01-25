import { z } from 'zod';

import { env } from '$env/dynamic/private';
import { db } from '$lib/db';
import { type DeepBoolean, deepSetAllValues } from '$lib/utils';
import { deepMerge, removeUndefined, mapSetValues } from '$lib/utils/other';
import { appConfigSchema, clientAppConfigSchema } from '$lib/zod/config';

export type FullAppConfig = z.infer<typeof appConfigSchema>;
export type ClientAppConfig = z.infer<typeof clientAppConfigSchema>;
type ConfigPath<T> = T extends object
  ? { [K in keyof T]: [K, ...ConfigPath<T[K]>] }[keyof T]
  : [];
type AppConfigPath = ConfigPath<FullAppConfig>;

export class AppConfig {
  #appConfig: FullAppConfig | null = null;

  // Whether a field has a value set. Useful in the frontend to know if a value is set even if the value itself is server-only.
  configured: DeepBoolean<FullAppConfig, boolean> | null = null;
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
    this.configured = mapSetValues(this.#appConfig);
    return true;
  }

  async load() {
    const result = await db
      .selectFrom('appConfig')
      .select('config')
      .executeTakeFirst();

    if (!result?.config) {
      return null;
    }

    let parsed = appConfigSchema.safeParse(result.config);

    if (!parsed.success) {
      // Config is missing some fields - merge with defaults
      const defaultConfig: FullAppConfig = {
        oauth: {
          enabled: false,
          issuerUrl: null,
          clientId: null,
          clientSecret: null,
          scope: null,
          autoRegister: true,
          autoLogin: false,
          hidePasswordForm: false,
          buttonText: 'Log in with SSO',
        },
        integrations: {
          aeroDataBoxKey: null,
        },
        data: {
          lastSynced: null,
        },
      };

      // Merge: defaults first, then overlay existing values
      const rawConfig = result.config as Record<string, any>;
      const merged = deepMerge(defaultConfig, removeUndefined(rawConfig));

      parsed = appConfigSchema.safeParse(merged);
      if (!parsed.success) {
        console.error('Invalid app config in database:', parsed.error.issues);
        process.exit(-1);
      }

      // Write the complete merged config back to DB
      await db.updateTable('appConfig').set('config', parsed.data).execute();
    }

    return parsed.data;
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
    const lowerValue = value.trim().toLowerCase();
    if (lowerValue === 'true') return true;
    if (lowerValue === 'false') return false;
    if (lowerValue === 'null') return null;

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

    this.configured = mapSetValues(this.#appConfig);

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

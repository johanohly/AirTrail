/* eslint-disable @typescript-eslint/no-empty-object-type */
import { LRUCache } from 'lru-cache';
import { browser } from '$app/environment';

interface CacheItem {
  key: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
}

class PersistentLRUCache<K extends string, V extends {}> {
  private cache: LRUCache<K, V, {}>;
  private storageKey: string;

  constructor(options: LRUCache.Options<K, V, {}>, storageKey: string) {
    this.cache = new LRUCache(options);
    this.storageKey = `cache-${storageKey}`;
    if (browser) {
      this.loadFromStorage();
      window.addEventListener('beforeunload', () => this.saveToStorage());
    }
  }

  get(key: K): V | undefined {
    return this.cache.get(key);
  }

  set(key: K, value: V): void {
    this.cache.set(key, value);
  }

  private loadFromStorage(): void {
    const storedData = localStorage.getItem(this.storageKey);
    if (storedData) {
      const parsedData: CacheItem[] = JSON.parse(storedData);
      parsedData.forEach((item) =>
        this.cache.set(item.key as K, item.value.value as V),
      );
    }
  }

  saveToStorage(): void {
    const cacheData: CacheItem[] = Array.from(this.cache.dump()).map(
      ([key, value]) => ({
        key: key as unknown as string,
        value,
      }),
    );
    localStorage.setItem(this.storageKey, JSON.stringify(cacheData));
  }
}

export { PersistentLRUCache };

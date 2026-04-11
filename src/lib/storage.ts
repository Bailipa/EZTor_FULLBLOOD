const STORAGE_VERSION = '1.0.0';

interface StorageData<T> {
  version: string;
  data: T;
  timestamp: number;
}

type MigrationFn<T> = (oldData: unknown, oldVersion: string) => T;

interface MigrationMap<T> {
  [version: string]: MigrationFn<T>;
}

export function saveToStorage<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  
  try {
    const storageData: StorageData<T> = {
      version: STORAGE_VERSION,
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(storageData));
  } catch (error) {
    console.error(`Failed to save ${key} to localStorage:`, error);
  }
}

export function loadFromStorage<T>(key: string, defaultValue: T, migrations?: MigrationMap<T>): T {
  if (typeof window === 'undefined') return defaultValue;
  
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;

    const parsedUnknown = JSON.parse(raw) as unknown;
    // 旧版可能直接存 JSON 布尔值，例如 true（无 version/data 包装）
    if (typeof parsedUnknown === "boolean") {
      saveToStorage(key, parsedUnknown as T);
      return parsedUnknown as T;
    }
    const parsed = parsedUnknown as StorageData<unknown>;

    if (!parsed.version || !parsed.data) {
      console.warn(`Storage ${key} has invalid format, using default`);
      return defaultValue;
    }

    if (parsed.version === STORAGE_VERSION) {
      return parsed.data as T;
    }

    if (migrations && migrations[parsed.version]) {
      try {
        const migratedData = migrations[parsed.version](parsed.data, parsed.version);
        saveToStorage(key, migratedData);
        return migratedData;
      } catch (migrationError) {
        console.error(`Migration failed for ${key}:`, migrationError);
        return defaultValue;
      }
    }

    console.warn(`Storage ${key} version ${parsed.version} mismatch, expected ${STORAGE_VERSION}`);
    return defaultValue;
  } catch (error) {
    console.error(`Failed to load ${key} from localStorage:`, error);
    return defaultValue;
  }
}

export function removeFromStorage(key: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to remove ${key} from localStorage:`, error);
  }
}

export function clearAllStorage(): void {
  if (typeof window === 'undefined') return;
  
  try {
    const keysToPreserve = ['theme', 'vocab_showDanmaku'];
    
    const preserved: Record<string, string | null> = {};
    keysToPreserve.forEach(key => {
      preserved[key] = localStorage.getItem(key);
    });
    
    localStorage.clear();
    
    Object.entries(preserved).forEach(([key, value]) => {
      if (value !== null) {
        localStorage.setItem(key, value);
      }
    });
  } catch (error) {
    console.error('Failed to clear localStorage:', error);
  }
}

export function getStorageInfo(): { key: string; size: number; age: number }[] {
  if (typeof window === 'undefined') return [];
  
  const info: { key: string; size: number; age: number }[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          info.push({
            key,
            size: new Blob([raw]).size,
            age: parsed.timestamp ? Date.now() - parsed.timestamp : 0,
          });
        } catch {
          info.push({
            key,
            size: new Blob([raw]).size,
            age: 0,
          });
        }
      }
    }
  }
  
  return info;
}

export { STORAGE_VERSION };

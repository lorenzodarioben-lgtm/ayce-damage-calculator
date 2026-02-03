export interface StorageDurability {
  readonly supported: boolean;
  readonly persisted: boolean | null;
  readonly usage: number | null;
  readonly quota: number | null;
}

export interface StorageManagerLike {
  readonly persisted?: () => Promise<boolean>;
  readonly persist?: () => Promise<boolean>;
  readonly estimate?: () => Promise<StorageEstimate>;
}

export interface StorageEstimate {
  readonly usage?: number;
  readonly quota?: number;
}

export type PersistRequestResult = 'granted' | 'declined' | 'unsupported' | 'unavailable';

const EMPTY_DURABILITY: StorageDurability = {
  supported: false,
  persisted: null,
  usage: null,
  quota: null,
};

function finiteBytes(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Reads browser-provided storage hints without making persistence promises of its own. */
export async function inspectStorageDurability(
  storage: StorageManagerLike | undefined,
): Promise<StorageDurability> {
  if (!storage) {
    return EMPTY_DURABILITY;
  }

  const [persisted, estimate] = await Promise.all([
    storage.persisted ? storage.persisted().catch(() => null) : Promise.resolve(null),
    storage.estimate ? storage.estimate().catch(() => null) : Promise.resolve(null),
  ]);

  return {
    supported: true,
    persisted: typeof persisted === 'boolean' ? persisted : null,
    usage: finiteBytes(estimate?.usage),
    quota: finiteBytes(estimate?.quota),
  };
}

/** Requests persistence only after a diner deliberately asks for it. */
export async function requestStoragePersistence(
  storage: StorageManagerLike | undefined,
): Promise<PersistRequestResult> {
  if (!storage?.persist) {
    return storage ? 'unavailable' : 'unsupported';
  }
  try {
    return (await storage.persist()) ? 'granted' : 'declined';
  } catch {
    return 'unavailable';
  }
}

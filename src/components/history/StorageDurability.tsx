'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  inspectStorageDurability,
  requestStoragePersistence,
  type PersistRequestResult,
  type StorageDurability as StorageDurabilityState,
  type StorageManagerLike,
} from '@/lib/storageDurability';

type Status = 'loading' | 'ready' | 'unavailable';

function storageManager(): StorageManagerLike | undefined {
  if (typeof navigator === 'undefined') {
    return undefined;
  }
  return navigator.storage as StorageManagerLike | undefined;
}

function formatBytes(value: number): string {
  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(value >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

function persistenceMessage(result: PersistRequestResult): string {
  switch (result) {
    case 'granted':
      return 'This browser has marked this site’s local data for persistent storage.';
    case 'declined':
      return 'This browser did not grant persistent storage. Your calculator still works normally.';
    case 'unsupported':
      return 'This browser does not offer a persistent-storage request.';
    default:
      return 'This browser could not complete the persistent-storage request.';
  }
}

/** A small, optional safeguard beside export—not a settings dashboard. */
export function StorageDurability() {
  const [status, setStatus] = useState<Status>('loading');
  const [durability, setDurability] = useState<StorageDurabilityState | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await inspectStorageDurability(storageManager());
    setDurability(next);
    setStatus(next.supported ? 'ready' : 'unavailable');
  }, []);

  useEffect(() => {
    let active = true;
    void inspectStorageDurability(storageManager()).then((next) => {
      if (!active) {
        return;
      }
      setDurability(next);
      setStatus(next.supported ? 'ready' : 'unavailable');
    });
    return () => {
      active = false;
    };
  }, []);

  const protectData = useCallback(async () => {
    setRequesting(true);
    const result = await requestStoragePersistence(storageManager());
    setMessage(persistenceMessage(result));
    await refresh();
    setRequesting(false);
  }, [refresh]);

  const canRequest = status === 'ready' && durability?.persisted !== true;

  return (
    <section aria-labelledby="storage-durability-heading" className="panel p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-ash-800 text-ember-400">
          <ShieldCheck size={18} aria-hidden="true" />
        </div>
        <div>
          <h2 id="storage-durability-heading" className="micro-label mb-1">
            Local data protection
          </h2>
          <p className="max-w-[58ch] text-sm leading-relaxed text-cream-300">
            Your meal data remains on this device. Browser storage controls can reduce eviction
            risk, but a backup is still the durable copy you can move elsewhere.
          </p>
        </div>
      </div>

      {status === 'loading' && (
        <p role="status" className="mt-4 text-sm text-cream-500">
          Checking this browser’s storage controls…
        </p>
      )}

      {status === 'unavailable' && (
        <p className="mt-4 text-sm leading-relaxed text-cream-500">
          This browser does not expose storage durability details here. The calculator remains
          local-first; download a backup when the records matter.
        </p>
      )}

      {status === 'ready' && durability && (
        <div className="mt-4 space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-cream-500">Persistent storage</dt>
              <dd className="mt-0.5 font-semibold text-cream-100">
                {durability.persisted === true
                  ? 'Already protected'
                  : durability.persisted === false
                    ? 'Not protected yet'
                    : 'Status unavailable'}
              </dd>
            </div>
            <div>
              <dt className="text-cream-500">Approx. used</dt>
              <dd className="mt-0.5 font-semibold text-cream-100">
                {durability.usage === null ? 'Unavailable' : formatBytes(durability.usage)}
              </dd>
            </div>
            <div>
              <dt className="text-cream-500">Approx. available</dt>
              <dd className="mt-0.5 font-semibold text-cream-100">
                {durability.quota === null
                  ? 'Unavailable'
                  : formatBytes(Math.max(0, durability.quota - (durability.usage ?? 0)))}
              </dd>
            </div>
          </dl>

          {canRequest && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void protectData()}
              disabled={requesting}
            >
              <ShieldCheck size={15} aria-hidden="true" />
              {requesting ? 'Protecting local data…' : 'Protect local data'}
            </Button>
          )}
        </div>
      )}

      {message && (
        <p role="status" className="mt-3 max-w-[60ch] text-sm leading-relaxed text-sesame-400">
          {message}
        </p>
      )}
    </section>
  );
}

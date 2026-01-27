import { db } from './index';
import { syncPush } from '../sync';

let debounceTimeout: NodeJS.Timeout | null = null;

function triggerSync() {
    if (debounceTimeout) {
        clearTimeout(debounceTimeout);
    }

    // Debounce sync for 2 seconds to batch updates
    debounceTimeout = setTimeout(() => {
        console.log('[Sync] Triggering auto-sync...');
        syncPush();
    }, 2000);
}

export function setupSyncHooks() {
    db.tables.forEach(table => {
        table.hook('creating', (primKey, obj, transaction) => {
            // Trigger sync after transaction commits
            transaction.on('complete', triggerSync);
        });

        table.hook('updating', (mods, primKey, obj, transaction) => {
            transaction.on('complete', triggerSync);
        });

        table.hook('deleting', (primKey, obj, transaction) => {
            transaction.on('complete', triggerSync);
        });
    });

    console.log('[Sync] Hooks registered.');
}

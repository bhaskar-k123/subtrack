import { db } from './db';
import type { Transaction, Account, Category, Merchant, Subscription, Setting } from '@/types/database';

const API_BASE = 'http://localhost:8000/api';

/**
 * Pull data from Backend (SQLite) to Frontend (IndexedDB)
 * Should be called on app startup.
 */
export async function syncPull(): Promise<void> {
    try {
        const response = await fetch(`${API_BASE}/sync/pull`);
        if (!response.ok) throw new Error('Failed to fetch sync data');

        const data = await response.json();

        // Check for pending local deletions
        const deletedLogs = await db.deletedLog.toArray();
        const deletedTransactionIds = new Set(
            deletedLogs
                .filter(log => log.type === 'transaction')
                .map(log => log.id)
        );

        // Restore Transactions
        if (data.transactions && data.transactions.length > 0) {
            const transactions = data.transactions
                .filter((t: any) => !deletedTransactionIds.has(t.id)) // Filter out locally deleted items
                .map((t: any) => ({
                    ...t,
                    date: new Date(t.date),
                    createdAt: new Date(t.createdAt),
                    updatedAt: new Date(t.updatedAt),
                }));
            await db.transactions.bulkPut(transactions);
        }

        // Restore Accounts
        if (data.accounts && data.accounts.length > 0) {
            const accounts = data.accounts.map((a: any) => ({
                ...a,
                lastProcessedDate: a.lastProcessedDate ? new Date(a.lastProcessedDate) : null,
                createdAt: new Date(a.createdAt),
                updatedAt: new Date(a.updatedAt),
            }));
            await db.accounts.bulkPut(accounts);
        }

        // Restore Categories
        if (data.categories && data.categories.length > 0) {
            const categories = data.categories.map((c: any) => ({
                ...c,
                createdAt: new Date(c.createdAt),
                updatedAt: new Date(c.updatedAt),
            }));
            await db.categories.bulkPut(categories);
        }

        // Restore Merchants
        if (data.merchants && data.merchants.length > 0) {
            const merchants = data.merchants.map((m: any) => ({
                ...m,
                createdAt: new Date(m.createdAt),
                updatedAt: new Date(m.updatedAt),
            }));
            await db.merchants.bulkPut(merchants);
        }

        // Restore Subscriptions
        if (data.subscriptions && data.subscriptions.length > 0) {
            const subscriptions = data.subscriptions.map((s: any) => ({
                ...s,
                firstChargeDate: s.firstChargeDate ? new Date(s.firstChargeDate) : new Date(), // Fallback
                lastChargeDate: s.lastChargeDate ? new Date(s.lastChargeDate) : new Date(), // Fallback
                nextExpectedDate: s.nextExpectedDate ? new Date(s.nextExpectedDate) : null,
                createdAt: new Date(s.createdAt),
                updatedAt: new Date(s.updatedAt),
            }));
            await db.subscriptions.bulkPut(subscriptions);
        }

        // Restore Settings
        if (data.settings && data.settings.length > 0) {
            const settings = data.settings.map((s: any) => ({
                ...s,
                updatedAt: new Date(s.updatedAt),
            }));
            await db.settings.bulkPut(settings);
        }

        console.log('[Sync] Pull completed successfully.');
    } catch (err) {
        console.error('[Sync] Pull failed:', err);
        // Don't throw, just log. App can work offline/locally.
    }
}

/**
 * Push data from Frontend (IndexedDB) to Backend (SQLite)
 * Should be called after significant mutations.
 */
export async function syncPush(): Promise<void> {
    try {
        const [
            transactions,
            accounts,
            categories,
            merchants,
            subscriptions,
            settings,
            deletedLogs
        ] = await Promise.all([
            db.transactions.toArray(),
            db.accounts.toArray(),
            db.categories.toArray(),
            db.merchants.toArray(),
            db.subscriptions.toArray(),
            db.settings.toArray(),
            db.deletedLog.toArray(),
        ]);

        // Filter deleted IDs for transactions (can be extended)
        const deletedTransactionIds = deletedLogs
            .filter(log => log.type === 'transaction')
            .map(log => log.id);

        const payload = {
            transactions,
            accounts,
            categories,
            merchants,
            subscriptions,
            settings,
            deletedTransactionIds
        };

        const response = await fetch(`${API_BASE}/sync/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Failed to push sync data');

        // On success, clear the deleted logs
        if (deletedLogs.length > 0) {
            await db.deletedLog.clear();
        }

        console.log('[Sync] Push completed successfully.');
    } catch (err) {
        console.error('[Sync] Push failed:', err);
    }
}

import { db } from './index';
import type { Setting, BackupData } from '@/types/database';

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const setting = await db.settings.get(key);
  return setting?.value as T | undefined;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const existing = await db.settings.get(key);
  
  if (existing) {
    await db.settings.update(key, {
      value,
      updatedAt: new Date(),
    });
  } else {
    await db.settings.add({
      key,
      value,
      updatedAt: new Date(),
    });
  }
}

export async function getAllSettings(): Promise<Record<string, unknown>> {
  const settings = await db.settings.toArray();
  return settings.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {} as Record<string, unknown>);
}

export async function exportData(): Promise<BackupData> {
  const [accounts, transactions, merchants, subscriptions, categories, settings] = await Promise.all([
    db.accounts.toArray(),
    db.transactions.toArray(),
    db.merchants.toArray(),
    db.subscriptions.toArray(),
    db.categories.toArray(),
    db.settings.toArray(),
  ]);
  
  return {
    version: '1.0',
    exportDate: new Date(),
    accounts,
    transactions,
    merchants,
    subscriptions,
    categories,
    settings,
  };
}

export async function importData(data: BackupData): Promise<{ success: boolean; message: string }> {
  try {
    // Validate version
    if (!data.version) {
      return { success: false, message: 'Invalid backup file: missing version' };
    }
    
    // Clear existing data
    await db.transactions.clear();
    await db.subscriptions.clear();
    await db.merchants.clear();
    await db.accounts.clear();
    await db.categories.clear();
    await db.settings.clear();
    
    // Import in order (respecting foreign keys)
    if (data.categories?.length) {
      await db.categories.bulkAdd(data.categories);
    }
    
    if (data.accounts?.length) {
      await db.accounts.bulkAdd(data.accounts);
    }
    
    if (data.merchants?.length) {
      await db.merchants.bulkAdd(data.merchants);
    }
    
    if (data.subscriptions?.length) {
      await db.subscriptions.bulkAdd(data.subscriptions);
    }
    
    if (data.transactions?.length) {
      await db.transactions.bulkAdd(data.transactions);
    }
    
    if (data.settings?.length) {
      await db.settings.bulkAdd(data.settings);
    }
    
    return { success: true, message: 'Data imported successfully' };
  } catch (error) {
    console.error('Import error:', error);
    return { success: false, message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export async function clearAllData(): Promise<void> {
  await db.transactions.clear();
  await db.subscriptions.clear();
  await db.merchants.clear();
  await db.accounts.clear();
  await db.processingLogs.clear();
  
  // Re-initialize default categories
  const categories = await db.categories.toArray();
  const defaultCategoryIds = categories.filter(c => c.isDefault).map(c => c.id);
  await db.categories.where('id').noneOf(defaultCategoryIds).delete();
}

export async function getDatabaseStats(): Promise<{
  accounts: number;
  transactions: number;
  merchants: number;
  subscriptions: number;
  categories: number;
  estimatedSize: string;
}> {
  const [accounts, transactions, merchants, subscriptions, categories] = await Promise.all([
    db.accounts.count(),
    db.transactions.count(),
    db.merchants.count(),
    db.subscriptions.count(),
    db.categories.count(),
  ]);
  
  // Rough estimate: 500 bytes per transaction
  const estimatedBytes = transactions * 500 + accounts * 200 + merchants * 150 + subscriptions * 300;
  const estimatedSize = estimatedBytes < 1024 * 1024
    ? `${(estimatedBytes / 1024).toFixed(1)} KB`
    : `${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB`;
  
  return {
    accounts,
    transactions,
    merchants,
    subscriptions,
    categories,
    estimatedSize,
  };
}

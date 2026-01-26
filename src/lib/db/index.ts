import Dexie, { type EntityTable } from 'dexie';
import type { 
  Account, 
  Transaction, 
  Merchant, 
  Subscription, 
  Category, 
  ProcessingLog, 
  Setting 
} from '@/types/database';

// Default categories as specified in Database Design
const DEFAULT_CATEGORIES: Omit<Category, 'createdAt' | 'updatedAt'>[] = [
  { id: 'cat_sub', name: 'Subscriptions', parentId: null, color: '#8B5CF6', icon: 'repeat', isDefault: true, sortOrder: 1 },
  { id: 'cat_util', name: 'Utilities', parentId: null, color: '#3B82F6', icon: 'zap', isDefault: true, sortOrder: 2 },
  { id: 'cat_food', name: 'Food & Dining', parentId: null, color: '#EF4444', icon: 'utensils', isDefault: true, sortOrder: 3 },
  { id: 'cat_trans', name: 'Transportation', parentId: null, color: '#F59E0B', icon: 'car', isDefault: true, sortOrder: 4 },
  { id: 'cat_shop', name: 'Shopping', parentId: null, color: '#EC4899', icon: 'shopping-bag', isDefault: true, sortOrder: 5 },
  { id: 'cat_health', name: 'Healthcare', parentId: null, color: '#10B981', icon: 'heart', isDefault: true, sortOrder: 6 },
  { id: 'cat_ent', name: 'Entertainment', parentId: null, color: '#6366F1', icon: 'music', isDefault: true, sortOrder: 7 },
  { id: 'cat_house', name: 'Housing', parentId: null, color: '#14B8A6', icon: 'home', isDefault: true, sortOrder: 8 },
  { id: 'cat_travel', name: 'Travel', parentId: null, color: '#0EA5E9', icon: 'plane', isDefault: true, sortOrder: 9 },
  { id: 'cat_other', name: 'Other', parentId: null, color: '#6B7280', icon: 'help-circle', isDefault: true, sortOrder: 10 },
];

// Default settings
const DEFAULT_SETTINGS: Omit<Setting, 'updatedAt'>[] = [
  { key: 'theme', value: 'dark' },
  { key: 'currency', value: 'USD' },
  { key: 'dateFormat', value: 'MM/DD/YYYY' },
  { key: 'defaultAccountId', value: null },
  { key: 'autoBackup', value: true },
  { key: 'lastBackupDate', value: null },
];

class SubTrackDB extends Dexie {
  accounts!: EntityTable<Account, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  merchants!: EntityTable<Merchant, 'id'>;
  subscriptions!: EntityTable<Subscription, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  processingLogs!: EntityTable<ProcessingLog, 'id'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor() {
    super('SubTrackDB');
    
    this.version(1).stores({
      accounts: 'id, name, status, type',
      transactions: 'id, [accountId+date], &transactionHash, date, merchantId, categoryId, subscriptionId',
      merchants: 'id, &normalizedName, categoryId',
      subscriptions: 'id, merchantId, accountId, status, nextExpectedDate',
      categories: 'id, parentId, sortOrder',
      processingLogs: 'id, accountId, processingDate',
      settings: 'key'
    });
  }
}

export const db = new SubTrackDB();

// Initialize default data on first load
export async function initializeDatabase(): Promise<void> {
  const categoryCount = await db.categories.count();
  
  if (categoryCount === 0) {
    const now = new Date();
    const categories = DEFAULT_CATEGORIES.map(cat => ({
      ...cat,
      createdAt: now,
      updatedAt: now,
    }));
    await db.categories.bulkAdd(categories);
  }

  const settingsCount = await db.settings.count();
  
  if (settingsCount === 0) {
    const now = new Date();
    const settings = DEFAULT_SETTINGS.map(setting => ({
      ...setting,
      updatedAt: now,
    }));
    await db.settings.bulkAdd(settings);
  }
}

// Generate unique ID
export function generateId(): string {
  return crypto.randomUUID();
}

// Generate transaction hash for deduplication
export async function generateTransactionHash(
  accountId: string,
  date: Date,
  amount: number,
  merchantRaw: string
): Promise<string> {
  const dateStr = date.toISOString().split('T')[0];
  const merchant = merchantRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
  const data = `${accountId}|${dateStr}|${amount}|${merchant}`;
  
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

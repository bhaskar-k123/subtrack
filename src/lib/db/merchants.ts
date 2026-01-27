import { db, generateId } from './index';
import type { Merchant } from '@/types/database';

// Payment processor prefixes to remove
const PROCESSOR_PREFIXES = [
  /^PAYPAL \*/i,
  /^PP\*/i,
  /^SQ \*/i,
  /^SQU\*/i,
  /^SP \*/i,
  /^TST\*/i,
  /^STRIPE\*/i,
  /^CKO\*/i,
  /^GOOG\*/i,
  /^APPLE\.COM/i,
  /^AMZN\*/i,
  /^AMZ\*/i,
];

// Common suffixes to remove
const SUFFIXES_TO_REMOVE = [
  /\s*#\d+.*$/,
  /\s+\d{4,}.*$/,
  /\s+\d{2}\/\d{2}$/,
  /\s*-\s*\d+$/,
  /\s+[A-Z]{2}\s*$/,
  /\.\s*COM$/i,
  /\.COM\/BILL$/i,
];

export function normalizeMerchantName(rawName: string): string {
  let clean = rawName.trim();

  // Remove payment processor prefixes
  for (const pattern of PROCESSOR_PREFIXES) {
    clean = clean.replace(pattern, '');
  }

  // Handle long numeric identifiers joined by hyphens
  if (/^[0-9]{3,}-[0-9-]{3,}/.test(clean)) {
    const parts = clean.split('-');
    // Find first non-numeric part
    const namePart = parts.find(p => /[A-Z]{3,}/i.test(p));
    if (namePart) {
      clean = namePart;
    } else if (parts.length > 1) {
      // Fallback to the last part if it has at least 3 chars
      const last = parts[parts.length - 1];
      if (last.length >= 3) clean = last;
    }
  }

  // Remove common suffixes
  for (const pattern of SUFFIXES_TO_REMOVE) {
    clean = clean.replace(pattern, '');
  }

  // Normalize whitespace
  clean = clean.replace(/\s+/g, ' ').trim();

  // Title case
  clean = clean
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return clean;
}

export async function createMerchant(
  data: Omit<Merchant, 'id' | 'createdAt' | 'updatedAt' | 'transactionCount' | 'totalSpent'>
): Promise<string> {
  const now = new Date();
  const merchant: Merchant = {
    ...data,
    id: generateId(),
    transactionCount: 0,
    totalSpent: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.merchants.add(merchant);
  return merchant.id;
}

export async function updateMerchant(
  id: string,
  data: Partial<Omit<Merchant, 'id' | 'createdAt'>>
): Promise<void> {
  await db.merchants.update(id, {
    ...data,
    updatedAt: new Date(),
  });
}

export async function deleteMerchant(id: string): Promise<void> {
  // Unlink transactions
  const transactions = await db.transactions.where('merchantId').equals(id).toArray();
  await db.transactions.bulkPut(
    transactions.map(t => ({ ...t, merchantId: null, updatedAt: new Date() }))
  );

  await db.merchants.delete(id);
}

export async function getMerchant(id: string): Promise<Merchant | undefined> {
  return db.merchants.get(id);
}

export async function getMerchantByName(normalizedName: string): Promise<Merchant | undefined> {
  return db.merchants.where('normalizedName').equals(normalizedName).first();
}

export async function getAllMerchants(): Promise<Merchant[]> {
  return db.merchants.orderBy('normalizedName').toArray();
}

export async function findOrCreateMerchant(rawName: string, categoryId?: string): Promise<string> {
  const normalized = normalizeMerchantName(rawName);

  // Try to find existing merchant
  let merchant = await db.merchants
    .where('normalizedName')
    .equalsIgnoreCase(normalized)
    .first();

  if (!merchant) {
    // Check if raw name is a variant of existing merchant
    const allMerchants = await db.merchants.toArray();
    for (const m of allMerchants) {
      if (m.variants.some(v => v.toLowerCase() === rawName.toLowerCase())) {
        merchant = m;
        break;
      }
    }
  }

  if (merchant) {
    // Add new variant if not already present
    if (!merchant.variants.includes(rawName)) {
      await db.merchants.update(merchant.id, {
        variants: [...merchant.variants, rawName],
        updatedAt: new Date(),
      });
    }
    return merchant.id;
  }

  // Create new merchant
  const id = await createMerchant({
    normalizedName: normalized,
    categoryId: categoryId || null,
    variants: [rawName],
    logoPath: null,
    isSubscription: false,
  });

  return id;
}

export async function mergeMerchants(targetId: string, sourceIds: string[]): Promise<void> {
  const target = await db.merchants.get(targetId);
  if (!target) throw new Error('Target merchant not found');

  const sources = await db.merchants.where('id').anyOf(sourceIds).toArray();

  // Collect all variants
  const allVariants = new Set(target.variants);
  for (const source of sources) {
    source.variants.forEach(v => allVariants.add(v));
  }

  // Update all transactions to use target merchant
  for (const sourceId of sourceIds) {
    const transactions = await db.transactions.where('merchantId').equals(sourceId).toArray();
    await db.transactions.bulkPut(
      transactions.map(t => ({ ...t, merchantId: targetId, updatedAt: new Date() }))
    );
  }

  // Update target with combined data
  const totalSpent = sources.reduce((sum, m) => sum + m.totalSpent, target.totalSpent);
  const transactionCount = sources.reduce((sum, m) => sum + m.transactionCount, target.transactionCount);

  await db.merchants.update(targetId, {
    variants: Array.from(allVariants),
    totalSpent,
    transactionCount,
    updatedAt: new Date(),
  });

  // Delete source merchants
  await db.merchants.bulkDelete(sourceIds);
}

export async function updateMerchantStats(merchantId: string): Promise<void> {
  const transactions = await db.transactions.where('merchantId').equals(merchantId).toArray();

  const totalSpent = transactions
    .filter(t => t.transactionType === 'debit')
    .reduce((sum, t) => sum + t.amount, 0);

  await db.merchants.update(merchantId, {
    transactionCount: transactions.length,
    totalSpent,
    updatedAt: new Date(),
  });
}

export async function getTopMerchants(limit = 10): Promise<Merchant[]> {
  const merchants = await db.merchants.orderBy('totalSpent').reverse().limit(limit).toArray();
  return merchants;
}

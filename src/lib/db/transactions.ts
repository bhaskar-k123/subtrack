import { db, generateId, generateTransactionHash } from './index';
import { updateAccountTransactionCount } from './accounts';
import type { Transaction, TransactionWithDetails } from '@/types/database';

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  merchantId?: string;
  startDate?: Date;
  endDate?: Date;
  transactionType?: 'debit' | 'credit';
  searchQuery?: string;
  minAmount?: number;
  maxAmount?: number;
}

export async function createTransaction(
  data: Omit<Transaction, 'id' | 'transactionHash' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = new Date();
  const hash = await generateTransactionHash(
    data.accountId,
    data.date,
    data.amount,
    data.merchantRaw
  );

  // Check for duplicate
  const existing = await db.transactions.where('transactionHash').equals(hash).first();
  if (existing) {
    throw new Error('Duplicate transaction detected');
  }

  const transaction: Transaction = {
    ...data,
    id: generateId(),
    transactionHash: hash,
    createdAt: now,
    updatedAt: now,
  };

  await db.transactions.add(transaction);
  await updateAccountTransactionCount(data.accountId);

  return transaction.id;
}

export async function bulkCreateTransactions(
  transactions: Omit<Transaction, 'id' | 'transactionHash' | 'createdAt' | 'updatedAt'>[]
): Promise<{ added: string[]; duplicates: number }> {
  const now = new Date();
  const added: string[] = [];
  let duplicates = 0;
  const affectedAccounts = new Set<string>();

  for (const data of transactions) {
    const hash = await generateTransactionHash(
      data.accountId,
      data.date,
      data.amount,
      data.merchantRaw
    );

    const existing = await db.transactions.where('transactionHash').equals(hash).first();
    if (existing) {
      duplicates++;
      continue;
    }

    const transaction: Transaction = {
      ...data,
      id: generateId(),
      transactionHash: hash,
      createdAt: now,
      updatedAt: now,
    };

    await db.transactions.add(transaction);
    added.push(transaction.id);
    affectedAccounts.add(data.accountId);
  }

  // Update transaction counts for affected accounts
  for (const accountId of affectedAccounts) {
    await updateAccountTransactionCount(accountId);
  }

  return { added, duplicates };
}

export async function updateTransaction(
  id: string,
  data: Partial<Omit<Transaction, 'id' | 'transactionHash' | 'createdAt'>>
): Promise<void> {
  await db.transactions.update(id, {
    ...data,
    updatedAt: new Date(),
  });
}

export async function deleteTransaction(id: string): Promise<void> {
  const tx = await db.transactions.get(id);
  if (tx) {
    await db.transactions.delete(id);
    await updateAccountTransactionCount(tx.accountId);
  }
}

export async function bulkDeleteTransactions(ids: string[]): Promise<void> {
  const transactions = await db.transactions.where('id').anyOf(ids).toArray();
  const affectedAccounts = new Set(transactions.map(t => t.accountId));

  await db.transactions.bulkDelete(ids);

  for (const accountId of affectedAccounts) {
    await updateAccountTransactionCount(accountId);
  }
}

export async function getTransaction(id: string): Promise<Transaction | undefined> {
  return db.transactions.get(id);
}

export async function getTransactionWithDetails(id: string): Promise<TransactionWithDetails | undefined> {
  const transaction = await db.transactions.get(id);
  if (!transaction) return undefined;

  const [account, category, merchant, subscription] = await Promise.all([
    transaction.accountId ? db.accounts.get(transaction.accountId) : undefined,
    transaction.categoryId ? db.categories.get(transaction.categoryId) : undefined,
    transaction.merchantId ? db.merchants.get(transaction.merchantId) : undefined,
    transaction.subscriptionId ? db.subscriptions.get(transaction.subscriptionId) : undefined,
  ]);

  return { ...transaction, account, category, merchant, subscription };
}

export async function getTransactions(
  filters: TransactionFilters = {},
  limit = 50,
  offset = 0
): Promise<Transaction[]> {
  let collection = db.transactions.orderBy('date').reverse();

  const transactions = await collection.toArray();

  let filtered = transactions;

  if (filters.accountId) {
    filtered = filtered.filter(t => t.accountId === filters.accountId);
  }

  if (filters.categoryId) {
    filtered = filtered.filter(t => t.categoryId === filters.categoryId);
  }

  if (filters.merchantId) {
    filtered = filtered.filter(t => t.merchantId === filters.merchantId);
  }

  if (filters.transactionType) {
    filtered = filtered.filter(t => t.transactionType === filters.transactionType);
  }

  if (filters.startDate) {
    filtered = filtered.filter(t => t.date >= filters.startDate!);
  }

  if (filters.endDate) {
    filtered = filtered.filter(t => t.date <= filters.endDate!);
  }

  if (filters.minAmount !== undefined) {
    filtered = filtered.filter(t => t.amount >= filters.minAmount!);
  }

  if (filters.maxAmount !== undefined) {
    filtered = filtered.filter(t => t.amount <= filters.maxAmount!);
  }

  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    filtered = filtered.filter(t =>
      t.merchantNormalized.toLowerCase().includes(query) ||
      t.merchantRaw.toLowerCase().includes(query) ||
      t.description?.toLowerCase().includes(query) ||
      t.notes?.toLowerCase().includes(query)
    );
  }

  return filtered.slice(offset, offset + limit);
}

export async function getTransactionCount(filters: TransactionFilters = {}): Promise<number> {
  const transactions = await getTransactions(filters, Number.MAX_SAFE_INTEGER, 0);
  return transactions.length;
}

export async function getTransactionsByDateRange(
  startDate: Date,
  endDate: Date
): Promise<Transaction[]> {
  return db.transactions
    .where('date')
    .between(startDate, endDate, true, true)
    .reverse()
    .sortBy('date');
}

export async function getRecentTransactions(limit = 10): Promise<TransactionWithDetails[]> {
  const transactions = await db.transactions
    .orderBy('date')
    .reverse()
    .limit(limit)
    .toArray();

  const withDetails = await Promise.all(
    transactions.map(async (t) => {
      const [account, category, merchant] = await Promise.all([
        t.accountId ? db.accounts.get(t.accountId) : undefined,
        t.categoryId ? db.categories.get(t.categoryId) : undefined,
        t.merchantId ? db.merchants.get(t.merchantId) : undefined,
      ]);
      return { ...t, account, category, merchant };
    })
  );

  return withDetails;
}

export async function checkDuplicate(
  accountId: string,
  date: Date,
  amount: number,
  merchantRaw: string
): Promise<Transaction | null> {
  const hash = await generateTransactionHash(accountId, date, amount, merchantRaw);
  const existing = await db.transactions.where('transactionHash').equals(hash).first();
  return existing || null;
}

// Statement management types
export interface UploadedStatement {
  sourceFileName: string;
  transactionCount: number;
  totalDebits: number;
  totalCredits: number;
  dateRange: { start: Date; end: Date } | null;
  uploadedAt: Date;
}

// Get list of unique uploaded statements
export async function getUploadedStatements(): Promise<UploadedStatement[]> {
  const allTransactions = await db.transactions.toArray();

  // Group by sourceFileName
  const statementMap = new Map<string, Transaction[]>();

  for (const tx of allTransactions) {
    if (tx.sourceFileName) {
      const existing = statementMap.get(tx.sourceFileName) || [];
      existing.push(tx);
      statementMap.set(tx.sourceFileName, existing);
    }
  }

  // Build statement summaries
  const statements: UploadedStatement[] = [];

  for (const [fileName, transactions] of statementMap) {
    const debits = transactions.filter(t => t.transactionType === 'debit');
    const credits = transactions.filter(t => t.transactionType === 'credit');

    const dates = transactions.map(t => new Date(t.date).getTime()).filter(d => !isNaN(d));
    const minDate = dates.length > 0 ? new Date(Math.min(...dates)) : null;
    const maxDate = dates.length > 0 ? new Date(Math.max(...dates)) : null;

    // Get earliest createdAt as uploadedAt
    const createdDates = transactions.map(t => new Date(t.createdAt).getTime()).filter(d => !isNaN(d));
    const uploadedAt = createdDates.length > 0 ? new Date(Math.min(...createdDates)) : new Date();

    statements.push({
      sourceFileName: fileName,
      transactionCount: transactions.length,
      totalDebits: debits.reduce((sum, t) => sum + t.amount, 0),
      totalCredits: credits.reduce((sum, t) => sum + t.amount, 0),
      dateRange: minDate && maxDate ? { start: minDate, end: maxDate } : null,
      uploadedAt,
    });
  }

  // Sort by upload date (newest first)
  statements.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());

  return statements;
}

// Delete all transactions from a specific statement
export async function deleteStatementTransactions(sourceFileName: string): Promise<number> {
  const transactions = await db.transactions.toArray();
  const toDelete = transactions.filter(t => t.sourceFileName === sourceFileName);

  if (toDelete.length === 0) {
    return 0;
  }

  const affectedAccounts = new Set(toDelete.map(t => t.accountId));
  const ids = toDelete.map(t => t.id);

  await db.transactions.bulkDelete(ids);

  // Update transaction counts for affected accounts
  for (const accountId of affectedAccounts) {
    await updateAccountTransactionCount(accountId);
  }

  return toDelete.length;
}

import { db, generateId } from './index';
import type { Account } from '@/types/database';

export async function createAccount(
  data: Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'transactionCount' | 'lastProcessedDate'>
): Promise<string> {
  const now = new Date();
  const account: Account = {
    ...data,
    id: generateId(),
    transactionCount: 0,
    lastProcessedDate: null,
    createdAt: now,
    updatedAt: now,
  };
  
  await db.accounts.add(account);
  return account.id;
}

export async function updateAccount(
  id: string,
  data: Partial<Omit<Account, 'id' | 'createdAt'>>
): Promise<void> {
  await db.accounts.update(id, {
    ...data,
    updatedAt: new Date(),
  });
}

export async function deleteAccount(id: string, cascadeDelete = false): Promise<void> {
  if (cascadeDelete) {
    // Delete all transactions for this account
    await db.transactions.where('accountId').equals(id).delete();
    // Delete all subscriptions for this account
    await db.subscriptions.where('accountId').equals(id).delete();
  } else {
    // Set accountId to null for transactions (soft delete cascade)
    const transactions = await db.transactions.where('accountId').equals(id).toArray();
    await db.transactions.bulkPut(
      transactions.map(t => ({ ...t, accountId: '', updatedAt: new Date() }))
    );
  }
  
  await db.accounts.delete(id);
}

export async function getAccount(id: string): Promise<Account | undefined> {
  return db.accounts.get(id);
}

export async function getAllAccounts(): Promise<Account[]> {
  return db.accounts.orderBy('name').toArray();
}

export async function getActiveAccounts(): Promise<Account[]> {
  return db.accounts.where('status').equals('active').sortBy('name');
}

export async function updateAccountTransactionCount(accountId: string): Promise<void> {
  const count = await db.transactions.where('accountId').equals(accountId).count();
  const lastTransaction = await db.transactions
    .where('accountId')
    .equals(accountId)
    .reverse()
    .sortBy('date')
    .then(txs => txs[0]);

  await db.accounts.update(accountId, {
    transactionCount: count,
    lastProcessedDate: lastTransaction?.date || null,
    updatedAt: new Date(),
  });
}

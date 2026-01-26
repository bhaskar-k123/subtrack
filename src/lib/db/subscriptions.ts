import { db, generateId } from './index';
import type { Subscription, SubscriptionWithDetails, Transaction } from '@/types/database';
import { addDays, addMonths, addWeeks, addYears, differenceInDays } from 'date-fns';

export async function createSubscription(
  data: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = new Date();
  const subscription: Subscription = {
    ...data,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  
  await db.subscriptions.add(subscription);
  return subscription.id;
}

export async function updateSubscription(
  id: string,
  data: Partial<Omit<Subscription, 'id' | 'createdAt'>>
): Promise<void> {
  await db.subscriptions.update(id, {
    ...data,
    updatedAt: new Date(),
  });
}

export async function deleteSubscription(id: string): Promise<void> {
  // Unlink transactions from this subscription
  const transactions = await db.transactions.where('subscriptionId').equals(id).toArray();
  await db.transactions.bulkPut(
    transactions.map(t => ({ ...t, subscriptionId: null, isRecurring: false, updatedAt: new Date() }))
  );
  
  await db.subscriptions.delete(id);
}

export async function getSubscription(id: string): Promise<Subscription | undefined> {
  return db.subscriptions.get(id);
}

export async function getAllSubscriptions(): Promise<Subscription[]> {
  return db.subscriptions.orderBy('name').toArray();
}

export async function getActiveSubscriptions(): Promise<Subscription[]> {
  return db.subscriptions.where('status').equals('active').sortBy('name');
}

export async function getSubscriptionWithDetails(id: string): Promise<SubscriptionWithDetails | undefined> {
  const subscription = await db.subscriptions.get(id);
  if (!subscription) return undefined;
  
  const [merchant, account, category, recentTransactions] = await Promise.all([
    subscription.merchantId ? db.merchants.get(subscription.merchantId) : undefined,
    subscription.accountId ? db.accounts.get(subscription.accountId) : undefined,
    subscription.categoryId ? db.categories.get(subscription.categoryId) : undefined,
    db.transactions
      .where('subscriptionId')
      .equals(id)
      .reverse()
      .sortBy('date')
      .then(txs => txs.slice(0, 5)),
  ]);
  
  return { ...subscription, merchant, account, category, recentTransactions };
}

export async function getSubscriptionsWithDetails(): Promise<SubscriptionWithDetails[]> {
  const subscriptions = await db.subscriptions.toArray();
  
  return Promise.all(
    subscriptions.map(async (sub) => {
      const [merchant, account, category] = await Promise.all([
        sub.merchantId ? db.merchants.get(sub.merchantId) : undefined,
        sub.accountId ? db.accounts.get(sub.accountId) : undefined,
        sub.categoryId ? db.categories.get(sub.categoryId) : undefined,
      ]);
      return { ...sub, merchant, account, category };
    })
  );
}

export async function getUpcomingRenewals(days = 30): Promise<SubscriptionWithDetails[]> {
  const now = new Date();
  const futureDate = addDays(now, days);
  
  const subscriptions = await db.subscriptions
    .where('status')
    .equals('active')
    .filter(sub => {
      if (!sub.nextExpectedDate) return false;
      return sub.nextExpectedDate >= now && sub.nextExpectedDate <= futureDate;
    })
    .sortBy('nextExpectedDate');
  
  return Promise.all(
    subscriptions.map(async (sub) => {
      const merchant = sub.merchantId ? await db.merchants.get(sub.merchantId) : undefined;
      return { ...sub, merchant };
    })
  );
}

// Calculate next expected date based on frequency
function calculateNextDate(lastDate: Date, frequency: Subscription['billingFrequency']): Date {
  switch (frequency) {
    case 'weekly':
      return addWeeks(lastDate, 1);
    case 'monthly':
      return addMonths(lastDate, 1);
    case 'quarterly':
      return addMonths(lastDate, 3);
    case 'annual':
      return addYears(lastDate, 1);
    default:
      return addMonths(lastDate, 1);
  }
}

// Detect frequency from intervals
function detectFrequency(avgDays: number): Subscription['billingFrequency'] {
  if (avgDays <= 10) return 'weekly';
  if (avgDays <= 45) return 'monthly';
  if (avgDays <= 120) return 'quarterly';
  return 'annual';
}

// Detect subscriptions from transactions
export async function detectSubscriptions(accountId?: string): Promise<Subscription[]> {
  // Get all transactions, optionally filtered by account
  let transactions: Transaction[];
  if (accountId) {
    transactions = await db.transactions.where('accountId').equals(accountId).toArray();
  } else {
    transactions = await db.transactions.toArray();
  }
  
  // Group by merchant
  const byMerchant = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (tx.transactionType !== 'debit') continue;
    const key = tx.merchantNormalized.toLowerCase();
    if (!byMerchant.has(key)) {
      byMerchant.set(key, []);
    }
    byMerchant.get(key)!.push(tx);
  }
  
  const detectedSubscriptions: Subscription[] = [];
  
  for (const [merchantKey, txs] of byMerchant) {
    if (txs.length < 2) continue;
    
    // Sort by date
    txs.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Calculate intervals
    const intervals: number[] = [];
    for (let i = 1; i < txs.length; i++) {
      intervals.push(differenceInDays(txs[i].date, txs[i - 1].date));
    }
    
    if (intervals.length === 0) continue;
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    
    // Low variance relative to mean = likely subscription
    const coefficientOfVariation = stdDev / avgInterval;
    
    if (coefficientOfVariation < 0.25 && intervals.length >= 2) {
      const frequency = detectFrequency(avgInterval);
      const amounts = txs.map(t => t.amount);
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const lastTx = txs[txs.length - 1];
      
      // Check if subscription already exists
      const existing = await db.subscriptions
        .where('merchantId')
        .equals(txs[0].merchantId || '')
        .first();
      
      if (!existing) {
        const now = new Date();
        const subscription: Subscription = {
          id: generateId(),
          merchantId: txs[0].merchantId || '',
          accountId: txs[0].accountId,
          name: txs[0].merchantNormalized,
          billingFrequency: frequency,
          averageAmount: avgAmount,
          lastAmount: lastTx.amount,
          firstChargeDate: txs[0].date,
          lastChargeDate: lastTx.date,
          nextExpectedDate: calculateNextDate(lastTx.date, frequency),
          status: 'active',
          priceHistory: txs.map(t => ({ date: t.date, amount: t.amount })),
          categoryId: txs[0].categoryId,
          isConfirmed: false,
          createdAt: now,
          updatedAt: now,
          notes: null,
        };
        
        detectedSubscriptions.push(subscription);
      }
    }
  }
  
  return detectedSubscriptions;
}

// Save detected subscriptions
export async function saveDetectedSubscriptions(subscriptions: Subscription[]): Promise<string[]> {
  const ids: string[] = [];
  
  for (const sub of subscriptions) {
    await db.subscriptions.add(sub);
    ids.push(sub.id);
    
    // Mark related transactions as recurring
    const transactions = await db.transactions
      .filter(t => t.merchantNormalized.toLowerCase() === sub.name.toLowerCase())
      .toArray();
    
    for (const tx of transactions) {
      await db.transactions.update(tx.id, {
        isRecurring: true,
        subscriptionId: sub.id,
        updatedAt: new Date(),
      });
    }
  }
  
  return ids;
}

// Get subscription metrics
export async function getSubscriptionMetrics(): Promise<{
  totalMonthly: number;
  totalAnnual: number;
  activeCount: number;
  upcomingCount: number;
}> {
  const active = await getActiveSubscriptions();
  const upcoming = await getUpcomingRenewals(7);
  
  let totalMonthly = 0;
  
  for (const sub of active) {
    switch (sub.billingFrequency) {
      case 'weekly':
        totalMonthly += sub.averageAmount * 4.33;
        break;
      case 'monthly':
        totalMonthly += sub.averageAmount;
        break;
      case 'quarterly':
        totalMonthly += sub.averageAmount / 3;
        break;
      case 'annual':
        totalMonthly += sub.averageAmount / 12;
        break;
    }
  }
  
  return {
    totalMonthly,
    totalAnnual: totalMonthly * 12,
    activeCount: active.length,
    upcomingCount: upcoming.length,
  };
}

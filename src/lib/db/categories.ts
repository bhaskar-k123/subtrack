import { db, generateId } from './index';
import type { Category } from '@/types/database';

export async function createCategory(
  data: Omit<Category, 'id' | 'createdAt' | 'updatedAt' | 'isDefault'>
): Promise<string> {
  const now = new Date();
  const category: Category = {
    ...data,
    id: generateId(),
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
  
  await db.categories.add(category);
  return category.id;
}

export async function updateCategory(
  id: string,
  data: Partial<Omit<Category, 'id' | 'createdAt' | 'isDefault'>>
): Promise<void> {
  await db.categories.update(id, {
    ...data,
    updatedAt: new Date(),
  });
}

export async function deleteCategory(id: string): Promise<void> {
  const category = await db.categories.get(id);
  if (!category) return;
  
  // Don't allow deleting default categories
  if (category.isDefault) {
    throw new Error('Cannot delete default category');
  }
  
  // Move transactions to 'Other' category
  const transactions = await db.transactions.where('categoryId').equals(id).toArray();
  await db.transactions.bulkPut(
    transactions.map(t => ({ ...t, categoryId: 'cat_other', updatedAt: new Date() }))
  );
  
  await db.categories.delete(id);
}

export async function getCategory(id: string): Promise<Category | undefined> {
  return db.categories.get(id);
}

export async function getAllCategories(): Promise<Category[]> {
  return db.categories.orderBy('sortOrder').toArray();
}

export async function getCategorySpending(
  startDate: Date,
  endDate: Date
): Promise<{ categoryId: string; category: Category; total: number; count: number }[]> {
  const categories = await getAllCategories();
  const transactions = await db.transactions
    .where('date')
    .between(startDate, endDate, true, true)
    .filter(t => t.transactionType === 'debit')
    .toArray();
  
  const spendingMap = new Map<string, { total: number; count: number }>();
  
  for (const tx of transactions) {
    const catId = tx.categoryId || 'cat_other';
    const current = spendingMap.get(catId) || { total: 0, count: 0 };
    spendingMap.set(catId, {
      total: current.total + tx.amount,
      count: current.count + 1,
    });
  }
  
  return categories.map(category => ({
    categoryId: category.id,
    category,
    total: spendingMap.get(category.id)?.total || 0,
    count: spendingMap.get(category.id)?.count || 0,
  })).filter(item => item.total > 0).sort((a, b) => b.total - a.total);
}

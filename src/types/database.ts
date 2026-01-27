// SubTrack Database Types - Exactly as specified in Database Design Document

export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'wallet';
  institutionName: string | null;
  identifier: string | null;
  currency: string;
  status: 'active' | 'closed';
  balance: number | null;
  lastProcessedDate: Date | null;
  transactionCount: number;
  createdAt: Date;
  updatedAt: Date;
  notes: string | null;
  pdfPassword?: string | null;
}

export interface Transaction {
  id: string;
  accountId: string;
  transactionHash: string;
  date: Date;
  merchantRaw: string;
  merchantNormalized: string;
  merchantId: string | null;
  amount: number;
  transactionType: 'debit' | 'credit';
  categoryId: string | null;
  description: string | null;
  sourceType: 'statement' | 'receipt' | 'manual';
  sourceFileName: string | null;
  confidenceScore: number;
  isRecurring: boolean;
  subscriptionId: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  notes: string | null;
  refNumber?: string | null;
  paymentMethod?: string;
}

export interface Merchant {
  id: string;
  normalizedName: string;
  categoryId: string | null;
  variants: string[];
  logoPath: string | null;
  transactionCount: number;
  totalSpent: number;
  isSubscription: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  id: string;
  merchantId: string;
  accountId: string;
  name: string;
  billingFrequency: 'weekly' | 'monthly' | 'quarterly' | 'annual';
  averageAmount: number;
  lastAmount: number;
  firstChargeDate: Date;
  lastChargeDate: Date;
  nextExpectedDate: Date | null;
  status: 'active' | 'paused' | 'cancelled';
  priceHistory: { date: Date; amount: number }[];
  categoryId: string | null;
  isConfirmed: boolean;
  createdAt: Date;
  updatedAt: Date;
  notes: string | null;
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  color: string;
  icon: string;
  isDefault: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessingLog {
  id: string;
  accountId: string | null;
  fileName: string;
  fileType: 'pdf' | 'image';
  fileSize: number;
  processingDate: Date;
  processingTimeMs: number;
  transactionsExtracted: number;
  transactionsAdded: number;
  status: 'success' | 'partial' | 'failed';
  errorLog: string | null;
}

export interface DeletedLog {
  id: string;
  type: 'transaction' | 'account' | 'category' | 'merchant' | 'subscription';
  deletedAt: Date;
}

export interface Setting {
  key: string;
  value: unknown;
  updatedAt: Date;
}

export interface BackupData {
  version: string;
  exportDate: Date;
  accounts: Account[];
  transactions: Transaction[];
  merchants: Merchant[];
  subscriptions: Subscription[];
  categories: Category[];
  settings: Setting[];
}

// Extended types for UI
export interface TransactionWithDetails extends Transaction {
  account?: Account;
  category?: Category;
  merchant?: Merchant;
  subscription?: Subscription;
}

export interface SubscriptionWithDetails extends Subscription {
  merchant?: Merchant;
  account?: Account;
  category?: Category;
  recentTransactions?: Transaction[];
}

export interface ExtractedTransaction {
  date: Date;
  merchantRaw: string;
  amount: number;
  transactionType: 'debit' | 'credit';
  description: string | null;
  confidenceScore: number;
  isDuplicate?: boolean;
  refNumber?: string;
  paymentMethod?: string;
  existingTransactionId?: string;
}

export interface ProcessingResult {
  transactions: ExtractedTransaction[];
  metadata: {
    accountName?: string;
    accountType?: Account['type'];
    accountIdentifier?: string;
    statementPeriodStart?: Date;
    statementPeriodEnd?: Date;
    openingBalance?: number;
    closingBalance?: number;
  };
  errors: { line: number; message: string }[];
}

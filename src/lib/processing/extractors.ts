// Processing pipeline for PDF and receipt extraction
// Note: Full PDF.js and Tesseract.js integration requires additional setup
// This provides the core extraction logic framework

import type { ExtractedTransaction, ProcessingResult } from '@/types/database';

// Date patterns commonly found in bank statements
const DATE_PATTERNS = [
  /(\d{1,2})\/(\d{1,2})\/(\d{4})/,          // MM/DD/YYYY
  /(\d{1,2})\/(\d{1,2})\/(\d{2})/,          // MM/DD/YY
  /(\d{4})-(\d{2})-(\d{2})/,                // YYYY-MM-DD
  /(\d{1,2})-(\d{1,2})-(\d{4})/,            // DD-MM-YYYY
  /(\w{3})\s+(\d{1,2}),?\s+(\d{4})/,        // Mon DD, YYYY
  /(\d{1,2})\s+(\w{3})\s+(\d{4})/,          // DD Mon YYYY
];

// Amount patterns
const AMOUNT_PATTERNS = [
  /\$?([\d,]+\.\d{2})/,                     // $1,234.56
  /([\d,]+\.\d{2})\s*(CR|DR)?/i,            // 1,234.56 CR
  /(-?\$?[\d,]+\.\d{2})/,                   // -$1,234.56
];

export function parseDate(text: string): Date | null {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      try {
        // Try to parse based on pattern format
        const parsed = new Date(match[0]);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}

export function parseAmount(text: string): { amount: number; type: 'debit' | 'credit' } | null {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const numStr = match[1].replace(/[$,]/g, '');
      const amount = parseFloat(numStr);
      
      if (!isNaN(amount)) {
        // Determine if credit or debit
        const isCredit = text.toLowerCase().includes('cr') || 
                         text.includes('+') ||
                         text.toLowerCase().includes('credit') ||
                         text.toLowerCase().includes('deposit');
        
        return {
          amount: Math.abs(amount),
          type: isCredit ? 'credit' : 'debit',
        };
      }
    }
  }
  return null;
}

export function extractTransactionLine(line: string): ExtractedTransaction | null {
  const date = parseDate(line);
  if (!date) return null;
  
  const amountInfo = parseAmount(line);
  if (!amountInfo) return null;
  
  // Remove date and amount to get merchant
  let merchantRaw = line;
  
  // Remove date patterns
  for (const pattern of DATE_PATTERNS) {
    merchantRaw = merchantRaw.replace(pattern, '');
  }
  
  // Remove amount patterns
  for (const pattern of AMOUNT_PATTERNS) {
    merchantRaw = merchantRaw.replace(pattern, '');
  }
  
  // Clean up merchant name
  merchantRaw = merchantRaw
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\-\.]/g, '')
    .trim();
  
  if (!merchantRaw || merchantRaw.length < 2) return null;
  
  return {
    date,
    merchantRaw,
    amount: amountInfo.amount,
    transactionType: amountInfo.type,
    description: null,
    confidenceScore: 70, // Base confidence for text extraction
  };
}

export async function processTextContent(text: string): Promise<ProcessingResult> {
  const lines = text.split('\n').filter(line => line.trim());
  const transactions: ExtractedTransaction[] = [];
  const errors: { line: number; message: string }[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    try {
      const transaction = extractTransactionLine(line);
      if (transaction) {
        transactions.push(transaction);
      }
    } catch (error) {
      errors.push({
        line: i + 1,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  
  return {
    transactions,
    metadata: {},
    errors,
  };
}

// Simple CSV parsing for bank exports
export function parseCSV(content: string): string[][] {
  const lines = content.split('\n');
  return lines.map(line => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    return values;
  });
}

export async function processCSVContent(
  content: string,
  columnMapping: {
    date: number;
    description: number;
    amount: number;
    type?: number;
  }
): Promise<ProcessingResult> {
  const rows = parseCSV(content);
  const transactions: ExtractedTransaction[] = [];
  const errors: { line: number; message: string }[] = [];
  
  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 3) continue;
    
    try {
      const dateStr = row[columnMapping.date];
      const date = parseDate(dateStr);
      if (!date) {
        errors.push({ line: i + 1, message: 'Invalid date format' });
        continue;
      }
      
      const merchantRaw = row[columnMapping.description];
      if (!merchantRaw) {
        errors.push({ line: i + 1, message: 'Missing description' });
        continue;
      }
      
      const amountStr = row[columnMapping.amount];
      const parsed = parseFloat(amountStr.replace(/[$,]/g, ''));
      if (isNaN(parsed)) {
        errors.push({ line: i + 1, message: 'Invalid amount' });
        continue;
      }
      
      let transactionType: 'debit' | 'credit' = parsed < 0 ? 'debit' : 'credit';
      
      if (columnMapping.type !== undefined) {
        const typeStr = row[columnMapping.type]?.toLowerCase();
        if (typeStr?.includes('debit') || typeStr?.includes('dr')) {
          transactionType = 'debit';
        } else if (typeStr?.includes('credit') || typeStr?.includes('cr')) {
          transactionType = 'credit';
        }
      }
      
      transactions.push({
        date,
        merchantRaw,
        amount: Math.abs(parsed),
        transactionType,
        description: null,
        confidenceScore: 90, // Higher confidence for structured CSV
      });
    } catch (error) {
      errors.push({
        line: i + 1,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  
  return {
    transactions,
    metadata: {},
    errors,
  };
}

export function calculateConfidenceScore(transaction: ExtractedTransaction): number {
  let score = transaction.confidenceScore;
  
  // Boost for reasonable amounts
  if (transaction.amount > 0 && transaction.amount < 100000) {
    score += 5;
  }
  
  // Boost for reasonable dates (within last 2 years)
  const now = new Date();
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
  if (transaction.date >= twoYearsAgo && transaction.date <= now) {
    score += 10;
  }
  
  // Boost for merchant name quality
  if (transaction.merchantRaw.length >= 3 && transaction.merchantRaw.length <= 50) {
    score += 5;
  }
  
  return Math.min(100, score);
}

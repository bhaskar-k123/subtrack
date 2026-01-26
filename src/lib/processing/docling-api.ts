/**
 * Docling API Client
 * Handles communication with the Python backend for document processing
 */

import type { ExtractedTransaction } from '@/types/database';

const API_BASE = '/api';

export interface ProcessingResult {
    success: boolean;
    filename: string;
    processingMethod: 'docling' | 'fallback';
    extractedText: string;
    transactions: ExtractedTransaction[];
    transactionCount: number;
    message: string;
    validation?: {
        expectedDrCount: number;
        expectedCrCount: number;
        actualDrCount: number;
        actualCrCount: number;
        foundFooter: boolean;
        matches: boolean | null;
    };
}

export interface HealthStatus {
    status: 'healthy' | 'unhealthy';
    docling_available: boolean;
    timestamp: string;
}

/**
 * Check if the backend server is available
 */
export async function checkServerHealth(): Promise<HealthStatus | null> {
    try {
        const response = await fetch(`${API_BASE}/health`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
        });

        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (error) {
        console.log('Backend server not available, using local processing');
        return null;
    }
}

/**
 * Process a document using the backend Docling API
 */
export async function processDocumentWithDocling(file: File, password?: string): Promise<ProcessingResult> {
    const formData = new FormData();
    formData.append('file', file);
    if (password) {
        formData.append('password', password);
    }

    const response = await fetch(`${API_BASE}/process`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || `Processing failed: ${response.status}`);
    }

    const result = await response.json();

    // Convert dates from strings to Date objects with robust parsing
    result.transactions = result.transactions.map((tx: any) => {
        let parsedDate: Date;

        if (tx.date) {
            // Try parsing the date
            parsedDate = new Date(tx.date);

            // If invalid, try adding time component for ISO dates
            if (isNaN(parsedDate.getTime()) && typeof tx.date === 'string') {
                // Try YYYY-MM-DD format explicitly
                const isoMatch = tx.date.match(/(\d{4})-(\d{2})-(\d{2})/);
                if (isoMatch) {
                    parsedDate = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
                }
            }

            // If still invalid, use current date as fallback
            if (isNaN(parsedDate.getTime())) {
                console.warn(`Could not parse date: ${tx.date}, using current date`);
                parsedDate = new Date();
            }
        } else {
            parsedDate = new Date();
        }

        return {
            ...tx,
            date: parsedDate,
        };
    });

    return result;
}

/**
 * Export transactions to CSV via the backend
 */
export async function exportToCSV(transactions: any[]): Promise<string> {
    const response = await fetch(`${API_BASE}/export/csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactions),
    });

    if (!response.ok) {
        throw new Error('Export failed');
    }

    const result = await response.json();
    return result.csv;
}

/**
 * Check if backend is available and has Docling
 */
export async function isDoclingAvailable(): Promise<boolean> {
    const health = await checkServerHealth();
    return health?.docling_available ?? false;
}

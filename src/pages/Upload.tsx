import React, { useState, useCallback, useEffect } from 'react';
import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Upload,
  FileText,
  Image,
  AlertCircle,
  Check,
  X,
  Trash2,
  RefreshCw,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate, formatFileSize } from '@/lib/utils/formatting';
import { processTextContent, processCSVContent, calculateConfidenceScore } from '@/lib/processing/extractors';
import { checkServerHealth, processDocumentWithDocling } from '@/lib/processing/docling-api';
import { normalizeMerchantName, findOrCreateMerchant } from '@/lib/db/merchants';
import { bulkCreateTransactions, checkDuplicate, getUploadedStatements, deleteStatementTransactions, type UploadedStatement } from '@/lib/db/transactions';
import { getAllAccounts, createAccount } from '@/lib/db/accounts';
import { getAllCategories } from '@/lib/db/categories';
import type { Account, Category, ExtractedTransaction } from '@/types/database';
import { syncPush } from '@/lib/sync';
import { toast } from 'sonner';

interface ProcessedFile {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  progress: number;
  transactions: ExtractedTransaction[];
  error?: string;
  password?: string;
  validation?: {
    matches: boolean | null;
    foundFooter: boolean;
    expectedDrCount: number;
    expectedCrCount: number;
    actualDrCount: number;
    actualCrCount: number;
  };
}

export default function UploadPage() {
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);

  // Server status
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);
  const [doclingAvailable, setDoclingAvailable] = useState(false);

  // Review state
  const [reviewingFile, setReviewingFile] = useState<ProcessedFile | null>(null);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Uploaded statements history
  const [uploadedStatements, setUploadedStatements] = useState<UploadedStatement[]>([]);

  useEffect(() => {
    loadData();
    checkServer();
  }, []);

  async function checkServer() {
    const health = await checkServerHealth();
    setServerAvailable(health !== null);
    setDoclingAvailable(health?.docling_available ?? false);
  }

  async function loadData() {
    const [accts, cats, statements] = await Promise.all([
      getAllAccounts(),
      getAllCategories(),
      getUploadedStatements(),
    ]);
    setAccounts(accts);
    setCategories(cats);
    setUploadedStatements(statements);

    if (accts.length > 0) {
      setSelectedAccountId(accts[0].id);
    }
  }

  // Auto-fill password when account changes
  useEffect(() => {
    if (!selectedAccountId) return;
    const account = accounts.find(a => a.id === selectedAccountId);
    if (account?.pdfPassword) {
      setFiles(prev => prev.map(f => {
        // Only auto-fill if empty and status is pending
        if (!f.password && f.status === 'pending') {
          return { ...f, password: account.pdfPassword };
        }
        return f;
      }));
      toast.info('Applied saved PDF password');
    }
  }, [selectedAccountId, accounts]);

  async function handleDeleteStatement(sourceFileName: string) {
    if (!confirm(`Delete all transactions from "${sourceFileName}"? This cannot be undone.`)) {
      return;
    }
    try {
      const count = await deleteStatementTransactions(sourceFileName);
      toast.success(`Deleted ${count} transactions from ${sourceFileName}`);
      // Refresh statements list
      const statements = await getUploadedStatements();
      setUploadedStatements(statements);

      // Sync deletion to backend immediately
      await syncPush();

    } catch (error) {
      toast.error('Failed to delete statement');
    }
  }

  const addFiles = useCallback((newFiles: File[]) => {
    const validFiles = newFiles.filter(file => {
      const isValid = file.type === 'application/pdf' ||
        file.type === 'text/csv' ||
        file.type.startsWith('image/') ||
        file.name.endsWith('.csv');

      if (!isValid) {
        toast.error(`Unsupported file type: ${file.name}`);
      }

      const isUnderLimit = file.size <= 50 * 1024 * 1024;
      if (!isUnderLimit) {
        toast.error(`File too large: ${file.name}`);
      }

      return isValid && isUnderLimit;
    });

    setFiles(prev => [
      ...prev,
      ...validFiles.map(file => ({
        id: crypto.randomUUID(),
        file,
        status: 'pending' as const,
        progress: 0,
        transactions: [],
        password: accounts.find(a => a.id === selectedAccountId)?.pdfPassword || '',
      })),
    ]);
  }, [selectedAccountId, accounts]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, [addFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  }, [addFiles]);



  function updateFilePassword(id: string, password: string) {
    setFiles(prev => prev.map(f =>
      f.id === id ? { ...f, password } : f
    ));
  }

  async function processFile(id: string) {
    const fileItem = files.find(f => f.id === id);
    if (!fileItem) return;

    setFiles(prev => prev.map(f =>
      f.id === id ? { ...f, status: 'processing', progress: 10 } : f
    ));

    try {
      let result;

      if (fileItem.file.name.endsWith('.csv') || fileItem.file.type === 'text/csv') {
        // Process CSV locally
        const text = await fileItem.file.text();
        setFiles(prev => prev.map(f =>
          f.id === id ? { ...f, progress: 50 } : f
        ));

        // Assume standard CSV format: Date, Description, Amount
        result = await processCSVContent(text, {
          date: 0,
          description: 1,
          amount: 2,
        });
      } else if (serverAvailable) {
        // Use Docling API for PDF/images
        try {
          setFiles(prev => prev.map(f =>
            f.id === id ? { ...f, progress: 30 } : f
          ));

          const apiResult = await processDocumentWithDocling(fileItem.file, fileItem.password || undefined);

          setFiles(prev => prev.map(f =>
            f.id === id ? { ...f, progress: 70 } : f
          ));

          result = {
            transactions: apiResult.transactions,
            validation: apiResult.validation,
            metadata: {},
            errors: [],
          };

          if (apiResult.processingMethod === 'docling') {
            toast.success('Processed with Docling AI');
          }
        } catch (error) {
          console.error('Docling API error:', error);
          toast.error('Processing failed. Please try again.');
          result = { transactions: [], metadata: {}, errors: [], validation: undefined };
        }
      } else {
        // Fallback for local processing without server
        toast.info('Start the backend server for PDF/image processing');
        result = { transactions: [], metadata: {}, errors: [], validation: undefined };
      }

      setFiles(prev => prev.map(f =>
        f.id === id ? { ...f, progress: 80 } : f
      ));

      // Check for duplicates and calculate confidence
      const processedTransactions = await Promise.all(
        result.transactions.map(async (tx) => {
          const duplicate = selectedAccountId
            ? await checkDuplicate(selectedAccountId, tx.date, tx.amount, tx.merchantRaw, tx.refNumber)
            : null;

          return {
            ...tx,
            confidenceScore: calculateConfidenceScore(tx),
            isDuplicate: !!duplicate,
            existingTransactionId: duplicate?.id,
          };
        })
      );

      setFiles(prev => prev.map(f =>
        f.id === id ? {
          ...f,
          status: 'success',
          progress: 100,
          transactions: processedTransactions,
          validation: result.validation,
        } : f
      ));

      if (processedTransactions.length > 0) {
        toast.success(`Extracted ${processedTransactions.length} transactions. Click Review to import.`);
      } else {
        toast.info('No transactions found in file');
      }
    } catch (error) {
      console.error('Processing error:', error);
      setFiles(prev => prev.map(f =>
        f.id === id ? {
          ...f,
          status: 'error',
          progress: 0,
          error: error instanceof Error ? error.message : 'Processing failed',
        } : f
      ));
      toast.error('Failed to process file');
    }
  }

  function removeFile(id: string) {
    setFiles(prev => prev.filter(f => f.id !== id));
  }

  function startReview(fileItem: ProcessedFile) {
    setReviewingFile(fileItem);
    // Select all non-duplicate transactions by default
    const nonDuplicates = new Set<number>();
    fileItem.transactions.forEach((tx, i) => {
      if (!tx.isDuplicate) nonDuplicates.add(i);
    });
    setSelectedTransactions(nonDuplicates);
  }

  function toggleTransaction(index: number) {
    setSelectedTransactions(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function toggleAll() {
    if (!reviewingFile) return;

    if (selectedTransactions.size === reviewingFile.transactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(reviewingFile.transactions.map((_, i) => i)));
    }
  }

  async function handleSaveTransactions() {
    if (!reviewingFile || !selectedAccountId) return;

    setIsSaving(true);

    try {
      const transactionsToSave = reviewingFile.transactions
        .filter((_, i) => selectedTransactions.has(i))
        .map(tx => ({
          accountId: selectedAccountId,
          date: tx.date,
          merchantRaw: tx.merchantRaw,
          merchantNormalized: normalizeMerchantName(tx.merchantRaw),
          merchantId: null,
          amount: tx.amount,
          transactionType: tx.transactionType,
          categoryId: null,
          description: tx.description,
          sourceType: 'statement' as const,
          sourceFileName: reviewingFile.file.name,
          confidenceScore: tx.confidenceScore,
          isRecurring: false,
          subscriptionId: null,
          tags: [],
          notes: null,
          refNumber: tx.refNumber,
        }));

      // If we are in review mode and user selected transactions, we allow duplicates
      // because they explicitly chose them.
      const result = await bulkCreateTransactions(transactionsToSave, { allowDuplicates: true });

      toast.success(`Added ${result.added.length} transactions${result.duplicates > 0 ? `, ${result.duplicates} duplicates skipped` : ''}`);

      // Remove the reviewed file from the list
      setFiles(prev => prev.filter(f => f !== reviewingFile));
      setReviewingFile(null);
      setSelectedTransactions(new Set());

      // Refresh statements list
      const statements = await getUploadedStatements();
      setUploadedStatements(statements);

    } catch (error) {
      toast.error('Failed to save transactions');
    } finally {
      setIsSaving(false);
    }
  }

  // Save all transactions from a file directly without review
  async function saveAllTransactions(fileItem: ProcessedFile) {
    if (!selectedAccountId) {
      toast.error('Please select an account first');
      return;
    }

    setIsSaving(true);

    try {
      const transactionsToSave = fileItem.transactions.map(tx => ({
        accountId: selectedAccountId,
        date: tx.date,
        merchantRaw: tx.merchantRaw,
        merchantNormalized: normalizeMerchantName(tx.merchantRaw),
        merchantId: null,
        amount: tx.amount,
        transactionType: tx.transactionType,
        categoryId: null,
        description: tx.description,
        sourceType: 'statement' as const,
        sourceFileName: fileItem.file.name,
        confidenceScore: tx.confidenceScore,
        isRecurring: false,
        subscriptionId: null,
        tags: [],
        notes: null,
        refNumber: tx.refNumber,
      }));

      const result = await bulkCreateTransactions(transactionsToSave);

      toast.success(`Added ${result.added.length} transactions${result.duplicates > 0 ? `, ${result.duplicates} duplicates skipped` : ''}`);

      // Remove the file from the list
      setFiles(prev => prev.filter(f => f !== fileItem));

      // Refresh statements list
      const statements = await getUploadedStatements();
      setUploadedStatements(statements);

    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save transactions');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateAccount(name: string) {
    try {
      const id = await createAccount({
        name,
        type: 'checking',
        institutionName: null,
        identifier: null,
        currency: 'INR',
        status: 'active',
        balance: null,
        notes: null,
      });
      await loadData();
      setSelectedAccountId(id);
      toast.success('Account created');
    } catch (error) {
      toast.error('Failed to create account');
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Upload"
        description="Import bank statements and receipts"
      />

      {/* Account Selection */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Label htmlFor="account">Select Account</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select an account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {accounts.length === 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  const name = prompt('Enter account name:');
                  if (name) handleCreateAccount(name);
                }}
              >
                Create Account
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upload Zone */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div
            className={cn(
              "upload-zone flex flex-col items-center justify-center min-h-[200px] text-center",
              isDragOver && "upload-zone-active"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Drop files here</h3>
            <p className="text-sm text-muted-foreground mb-4">
              or click to browse • PDF, CSV, JPEG, PNG up to 50MB
            </p>
            <input
              type="file"
              id="file-upload"
              className="hidden"
              multiple
              accept=".pdf,.csv,.jpg,.jpeg,.png"
              onChange={handleFileSelect}
            />
            <Button asChild>
              <label htmlFor="file-upload" className="cursor-pointer">
                Select Files
              </label>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* File Queue */}
      {files.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Upload Queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {files.map((fileItem, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
              >
                <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center shrink-0">
                  {fileItem.file.type === 'application/pdf' || fileItem.file.name.endsWith('.pdf') ? (
                    <FileText className="w-5 h-5 text-danger" />
                  ) : fileItem.file.type.startsWith('image/') ? (
                    <Image className="w-5 h-5 text-primary" />
                  ) : (
                    <FileText className="w-5 h-5 text-success" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{fileItem.file.name}</p>
                    {fileItem.validation?.foundFooter && (
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-medium border",
                        fileItem.validation.matches
                          ? "bg-green-500/10 text-green-500 border-green-500/20"
                          : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                      )}>
                        {fileItem.validation.matches ? "Statement Verified" : "Count Mismatch"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(fileItem.file.size)}
                    {fileItem.transactions.length > 0 && (
                      <> • {fileItem.transactions.length} transactions</>
                    )}
                  </p>
                  {fileItem.status === 'processing' && (
                    <Progress value={fileItem.progress} className="h-1 mt-2" />
                  )}
                  {fileItem.error && (
                    <p className="text-xs text-danger mt-1">{fileItem.error}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Password input for PDFs */}
                  {fileItem.status === 'pending' &&
                    (fileItem.file.type === 'application/pdf' || fileItem.file.name.endsWith('.pdf')) && (
                      <Input
                        type="password"
                        placeholder="PDF password (optional)"
                        className="w-40 h-8 text-xs"
                        value={fileItem.password || ''}
                        onChange={(e) => updateFilePassword(fileItem.id, e.target.value)}
                      />
                    )}
                  {fileItem.status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => processFile(fileItem.id)}
                      disabled={!selectedAccountId}
                    >
                      Process
                    </Button>
                  )}
                  {fileItem.status === 'processing' && (
                    <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                  {fileItem.status === 'success' && fileItem.transactions.length > 0 && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => saveAllTransactions(fileItem)}
                        disabled={isSaving || !selectedAccountId}
                      >
                        {isSaving ? 'Saving...' : 'Save All'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => startReview(fileItem)}>
                        Review
                      </Button>
                    </>
                  )}
                  {fileItem.status === 'success' && fileItem.transactions.length === 0 && (
                    <StatusBadge variant="pending">No data</StatusBadge>
                  )}
                  {fileItem.status === 'error' && (
                    <StatusBadge variant="cancelled">Failed</StatusBadge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeFile(fileItem.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Review Table */}
      {reviewingFile && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Review Transactions</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedTransactions.size} of {reviewingFile.transactions.length} selected
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setReviewingFile(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveTransactions}
                disabled={selectedTransactions.size === 0}
                isLoading={isSaving}
              >
                <Check className="w-4 h-4 mr-2" />
                Import {selectedTransactions.size} Transactions
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedTransactions.size === reviewingFile.transactions.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Merchant</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewingFile.transactions.map((tx, index) => (
                  <TableRow
                    key={index}
                    className={cn(tx.isDuplicate && "opacity-50")}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedTransactions.has(index)}
                        onCheckedChange={() => toggleTransaction(index)}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(tx.date)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {normalizeMerchantName(tx.merchantRaw)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono ${tx.transactionType === 'debit' ? 'text-danger' : 'text-success'}`}>
                        {tx.transactionType === 'debit' ? '-' : '+'}
                        {formatCurrency(tx.amount)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={tx.confidenceScore} className="h-1.5 w-16" />
                        <span className="text-xs text-muted-foreground">{tx.confidenceScore}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {tx.isDuplicate ? (
                        <StatusBadge variant="warning">Duplicate</StatusBadge>
                      ) : (
                        <StatusBadge variant="active">New</StatusBadge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Uploaded Statements History */}
      {uploadedStatements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Statements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {uploadedStatements.map((stmt) => (
                <div
                  key={stmt.sourceFileName}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{stmt.sourceFileName}</p>
                      <p className="text-sm text-muted-foreground">
                        {stmt.transactionCount} transactions
                        {stmt.dateRange && (
                          <> • {formatDate(stmt.dateRange.start)} - {formatDate(stmt.dateRange.end)}</>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Debits: {formatCurrency(stmt.totalDebits)} • Credits: {formatCurrency(stmt.totalCredits)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteStatement(stmt.sourceFileName)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {files.length === 0 && uploadedStatements.length === 0 && (
        <EmptyState
          icon={<Upload className="w-8 h-8" />}
          title="No files uploaded"
          description="Drag and drop your bank statements or receipts to get started"
        />
      )}
    </PageContainer>
  );
}

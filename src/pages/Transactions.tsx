import React, { useEffect, useState, useMemo } from 'react';
import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
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
import {
  Search,
  Filter,
  Plus,
  Download,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  CreditCard,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency, formatDate } from '@/lib/utils/formatting';
import { getTransactions, getTransactionCount, deleteTransaction } from '@/lib/db/transactions';
import { getAllCategories } from '@/lib/db/categories';
import { getAllAccounts } from '@/lib/db/accounts';
import type { Transaction, Category, Account } from '@/types/database';
import { TransactionEditDialog } from '@/components/features/transactions/TransactionEditDialog';
import { TransactionForm } from '@/components/features/transactions/TransactionForm';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';

const ITEMS_PER_PAGE = 20;

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Edit dialog
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Add transaction dialog
  const [showAddForm, setShowAddForm] = useState(false);

  // CSV Export
  function exportToCSV() {
    const headers = ['Date', 'Merchant', 'Amount', 'Type', 'Category', 'Account', 'Notes'];
    const rows = transactions.map(tx => {
      const category = categories.find(c => c.id === tx.categoryId);
      const account = accounts.find(a => a.id === tx.accountId);
      return [
        formatDate(tx.date),
        tx.merchantNormalized || tx.merchantRaw,
        tx.amount.toFixed(2),
        tx.transactionType,
        category?.name || '',
        account?.name || '',
        tx.notes || '',
      ].map(v => `"${v}"`).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Transactions exported to CSV');
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [currentPage, searchQuery, categoryFilter, accountFilter, typeFilter, dateFilter, customDateRange, minAmount, maxAmount, sortBy, sortOrder]);

  async function loadInitialData() {
    const [cats, accts] = await Promise.all([
      getAllCategories(),
      getAllAccounts(),
    ]);
    setCategories(cats);
    setAccounts(accts);
  }

  async function loadTransactions() {
    setIsLoading(true);
    try {
      // Calculate date range based on filter
      let startDate: Date | undefined;
      let endDate: Date | undefined;
      const now = new Date();

      switch (dateFilter) {
        case 'this_month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'last_month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0);
          break;
        case 'last_3_months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          endDate = now;
          break;
        case 'this_year':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = now;
          break;
        case '2025':
          startDate = new Date(2025, 0, 1);
          endDate = new Date(2025, 11, 31);
          break;
        case '2024':
          startDate = new Date(2024, 0, 1);
          endDate = new Date(2024, 11, 31);
          break;
        case 'custom':
          if (customDateRange?.from) {
            startDate = customDateRange.from;
            endDate = customDateRange.to || customDateRange.from;
          }
          break;
      }

      const filters = {
        searchQuery: searchQuery || undefined,
        categoryId: categoryFilter !== 'all' ? categoryFilter : undefined,
        accountId: accountFilter !== 'all' ? accountFilter : undefined,
        transactionType: typeFilter !== 'all' ? typeFilter as 'debit' | 'credit' : undefined,
        startDate,
        endDate,
        minAmount: minAmount ? parseFloat(minAmount) : undefined,
        maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
        sortBy,
        sortOrder,
      };

      const [txs, count] = await Promise.all([
        getTransactions(filters, ITEMS_PER_PAGE, (currentPage - 1) * ITEMS_PER_PAGE),
        getTransactionCount(filters),
      ]);

      setTransactions(txs);
      setTotalCount(count);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const getCategoryById = (id: string | null) => categories.find(c => c.id === id);
  const getAccountById = (id: string) => accounts.find(a => a.id === id);

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
      await deleteTransaction(id);
      toast.success('Transaction deleted');
      loadTransactions();
    } catch (error) {
      toast.error('Failed to delete transaction');
    }
  }

  function handleExport() {
    // Export current filtered transactions as CSV
    const headers = ['Date', 'Merchant', 'Amount', 'Type', 'Category', 'Account'];
    const rows = transactions.map(tx => [
      formatDate(tx.date, 'yyyy-MM-dd'),
      tx.merchantNormalized,
      tx.amount.toFixed(2),
      tx.transactionType,
      getCategoryById(tx.categoryId)?.name || 'Uncategorized',
      getAccountById(tx.accountId)?.name || 'Unknown',
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${formatDate(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Transactions exported');
  }

  // Tab filter options
  const tabs = [
    { value: 'all', label: 'All' },
    { value: 'credit', label: 'Income' },
    { value: 'debit', label: 'Outcome' },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Transactions"
        description={`${totalCount} total transactions`}
      >
        <Button variant="outline" onClick={handleExport} disabled={transactions.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
        <Button onClick={() => setShowAddForm(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          Add Transaction
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Tabs and Filters */}
          <Card className="border-0 bg-card">
            <CardContent className="pt-6">
              {/* Tab Pills */}
              <div className="flex items-center gap-2 mb-4">
                {tabs.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => { setTypeFilter(tab.value); setCurrentPage(1); }}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                      typeFilter === tab.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search transactions..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-10 bg-muted border-0"
                    />
                  </div>
                </div>

                <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-[180px] bg-muted border-0">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={accountFilter} onValueChange={(v) => { setAccountFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-[180px] bg-muted border-0">
                    <SelectValue placeholder="Account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Date Filter */}
                <div className="flex items-center gap-2">
                  <Select
                    value={dateFilter}
                    onValueChange={(v) => { setDateFilter(v); setCurrentPage(1); }}
                  >
                    <SelectTrigger className="w-[180px] bg-muted border-0">
                      <SelectValue placeholder="Date Range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="this_month">This Month</SelectItem>
                      <SelectItem value="last_month">Last Month</SelectItem>
                      <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                      <SelectItem value="this_year">This Year</SelectItem>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2024">2024</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>

                  {dateFilter === 'custom' && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          id="date"
                          className={cn(
                            "w-[260px] justify-start text-left font-normal bg-muted border-0",
                            !customDateRange && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customDateRange?.from ? (
                            customDateRange.to ? (
                              <>
                                {format(customDateRange.from, "LLL dd, y")} -{" "}
                                {format(customDateRange.to, "LLL dd, y")}
                              </>
                            ) : (
                              format(customDateRange.from, "LLL dd, y")
                            )
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={customDateRange?.from}
                          selected={customDateRange}
                          onSelect={setCustomDateRange}
                          numberOfMonths={2}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                {/* Amount Filter */}
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Min ₹"
                    value={minAmount}
                    onChange={(e) => { setMinAmount(e.target.value); setCurrentPage(1); }}
                    className="w-[100px] bg-muted border-0"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="number"
                    placeholder="Max ₹"
                    value={maxAmount}
                    onChange={(e) => { setMaxAmount(e.target.value); setCurrentPage(1); }}
                    className="w-[100px] bg-muted border-0"
                  />
                </div>

                {/* Sort Controls */}
                <div className="flex items-center gap-2">
                  <Select value={sortBy} onValueChange={(v) => { setSortBy(v as 'date' | 'amount'); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[140px] bg-muted border-0">
                      <div className="flex items-center gap-2">
                        <ArrowUpDown className="w-4 h-4" />
                        <SelectValue placeholder="Sort By" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="amount">Amount</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); setCurrentPage(1); }}
                    className="bg-muted hover:bg-muted/80"
                  >
                    {sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transactions Table */}
          <Card className="border-0 bg-card">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : transactions.length > 0 ? (
                <>
                  <div className="overflow-x-auto no-scrollbar">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-muted-foreground font-medium">Name</TableHead>
                          <TableHead className="text-muted-foreground font-medium">Transaction ID</TableHead>
                          <TableHead className="text-muted-foreground font-medium">Card</TableHead>
                          <TableHead className="text-muted-foreground font-medium">Date</TableHead>
                          <TableHead className="text-muted-foreground font-medium">Method</TableHead>
                          <TableHead className="text-right text-muted-foreground font-medium">Amount</TableHead>
                          <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((tx) => {
                          const category = getCategoryById(tx.categoryId);
                          const account = getAccountById(tx.accountId);

                          return (
                            <TableRow key={tx.id} className="group border-border hover:bg-muted/30">
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-medium shrink-0"
                                    style={{
                                      backgroundColor: `${category?.color || '#6B7280'}15`,
                                      color: category?.color || '#6B7280'
                                    }}
                                  >
                                    {(tx.merchantNormalized || tx.merchantRaw || '?').charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-medium truncate max-w-[180px]">{tx.merchantNormalized || tx.merchantRaw || 'Unknown'}</p>
                                    {category && (
                                      <p className="text-xs text-muted-foreground truncate">{category.name}</p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground font-mono text-sm">
                                #{tx.id.slice(0, 8).toUpperCase()}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                  <CreditCard className="w-4 h-4" />
                                  ****{account?.name?.slice(-4) || '0000'}
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {formatDate(tx.date, 'dd MMM, h:mma')}
                              </TableCell>
                              <TableCell>
                                {tx.paymentMethod === 'UPI' ? (
                                  <span className="badge-method badge-upi">UPI</span>
                                ) : (
                                  <span className="badge-method badge-other">OTHER</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={cn(
                                  "font-mono font-medium",
                                  tx.transactionType === 'debit' ? 'text-foreground' : 'text-success'
                                )}>
                                  {tx.transactionType === 'debit' ? '-' : '+'}
                                  ₹{tx.amount.toFixed(2)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setEditingTransaction(tx)}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-danger hover:text-danger"
                                    onClick={() => handleDelete(tx.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                      <p className="text-sm text-muted-foreground">
                        Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="border-0 bg-muted"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-sm">
                          Page {currentPage} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="border-0 bg-muted"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-8">
                  <EmptyState
                    icon={<Receipt className="w-8 h-8" />}
                    title="No transactions found"
                    description={searchQuery || categoryFilter !== 'all' || accountFilter !== 'all'
                      ? "Try adjusting your filters"
                      : "Upload your first bank statement to get started"
                    }
                    action={
                      !searchQuery && categoryFilter === 'all' && accountFilter === 'all' && (
                        <Button asChild className="bg-primary hover:bg-primary/90">
                          <Link to="/upload">Upload Statement</Link>
                        </Button>
                      )
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar - Invoices */}
        <div className="space-y-6">
          <Card className="border-0 bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {transactions.slice(0, 5).map((tx) => {
                  const category = getCategoryById(tx.categoryId);
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-medium"
                          style={{
                            backgroundColor: `${category?.color || '#6B7280'}15`,
                            color: category?.color || '#6B7280'
                          }}
                        >
                          {(tx.merchantNormalized || tx.merchantRaw || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate max-w-[140px]">{tx.merchantNormalized || tx.merchantRaw || 'Unknown'}</p>
                            {tx.paymentMethod === 'UPI' && (
                              <span className="badge-method badge-upi shrink-0">UPI</span>
                            )}
                            {tx.paymentMethod !== 'UPI' && tx.paymentMethod && (
                              <span className="badge-method badge-other shrink-0">OTH</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(tx.date, 'dd MMM')}
                          </p>
                        </div>
                      </div>
                      <span className="font-mono text-sm font-medium">
                        ₹{tx.amount.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
                {transactions.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No invoices yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      {editingTransaction && (
        <TransactionEditDialog
          transaction={editingTransaction}
          categories={categories}
          accounts={accounts}
          onClose={() => setEditingTransaction(null)}
          onSave={() => {
            setEditingTransaction(null);
            loadTransactions();
          }}
        />
      )}

      {/* Add Transaction Form */}
      <TransactionForm
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        onSaved={loadTransactions}
        accounts={accounts}
        categories={categories}
      />
    </PageContainer>
  );
}

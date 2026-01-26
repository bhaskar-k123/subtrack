import React, { useEffect, useState } from 'react';
import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { MonthSelector } from '@/components/ui/month-selector';
import {
  ArrowRight,
  Calendar,
  Repeat,
  Plus,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency, formatDate, formatRelativeDate } from '@/lib/utils/formatting';
import { startOfMonth, endOfMonth, subMonths } from '@/lib/utils/dates';
import { getTransactions, getRecentTransactions } from '@/lib/db/transactions';
import { getSubscriptionMetrics, getUpcomingRenewals } from '@/lib/db/subscriptions';
import { getCategorySpending } from '@/lib/db/categories';
import { SpendingTrendChart } from '@/components/charts/SpendingTrendChart';
import { CategoryDonutChart } from '@/components/charts/CategoryDonutChart';
import type { TransactionWithDetails, SubscriptionWithDetails } from '@/types/database';

// Financial goals will be loaded from database in future update

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalSpending: 0,
    monthChange: 0,
    subscriptionCost: 0,
    subscriptionCount: 0,
    transactionCount: 0,
    totalIncome: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<TransactionWithDetails[]>([]);
  const [upcomingRenewals, setUpcomingRenewals] = useState<SubscriptionWithDetails[]>([]);
  const [categorySpending, setCategorySpending] = useState<{ name: string; value: number; color: string }[]>([]);
  const [monthlySpending, setMonthlySpending] = useState<{ month: string; amount: number }[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  useEffect(() => {
    loadDashboardData();
  }, [selectedMonth]);

  async function loadDashboardData() {
    try {
      const now = new Date();
      const currentMonthStart = startOfMonth(selectedMonth);
      const currentMonthEnd = endOfMonth(selectedMonth);
      const lastMonthStart = startOfMonth(subMonths(selectedMonth, 1));
      const lastMonthEnd = endOfMonth(subMonths(selectedMonth, 1));

      const currentMonthTxs = await getTransactions({
        startDate: currentMonthStart,
        endDate: currentMonthEnd,
        transactionType: 'debit',
      }, 10000, 0);

      const currentSpending = currentMonthTxs.reduce((sum, tx) => sum + tx.amount, 0);

      const incomeTxs = await getTransactions({
        startDate: currentMonthStart,
        endDate: currentMonthEnd,
        transactionType: 'credit',
      }, 10000, 0);
      const totalIncome = incomeTxs.reduce((sum, tx) => sum + tx.amount, 0);

      const lastMonthTxs = await getTransactions({
        startDate: lastMonthStart,
        endDate: lastMonthEnd,
        transactionType: 'debit',
      }, 10000, 0);

      const lastSpending = lastMonthTxs.reduce((sum, tx) => sum + tx.amount, 0);
      const monthChange = lastSpending > 0
        ? ((currentSpending - lastSpending) / lastSpending) * 100
        : 0;

      const subMetrics = await getSubscriptionMetrics();
      const recent = await getRecentTransactions(4);
      const upcoming = await getUpcomingRenewals(30);

      const catSpending = await getCategorySpending(currentMonthStart, currentMonthEnd);
      const categoryData = catSpending.map(item => ({
        name: item.category.name,
        value: item.total,
        color: item.category.color,
      }));

      const monthlyData: { month: string; amount: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const monthStart = startOfMonth(subMonths(now, i));
        const monthEnd = endOfMonth(subMonths(now, i));
        const txs = await getTransactions({
          startDate: monthStart,
          endDate: monthEnd,
          transactionType: 'debit',
        }, 10000, 0);
        const total = txs.reduce((sum, tx) => sum + tx.amount, 0);
        monthlyData.push({
          month: formatDate(monthStart, 'MMM'),
          amount: total,
        });
      }

      setMetrics({
        totalSpending: currentSpending,
        monthChange,
        subscriptionCost: subMetrics.totalMonthly,
        subscriptionCount: subMetrics.activeCount,
        transactionCount: currentMonthTxs.length,
        totalIncome,
      });

      setRecentTransactions(recent);
      setUpcomingRenewals(upcoming);
      setCategorySpending(categoryData);
      setMonthlySpending(monthlyData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-6 animate-pulse">
          <div className="h-10 w-48 bg-muted rounded-lg" />
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-9 h-[500px] bg-muted rounded-2xl" />
            <div className="col-span-3 h-[500px] bg-muted rounded-2xl" />
          </div>
        </div>
      </PageContainer>
    );
  }

  // Calculate balances from actual data
  const totalBalance = metrics.totalIncome - metrics.totalSpending;
  const mainBalance = totalBalance;
  const creditBalance = 0;

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your payments and transactions in one click</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="bg-card border-border text-foreground hover:bg-muted">
            <Plus className="w-4 h-4 mr-2" />
            Add widget
          </Button>
          <div className="flex items-center gap-2">
            <MonthSelector
              currentMonth={selectedMonth}
              onChange={setSelectedMonth}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Column - Main Content */}
        <div className="col-span-12 lg:col-span-9 space-y-6">
          {/* Balance Row */}
          <div className="grid grid-cols-12 gap-6">
            {/* Total Balance Card */}
            <div className="col-span-5 bg-card border border-border rounded-2xl p-6">
              <p className="text-muted-foreground text-sm mb-2">Total balance</p>
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-4xl font-bold font-mono tracking-tight">₹{totalBalance.toLocaleString()}</span>
                {metrics.monthChange !== 0 && (
                  <span className={`text-sm font-medium ${metrics.monthChange > 0 ? 'text-danger' : 'text-success'}`}>
                    {metrics.monthChange > 0 ? '↑' : '↓'} {Math.abs(metrics.monthChange).toFixed(0)}%
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <Button className="bg-muted hover:bg-muted/80 text-foreground font-medium flex-1">
                  Deposit
                </Button>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium flex-1">
                  Transfer
                </Button>
              </div>

              {/* Sub balances */}
              <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-border">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Main balance</p>
                  <p className="font-semibold font-mono">₹{mainBalance.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Credit balance</p>
                  <p className="font-semibold font-mono">₹{creditBalance.toLocaleString()}</p>
                </div>
              </div>

              {/* Spending progress - based on actual spending vs income */}
              {metrics.totalIncome > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-muted-foreground">₹{metrics.totalSpending.toLocaleString()} spent this month</span>
                    <span className="font-medium">{Math.min(100, Math.round((metrics.totalSpending / metrics.totalIncome) * 100))}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, (metrics.totalSpending / metrics.totalIncome) * 100)}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* Income/Outcome Chart */}
            <div className="col-span-7 bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-full bg-primary"></span>
                    Income
                  </span>
                  <span className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-full bg-danger"></span>
                    Outcome
                  </span>
                </div>
                <span className="text-muted-foreground text-sm">Year ▼</span>
              </div>

              {monthlySpending.some(m => m.amount > 0) ? (
                <SpendingTrendChart data={monthlySpending} />
              ) : (
                <div className="h-64 flex items-center justify-center">
                  <EmptyState
                    variant="minimal"
                    size="sm"
                    title="No spending data"
                    description="Upload bank statements to see trends"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-2 gap-6">
            {/* Financial Goals - Coming Soon */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4">Financial goals</h3>
              <EmptyState
                variant="minimal"
                size="sm"
                title="No goals set"
                description="Financial goals feature coming soon"
              />
            </div>

            {/* Your Spendings */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Your spendings</h3>
                <span className="text-muted-foreground text-sm">Month ▼</span>
              </div>
              {categorySpending.length > 0 ? (
                <CategoryDonutChart data={categorySpending} />
              ) : (
                <EmptyState
                  variant="minimal"
                  size="sm"
                  title="No categories"
                  description="Categorize transactions to see breakdown"
                />
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Cards & Info */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
          {/* Your Cards - Placeholder until card management is implemented */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4">Your cards</h3>
            <EmptyState
              variant="minimal"
              size="sm"
              title="No cards linked"
              description="Card management coming soon"
            />
          </div>

          {/* Recent Transactions */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4">Recent transaction</h3>
            {recentTransactions.length > 0 ? (
              <div className="space-y-3">
                {recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold"
                        style={{
                          backgroundColor: `${tx.category?.color || '#6B7280'}20`,
                          color: tx.category?.color || '#6B7280'
                        }}
                      >
                        {tx.merchantNormalized.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{tx.merchantNormalized}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeDate(tx.date)}
                        </p>
                      </div>
                    </div>
                    <span className={`font-mono text-sm font-medium ${tx.transactionType === 'debit' ? '' : 'text-success'}`}>
                      {tx.transactionType === 'debit' ? '-' : '+'}₹{tx.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No recent transactions</p>
            )}
          </div>

          {/* Monthly Spending Summary */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4">Monthly summary</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Transactions</span>
                <span className="font-medium">{metrics.transactionCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subscriptions</span>
                <span className="font-medium">{metrics.subscriptionCount} active</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subscription cost</span>
                <span className="font-medium">₹{metrics.subscriptionCost.toFixed(2)}/mo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

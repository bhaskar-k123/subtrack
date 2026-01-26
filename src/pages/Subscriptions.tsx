import React, { useEffect, useState } from 'react';
import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { ProgressCircle } from '@/components/ui/progress-circle';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Repeat,
  IndianRupee,
  Calendar,
  TrendingUp,
  Sparkles,
  Check,
  X,
  Target,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils/formatting';
import {
  getSubscriptionsWithDetails,
  getSubscriptionMetrics,
  detectSubscriptions,
  saveDetectedSubscriptions,
  updateSubscription,
  deleteSubscription,
} from '@/lib/db/subscriptions';
import type { SubscriptionWithDetails, Subscription } from '@/types/database';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithDetails[]>([]);
  const [metrics, setMetrics] = useState({
    totalMonthly: 0,
    totalAnnual: 0,
    activeCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');

  // Detection state
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedSubscriptions, setDetectedSubscriptions] = useState<Subscription[]>([]);
  const [showDetectionDialog, setShowDetectionDialog] = useState(false);

  // Detail view
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionWithDetails | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [subs, metricsData] = await Promise.all([
        getSubscriptionsWithDetails(),
        getSubscriptionMetrics(),
      ]);
      setSubscriptions(subs);
      setMetrics(metricsData);
    } catch (error) {
      console.error('Failed to load subscriptions:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDetect() {
    setIsDetecting(true);
    try {
      const detected = await detectSubscriptions();
      if (detected.length > 0) {
        setDetectedSubscriptions(detected);
        setShowDetectionDialog(true);
      } else {
        toast.info('No new subscriptions detected');
      }
    } catch (error) {
      toast.error('Detection failed');
    } finally {
      setIsDetecting(false);
    }
  }

  async function handleSaveDetected() {
    try {
      await saveDetectedSubscriptions(detectedSubscriptions);
      toast.success(`${detectedSubscriptions.length} subscriptions added`);
      setShowDetectionDialog(false);
      setDetectedSubscriptions([]);
      loadData();
    } catch (error) {
      toast.error('Failed to save subscriptions');
    }
  }

  async function handleStatusChange(id: string, status: Subscription['status']) {
    try {
      await updateSubscription(id, { status });
      toast.success('Status updated');
      loadData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this subscription?')) return;
    try {
      await deleteSubscription(id);
      toast.success('Subscription deleted');
      setSelectedSubscription(null);
      loadData();
    } catch (error) {
      toast.error('Failed to delete subscription');
    }
  }

  const filteredSubscriptions = subscriptions
    .filter(sub => statusFilter === 'all' || sub.status === statusFilter)
    .sort((a, b) => {
      switch (sortBy) {
        case 'amount':
          return b.averageAmount - a.averageAmount;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'next':
          if (!a.nextExpectedDate) return 1;
          if (!b.nextExpectedDate) return -1;
          return new Date(a.nextExpectedDate).getTime() - new Date(b.nextExpectedDate).getTime();
        default:
          return 0;
      }
    });

  // Tab options
  const tabs = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-6 animate-pulse">
          <div className="h-10 w-48 bg-muted rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-2xl" />
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Subscriptions"
        description="Track your recurring payments"
      >
        <Button
          onClick={handleDetect}
          isLoading={isDetecting}
          className="bg-primary hover:bg-primary/90"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Detect Subscriptions
        </Button>
      </PageHeader>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-0 bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
                <IndianRupee className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Cost</p>
                <p className="text-2xl font-bold font-mono">{formatCurrency(metrics.totalMonthly)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-success/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Annual Cost</p>
                <p className="text-2xl font-bold font-mono">{formatCurrency(metrics.totalAnnual)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-secondary/20 flex items-center justify-center">
                <Repeat className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Subscriptions</p>
                <p className="text-2xl font-bold">{metrics.activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        {/* Tab Pills */}
        <div className="flex items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                statusFilter === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[150px] bg-muted border-0">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="amount">Amount</SelectItem>
            <SelectItem value="next">Next Billing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Subscriptions Grid */}
      {filteredSubscriptions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSubscriptions.map((sub) => {
            // Calculate days until next billing
            const daysUntil = sub.nextExpectedDate
              ? Math.ceil((new Date(sub.nextExpectedDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null;
            // Progress through billing cycle (rough estimate)
            const cycleProgress = sub.billingFrequency === 'monthly'
              ? ((30 - (daysUntil || 0)) / 30) * 100
              : ((365 - (daysUntil || 0)) / 365) * 100;

            return (
              <Card
                key={sub.id}
                className="border-0 bg-card hover:bg-card-elevated transition-colors cursor-pointer"
                onClick={() => setSelectedSubscription(sub)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-secondary/30 to-primary/30 flex items-center justify-center">
                        <Repeat className="w-6 h-6 text-secondary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{sub.name}</h3>
                        <StatusBadge
                          variant={sub.status as 'active' | 'paused' | 'cancelled'}
                          className="mt-1"
                        >
                          {sub.status}
                        </StatusBadge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-end justify-between">
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold font-mono">
                          {formatCurrency(sub.averageAmount)}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          /{sub.billingFrequency === 'monthly' ? 'mo' : sub.billingFrequency}
                        </span>
                      </div>

                      {sub.nextExpectedDate && sub.status === 'active' && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2">
                          <Calendar className="w-4 h-4" />
                          Next: {formatDate(sub.nextExpectedDate)}
                        </div>
                      )}
                    </div>

                    {sub.status === 'active' && (
                      <ProgressCircle
                        value={Math.min(100, Math.max(0, cycleProgress))}
                        size="sm"
                        showValue={false}
                        color="hsl(var(--primary))"
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Repeat className="w-8 h-8" />}
          title="No subscriptions found"
          description={statusFilter !== 'all'
            ? "Try adjusting your filter"
            : "Click 'Detect Subscriptions' to find recurring payments"
          }
          action={
            statusFilter === 'all' && (
              <Button onClick={handleDetect} isLoading={isDetecting} className="bg-primary hover:bg-primary/90">
                <Sparkles className="w-4 h-4 mr-2" />
                Detect Subscriptions
              </Button>
            )
          }
        />
      )}

      {/* Detection Dialog */}
      <Dialog open={showDetectionDialog} onOpenChange={setShowDetectionDialog}>
        <DialogContent className="sm:max-w-[500px] border-0">
          <DialogHeader>
            <DialogTitle>Detected Subscriptions</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {detectedSubscriptions.map((sub, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 rounded-xl bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
                    <Repeat className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <p className="font-medium">{sub.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(sub.averageAmount)}/{sub.billingFrequency}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-danger"
                  onClick={() => {
                    setDetectedSubscriptions(prev => prev.filter((_, j) => j !== i));
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDetectionDialog(false)} className="border-0 bg-muted">
              Cancel
            </Button>
            <Button onClick={handleSaveDetected} disabled={detectedSubscriptions.length === 0} className="bg-primary hover:bg-primary/90">
              <Check className="w-4 h-4 mr-2" />
              Add {detectedSubscriptions.length} Subscriptions
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selectedSubscription} onOpenChange={() => setSelectedSubscription(null)}>
        <DialogContent className="sm:max-w-[500px] border-0">
          {selectedSubscription && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
                    <Repeat className="w-5 h-5 text-secondary" />
                  </div>
                  {selectedSubscription.name}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <span className="text-muted-foreground">Status</span>
                  <Select
                    value={selectedSubscription.status}
                    onValueChange={(v) => handleStatusChange(selectedSubscription.id, v as Subscription['status'])}
                  >
                    <SelectTrigger className="w-[120px] border-0 bg-transparent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-mono font-medium">
                    {formatCurrency(selectedSubscription.averageAmount)}/{selectedSubscription.billingFrequency}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <span className="text-muted-foreground">First Charge</span>
                  <span>{formatDate(selectedSubscription.firstChargeDate)}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <span className="text-muted-foreground">Last Charge</span>
                  <span>{formatDate(selectedSubscription.lastChargeDate)}</span>
                </div>

                {selectedSubscription.nextExpectedDate && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                    <span className="text-muted-foreground">Next Expected</span>
                    <span>{formatDate(selectedSubscription.nextExpectedDate)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <span className="text-muted-foreground">Account</span>
                  <span>{selectedSubscription.account?.name || '—'}</span>
                </div>

                <div className="pt-4">
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => handleDelete(selectedSubscription.id)}
                  >
                    Delete Subscription
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

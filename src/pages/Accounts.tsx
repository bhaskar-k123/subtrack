import React, { useEffect, useState } from 'react';
import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Wallet,
  Plus,
  Pencil,
  Trash2,
  Building2,
  CreditCard,
  PiggyBank,
  Banknote,
} from 'lucide-react';
import { formatCurrency, formatDate, pluralize } from '@/lib/utils/formatting';
import {
  getAllAccounts,
  createAccount,
  updateAccount,
  deleteAccount
} from '@/lib/db/accounts';
import type { Account } from '@/types/database';
import { toast } from 'sonner';

const ACCOUNT_ICONS = {
  checking: Banknote,
  savings: PiggyBank,
  credit: CreditCard,
  wallet: Wallet,
};

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'checking' as Account['type'],
    institutionName: '',
    identifier: '',
    currency: 'USD',
    notes: '',
    pdfPassword: '',
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    setIsLoading(true);
    try {
      const data = await getAllAccounts();
      setAccounts(data);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function openCreateDialog() {
    setEditingAccount(null);
    setFormData({
      name: '',
      type: 'checking',
      institutionName: '',
      identifier: '',
      currency: 'USD',
      notes: '',
      pdfPassword: '',
    });
    setShowDialog(true);
  }

  function openEditDialog(account: Account) {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      type: account.type,
      institutionName: account.institutionName || '',
      identifier: account.identifier || '',
      currency: account.currency,
      notes: account.notes || '',
      pdfPassword: account.pdfPassword || '',
    });
    setShowDialog(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (editingAccount) {
        await updateAccount(editingAccount.id, {
          name: formData.name,
          type: formData.type,
          institutionName: formData.institutionName || null,
          identifier: formData.identifier || null,
          currency: formData.currency,
          notes: formData.notes || null,
          pdfPassword: formData.pdfPassword || null,
        });
        toast.success('Account updated');
      } else {
        await createAccount({
          name: formData.name,
          type: formData.type,
          institutionName: formData.institutionName || null,
          identifier: formData.identifier || null,
          currency: formData.currency,
          status: 'active',
          balance: null,
          notes: formData.notes || null,
          pdfPassword: formData.pdfPassword || null,
        });
        toast.success('Account created');
      }
      setShowDialog(false);
      loadAccounts();
    } catch (error) {
      toast.error('Failed to save account');
    }
  }

  async function handleDelete(account: Account) {
    const hasTransactions = account.transactionCount > 0;
    const message = hasTransactions
      ? `This account has ${account.transactionCount} transactions. Delete anyway?`
      : 'Are you sure you want to delete this account?';

    if (!confirm(message)) return;

    try {
      await deleteAccount(account.id, true);
      toast.success('Account deleted');
      loadAccounts();
    } catch (error) {
      toast.error('Failed to delete account');
    }
  }

  async function handleToggleStatus(account: Account) {
    const newStatus = account.status === 'active' ? 'closed' : 'active';
    try {
      await updateAccount(account.id, { status: newStatus });
      toast.success(`Account ${newStatus === 'active' ? 'activated' : 'closed'}`);
      loadAccounts();
    } catch (error) {
      toast.error('Failed to update status');
    }
  }

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-6 animate-pulse">
          <div className="h-10 w-48 bg-muted rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Accounts"
        description="Manage your bank accounts and cards"
      >
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </Button>
      </PageHeader>

      {accounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => {
            const Icon = ACCOUNT_ICONS[account.type];

            return (
              <Card
                key={account.id}
                className={`relative group ${account.status === 'closed' ? 'opacity-60' : ''}`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        variant={account.status === 'active' ? 'active' : 'cancelled'}
                      >
                        {account.status}
                      </StatusBadge>
                    </div>
                  </div>

                  <h3 className="font-semibold text-lg mb-1">{account.name}</h3>

                  {account.institutionName && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
                      <Building2 className="w-3.5 h-3.5" />
                      {account.institutionName}
                      {account.identifier && ` •••${account.identifier}`}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-border mt-3">
                    <span className="text-sm text-muted-foreground">
                      {account.transactionCount} {pluralize(account.transactionCount, 'transaction')}
                    </span>
                    {account.lastProcessedDate && (
                      <span className="text-xs text-muted-foreground">
                        Last: {formatDate(account.lastProcessedDate, 'MMM d')}
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(account)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-danger hover:text-danger"
                      onClick={() => handleDelete(account)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Wallet className="w-8 h-8" />}
          title="No accounts yet"
          description="Add your bank accounts to start tracking transactions"
          action={
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Account
            </Button>
          }
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? 'Edit Account' : 'Add Account'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Account Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Chase Checking"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Account Type</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData(prev => ({ ...prev, type: v as Account['type'] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="credit">Credit Card</SelectItem>
                  <SelectItem value="wallet">Digital Wallet</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="institution">Institution</Label>
              <Input
                id="institution"
                value={formData.institutionName}
                onChange={(e) => setFormData(prev => ({ ...prev, institutionName: e.target.value }))}
                placeholder="e.g., Chase Bank"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="identifier">Last 4 Digits</Label>
              <Input
                id="identifier"
                value={formData.identifier}
                onChange={(e) => setFormData(prev => ({ ...prev, identifier: e.target.value.slice(0, 4) }))}
                placeholder="1234"
                maxLength={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pdfPassword">Default PDF Password (Optional)</Label>
              <Input
                id="pdfPassword"
                type="password"
                value={formData.pdfPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, pdfPassword: e.target.value }))}
                placeholder="Auto-unlock statements"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(v) => setFormData(prev => ({ ...prev, currency: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                  <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                  <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingAccount ? 'Save Changes' : 'Add Account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

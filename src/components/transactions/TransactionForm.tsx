import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from 'lucide-react';
import { createTransaction } from '@/lib/db/transactions';
import { normalizeMerchantName } from '@/lib/db/merchants';
import type { Account, Category } from '@/types/database';
import { toast } from 'sonner';

interface TransactionFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    accounts: Account[];
    categories: Category[];
}

export function TransactionForm({
    isOpen,
    onClose,
    onSaved,
    accounts,
    categories
}: TransactionFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        merchant: '',
        amount: '',
        type: 'debit' as 'debit' | 'credit',
        accountId: accounts[0]?.id || '',
        categoryId: '',
        notes: '',
    });

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!formData.merchant || !formData.amount || !formData.accountId) {
            toast.error('Please fill in all required fields');
            return;
        }

        setIsLoading(true);

        try {
            await createTransaction({
                accountId: formData.accountId,
                date: new Date(formData.date),
                merchantRaw: formData.merchant,
                merchantNormalized: normalizeMerchantName(formData.merchant),
                merchantId: null,
                amount: parseFloat(formData.amount),
                transactionType: formData.type,
                categoryId: formData.categoryId || null,
                description: null,
                sourceType: 'manual',
                sourceFileName: null,
                confidenceScore: 100,
                isRecurring: false,
                subscriptionId: null,
                tags: [],
                notes: formData.notes || null,
            });

            toast.success('Transaction added');
            onSaved();
            onClose();

            // Reset form
            setFormData({
                date: new Date().toISOString().split('T')[0],
                merchant: '',
                amount: '',
                type: 'debit',
                accountId: accounts[0]?.id || '',
                categoryId: '',
                notes: '',
            });
        } catch (error) {
            toast.error('Failed to add transaction');
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[450px] border-0">
                <DialogHeader>
                    <DialogTitle>Add Transaction</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    {/* Date */}
                    <div>
                        <Label htmlFor="date">Date *</Label>
                        <Input
                            id="date"
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                            className="mt-1.5"
                        />
                    </div>

                    {/* Merchant */}
                    <div>
                        <Label htmlFor="merchant">Merchant *</Label>
                        <Input
                            id="merchant"
                            placeholder="e.g., Amazon, Starbucks"
                            value={formData.merchant}
                            onChange={(e) => setFormData(prev => ({ ...prev, merchant: e.target.value }))}
                            className="mt-1.5"
                        />
                    </div>

                    {/* Amount and Type */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="amount">Amount *</Label>
                            <Input
                                id="amount"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={formData.amount}
                                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                                className="mt-1.5"
                            />
                        </div>
                        <div>
                            <Label htmlFor="type">Type</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(v) => setFormData(prev => ({ ...prev, type: v as 'debit' | 'credit' }))}
                            >
                                <SelectTrigger className="mt-1.5">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="debit">Expense</SelectItem>
                                    <SelectItem value="credit">Income</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Account */}
                    <div>
                        <Label htmlFor="account">Account *</Label>
                        <Select
                            value={formData.accountId}
                            onValueChange={(v) => setFormData(prev => ({ ...prev, accountId: v }))}
                        >
                            <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                            <SelectContent>
                                {accounts.map(acc => (
                                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Category */}
                    <div>
                        <Label htmlFor="category">Category</Label>
                        <Select
                            value={formData.categoryId}
                            onValueChange={(v) => setFormData(prev => ({ ...prev, categoryId: v }))}
                        >
                            <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="Select category (optional)" />
                            </SelectTrigger>
                            <SelectContent>
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
                    </div>

                    {/* Notes */}
                    <div>
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            placeholder="Optional notes..."
                            value={formData.notes}
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            className="mt-1.5"
                            rows={2}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isLoading}>
                            Add Transaction
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

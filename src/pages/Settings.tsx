import React, { useEffect, useState } from 'react';
import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Settings as SettingsIcon,
  Palette,
  Database,
  Download,
  Upload,
  Trash2,
  Shield,
  Info,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { exportData, importData, clearAllData, getDatabaseStats } from '@/lib/db/settings';
import { getAllCategories } from '@/lib/db/categories';
import type { Category, BackupData } from '@/types/database';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils/formatting';

export default function Settings() {
  const { theme, setTheme, currency, setCurrency, dateFormat, setDateFormat } = useAppStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [dbStats, setDbStats] = useState({
    accounts: 0,
    transactions: 0,
    merchants: 0,
    subscriptions: 0,
    categories: 0,
    estimatedSize: '0 KB',
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [cats, stats] = await Promise.all([
      getAllCategories(),
      getDatabaseStats(),
    ]);
    setCategories(cats);
    setDbStats(stats);
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const data = await exportData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `subtrack-backup-${formatDate(new Date(), 'yyyy-MM-dd')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup exported successfully');
    } catch (error) {
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as BackupData;

      // Convert date strings back to Date objects
      if (data.transactions) {
        data.transactions = data.transactions.map(tx => ({
          ...tx,
          date: new Date(tx.date),
          createdAt: new Date(tx.createdAt),
          updatedAt: new Date(tx.updatedAt),
        }));
      }
      if (data.subscriptions) {
        data.subscriptions = data.subscriptions.map(sub => ({
          ...sub,
          firstChargeDate: new Date(sub.firstChargeDate),
          lastChargeDate: new Date(sub.lastChargeDate),
          nextExpectedDate: sub.nextExpectedDate ? new Date(sub.nextExpectedDate) : null,
          createdAt: new Date(sub.createdAt),
          updatedAt: new Date(sub.updatedAt),
          priceHistory: sub.priceHistory.map(ph => ({ ...ph, date: new Date(ph.date) })),
        }));
      }
      if (data.accounts) {
        data.accounts = data.accounts.map(acc => ({
          ...acc,
          lastProcessedDate: acc.lastProcessedDate ? new Date(acc.lastProcessedDate) : null,
          createdAt: new Date(acc.createdAt),
          updatedAt: new Date(acc.updatedAt),
        }));
      }

      const result = await importData(data);

      if (result.success) {
        toast.success(result.message);
        loadData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Invalid backup file');
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  }

  async function handleClearData() {
    try {
      await clearAllData();
      toast.success('All data cleared');
      loadData();
    } catch (error) {
      toast.error('Failed to clear data');
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Configure your SubTrack preferences"
      />

      <div className="space-y-6 max-w-2xl">
        {/* Appearance */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              <CardTitle>Appearance</CardTitle>
            </div>
            <CardDescription>Customize how SubTrack looks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Theme</Label>
                <p className="text-sm text-muted-foreground">Select your preferred theme</p>
              </div>
              <Select value={theme} onValueChange={(v) => setTheme(v as typeof theme)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-primary" />
              <CardTitle>Preferences</CardTitle>
            </div>
            <CardDescription>General application settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Currency</Label>
                <p className="text-sm text-muted-foreground">Default currency for amounts</p>
              </div>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INR">INR (₹)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                  <SelectItem value="CAD">CAD ($)</SelectItem>
                  <SelectItem value="AUD">AUD ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Date Format</Label>
                <p className="text-sm text-muted-foreground">How dates are displayed</p>
              </div>
              <Select value={dateFormat} onValueChange={setDateFormat}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Categories */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              <CardTitle>Categories</CardTitle>
            </div>
            <CardDescription>Transaction categories ({categories.length} total)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <div
                  key={cat.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
                  style={{
                    backgroundColor: `${cat.color}15`,
                    color: cat.color,
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  {cat.name}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              <CardTitle>Data Management</CardTitle>
            </div>
            <CardDescription>
              {dbStats.transactions} transactions • {dbStats.accounts} accounts • {dbStats.estimatedSize}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Export Backup</Label>
                <p className="text-sm text-muted-foreground">Download all your data as JSON</p>
              </div>
              <Button variant="outline" onClick={handleExport} isLoading={isExporting}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Import Backup</Label>
                <p className="text-sm text-muted-foreground">Restore from a backup file</p>
              </div>
              <div>
                <input
                  type="file"
                  id="import-file"
                  className="hidden"
                  accept=".json"
                  onChange={handleImport}
                />
                <Button variant="outline" asChild disabled={isImporting}>
                  <label htmlFor="import-file" className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    {isImporting ? 'Importing...' : 'Import'}
                  </label>
                </Button>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-danger">Delete All Data</Label>
                <p className="text-sm text-muted-foreground">Permanently remove all data</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete all your
                      transactions, accounts, subscriptions, and settings.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClearData}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-success" />
              <CardTitle>Privacy</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-success mt-1.5" />
                <div>
                  <p className="font-medium">100% Local Storage</p>
                  <p className="text-muted-foreground">All data is stored in your browser's IndexedDB</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-success mt-1.5" />
                <div>
                  <p className="font-medium">No Cloud Sync</p>
                  <p className="text-muted-foreground">Your financial data never leaves your device</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-success mt-1.5" />
                <div>
                  <p className="font-medium">No Analytics</p>
                  <p className="text-muted-foreground">Zero tracking, telemetry, or data collection</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              <CardTitle>About</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version</span>
                <span>1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Built with</span>
                <span>React + TypeScript + Dexie.js</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

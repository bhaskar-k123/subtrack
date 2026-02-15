import React, { useEffect, useState } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Upload as UploadIcon,
  Trash2,
  Shield,
  Info,
  List,
  Check,
  ChevronRight,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { ModeToggle } from '@/components/ui/mode-toggle';
import { exportData, importData, clearAllData, getDatabaseStats } from '@/lib/db/settings';
import { getAllCategories } from '@/lib/db/categories';
import type { Category, BackupData } from '@/types/database';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils/formatting';
import { cn } from '@/lib/utils';

export default function Settings() {
  const { currency, setCurrency, dateFormat, setDateFormat } = useAppStore();
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your workspace preferences</p>
        </div>
      </div>

      {/* Split View Container */}
      <div className="flex flex-col lg:flex-row h-[calc(100vh-12rem)] min-h-[600px] border rounded-xl overflow-hidden bg-background shadow-sm ring-1 ring-border/50">
        <Tabs defaultValue="general" orientation="vertical" className="w-full flex flex-col lg:flex-row h-full">

          {/* Sidebar */}
          <aside className="lg:w-72 border-r bg-muted/10 h-full flex flex-col">
            <div className="p-4 pb-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">Configuration</h2>
            </div>
            <TabsList className="flex flex-row lg:flex-col justify-start items-stretch h-auto bg-transparent p-2 gap-1 w-full relative">
              <TabsTrigger
                value="general"
                className="group flex items-center justify-between w-full px-3 py-2.5 text-sm font-medium rounded-md data-[state=active]:bg-primary/10 data-[state=active]:text-primary hover:bg-muted/50 transition-all justify-start"
              >
                <div className="flex items-center gap-3">
                  <SettingsIcon className="w-4 h-4" />
                  General
                </div>
                <ChevronRight className="w-4 h-4 opacity-0 group-data-[state=active]:opacity-50" />
              </TabsTrigger>
              <TabsTrigger
                value="categories"
                className="group flex items-center justify-between w-full px-3 py-2.5 text-sm font-medium rounded-md data-[state=active]:bg-primary/10 data-[state=active]:text-primary hover:bg-muted/50 transition-all justify-start"
              >
                <div className="flex items-center gap-3">
                  <List className="w-4 h-4" />
                  Categories
                </div>
                <ChevronRight className="w-4 h-4 opacity-0 group-data-[state=active]:opacity-50" />
              </TabsTrigger>
              <TabsTrigger
                value="data"
                className="group flex items-center justify-between w-full px-3 py-2.5 text-sm font-medium rounded-md data-[state=active]:bg-primary/10 data-[state=active]:text-primary hover:bg-muted/50 transition-all justify-start"
              >
                <div className="flex items-center gap-3">
                  <Database className="w-4 h-4" />
                  Data
                </div>
                <ChevronRight className="w-4 h-4 opacity-0 group-data-[state=active]:opacity-50" />
              </TabsTrigger>
              <TabsTrigger
                value="about"
                className="group flex items-center justify-between w-full px-3 py-2.5 text-sm font-medium rounded-md data-[state=active]:bg-primary/10 data-[state=active]:text-primary hover:bg-muted/50 transition-all justify-start"
              >
                <div className="flex items-center gap-3">
                  <Info className="w-4 h-4" />
                  About
                </div>
                <ChevronRight className="w-4 h-4 opacity-0 group-data-[state=active]:opacity-50" />
              </TabsTrigger>
            </TabsList>

            <div className="mt-auto p-4 border-t bg-muted/5">
              <div className="flex items-center gap-3 px-2 py-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-xs text-muted-foreground font-medium">System Operational</span>
              </div>
            </div>
          </aside>

          {/* Content Area */}
          <main className="flex-1 h-full overflow-y-auto bg-card/50">
            <div className="max-w-4xl mx-auto p-8">

              {/* General Tab */}
              <TabsContent value="general" className="space-y-8 m-0 animate-in fade-in-50 slide-in-from-left-2 duration-300">
                <div className="space-y-1 pb-4 border-b">
                  <h3 className="text-2xl font-semibold tracking-tight">General Settings</h3>
                  <p className="text-muted-foreground">Manage appearance and preferences.</p>
                </div>

                <section className="space-y-6">
                  <div className="grid gap-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                      <div className="space-y-1">
                        <Label className="text-base">Theme</Label>
                        <p className="text-sm text-muted-foreground max-w-sm">Select the visual appearance of the application.</p>
                      </div>
                      <ModeToggle />
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                      <div className="space-y-1">
                        <Label className="text-base">Currency</Label>
                        <p className="text-sm text-muted-foreground">The primary currency for financial calculations.</p>
                      </div>
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger className="w-[180px]">
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

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                      <div className="space-y-1">
                        <Label className="text-base">Date Format</Label>
                        <p className="text-sm text-muted-foreground">How dates appear across the application.</p>
                      </div>
                      <Select value={dateFormat} onValueChange={setDateFormat}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                          <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                          <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </section>
              </TabsContent>

              {/* Categories Tab */}
              <TabsContent value="categories" className="space-y-8 m-0 animate-in fade-in-50 slide-in-from-left-2 duration-300">
                <div className="space-y-1 pb-4 border-b">
                  <h3 className="text-2xl font-semibold tracking-tight">Categories</h3>
                  <p className="text-muted-foreground">Manage available transaction categories.</p>
                </div>

                <Card className="border-none shadow-none bg-transparent">
                  <CardContent className="p-0">
                    <div className="flex flex-wrap gap-3">
                      {categories.map(cat => (
                        <div
                          key={cat.id}
                          className="group flex items-center gap-3 px-4 py-2.5 rounded-lg border bg-card hover:border-primary/50 transition-all cursor-default"
                        >
                          <div
                            className="w-3 h-3 rounded-full ring-2 ring-offset-2 ring-offset-background"
                            style={{ backgroundColor: cat.color, '--tw-ring-color': cat.color } as React.CSSProperties}
                          />
                          <span className="font-medium">{cat.name}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Data Tab */}
              <TabsContent value="data" className="space-y-8 m-0 animate-in fade-in-50 slide-in-from-left-2 duration-300">
                <div className="space-y-1 pb-4 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight">Data Management</h3>
                      <p className="text-muted-foreground">Backup, restore, or reset your local database.</p>
                    </div>
                    <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      Usage: {dbStats.estimatedSize}
                    </div>
                  </div>
                </div>

                <div className="grid gap-6">
                  {/* Backup Section */}
                  <div className="rounded-lg border p-6 bg-card space-y-6">
                    <div className="flex items-center gap-3 text-primary">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Download className="w-5 h-5" />
                      </div>
                      <h4 className="font-semibold text-lg">Backup & Restore</h4>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Download a JSON file containing all your transactions, subscriptions, and settings.
                        </p>
                        <Button variant="outline" onClick={handleExport} disabled={isExporting} className="w-full justify-start">
                          <Download className="w-4 h-4 mr-2" />
                          {isExporting ? 'Exporting...' : 'Export Data'}
                        </Button>
                      </div>
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Restore your data from a previously created backup file.
                        </p>
                        <div>
                          <input
                            type="file"
                            id="import-file"
                            className="hidden"
                            accept=".json"
                            onChange={handleImport}
                          />
                          <Button variant="outline" asChild disabled={isImporting} className="w-full justify-start">
                            <label htmlFor="import-file" className="cursor-pointer font-medium">
                              <UploadIcon className="w-4 h-4 mr-2" />
                              {isImporting ? 'Importing...' : 'Import Data'}
                            </label>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 space-y-4">
                    <div className="flex items-center gap-3 text-destructive">
                      <div className="p-2 rounded-lg bg-destructive/10">
                        <Trash2 className="w-5 h-5" />
                      </div>
                      <h4 className="font-semibold text-lg">Danger Zone</h4>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground max-w-xl">
                        Permanently remove all data. This action removes the local IndexedDB database and cannot be undone.
                      </p>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive">Delete All</Button>
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
                  </div>
                </div>
              </TabsContent>

              {/* About Tab */}
              <TabsContent value="about" className="space-y-8 m-0 animate-in fade-in-50 slide-in-from-left-2 duration-300">
                <div className="space-y-1 pb-4 border-b">
                  <h3 className="text-2xl font-semibold tracking-tight">About</h3>
                  <p className="text-muted-foreground">Privacy and application information.</p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="p-6 rounded-xl bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20">
                    <div className="flex items-center gap-2 mb-4">
                      <Shield className="w-6 h-6 text-green-500" />
                      <h4 className="font-semibold text-lg">Privacy First</h4>
                    </div>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-green-500 mt-0.5" />
                        100% Local Storage via IndexedDB
                      </li>
                      <li className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-green-500 mt-0.5" />
                        No data sent to cloud servers
                      </li>
                      <li className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-green-500 mt-0.5" />
                        Zero analytics or tracking
                      </li>
                    </ul>
                  </div>

                  <div className="p-6 rounded-xl border bg-card">
                    <div className="flex items-center gap-2 mb-4">
                      <Info className="w-6 h-6 text-primary" />
                      <h4 className="font-semibold text-lg">SubTrack</h4>
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm py-2 border-b">
                        <span className="text-muted-foreground">Version</span>
                        <span className="font-mono">1.0.0</span>
                      </div>
                      <div className="flex justify-between text-sm py-2 border-b">
                        <span className="text-muted-foreground">Build</span>
                        <span className="font-mono">Production</span>
                      </div>
                      <p className="text-xs text-muted-foreground pt-2">
                        Built with modern web technologies for performance and reliability.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

            </div>
          </main>
        </Tabs>
      </div>
    </PageContainer>
  );
}

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Wallet,
    Upload,
    ChevronRight,
    Check,
    Sparkles,
    Shield,
    Zap,
} from 'lucide-react';
import { createAccount } from '@/lib/db/accounts';
import { setSetting, getSetting } from '@/lib/db/settings';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface OnboardingProps {
    onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
    const [step, setStep] = useState(1);
    const [accountName, setAccountName] = useState('');
    const [accountType, setAccountType] = useState<'checking' | 'savings' | 'credit' | 'wallet'>('checking');
    const [isCreating, setIsCreating] = useState(false);
    const navigate = useNavigate();

    const features = [
        {
            icon: <Shield className="w-6 h-6" />,
            title: "100% Private",
            description: "All data stays on your device. No cloud, no tracking."
        },
        {
            icon: <Zap className="w-6 h-6" />,
            title: "AI-Powered",
            description: "Docling AI extracts transactions from PDFs and images."
        },
        {
            icon: <Sparkles className="w-6 h-6" />,
            title: "Smart Detection",
            description: "Automatically detects recurring subscriptions."
        },
    ];

    async function handleCreateAccount() {
        if (!accountName.trim()) {
            toast.error('Please enter an account name');
            return;
        }

        setIsCreating(true);
        try {
            await createAccount({
                name: accountName,
                type: accountType,
                institutionName: null,
                identifier: null,
                currency: 'USD',
                status: 'active',
                balance: null,
                notes: null,
            });

            await setSetting('hasCompletedOnboarding', true);
            toast.success('Account created!');
            setStep(3);
        } catch (error) {
            toast.error('Failed to create account');
        } finally {
            setIsCreating(false);
        }
    }

    async function handleSkip() {
        await setSetting('hasCompletedOnboarding', true);
        onComplete();
    }

    function handleFinish() {
        onComplete();
        navigate('/upload');
    }

    return (
        <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-8">
            <div className="w-full max-w-lg">

                {/* Step 1: Welcome */}
                {step === 1 && (
                    <div className="text-center animate-fade-in">
                        <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-6">
                            <Wallet className="w-10 h-10 text-primary" />
                        </div>

                        <h1 className="text-3xl font-bold mb-3">Welcome to SubTrack</h1>
                        <p className="text-muted-foreground mb-8">
                            Your privacy-first subscription and expense tracker
                        </p>

                        <div className="space-y-4 mb-8">
                            {features.map((feature, i) => (
                                <Card key={i} className="text-left">
                                    <CardContent className="flex items-start gap-4 p-4">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                                            {feature.icon}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold">{feature.title}</h3>
                                            <p className="text-sm text-muted-foreground">{feature.description}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <Button
                            size="lg"
                            className="w-full bg-primary hover:bg-primary/90"
                            onClick={() => setStep(2)}
                        >
                            Get Started
                            <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>

                        <button
                            onClick={handleSkip}
                            className="text-sm text-muted-foreground mt-4 hover:underline"
                        >
                            Skip for now
                        </button>
                    </div>
                )}

                {/* Step 2: Create Account */}
                {step === 2 && (
                    <div className="animate-fade-in">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold mb-2">Create Your First Account</h2>
                            <p className="text-muted-foreground">
                                Add a bank account or credit card to track
                            </p>
                        </div>

                        <Card>
                            <CardContent className="space-y-4 p-6">
                                <div>
                                    <Label htmlFor="name">Account Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g., Chase Checking, Amex Gold"
                                        value={accountName}
                                        onChange={(e) => setAccountName(e.target.value)}
                                        className="mt-1.5"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="type">Account Type</Label>
                                    <Select
                                        value={accountType}
                                        onValueChange={(v) => setAccountType(v as typeof accountType)}
                                    >
                                        <SelectTrigger className="mt-1.5">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="checking">Checking Account</SelectItem>
                                            <SelectItem value="savings">Savings Account</SelectItem>
                                            <SelectItem value="credit">Credit Card</SelectItem>
                                            <SelectItem value="wallet">Digital Wallet</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button
                                    className="w-full mt-4 bg-primary hover:bg-primary/90"
                                    onClick={handleCreateAccount}
                                    isLoading={isCreating}
                                >
                                    Create Account
                                </Button>
                            </CardContent>
                        </Card>

                        <button
                            onClick={handleSkip}
                            className="text-sm text-muted-foreground mt-4 hover:underline block mx-auto"
                        >
                            Skip for now
                        </button>
                    </div>
                )}

                {/* Step 3: Success */}
                {step === 3 && (
                    <div className="text-center animate-fade-in">
                        <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
                            <Check className="w-10 h-10 text-success" />
                        </div>

                        <h2 className="text-2xl font-bold mb-2">You're All Set!</h2>
                        <p className="text-muted-foreground mb-8">
                            Your account is ready. Upload your first bank statement to start tracking.
                        </p>

                        <Button
                            size="lg"
                            className="w-full bg-primary hover:bg-primary/90"
                            onClick={handleFinish}
                        >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Statement
                        </Button>

                        <button
                            onClick={onComplete}
                            className="text-sm text-muted-foreground mt-4 hover:underline"
                        >
                            Go to Dashboard
                        </button>
                    </div>
                )}

                {/* Progress dots */}
                <div className="flex justify-center gap-2 mt-8">
                    {[1, 2, 3].map((s) => (
                        <div
                            key={s}
                            className={`w-2 h-2 rounded-full transition-colors ${s === step ? 'bg-primary' : 'bg-muted'
                                }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

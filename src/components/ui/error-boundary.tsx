import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
                    <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full shadow-2xl glow-yellow-sm">
                        <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-6 text-danger">
                            <AlertCircle size={32} />
                        </div>

                        <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
                        <p className="text-muted-foreground mb-6">
                            The application encountered an unexpected error. We apologize for the inconvenience.
                        </p>

                        {this.state.error && (
                            <div className="bg-muted p-4 rounded-lg mb-6 text-left overflow-auto max-h-40 text-xs font-mono">
                                {this.state.error.toString()}
                            </div>
                        )}

                        <Button
                            className="w-full btn-primary"
                            onClick={() => window.location.reload()}
                        >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Reload Application
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

import React from 'react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  const { sidebarCollapsed } = useAppStore();

  return (
    <main
      className={cn(
        "min-h-screen bg-background transition-all duration-300",
        sidebarCollapsed ? "pl-16" : "pl-60"
      )}
    >
      <div className={cn("p-6 lg:p-8 max-w-7xl mx-auto", className)}>
        {children}
      </div>
    </main>
  );
}

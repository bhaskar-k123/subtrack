import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const metricCardVariants = cva(
  "relative overflow-hidden rounded-xl border p-5 transition-all duration-200",
  {
    variants: {
      variant: {
        default: "bg-card border-border hover:border-primary/30",
        gradient: "bg-gradient-to-br from-card to-card-elevated border-border/50",
        elevated: "bg-card-elevated border-border shadow-card hover:shadow-card-hover",
        accent: "bg-primary/5 border-primary/20 hover:border-primary/40",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface MetricCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof metricCardVariants> {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive?: boolean;
  };
  icon?: React.ReactNode;
}

const MetricCard = React.forwardRef<HTMLDivElement, MetricCardProps>(
  ({ className, variant, title, value, subtitle, trend, icon, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(metricCardVariants({ variant }), className)}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            {trend && (
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <span
                  className={cn(
                    "flex items-center gap-0.5",
                    trend.isPositive !== false ? "text-success" : "text-danger"
                  )}
                >
                  {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value).toFixed(1)}%
                </span>
                {subtitle && (
                  <span className="text-muted-foreground">{subtitle}</span>
                )}
              </div>
            )}
            <div className="text-2xl font-bold tracking-tight font-mono">
              {value}
            </div>
            <p className="text-sm text-muted-foreground">{title}</p>
          </div>
          {icon && (
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
          )}
        </div>
      </div>
    );
  }
);
MetricCard.displayName = "MetricCard";

export { MetricCard, metricCardVariants };

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
  {
    variants: {
      variant: {
        active: "bg-success/10 text-success border-success/20",
        paused: "bg-warning/10 text-warning border-warning/20",
        cancelled: "bg-danger/10 text-danger border-danger/20",
        pending: "bg-muted text-muted-foreground border-border",
        warning: "bg-warning/10 text-warning border-warning/20",
        default: "bg-primary/10 text-primary border-primary/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  showDot?: boolean;
}

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, variant, showDot = true, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(statusBadgeVariants({ variant }), className)}
        {...props}
      >
        {showDot && (
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              variant === "active" && "bg-success",
              variant === "paused" && "bg-warning",
              variant === "cancelled" && "bg-danger",
              variant === "pending" && "bg-muted-foreground",
              variant === "default" && "bg-primary"
            )}
          />
        )}
        {children}
      </span>
    );
  }
);
StatusBadge.displayName = "StatusBadge";

export { StatusBadge, statusBadgeVariants };

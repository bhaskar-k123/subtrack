import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressCircleProps extends React.HTMLAttributes<HTMLDivElement> {
    value: number;
    size?: "sm" | "md" | "lg";
    strokeWidth?: number;
    color?: string;
    showValue?: boolean;
    label?: string;
}

const ProgressCircle = React.forwardRef<HTMLDivElement, ProgressCircleProps>(
    ({
        className,
        value,
        size = "md",
        strokeWidth = 3,
        color = "hsl(var(--primary))",
        showValue = true,
        label,
        ...props
    }, ref) => {
        const sizeMap = {
            sm: 44,
            md: 56,
            lg: 72,
        };

        const fontSizeMap = {
            sm: '11px',
            md: '13px',
            lg: '16px',
        };

        const dimension = sizeMap[size];
        const radius = (dimension - strokeWidth * 2) / 2;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (value / 100) * circumference;

        // Determine color based on percentage if no custom color
        const getColor = () => {
            if (color !== "hsl(var(--primary))") return color;
            if (value >= 75) return 'hsl(var(--success))';
            if (value >= 50) return 'hsl(var(--primary))';
            return 'hsl(var(--secondary))';
        };

        return (
            <div
                ref={ref}
                className={cn("relative inline-flex flex-col items-center shrink-0", className)}
                {...props}
            >
                <svg
                    width={dimension}
                    height={dimension}
                    className="transform -rotate-90"
                >
                    {/* Background circle */}
                    <circle
                        cx={dimension / 2}
                        cy={dimension / 2}
                        r={radius}
                        fill="none"
                        stroke="hsl(var(--muted))"
                        strokeWidth={strokeWidth}
                    />
                    {/* Progress circle */}
                    <circle
                        cx={dimension / 2}
                        cy={dimension / 2}
                        r={radius}
                        fill="none"
                        stroke={getColor()}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        className="transition-all duration-500 ease-out"
                    />
                </svg>

                {showValue && (
                    <div
                        className="absolute inset-0 flex items-center justify-center font-semibold"
                        style={{ fontSize: fontSizeMap[size] }}
                    >
                        {Math.round(value)}%
                    </div>
                )}

                {label && (
                    <span className="mt-1 text-xs text-muted-foreground">{label}</span>
                )}
            </div>
        );
    }
);
ProgressCircle.displayName = "ProgressCircle";

export { ProgressCircle };

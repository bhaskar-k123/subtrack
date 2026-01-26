import * as React from "react";
import { cn } from "@/lib/utils";

interface CreditCardProps extends React.HTMLAttributes<HTMLDivElement> {
  cardNumber?: string;
  cardHolder?: string;
  expiryDate?: string;
  variant?: "purple" | "green" | "pink";
  bankName?: string;
}

const CreditCard = React.forwardRef<HTMLDivElement, CreditCardProps>(
  ({
    className,
    cardNumber = "•••• •••• •••• ••••",
    cardHolder = "",
    expiryDate = "••/••",
    variant = "purple",
    bankName = "National Wbank",
    ...props
  }, ref) => {
    const gradientClasses = {
      purple: "bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600",
      green: "bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600",
      pink: "bg-gradient-to-br from-pink-400 via-rose-400 to-pink-500",
    };

    const formatCardNumber = (num: string) => {
      if (num.includes("•") || num.includes(" ")) return num;
      return num.replace(/(.{4})/g, "$1 ").trim();
    };

    return (
      <div
        ref={ref}
        className={cn(
          "relative rounded-2xl p-5 text-white overflow-hidden w-full",
          gradientClasses[variant],
          className
        )}
        style={{ minHeight: '180px' }}
        {...props}
      >
        {/* Background circles for depth */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
          <div className="absolute -right-2 top-6 w-20 h-20 rounded-full bg-white/5" />
          <div className="absolute left-1/2 -bottom-10 w-32 h-32 rounded-full bg-black/10" />
        </div>

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col justify-between" style={{ minHeight: '150px' }}>
          {/* Top row */}
          <div className="flex items-start justify-between">
            <div className="text-xs font-medium opacity-90">{bankName}</div>
            {/* Chip */}
            <div className="w-10 h-7 rounded-md bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 shadow-sm" />
          </div>

          {/* Card number */}
          <div className="mt-4">
            <div className="text-lg font-mono tracking-[0.15em] font-medium">
              {formatCardNumber(cardNumber)}
            </div>
          </div>

          {/* Bottom row */}
          <div className="flex items-end justify-between mt-4">
            <div>
              <div className="text-[10px] opacity-60 uppercase tracking-wider mb-0.5">Exp</div>
              <div className="text-sm font-mono font-medium">{expiryDate}</div>
            </div>

            {/* Card indicator dots */}
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-white/60" />
              <div className="w-2 h-2 rounded-full bg-white/30" />
            </div>
          </div>
        </div>
      </div>
    );
  }
);
CreditCard.displayName = "CreditCard";

export { CreditCard };

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, startOfMonth, addMonths, subMonths, isSameMonth } from 'date-fns';

interface MonthSelectorProps {
    currentMonth: Date;
    onChange: (month: Date) => void;
    minDate?: Date;
    maxDate?: Date;
}

export function MonthSelector({
    currentMonth,
    onChange,
    minDate,
    maxDate = new Date(),
}: MonthSelectorProps) {
    const canGoBack = !minDate || subMonths(currentMonth, 1) >= startOfMonth(minDate);
    const canGoForward = !isSameMonth(currentMonth, maxDate) && currentMonth < maxDate;

    const handlePrevious = () => {
        if (canGoBack) {
            onChange(subMonths(currentMonth, 1));
        }
    };

    const handleNext = () => {
        if (canGoForward) {
            onChange(addMonths(currentMonth, 1));
        }
    };

    return (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-card border border-border rounded-full">
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full"
                onClick={handlePrevious}
                disabled={!canGoBack}
            >
                <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[100px] text-center">
                {format(currentMonth, 'MMMM yyyy')}
            </span>
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full"
                onClick={handleNext}
                disabled={!canGoForward}
            >
                <ChevronRight className="w-4 h-4" />
            </Button>
        </div>
    );
}

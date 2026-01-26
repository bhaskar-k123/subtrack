import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subDays,
  subMonths,
  subYears,
  addDays,
  addMonths,
  differenceInDays,
  differenceInMonths,
  eachMonthOfInterval,
  format,
  isWithinInterval,
  isSameDay,
  isSameMonth,
  isSameYear,
} from 'date-fns';

export interface DateRange {
  start: Date;
  end: Date;
  label?: string;
}

export function getDateRangePresets(): DateRange[] {
  const now = new Date();
  
  return [
    {
      start: startOfDay(now),
      end: endOfDay(now),
      label: 'Today',
    },
    {
      start: startOfWeek(now),
      end: endOfWeek(now),
      label: 'This Week',
    },
    {
      start: startOfMonth(now),
      end: endOfMonth(now),
      label: 'This Month',
    },
    {
      start: startOfMonth(subMonths(now, 1)),
      end: endOfMonth(subMonths(now, 1)),
      label: 'Last Month',
    },
    {
      start: subDays(now, 30),
      end: now,
      label: 'Last 30 Days',
    },
    {
      start: subDays(now, 90),
      end: now,
      label: 'Last 90 Days',
    },
    {
      start: startOfYear(now),
      end: endOfYear(now),
      label: 'This Year',
    },
    {
      start: startOfYear(subYears(now, 1)),
      end: endOfYear(subYears(now, 1)),
      label: 'Last Year',
    },
  ];
}

export function getMonthsInRange(start: Date, end: Date): Date[] {
  return eachMonthOfInterval({ start, end });
}

export function getDefaultDateRange(): DateRange {
  const now = new Date();
  return {
    start: startOfMonth(now),
    end: endOfMonth(now),
    label: 'This Month',
  };
}

export function getLast12Months(): DateRange {
  const now = new Date();
  return {
    start: subMonths(startOfMonth(now), 11),
    end: endOfMonth(now),
    label: 'Last 12 Months',
  };
}

export function isDateInRange(date: Date, range: DateRange): boolean {
  return isWithinInterval(date, { start: range.start, end: range.end });
}

export function formatDateRange(range: DateRange): string {
  if (isSameDay(range.start, range.end)) {
    return format(range.start, 'MMM d, yyyy');
  }
  
  if (isSameMonth(range.start, range.end)) {
    return `${format(range.start, 'MMM d')} - ${format(range.end, 'd, yyyy')}`;
  }
  
  if (isSameYear(range.start, range.end)) {
    return `${format(range.start, 'MMM d')} - ${format(range.end, 'MMM d, yyyy')}`;
  }
  
  return `${format(range.start, 'MMM d, yyyy')} - ${format(range.end, 'MMM d, yyyy')}`;
}

export function getDaysUntil(date: Date): number {
  return differenceInDays(date, new Date());
}

export function getMonthsUntil(date: Date): number {
  return differenceInMonths(date, new Date());
}

export function getNextBillingDate(
  lastDate: Date,
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annual'
): Date {
  switch (frequency) {
    case 'weekly':
      return addDays(lastDate, 7);
    case 'monthly':
      return addMonths(lastDate, 1);
    case 'quarterly':
      return addMonths(lastDate, 3);
    case 'annual':
      return addMonths(lastDate, 12);
  }
}

export { 
  startOfDay, 
  endOfDay, 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  subDays,
  addDays,
  addMonths,
  format,
  differenceInDays,
};

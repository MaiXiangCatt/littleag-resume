import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';

import { useMonthPicker } from '../hooks/useMonthPicker';

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

type MonthPickerProps = {
  ariaLabel: string;
  onValueChange: (value: string) => void;
  value: string;
};

export function MonthPicker({ ariaLabel, onValueChange, value }: MonthPickerProps) {
  const picker = useMonthPicker(value, onValueChange);

  return (
    <Popover open={picker.open} onOpenChange={picker.setOpen}>
      <PopoverTrigger asChild>
        <Button
          aria-label={ariaLabel}
          className="h-10 w-full justify-between px-3 font-normal"
          type="button"
          variant="outline"
        >
          <span
            className={
              picker.selected
                ? 'flex items-center gap-2 text-slate-800'
                : 'flex items-center gap-2 text-slate-400'
            }
          >
            <CalendarDays aria-hidden="true" size={16} />
            {picker.selected
              ? `${picker.selected.year} 年 ${String(picker.selected.month).padStart(2, '0')} 月`
              : '选择年月'}
          </span>
          <ChevronDown aria-hidden="true" className="text-slate-400" size={15} />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-72 p-3">
        <div className="flex items-center justify-between">
          <Button
            aria-label="上一年"
            onClick={picker.previousYear}
            size="icon"
            type="button"
            variant="ghost"
          >
            <ChevronLeft size={16} />
          </Button>
          <p aria-live="polite" className="text-sm font-semibold text-slate-800">
            {picker.visibleYear} 年
          </p>
          <Button
            aria-label="下一年"
            onClick={picker.nextYear}
            size="icon"
            type="button"
            variant="ghost"
          >
            <ChevronRight size={16} />
          </Button>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-1">
          {MONTHS.map((month) => {
            const selected =
              picker.selected?.year === picker.visibleYear && picker.selected.month === month;

            return (
              <Button
                aria-label={`${picker.visibleYear} 年 ${month} 月`}
                aria-pressed={selected}
                className={
                  selected
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'font-normal'
                }
                key={month}
                onClick={() => picker.selectMonth(month)}
                size="sm"
                type="button"
                variant={selected ? 'default' : 'ghost'}
              >
                {month} 月
              </Button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <Button disabled={!value} onClick={picker.clear} size="sm" type="button" variant="ghost">
            清除
          </Button>
          <Button onClick={picker.selectCurrentMonth} size="sm" type="button" variant="outline">
            本月
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

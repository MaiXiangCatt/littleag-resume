import { useMemo, useState } from 'react';

const MONTH_VALUE_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

function parseMonthValue(value: string) {
  const match = MONTH_VALUE_PATTERN.exec(value);
  if (!match) return null;

  return {
    month: Number(match[2]),
    year: Number(match[1]),
  };
}

function formatMonthValue(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function useMonthPicker(value: string, onValueChange: (value: string) => void) {
  const selected = useMemo(() => parseMonthValue(value), [value]);
  const current = useMemo(() => {
    const today = new Date();
    return {
      month: today.getMonth() + 1,
      year: today.getFullYear(),
    };
  }, []);
  const [open, setOpenState] = useState(false);
  const [visibleYear, setVisibleYear] = useState(selected?.year ?? current.year);

  const setOpen = (nextOpen: boolean) => {
    if (nextOpen && selected) setVisibleYear(selected.year);
    setOpenState(nextOpen);
  };

  const selectMonth = (month: number) => {
    onValueChange(formatMonthValue(visibleYear, month));
    setOpenState(false);
  };

  const selectCurrentMonth = () => {
    setVisibleYear(current.year);
    onValueChange(formatMonthValue(current.year, current.month));
    setOpenState(false);
  };

  const clear = () => {
    onValueChange('');
    setOpenState(false);
  };

  return {
    clear,
    nextYear: () => setVisibleYear((year) => year + 1),
    open,
    previousYear: () => setVisibleYear((year) => year - 1),
    selectCurrentMonth,
    selectMonth,
    selected,
    setOpen,
    visibleYear,
  };
}

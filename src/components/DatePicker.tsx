/**
 * DatePicker Component
 * Custom date picker with popover calendar - 17-Apr-2026 - Emanuele Motta
 */

import { useState } from 'react';
import { format, parse } from 'date-fns';
import { it } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

interface DatePickerProps {
  value: string; // ISO string format (YYYY-MM-DD)
  onChange: (date: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  isOptional?: boolean;
}

export default function DatePicker({
  value,
  onChange,
  placeholder = 'Seleziona una data',
  disabled = false,
  className = '',
  isOptional = false,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  // Parse ISO string to Date object
  const selectedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;
  
  // Display formatted date
  const displayDate = selectedDate ? format(selectedDate, 'dd MMM yyyy', { locale: it }) : placeholder;

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      // Format back to ISO string
      const isoString = format(date, 'yyyy-MM-dd');
      onChange(isoString);
      setOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOptional) {
      onChange('');
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal pl-3 pr-2',
            'border-border/50 hover:border-primary/30 focus:border-primary/50 transition-colors',
            !selectedDate && 'text-muted-foreground',
            disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
          <span className="flex-1 truncate">{displayDate}</span>
          {selectedDate && isOptional && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClear(e as unknown as React.MouseEvent); }}
              className="ml-2 inline-flex items-center justify-center rounded p-0.5 hover:bg-muted transition-colors cursor-pointer"
              aria-label="Cancella data"
            >
              ✕
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-border/50 shadow-lg" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          disabled={disabled}
          initialFocus
          className="p-3"
        />
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Calendar } from "@repo/design-system/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { CalendarIcon } from "lucide-react";

type PIDatePickerProps = {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  minDate?: Date;
  label: string;
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function PIDatePicker({
  date,
  onDateChange,
  minDate,
  label,
}: PIDatePickerProps) {
  const floor = minDate ?? new Date(new Date().setHours(0, 0, 0, 0));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          className="w-full justify-start font-normal"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--hairline)",
            color: date ? "var(--ink)" : "var(--ink-faint)",
          }}
          type="button"
          variant="outline"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? formatDate(date) : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          disabled={(d) => d < floor}
          mode="single"
          onSelect={onDateChange}
          selected={date}
        />
      </PopoverContent>
    </Popover>
  );
}

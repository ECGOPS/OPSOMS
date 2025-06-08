import * as React from "react";
import { Input } from "@/components/ui/input";

interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  picker?: "date" | "month";
  className?: string;
}

export function DatePicker({ value, onChange, picker = "date", className }: DatePickerProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value ? new Date(e.target.value) : null;
    onChange(date);
  };

  return (
    <div className={className}>
      <Input
        type={picker === "month" ? "month" : "date"}
        value={value ? value.toISOString().split('T')[0] : ''}
        onChange={handleChange}
        className="w-full"
      />
    </div>
  );
} 
import { Calendar, CalendarDays } from "lucide-react";

interface MonthYearSelectorProps {
  year: number;
  month: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
}

export default function MonthYearSelector({
  year,
  month,
  onYearChange,
  onMonthChange,
}: MonthYearSelectorProps) {
  return (
    <>
      <div className="flex-1">
        <label className="block text-sm text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] mb-1 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Año
        </label>
        <input
          type="number"
          className="input"
          value={year}
          onChange={(e) => onYearChange(Number(e.target.value))}
          aria-label="Año"
        />
      </div>
      <div className="flex-1">
        <label className="block text-sm text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] mb-1 flex items-center gap-2">
          <CalendarDays className="w-4 h-4" />
          Mes
        </label>
        <select
          className="input"
          value={month}
          onChange={(e) => onMonthChange(Number(e.target.value))}
          aria-label="Mes"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {new Date(0, i).toLocaleString("es-ES", { month: "long" })}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

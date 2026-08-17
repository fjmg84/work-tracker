import { ChevronLeft, ChevronRight } from "lucide-react";

interface MonthYearSelectorProps {
  year: number;
  month: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function MonthYearSelector({
  year,
  month,
  onYearChange,
  onMonthChange,
}: MonthYearSelectorProps) {
  const prev = () => {
    if (month === 1) {
      onMonthChange(12);
      onYearChange(year - 1);
    } else {
      onMonthChange(month - 1);
    }
  };

  const next = () => {
    if (month === 12) {
      onMonthChange(1);
      onYearChange(year + 1);
    } else {
      onMonthChange(month + 1);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        className="btn btn-ghost p-2"
        onClick={prev}
        aria-label="Mes anterior"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="text-center min-w-[140px]">
        <div className="text-sm font-medium text-text-light dark:text-text-dark">
          {MONTHS[month - 1]}
        </div>
        <div className="text-xs text-text-muted-light dark:text-text-muted-dark">
          {year}
        </div>
      </div>
      <button
        className="btn btn-ghost p-2"
        onClick={next}
        aria-label="Mes siguiente"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

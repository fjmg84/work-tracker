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
      <div>
        <label className="small">Año</label>
        <input
          type="number"
          value={year}
          onChange={(e) => onYearChange(Number(e.target.value))}
        />
      </div>
      <div>
        <label className="small">Mes</label>
        <select
          value={month}
          onChange={(e) => onMonthChange(Number(e.target.value))}
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

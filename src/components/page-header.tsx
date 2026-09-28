export function PageHeader({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="rise flex flex-wrap items-end justify-between gap-4 pt-8 lg:pt-12">
      <div className="max-w-xl">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 font-serif text-5xl tracking-tight lg:text-6xl">{title}</h1>
        {children && <p className="mt-3 text-ink-2">{children}</p>}
      </div>
      {action}
    </header>
  );
}

export function KindToggle({
  value,
  onChange,
  disabled,
}: {
  value: "income" | "expense";
  onChange: (v: "income" | "expense") => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Tür" className="grid grid-cols-2 rounded-full bg-surface-2 p-1">
      {(["expense", "income"] as const).map((k) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          disabled={disabled && value !== k}
          onClick={() => onChange(k)}
          className={`flex h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all disabled:opacity-30 ${
            value === k ? "bg-surface text-ink shadow-sm" : "text-ink-3"
          }`}
        >
          <span className={`size-2 rounded-full ${k === "expense" ? "bg-expense" : "bg-income-fill"}`} />
          {k === "expense" ? "Gider" : "Gelir"}
        </button>
      ))}
    </div>
  );
}

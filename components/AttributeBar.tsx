import { ratingColor } from "@/lib/attributes";

// Tek attribute satırı: etiket + bar + değer (1-20). Gizliyse "?" ve soluk.
export default function AttributeBar({
  label,
  value,
  hidden = false,
}: {
  label: string;
  value: number | null;
  hidden?: boolean;
}) {
  const isHidden = hidden || value == null;
  const color = ratingColor(isHidden ? null : value);
  const pct = isHidden ? 0 : (value! / 20) * 100;

  return (
    <div className="flex items-center gap-2.5 py-1">
      <span className="text-[12px] text-text-2 w-[92px] shrink-0 truncate">{label}</span>
      <div className="flex-1 h-[6px] rounded-full bg-panel-inset overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color, opacity: isHidden ? 0.25 : 1 }}
        />
      </div>
      <span
        className="font-display font-bold text-[13px] w-5 text-right"
        style={{ color, opacity: isHidden ? 0.4 : 1 }}
      >
        {isHidden ? "?" : value}
      </span>
    </div>
  );
}

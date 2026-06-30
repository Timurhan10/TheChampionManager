import BalanceChips from "./BalanceChips";
import NotificationsDropdown from "./NotificationsDropdown";

interface TopBarProps {
  title: string;
  subtitle?: string;
  badge?: string;
  // cr/cmp artık TopBar'da kullanılmıyor (BalanceChips client'ta çeker) — geriye dönük uyumluluk için opsiyonel.
  cr?: number;
  cmp?: number;
}

export default function TopBar({ title, subtitle, badge }: TopBarProps) {
  return (
    <header className="h-[62px] shrink-0 bg-bg-base border-b border-border-cm px-[22px] flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-[34px] h-[34px] rounded-lg bg-panel border border-border-cm flex items-center justify-center font-display font-bold text-[12px] text-emerald">
          {badge ?? "CM"}
        </div>
        <div className="leading-tight">
          <div className="font-display font-bold text-[16px]">{title}</div>
          {subtitle && <div className="text-[11.5px] text-text-muted">{subtitle}</div>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <BalanceChips />
        <NotificationsDropdown />
      </div>
    </header>
  );
}

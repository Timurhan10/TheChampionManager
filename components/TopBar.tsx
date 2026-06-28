import { formatNumber } from "@/lib/utils";

interface TopBarProps {
  title: string;
  subtitle?: string;
  badge?: string;
  cr: number;
  cmp: number;
}

export default function TopBar({ title, subtitle, badge, cr, cmp }: TopBarProps) {
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
        {/* CR */}
        <div className="flex items-center gap-2 bg-panel-inset border border-border-cm rounded-lg px-3 py-1.5">
          <span className="w-4 h-4 rounded-full bg-[radial-gradient(circle_at_30%_30%,#34D399,#10B981)]" />
          <span className="font-display font-bold text-[14px]">{formatNumber(cr)}</span>
          <span className="text-[11px] text-text-muted">CR</span>
        </div>
        {/* CMP */}
        <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 border border-amber/40 bg-amber/[0.08]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
          </svg>
          <span className="font-display font-bold text-[14px] text-amber">{formatNumber(cmp)}</span>
        </div>
        {/* Bildirim */}
        <button className="relative w-[38px] h-[38px] rounded-lg bg-panel border border-border-cm flex items-center justify-center text-text-muted hover:text-text-cm">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-danger" />
        </button>
      </div>
    </header>
  );
}

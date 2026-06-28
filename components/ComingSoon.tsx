// Henüz uygulanmamış faz ekranları için ortak empty-state
export default function ComingSoon({
  title,
  phase,
  desc,
}: {
  title: string;
  phase: string;
  desc: string;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div className="w-14 h-14 rounded-xl bg-panel border border-border-cm flex items-center justify-center mb-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v4" /><path d="m16.2 7.8 2.9-2.9" /><path d="M18 12h4" /><path d="m16.2 16.2 2.9 2.9" /><path d="M12 18v4" /><path d="m4.9 19.1 2.9-2.9" /><path d="M2 12h4" /><path d="m4.9 4.9 2.9 2.9" />
        </svg>
      </div>
      <h2 className="font-display font-bold text-2xl mb-1">{title}</h2>
      <p className="text-text-muted text-sm max-w-md mb-3">{desc}</p>
      <span className="text-[11px] font-bold tracking-wide uppercase px-3 py-1 rounded-pill bg-emerald/10 text-emerald">{phase}</span>
    </div>
  );
}

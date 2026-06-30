// Tüm oyun sayfaları için anında yükleme iskeleti.
// Sidebar + TopBar kabuğu kalıcı; sadece içerik alanı bu skeleton ile değişir →
// menüler arası geçiş anında ve akıcı hissedilir.
export default function GameLoading() {
  return (
    <>
      {/* Üst bar yer tutucu */}
      <div className="h-[62px] shrink-0 bg-bg-base border-b border-border-cm px-[22px] flex items-center justify-between">
        <div className="h-5 w-44 rounded bg-border-cm/50 animate-pulse" />
        <div className="flex gap-2">
          <div className="h-8 w-24 rounded-lg bg-border-cm/40 animate-pulse" />
          <div className="h-8 w-16 rounded-lg bg-border-cm/40 animate-pulse" />
        </div>
      </div>

      {/* İçerik yer tutucu */}
      <div className="flex-1 overflow-y-auto p-[22px]">
        <div className="grid grid-cols-3 gap-4 mb-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 rounded-card bg-panel border border-border-cm animate-pulse" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-11 rounded-lg bg-panel border border-border-cm animate-pulse" />
          ))}
        </div>
      </div>
    </>
  );
}

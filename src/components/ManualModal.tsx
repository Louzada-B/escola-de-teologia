import { useState, useMemo, useRef, useEffect } from "react";
import { X, Search, BookOpen } from "lucide-react";
import { manualSections } from "@/lib/manualContent";

interface ManualModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ManualModal({ open, onClose }: ManualModalProps) {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(manualSections[0].id);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveId(manualSections[0].id);
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return manualSections;
    const q = query.toLowerCase();
    return manualSections.filter(
      s => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q) || s.group.toLowerCase().includes(q)
    );
  }, [query]);

  const groups = useMemo(() => {
    const map: Record<string, typeof filtered> = {};
    filtered.forEach(s => {
      if (!map[s.group]) map[s.group] = [];
      map[s.group].push(s);
    });
    return map;
  }, [filtered]);

  function scrollTo(id: string) {
    setActiveId(id);
    const el = contentRef.current?.querySelector(`#manual-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function highlight(text: string) {
    if (!query.trim()) return text;
    const q = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${q})`, "gi"));
    return parts.map((p, i) =>
      p.toLowerCase() === query.toLowerCase()
        ? `<mark style="background:hsl(var(--primary)/0.2);color:inherit;border-radius:2px;padding:0 2px;">${p}</mark>`
        : p
    ).join("");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-card w-full sm:max-w-3xl sm:rounded-2xl rounded-t-2xl flex flex-col h-[92vh] sm:h-[85vh] shadow-xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <span className="font-semibold text-base">Manual do Professor</span>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Buscar no manual..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {query && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {filtered.length} {filtered.length === 1 ? "resultado" : "resultados"} para "{query}"
            </p>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Índice — oculto no mobile quando há busca */}
          {!query && (
            <nav className="hidden sm:flex flex-col w-48 border-r border-border flex-shrink-0 overflow-y-auto py-2">
              {Object.entries(groups).map(([group, sections]) => (
                <div key={group}>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                    {group}
                  </p>
                  {sections.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => scrollTo(s.id)}
                      className={`w-full text-left px-4 py-1.5 text-sm transition-colors ${
                        activeId === s.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              ))}
            </nav>
          )}

          {/* Conteúdo */}
          <div ref={contentRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-8">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum resultado para "{query}"</p>
              </div>
            ) : (
              Object.entries(groups).map(([group, sections]) => (
                <div key={group}>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">{group}</p>
                  {sections.map(s => (
                    <div key={s.id} id={`manual-${s.id}`} className="mb-6">
                      <h3 className="text-base font-semibold text-foreground mb-2">{s.title}</h3>
                      <div
                        className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line"
                        dangerouslySetInnerHTML={{ __html: highlight(s.content) }}
                      />
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

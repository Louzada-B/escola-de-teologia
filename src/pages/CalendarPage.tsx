import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const typeConfig: Record<string, { label: string; className: string }> = {
  aula: { label: "Aula", className: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  aula_especial: {
    label: "Aula Especial",
    className: "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30",
  },
  aula_sincrona: {
    label: "Aula Síncrona",
    className: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
  },
  //prova: { label: 'Prova', className: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30' },
  evento: { label: "Evento", className: "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30" },
};

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    supabase
      .from("calendar_events")
      .select("*")
      .order("event_date")
      .then(({ data }) => setEvents(data || []));
  }, []);

  const eventDates = events.map((e) => new Date(e.event_date + "T00:00:00"));

  const eventDateTypes = events.reduce((acc: Record<string, Set<string>>, e) => {
    if (!acc[e.event_date]) acc[e.event_date] = new Set();
    acc[e.event_date].add(e.event_type);
    return acc;
  }, {});

  const selectedEvents = events.filter((e) => selectedDate && e.event_date === format(selectedDate, "yyyy-MM-dd"));

  return (
    <div className="page-container">
      <h1 className="section-title mb-6">Calendário</h1>

      <div className="flex flex-wrap gap-3 mb-4">
        {Object.entries(typeConfig).map(([key, cfg]) => (
          <Badge key={key} variant="outline" className={cfg.className}>
            {cfg.label}
          </Badge>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="card-academic">
          <CardContent className="p-4 flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              modifiers={{ event: eventDates }}
              modifiersClassNames={{ event: "bg-accent text-accent-foreground rounded-full" }}
              className="pointer-events-auto"
            />
          </CardContent>
        </Card>

        <div>
          <h2 className="font-heading text-lg font-semibold mb-3">
            {selectedDate ? format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR }) : "Selecione uma data"}
          </h2>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento nesta data.</p>
          ) : (
            <div className="space-y-3">
              {selectedEvents.map((ev) => {
                const cfg = typeConfig[ev.event_type] || {
                  label: ev.event_type,
                  className: "bg-muted text-muted-foreground",
                };
                return (
                  <Card key={ev.id} className="card-academic">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-body">{ev.title}</CardTitle>
                        <Badge variant="outline" className={`text-xs ${cfg.className}`}>
                          {cfg.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    {ev.description && (
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{ev.description}</p>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

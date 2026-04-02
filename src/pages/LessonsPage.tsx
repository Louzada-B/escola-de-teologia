import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Download, Play, FileText } from "lucide-react";
import { useCohort } from "@/contexts/CohortContext";
import { useCourse } from "@/contexts/CourseContext";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type Module = Database["public"]["Tables"]["modules"]["Row"];
type Lesson = Database["public"]["Tables"]["lessons"]["Row"] & {
  lesson_files: Database["public"]["Tables"]["lesson_files"]["Row"][];
};

export default function LessonsPage() {
  const [modules, setModules] = useState<(Module & { lessons: Lesson[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedCohort } = useCohort();
  const { profile } = useAuth();
  const isStudent = profile?.role === 'aluno';

  useEffect(() => {
    async function load() {
      const { data: mods } = await supabase.from("modules").select("*").order("order_index");

      const { data: lessons } = await supabase
        .from("lessons")
        .select("*, lesson_files(*)")
        .order("scheduled_date", { ascending: true, nullsFirst: false });

      if (mods && lessons) {
        const allLessons = lessons as Lesson[];

        // Filter lessons by selected cohort date range (all roles)
        const filteredLessons = selectedCohort
          ? allLessons.filter((l) => {
              if (!l.scheduled_date) return false;
              return l.scheduled_date >= selectedCohort.start_date && l.scheduled_date <= selectedCohort.end_date;
            })
          : allLessons;

        const mapped = mods
          .map((m) => ({
            ...m,
            lessons: filteredLessons.filter((l) => l.module_id === m.id),
          }))
          // Hide modules with no lessons when a cohort is selected
          .filter((m) => !selectedCohort || m.lessons.length > 0);

        setModules(mapped);
      }
      setLoading(false);
    }
    load();
  }, [selectedCohort, isStudent]);

  const getFileUrl = (path: string) => {
    const { data } = supabase.storage.from("course-files").getPublicUrl(path);
    return data.publicUrl;
  };

  const getVideoEmbed = (url: string) => {
    const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }
    return url;
  };

  if (loading) {
    return (
      <div className="page-container">
        <p className="text-muted-foreground">Carregando aulas...</p>
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="page-container">
        <h1 className="section-title mb-4">Aulas</h1>
        <p className="text-muted-foreground">Nenhum módulo disponível ainda.</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1 className="section-title mb-6">Aulas</h1>

      <Accordion type="multiple" className="space-y-3">
        {modules.map((mod) => (
          <AccordionItem key={mod.id} value={mod.id} className="border rounded-lg bg-card px-4">
            <AccordionTrigger className="font-heading text-lg hover:no-underline">{mod.title}</AccordionTrigger>
            <AccordionContent>
              {mod.description && <p className="text-muted-foreground text-sm mb-4">{mod.description}</p>}
              <div className="space-y-4">
                {mod.lessons.map((lesson) => (
                  <Card key={lesson.id} className="card-academic">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-base font-body font-semibold">{lesson.title}</CardTitle>
                        {lesson.scheduled_date && (
                          <span className="text-xs text-muted-foreground">
                            ({new Date(lesson.scheduled_date + "T12:00:00").toLocaleDateString("pt-BR")})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {lesson.professor_name && (
                          <span className="text-xs text-muted-foreground">Professor(a) {lesson.professor_name}</span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {lesson.description && <p className="text-sm text-muted-foreground">{lesson.description}</p>}

                      {lesson.video_url && (
                        <div className="aspect-video rounded-md overflow-hidden bg-muted">
                          <iframe
                            src={getVideoEmbed(lesson.video_url)}
                            className="w-full h-full"
                            allowFullScreen
                            title={lesson.title}
                          />
                        </div>
                      )}

                      {lesson.lesson_files.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium flex items-center gap-1">
                            <FileText className="w-4 h-4" /> Materiais
                          </p>
                          {[...lesson.lesson_files]
                            .sort((a, b) => a.file_name.localeCompare(b.file_name))
                            .map((file) => (
                              <a
                                key={file.id}
                                href={getFileUrl(file.file_path)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button variant="outline" size="sm" className="mr-2 mb-1">
                                  <Download className="w-3 h-3 mr-1" />
                                  {file.file_name}
                                </Button>
                              </a>
                            ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {mod.lessons.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma aula neste módulo.</p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

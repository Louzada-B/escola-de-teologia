-- Fase 3 (3/3, na verdade uma extensão da Fase 1): modules ganha course_id.
--
-- Lacuna encontrada: modules/lessons nunca tiveram vínculo direto com
-- cohort -- o portal sempre filtrou aula por turma comparando scheduled_date
-- com o período da turma. Isso nunca foi problema com um curso só, mas quebra
-- no momento em que dois currículos diferentes coexistem: sem isolamento por
-- curso, aula da Trilha do Crescimento poderia aparecer misturada com aula
-- da Formação Teológica sempre que as datas coincidissem.

ALTER TABLE public.modules ADD COLUMN course_id uuid REFERENCES public.courses(id);

UPDATE public.modules
  SET course_id = (SELECT id FROM public.courses WHERE slug = 'formacao-teologica')
  WHERE course_id IS NULL;

ALTER TABLE public.modules ALTER COLUMN course_id SET NOT NULL;

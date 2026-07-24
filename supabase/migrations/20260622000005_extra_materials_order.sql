-- Adiciona campo de ordenação em extra_materials
ALTER TABLE public.extra_materials
  ADD COLUMN order_index INTEGER;

-- Preenche os existentes com a ordem de criação
UPDATE public.extra_materials
SET order_index = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM public.extra_materials
) sub
WHERE public.extra_materials.id = sub.id;

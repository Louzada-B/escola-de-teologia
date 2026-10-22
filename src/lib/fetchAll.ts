// O Supabase devolve no máximo 1.000 linhas por consulta (max_rows da API),
// sem erro nenhum: o resto simplesmente não vem. Tabelas que crescem com a
// turma (presenças, respostas, leituras) já passaram disso, e as telas de
// gestão que liam a tabela inteira mostravam os registros mais recentes como
// se não existissem.
//
// fetchAll busca página por página até acabar. `build` precisa devolver uma
// consulta NOVA a cada chamada, com uma ordenação estável (ex.: .order('id')),
// senão as páginas podem repetir ou pular linhas.
//
// Avança pelo número de linhas que de fato voltou (e não pelo tamanho pedido),
// então continua correto mesmo se o limite do servidor for menor que pageSize.
export async function fetchAll<T = any>(
  build: () => any,
  pageSize = 1000,
): Promise<{ data: T[]; error: any }> {
  const rows: T[] = [];
  let from = 0;
  // Trava de segurança contra laço infinito (200 mil linhas).
  for (let i = 0; i < 200; i++) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) return { data: rows, error };
    const page = (data as T[]) || [];
    if (page.length === 0) break;
    rows.push(...page);
    from += page.length;
  }
  return { data: rows, error: null };
}

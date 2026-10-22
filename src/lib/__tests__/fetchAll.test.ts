import { describe, it, expect } from 'vitest';
import { fetchAll } from '../fetchAll';

// Simula o PostgREST: devolve no máximo `cap` linhas por pedido.
function fakeTable(total: number, cap: number) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  return () => ({
    range: async (from: number, to: number) => ({
      data: rows.slice(from, Math.min(to + 1, from + cap)),
      error: null,
    }),
  });
}

describe('fetchAll', () => {
  it('traz tudo quando passa de 1.000', async () => {
    const { data } = await fetchAll(fakeTable(1083, 1000));
    expect(data.length).toBe(1083);
    expect(data[1082]).toEqual({ id: 1082 });
  });
  it('funciona com limite do servidor menor que a página', async () => {
    const { data } = await fetchAll(fakeTable(1083, 250));
    expect(data.length).toBe(1083);
  });
  it('tabela vazia e múltiplo exato', async () => {
    expect((await fetchAll(fakeTable(0, 1000))).data.length).toBe(0);
    expect((await fetchAll(fakeTable(2000, 1000))).data.length).toBe(2000);
  });
});

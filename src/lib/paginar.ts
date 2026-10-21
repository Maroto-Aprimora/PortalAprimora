/** O Supabase devolve no máximo 1.000 linhas por consulta: busca página a página até trazer tudo (com um teto de segurança). */
export async function buscarTudo<T>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  maximo = 20000,
): Promise<T[]> {
  const TAMANHO = 1000;
  const todos: T[] = [];
  for (let de = 0; de < maximo; de += TAMANHO) {
    const { data, error } = await pagina(de, Math.min(de + TAMANHO, maximo) - 1);
    if (error) throw error;
    todos.push(...(data ?? []));
    if (!data || data.length < TAMANHO) break;
  }
  return todos;
}

import { exigir, rotaN8n, uuid } from "@/lib/n8n";

/**
 * Dados de uma 1:1 para o A13 Analista de 1:1 (`id` = trabalho reservado). Só responde com o segredo e para um
 * trabalho do A13 em processamento: a transcrição não vai no payload da fila, que todo membro ativo lê.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = uuid.safeParse((await params).id);
  if (!id.success) return Response.json({ erro: "id inválido" }, { status: 400 });
  return rotaN8n(async ({ segredo, supabase }) =>
    exigir(await supabase.rpc("n8n_dados_1on1", { _segredo: segredo, _trabalho: id.data })))(request);
}

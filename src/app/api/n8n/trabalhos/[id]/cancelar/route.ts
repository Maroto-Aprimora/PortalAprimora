import { z } from "zod";
import { exigir, rotaN8n, uuid } from "@/lib/n8n";

const esquema = z.object({ motivo: z.string().max(1500).optional() });

/** Cancela um trabalho que não deve ser feito (ex.: e-mail para card com a etiqueta SAAS). Não volta para a fila. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = uuid.safeParse((await params).id);
  if (!id.success) return Response.json({ erro: "id inválido" }, { status: 400 });
  return rotaN8n(async ({ segredo, supabase, corpo }) => {
    const { motivo } = esquema.parse(corpo ?? {});
    return exigir(await supabase.rpc("n8n_cancelar", { _segredo: segredo, _id: id.data, _motivo: motivo ?? "" }));
  })(request);
}

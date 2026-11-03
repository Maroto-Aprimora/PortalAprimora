import { z } from "zod";
import { exigir, rotaN8n } from "@/lib/n8n";

const leitura = z.object({ fonte: z.enum(["gmail", "api4com"]), ate: z.string().datetime({ offset: true }) });

/** Leitura concluída até `ate` (o início da execução no n8n). A marca só anda para a frente. */
export const POST = rotaN8n(async ({ segredo, supabase, corpo }) => {
  const v = leitura.parse(corpo);
  return exigir(await supabase.rpc("n8n_leitura_fim", { _segredo: segredo, _fonte: v.fonte, _ate: v.ate }));
});

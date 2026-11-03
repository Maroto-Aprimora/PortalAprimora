import { z } from "zod";
import { exigir, rotaN8n } from "@/lib/n8n";

const fonte = z.object({ fonte: z.enum(["gmail", "api4com"]) });

/**
 * De onde ler (marca d'água): a última leitura concluída, com 2 h de folga. Se o n8n ficou fora do ar, a próxima
 * execução lê desde esse ponto e recupera os dias sem leitura (até 30 dias).
 */
export const POST = rotaN8n(async ({ segredo, supabase, corpo }) => {
  const { fonte: f } = fonte.parse(corpo);
  return exigir(await supabase.rpc("n8n_leitura_inicio", { _segredo: segredo, _fonte: f }));
});

"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Cartao } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { formatarDataHora } from "@/lib/formatar";
import { decidirAprovacao } from "./acoes";

export type ItemAprovacao = {
  id: string; titulo: string; resumo: string | null; agente: string; tipo: string; criadoEm: string;
  conteudo: Record<string, unknown>; negocio: { id: string; titulo: string } | null; responsavel: string | null;
};

/** Rótulos conhecidos; os demais saem do nome do campo. */
const ROTULOS: Record<string, string> = {
  para: "Para", assunto: "Assunto", corpo: "E-mail", motivo: "Motivo da desqualificação", comentario: "Comentário", retorno_em: "Retornar em",
};
const rotuloCampo = (k: string) => ROTULOS[k] ?? (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, " ");

/** Campos do "Confirmar resultado da ligação" com controle próprio (lista fechada e datas). */
const CAMPOS_LIGACAO: Record<string, { rotulo: string; tipo?: "date" | "datetime-local" }> = {
  resultado: { rotulo: "Resultado" },
  retorno_em: { rotulo: "Retornar em", tipo: "date" },
  compromisso_em: { rotulo: "Data e hora do compromisso", tipo: "datetime-local" },
  decisor_nome: { rotulo: "Nome do decisor" },
  decisor_melhor_horario: { rotulo: "Melhor horário do decisor" },
  proximo_passo: { rotulo: "Próximo passo" },
};

/**
 * Um item da Caixa de aprovação. O texto aparece por inteiro e cada campo pode ser editado antes de aprovar
 * (PE-PA-002, risco "time aprova sem ler").
 */
export function CartaoAprovacao({ item, mostrarResponsavel, resultados = [], aoDecidir, semMoldura }: {
  item: ItemAprovacao; mostrarResponsavel: boolean; resultados?: { chave: string; nome: string }[];
  aoDecidir?: () => void; semMoldura?: boolean;
}) {
  const [pendente, iniciar] = useTransition();
  const [conteudo, setConteudo] = useState(item.conteudo);
  const [comentario, setComentario] = useState("");

  const decidir = (status: "aprovada" | "descartada") => iniciar(async () => {
    const r = await decidirAprovacao({ id: item.id, status, conteudo, comentario: comentario || null });
    if (!r.ok) return void toast.error(r.erro);
    toast.success(status === "aprovada" ? "Aprovado." : "Descartado.");
    aoDecidir?.();
  });

  return (
    <Cartao className={semMoldura ? "border-0 p-0 shadow-none" : "p-5"}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Selo tom="marca">{item.agente}</Selo>
        {item.negocio && <Link href={`/negocios/${item.negocio.id}`}><Selo>{item.negocio.titulo}</Selo></Link>}
        {mostrarResponsavel && item.responsavel && <Selo>{item.responsavel}</Selo>}
        <span className="ml-auto text-xs text-texto-suave">{formatarDataHora(item.criadoEm)}</span>
      </div>
      <h2 className="font-bold">{item.titulo}</h2>
      {item.resumo && <p className="mt-1 text-sm text-texto-suave">{item.resumo}</p>}

      <div className="mt-4 space-y-3">
        {Object.entries(conteudo).map(([chave, valor]) => {
          const texto = typeof valor === "string" ? valor : JSON.stringify(valor, null, 2);
          const longo = texto.length > 80 || texto.includes("\n");
          const mudar = (novo: string) => setConteudo((c) => ({ ...c, [chave]: typeof valor === "string" ? novo : tentarJson(novo, valor) }));
          const especial = item.tipo === "resultado_ligacao" ? CAMPOS_LIGACAO[chave]
            : chave === "retorno_em" ? { rotulo: "Retornar em", tipo: "date" as const } : undefined;
          if (especial && chave === "resultado") {
            return (
              <Campo key={chave} rotulo={especial.rotulo} obrigatorio>
                <Selecao value={texto} onChange={(e) => mudar(e.target.value)} disabled={pendente}>
                  <option value="">Escolha…</option>
                  {resultados.map((r) => <option key={r.chave} value={r.chave}>{r.nome}</option>)}
                </Selecao>
              </Campo>
            );
          }
          if (especial) {
            return (
              <Campo key={chave} rotulo={especial.rotulo}>
                <Entrada type={especial.tipo ?? "text"} value={especial.tipo === "datetime-local" ? texto.replace(" ", "T") : texto}
                  onChange={(e) => mudar(e.target.value)} disabled={pendente} />
              </Campo>
            );
          }
          return (
            <Campo key={chave} rotulo={rotuloCampo(chave)}>
              {longo
                ? <AreaTexto value={texto} onChange={(e) => mudar(e.target.value)} disabled={pendente}
                    className={item.tipo === "email" ? "min-h-64 text-sm leading-relaxed" : "min-h-40 font-mono text-[13px] leading-relaxed"} />
                : <Entrada value={texto} onChange={(e) => mudar(e.target.value)} disabled={pendente} />}
            </Campo>
          );
        })}
        <Campo rotulo="Comentário (opcional)">
          <Entrada value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Por que descartou, o que ajustou…" disabled={pendente} />
        </Campo>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Botao variante="secundario" onClick={() => decidir("descartada")} carregando={pendente}><X className="h-4 w-4" /> Descartar</Botao>
        <Botao onClick={() => decidir("aprovada")} carregando={pendente}><Check className="h-4 w-4" /> {item.tipo === "email" ? "Aprovar e enviar" : item.tipo === "resposta_recusa" ? "Encerrar lead" : item.tipo === "resposta_retornar" ? "Mover para Retornar futuro" : "Aprovar"}</Botao>
      </div>
    </Cartao>
  );
}

function tentarJson(texto: string, anterior: unknown) {
  try {
    return JSON.parse(texto);
  } catch {
    return typeof anterior === "number" ? Number(texto) : texto;
  }
}

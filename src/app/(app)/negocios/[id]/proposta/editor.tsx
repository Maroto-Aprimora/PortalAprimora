"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ClipboardCheck, Copy, Loader2, Sparkles } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo } from "@/components/ui/campos";
import { Cartao, CabecalhoCartao } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { formatarDataHora } from "@/lib/formatar";
import { aplicarServicosSugeridos, salvarProposta } from "../venda-acoes";

export type Sugestao = { servico_id: string; nome: string; motivo: string | null };
type Proposta = {
  resumo: string; escopo: string; texto: string; revisada: boolean; revisadoEm: string | null; revisor: string | null;
  geradoEm: string | null; sugestoes: Sugestao[];
};

export function EditorProposta({ negocioId, podeEditar, diagnostico, proposta, marcados }: {
  negocioId: string; podeEditar: boolean; marcados: string[];
  diagnostico: { status: string; analiseStatus: string | null; analiseErro: string | null } | null;
  proposta: Proposta | null;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [resumo, setResumo] = useState(proposta?.resumo ?? "");
  const [escopo, setEscopo] = useState(proposta?.escopo ?? "");
  const [texto, setTexto] = useState(proposta?.texto ?? "");

  const salvar = (revisada: boolean) => iniciar(async () => {
    const r = await salvarProposta(negocioId, { resumo_diagnostico: resumo, escopo, texto, revisada });
    if (r.ok) { toast.success(revisada ? "Proposta marcada como revisada." : "Proposta salva."); router.refresh(); } else toast.error(r.erro);
  });
  const copiar = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success("Copiado."));
  const naoMarcadas = (proposta?.sugestoes ?? []).filter((s) => !marcados.includes(s.servico_id));

  return (
    <div className="space-y-6">
      {(!diagnostico || diagnostico.status !== "concluido") && (
        <Cartao className="flex flex-wrap items-center gap-3 p-4 text-sm">
          <ClipboardCheck className="h-5 w-5 text-marca" />
          <span className="flex-1">Conclua o diagnóstico para o Assistente montar o rascunho. Você também pode escrever direto aqui.</span>
          <Link href={`/negocios/${negocioId}/diagnostico`}><Botao tamanho="sm" variante="secundario">Diagnóstico</Botao></Link>
        </Cartao>
      )}
      {diagnostico?.analiseStatus === "gerando" && (
        <Cartao className="flex items-center gap-2 p-4 text-sm"><Loader2 className="h-4 w-4 animate-spin text-marca" /> O Assistente está escrevendo o rascunho (1 a 2 minutos). Recarregue a página em seguida.</Cartao>
      )}
      {diagnostico?.analiseStatus === "erro" && (
        <Cartao className="p-4 text-sm text-perigo">O Assistente não conseguiu analisar: {diagnostico.analiseErro}</Cartao>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {proposta?.revisada
          ? <Selo tom="sucesso"><Check className="h-3 w-3" /> Revisada{proposta.revisor ? ` por ${proposta.revisor}` : ""}{proposta.revisadoEm ? ` em ${formatarDataHora(proposta.revisadoEm)}` : ""}</Selo>
          : <Selo tom="destaque">Rascunho</Selo>}
        {proposta?.geradoEm && <span className="flex items-center gap-1 text-xs text-texto-suave"><Sparkles className="h-3.5 w-3.5" /> Gerado pelo Assistente em {formatarDataHora(proposta.geradoEm)}</span>}
      </div>

      {!!proposta?.sugestoes.length && (
        <Cartao>
          <CabecalhoCartao titulo="Serviços sugeridos" descricao="Pelas áreas de menor maturidade do diagnóstico." />
          <ul className="divide-y divide-borda text-sm">
            {proposta.sugestoes.map((s) => (
              <li key={s.servico_id} className="flex flex-wrap items-start gap-2 px-6 py-3">
                <span className="font-semibold">{s.nome}</span>
                {marcados.includes(s.servico_id) && <Selo tom="sucesso">nas dores</Selo>}
                {s.motivo && <span className="w-full text-texto-suave">{s.motivo}</span>}
              </li>
            ))}
          </ul>
          {podeEditar && naoMarcadas.length > 0 && (
            <div className="flex justify-end border-t border-borda px-6 py-3">
              <Botao tamanho="sm" variante="secundario" carregando={pendente} onClick={() => iniciar(async () => {
                const r = await aplicarServicosSugeridos(negocioId, naoMarcadas.map((s) => s.servico_id));
                if (r.ok) { toast.success("Serviços marcados nas dores identificadas."); router.refresh(); } else toast.error(r.erro);
              })}>Marcar nas dores identificadas</Botao>
            </div>
          )}
        </Cartao>
      )}

      {[
        { rotulo: "Resumo do diagnóstico", valor: resumo, mudar: setResumo, linhas: "min-h-28" },
        { rotulo: "Escopo", valor: escopo, mudar: setEscopo, linhas: "min-h-48" },
        { rotulo: "Texto da proposta", valor: texto, mudar: setTexto, linhas: "min-h-72" },
      ].map((c) => (
        <Campo key={c.rotulo} rotulo={c.rotulo}>
          <div className="relative">
            <AreaTexto value={c.valor} onChange={(e) => c.mudar(e.target.value)} disabled={!podeEditar} className={`${c.linhas} text-sm leading-relaxed`} />
            {c.valor && (
              <button type="button" onClick={() => copiar(c.valor)} aria-label={`Copiar ${c.rotulo}`}
                className="absolute right-2 top-2 rounded-controle p-1 text-texto-suave hover:bg-superficie-2 hover:text-texto"><Copy className="h-4 w-4" /></button>
            )}
          </div>
        </Campo>
      ))}

      {podeEditar && (
        <div className="flex flex-wrap justify-end gap-2 pb-6">
          <Botao variante="secundario" carregando={pendente} onClick={() => salvar(false)}>Salvar rascunho</Botao>
          <Botao carregando={pendente} onClick={() => salvar(true)}><Check className="h-4 w-4" /> Marcar como revisada</Botao>
        </div>
      )}
    </div>
  );
}

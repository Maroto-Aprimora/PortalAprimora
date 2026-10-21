"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BadgeCheck, Plus, Trash2 } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Cartao, CabecalhoCartao } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { formatarData, formatarMoeda, lerValor } from "@/lib/formatar";
import { definirPrecoFinal, salvarPrecificacao } from "../venda-acoes";

export type Fator = { chave: string; nome: string; opcoes: { rotulo: string; multiplicador: number }[] };
export type Parecido = { id: string; titulo: string; valor: number; ganhoEm: string; servicos: string[] };
type Parametros = { valorHoraConsultor: number; valorHoraGerente: number; margemMinima: number; margemMaxima: number; imposto: number; fatores: Fator[] };
type Inicial = {
  fatores: Record<string, string>; horasConsultor: number; horasGerente: number; custos: { descricao: string; valor: number }[];
  observacoes: string; precoFinal: number | null; salvo: boolean;
};

const numero = (s: string) => lerValor(s) ?? 0;
const pct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/** A mesma conta do banco (public.calcular_precificacao), só para mostrar ao vivo. */
function calcular(p: Parametros, fatores: Record<string, string>, horasC: number, horasG: number, custos: { valor: number }[]) {
  const multiplicador = p.fatores.reduce((m, f) => {
    const o = f.opcoes.find((x) => x.rotulo === fatores[f.chave]) ?? f.opcoes[0];
    return m * (o?.multiplicador ?? 1);
  }, 1);
  const outros = custos.reduce((s, c) => s + (c.valor || 0), 0);
  const base = horasC * p.valorHoraConsultor + horasG * p.valorHoraGerente + outros;
  return {
    multiplicador, base, outros,
    minimo: (base * multiplicador * (1 + p.margemMinima)) / (1 - p.imposto),
    maximo: (base * multiplicador * (1 + p.margemMaxima)) / (1 - p.imposto),
  };
}

export function Calculadora({ negocioId, podeEditar, ehDiretor, parametros, inicial, parecidos }: {
  negocioId: string; podeEditar: boolean; ehDiretor: boolean; parametros: Parametros; inicial: Inicial; parecidos: Parecido[];
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [fatores, setFatores] = useState<Record<string, string>>(() =>
    Object.fromEntries(parametros.fatores.map((f) => [f.chave, inicial.fatores[f.chave] ?? f.opcoes[0]?.rotulo ?? ""])));
  const [horasC, setHorasC] = useState(String(inicial.horasConsultor || ""));
  const [horasG, setHorasG] = useState(String(inicial.horasGerente || ""));
  const [custos, setCustos] = useState(inicial.custos.length ? inicial.custos.map((c) => ({ descricao: c.descricao, valor: String(c.valor) })) : [{ descricao: "", valor: "" }]);
  const [observacoes, setObservacoes] = useState(inicial.observacoes);
  const [precoFinal, setPrecoFinal] = useState(inicial.precoFinal != null ? String(inicial.precoFinal) : "");

  const r = useMemo(() => calcular(parametros, fatores, numero(horasC), numero(horasG), custos.map((c) => ({ valor: numero(c.valor) }))),
    [parametros, fatores, horasC, horasG, custos]);
  const mediaParecidos = parecidos.length ? parecidos.reduce((s, p) => s + p.valor, 0) / parecidos.length : null;

  const salvar = () => iniciar(async () => {
    const res = await salvarPrecificacao(negocioId, {
      fatores, horas_consultor: numero(horasC), horas_gerente: numero(horasG),
      custos: custos.map((c) => ({ descricao: c.descricao.trim(), valor: numero(c.valor) })), observacoes: observacoes.trim() || null,
    });
    if (res.ok) { toast.success("Precificação salva."); router.refresh(); } else toast.error(res.erro);
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <Cartao>
          <CabecalhoCartao titulo="Fatores" descricao="Cada escolha multiplica o custo do projeto." />
          <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
            {parametros.fatores.map((f) => (
              <Campo key={f.chave} rotulo={f.nome}>
                <Selecao value={fatores[f.chave]} disabled={!podeEditar} className="h-9"
                  onChange={(e) => setFatores((x) => ({ ...x, [f.chave]: e.target.value }))}>
                  {f.opcoes.map((o) => <option key={o.rotulo} value={o.rotulo}>{o.rotulo} (×{String(o.multiplicador).replace(".", ",")})</option>)}
                </Selecao>
              </Campo>
            ))}
          </div>
        </Cartao>

        <Cartao>
          <CabecalhoCartao titulo="Horas e custos" />
          <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
            <Campo rotulo={`Horas de consultores (${formatarMoeda(parametros.valorHoraConsultor)}/h)`}>
              <Entrada inputMode="decimal" value={horasC} onChange={(e) => setHorasC(e.target.value)} disabled={!podeEditar} className="h-9" />
            </Campo>
            <Campo rotulo={`Horas de gerentes (${formatarMoeda(parametros.valorHoraGerente)}/h)`}>
              <Entrada inputMode="decimal" value={horasG} onChange={(e) => setHorasG(e.target.value)} disabled={!podeEditar} className="h-9" />
            </Campo>
          </div>
          <div className="space-y-2 border-t border-borda px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">Custos do projeto (deslocamento, materiais, impressões…)</p>
            {custos.map((c, i) => (
              <div key={i} className="flex gap-2">
                <Entrada value={c.descricao} placeholder="Descrição" disabled={!podeEditar} className="h-9"
                  onChange={(e) => setCustos((xs) => xs.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)))} />
                <Entrada value={c.valor} placeholder="R$" inputMode="decimal" disabled={!podeEditar} className="h-9 w-32"
                  onChange={(e) => setCustos((xs) => xs.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))} />
                {podeEditar && (
                  <button type="button" aria-label="Remover custo" className="p-1 text-texto-suave hover:text-perigo"
                    onClick={() => setCustos((xs) => xs.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>
                )}
              </div>
            ))}
            {podeEditar && (
              <Botao tamanho="sm" variante="fantasma" onClick={() => setCustos((xs) => [...xs, { descricao: "", valor: "" }])}>
                <Plus className="h-3.5 w-3.5" /> Custo
              </Botao>
            )}
          </div>
          <div className="border-t border-borda px-5 py-4">
            <Campo rotulo="Observações">
              <AreaTexto value={observacoes} onChange={(e) => setObservacoes(e.target.value)} disabled={!podeEditar} className="min-h-16" />
            </Campo>
          </div>
          {podeEditar && (
            <div className="flex justify-end border-t border-borda px-5 py-3">
              <Botao onClick={salvar} carregando={pendente}>Salvar precificação</Botao>
            </div>
          )}
        </Cartao>
      </div>

      <aside className="space-y-6">
        <Cartao className="lg:sticky lg:top-4">
          <CabecalhoCartao titulo="Preço" />
          <dl className="space-y-2 px-5 py-4 text-sm">
            <div className="flex justify-between"><dt className="text-texto-suave">Custo do projeto</dt><dd className="font-semibold">{formatarMoeda(r.base)}</dd></div>
            <div className="flex justify-between"><dt className="text-texto-suave">Multiplicador</dt><dd className="font-semibold">×{r.multiplicador.toFixed(3).replace(".", ",")}</dd></div>
            <div className="flex justify-between text-xs text-texto-suave"><dt>Margens</dt><dd>{pct(parametros.margemMinima)} a {pct(parametros.margemMaxima)} · imposto {pct(parametros.imposto)}</dd></div>
            <div className="mt-3 rounded-lg bg-superficie-2 p-3">
              <div className="flex justify-between"><dt>Mínimo</dt><dd className="text-base font-bold">{formatarMoeda(r.minimo)}</dd></div>
              <div className="flex justify-between"><dt>Máximo</dt><dd className="text-base font-bold">{formatarMoeda(r.maximo)}</dd></div>
            </div>
          </dl>
          <div className="border-t border-borda px-5 py-4">
            <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-texto-suave">
              <BadgeCheck className="h-3.5 w-3.5" /> Preço final
            </p>
            {ehDiretor ? (
              <div className="flex gap-2">
                <Entrada inputMode="decimal" value={precoFinal} onChange={(e) => setPrecoFinal(e.target.value)} placeholder="R$" className="h-9" />
                <Botao tamanho="sm" variante="destaque" carregando={pendente} onClick={() => iniciar(async () => {
                  const res = await definirPrecoFinal(negocioId, precoFinal.trim() ? numero(precoFinal) : null);
                  if (res.ok) { toast.success("Preço final registrado: é o valor do negócio."); router.refresh(); } else toast.error(res.erro);
                })}>Registrar</Botao>
              </div>
            ) : (
              <p className="text-sm">{inicial.precoFinal != null ? <strong>{formatarMoeda(inicial.precoFinal)}</strong> : "O Diretor Comercial registra o preço final."}</p>
            )}
            {inicial.precoFinal != null && r.maximo > 0 && (inicial.precoFinal < r.minimo || inicial.precoFinal > r.maximo) && (
              <Selo tom="destaque" className="mt-2">Fora da faixa calculada</Selo>
            )}
          </div>
        </Cartao>

        <Cartao>
          <CabecalhoCartao titulo="Projetos parecidos" descricao={mediaParecidos != null ? `Média: ${formatarMoeda(mediaParecidos)}` : "Vendidos com alguma dor em comum."} />
          <ul className="divide-y divide-borda text-sm">
            {parecidos.map((p) => (
              <li key={p.id} className="px-5 py-2.5">
                <div className="flex justify-between gap-2">
                  <Link href={`/negocios/${p.id}`} className="truncate font-medium hover:text-destaque">{p.titulo}</Link>
                  <span className="font-semibold">{formatarMoeda(p.valor)}</span>
                </div>
                <p className="text-xs text-texto-suave">{formatarData(p.ganhoEm)} · {p.servicos.join(", ")}</p>
              </li>
            ))}
            {!parecidos.length && <li className="px-5 py-3 text-texto-suave">Nenhum projeto vendido com as mesmas dores ainda. Marque as dores no negócio para comparar.</li>}
          </ul>
        </Cartao>
      </aside>
    </div>
  );
}

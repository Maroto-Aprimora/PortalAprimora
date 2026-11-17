"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Loader2, MapPin, MessageCircle, Phone, Search, Star, Trash2 } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Cartao, CabecalhoCartao, Vazio } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { BotaoFiltros, CampoBusca, useParametros } from "@/components/app/barra-visoes";
import { formatarDataHora } from "@/lib/formatar";
import { cn } from "@/lib/utils";
import { atualizarLead, buscarLeads, excluirLead } from "./acoes";
import { NOME_SITUACAO, type FiltrosLeads } from "./dados";

type Busca = { id: string; termos: string[]; cidade: string; status: string; encontrados: number | null; novos: number | null; erro: string | null; created_at: string; concluida_em: string | null };

const TOM: Record<string, "neutro" | "marca" | "destaque" | "sucesso" | "perigo"> = {
  novo: "neutro", contatado: "marca", interessado: "destaque", demonstracao: "destaque", cliente: "sucesso", descartado: "perigo",
};

export function Buscas({ buscas, termosPadrao }: { buscas: Busca[]; termosPadrao: string[] }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [aberta, setAberta] = useState(false);
  const [termos, setTermos] = useState(termosPadrao.join("\n"));
  const [cidade, setCidade] = useState("Londrina, PR");
  const emAndamento = buscas.find((b) => b.status === "na_fila" || b.status === "buscando");

  return (
    <Cartao className="mb-6">
      <CabecalhoCartao titulo="Buscas no Google Maps"
        descricao="O n8n roda o google-maps-scraper na VPS com cada tipo de comércio. Leva de 10 a 25 minutos; você recebe um aviso no sino quando terminar. Duplicados e fechados ficam de fora." />
      <div className="space-y-3 px-6 py-4">
        {emAndamento && (
          <p className="flex items-center gap-2 rounded-controle bg-destaque-suave px-3 py-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-marca" /> Buscando {emAndamento.termos.length} tipos de comércio em {emAndamento.cidade}, desde {formatarDataHora(emAndamento.created_at)}.
            <button type="button" className="ml-auto text-xs underline" onClick={() => router.refresh()}>Atualizar</button>
          </p>
        )}
        {!aberta
          ? <Botao tamanho="sm" disabled={!!emAndamento} onClick={() => setAberta(true)}><Search className="h-4 w-4" /> Nova busca</Botao>
          : (
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <Campo rotulo="Tipos de comércio (um por linha)" dica={`${termos.split("\n").filter((t) => t.trim()).length} termos (máximo 40).`}>
                <AreaTexto value={termos} onChange={(e) => setTermos(e.target.value)} className="min-h-48 text-sm" />
              </Campo>
              <div className="space-y-3">
                <Campo rotulo="Cidade"><Entrada value={cidade} onChange={(e) => setCidade(e.target.value)} className="h-9" /></Campo>
                <div className="flex gap-2">
                  <Botao tamanho="sm" carregando={pendente} onClick={() => iniciar(async () => {
                    const r = await buscarLeads(termos.split("\n").map((t) => t.trim()).filter(Boolean), cidade);
                    if (r.ok) { toast.success("Busca na fila. Em 2 minutos o n8n começa."); setAberta(false); router.refresh(); }
                    else toast.error(r.erro);
                  })}>Buscar</Botao>
                  <Botao variante="fantasma" tamanho="sm" onClick={() => setAberta(false)}>Cancelar</Botao>
                </div>
              </div>
            </div>
          )}
        {buscas.length > 0 && (
          <ul className="divide-y divide-borda border-t border-borda pt-2 text-sm">
            {buscas.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-2 py-1.5">
                <Selo tom={b.status === "pronta" ? "sucesso" : b.status === "erro" ? "perigo" : "destaque"}>
                  {b.status === "pronta" ? "Pronta" : b.status === "erro" ? "Erro" : "Buscando"}
                </Selo>
                <span className="text-texto-suave">{formatarDataHora(b.created_at)} · {b.termos.length} termos · {b.cidade}</span>
                {b.status === "pronta" && <span>{b.encontrados} encontrados, <strong>{b.novos} novos</strong></span>}
                {b.erro && <span className="text-xs text-perigo">{b.erro}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Cartao>
  );
}

export function FiltrosStockFacil({ filtros, categorias, bairros, membros }: {
  filtros: FiltrosLeads; categorias: { valor: string; n: number }[]; bairros: { valor: string; n: number }[]; membros: Membro[];
}) {
  const router = useRouter();
  const { params, montar } = useParametros();
  const [q, setQ] = useState(filtros.q);
  const ir = (m: Record<string, string | null>) => router.replace(montar(m), { scroll: false });
  const ativos = [filtros.situacao, filtros.categoria, filtros.bairro, filtros.resp].filter(Boolean).length;
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = setTimeout(() => ir({ q: q || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  return (
    <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
      <CampoBusca valor={q} aoMudar={setQ} placeholder="Procurar por nome ou endereço" />
      <BotaoFiltros ativos={ativos} aoLimpar={() => ir({ situacao: null, categoria: null, bairro: null, resp: null })}>
        <Campo rotulo="Situação">
          <Selecao value={filtros.situacao} onChange={(e) => ir({ situacao: e.target.value || null })} className="h-9">
            <option value="">Todas</option>
            {Object.entries(NOME_SITUACAO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Selecao>
        </Campo>
        <Campo rotulo="Responsável">
          <Selecao value={filtros.resp} onChange={(e) => ir({ resp: e.target.value || null })} className="h-9">
            <option value="">Todos</option>
            <option value="sem">Sem responsável</option>
            {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Selecao>
        </Campo>
        <Campo rotulo="Categoria">
          <Selecao value={filtros.categoria} onChange={(e) => ir({ categoria: e.target.value || null })} className="h-9">
            <option value="">Todas</option>
            {categorias.map((c) => <option key={c.valor} value={c.valor}>{c.valor} ({c.n})</option>)}
          </Selecao>
        </Campo>
        <Campo rotulo="Bairro">
          <Selecao value={filtros.bairro} onChange={(e) => ir({ bairro: e.target.value || null })} className="h-9">
            <option value="">Todos</option>
            {bairros.map((c) => <option key={c.valor} value={c.valor}>{c.valor} ({c.n})</option>)}
          </Selecao>
        </Campo>
      </BotaoFiltros>
    </div>
  );
}

type Lead = {
  id: string; nome: string; categoria: string | null; telefone: string | null; telefoneDigitos: string | null; endereco: string | null;
  bairro: string | null; site: string | null; nota: number | null; avaliacoes: number | null; linkMaps: string | null;
  situacao: string; responsavelId: string | null;
};
type Membro = { id: string; nome: string };

export function TabelaLeads({ leads, membros }: { leads: Lead[]; membros: Membro[] }) {
  if (!leads.length) return <Cartao><Vazio titulo="Nenhum lead ainda" descricao="Faça uma busca acima para trazer comércios da região." /></Cartao>;
  return (
    <Cartao className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-superficie-2 text-left text-xs uppercase tracking-wide text-texto-suave">
          <tr><th className="px-3 py-2">Comércio</th><th className="px-3 py-2">Contato</th><th className="px-3 py-2">Endereço</th>
            <th className="px-3 py-2">Google</th><th className="px-3 py-2">Situação</th><th className="px-3 py-2">Responsável</th><th /></tr>
        </thead>
        <tbody className="divide-y divide-borda">{leads.map((l) => <LinhaLead key={l.id} lead={l} membros={membros} />)}</tbody>
      </table>
    </Cartao>
  );
}

function LinhaLead({ lead, membros }: { lead: Lead; membros: Membro[] }) {
  const [pendente, iniciar] = useTransition();
  const dig = (lead.telefoneDigitos ?? "").replace(/^0+/, "");
  const celular = dig.length === 11 && dig[2] === "9";
  const salvar = (dados: { situacao?: string; responsavel_id?: string | null }) => iniciar(async () => {
    const r = await atualizarLead(lead.id, dados);
    if (!r.ok) toast.error(r.erro);
  });
  return (
    <tr className={cn("align-top", lead.situacao === "descartado" && "opacity-60")}>
      <td className="px-3 py-3">
        <p className="font-semibold">{lead.nome}</p>
        {lead.categoria && <p className="text-xs text-texto-suave">{lead.categoria}</p>}
        {lead.site && <a href={lead.site} target="_blank" rel="noopener noreferrer" className="text-xs text-marca underline-offset-4 hover:underline">site</a>}
      </td>
      <td className="whitespace-nowrap px-3 py-3">
        {lead.telefone ? (
          <div className="space-y-1">
            <a href={`tel:+55${dig}`} className="flex items-center gap-1 hover:text-marca"><Phone className="h-3.5 w-3.5" /> {lead.telefone}</a>
            {celular && <a href={`https://wa.me/55${dig}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-sucesso hover:underline"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>}
          </div>
        ) : <span className="text-texto-suave">—</span>}
      </td>
      <td className="max-w-56 px-3 py-3 text-xs">
        <p>{lead.endereco ?? "—"}</p>
        {lead.bairro && <p className="text-texto-suave">{lead.bairro}</p>}
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-xs">
        {lead.nota != null && <p className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-destaque" /> {String(lead.nota).replace(".", ",")} ({lead.avaliacoes ?? 0})</p>}
        {lead.linkMaps && <a href={lead.linkMaps} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-marca underline-offset-4 hover:underline"><MapPin className="h-3.5 w-3.5" /> Maps <ExternalLink className="h-3 w-3" /></a>}
      </td>
      <td className="px-3 py-3">
        <Selecao defaultValue={lead.situacao} disabled={pendente} onChange={(e) => salvar({ situacao: e.target.value })} className="h-8 w-36 text-xs">
          {Object.entries(NOME_SITUACAO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Selecao>
        <Selo tom={TOM[lead.situacao]} className="mt-1">{NOME_SITUACAO[lead.situacao]}</Selo>
      </td>
      <td className="px-3 py-3">
        <Selecao defaultValue={lead.responsavelId ?? ""} disabled={pendente} aria-label="Responsável"
          onChange={(e) => salvar({ responsavel_id: e.target.value || null })} className="h-8 w-44 text-xs">
          <option value="">Sem responsável</option>
          {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </Selecao>
      </td>
      <td className="px-2 py-3">
        <button type="button" aria-label="Excluir lead" className="p-1 text-texto-suave hover:text-perigo" disabled={pendente}
          onClick={() => confirm(`Excluir ${lead.nome}?`) && iniciar(async () => { const r = await excluirLead(lead.id); if (!r.ok) toast.error(r.erro); })}>
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarDays, ChevronLeft, ChevronRight, List, MapPin, Plus } from "lucide-react";
import { Botao, classeBotao } from "@/components/ui/botao";
import { Entrada, Selecao } from "@/components/ui/campos";
import { Cartao, TituloPagina } from "@/components/ui/cartao";
import { Dialogo } from "@/components/ui/dialogo";
import { Selo } from "@/components/ui/selo";
import { DialogoAtividade, type AtividadeEditavel } from "@/components/agenda/form-atividade";
import { COR_TIPO, NOME_STATUS, type ItemAgenda, type TipoAtividade } from "@/lib/agenda";
import { diaBR, horaBR, NOMES_DIA, NOMES_MES, somarDias } from "@/lib/datas";
import type { MembroResumo } from "@/lib/crm";
import { cn } from "@/lib/utils";
import { mudarStatusAtividade, remarcarAtividade } from "./acoes";

export function Agenda({
  mes, visao, de, ate, hoje, itens, completas, tipos, membros, negocios, usuarioId, ehDiretorComercial, acoes,
}: {
  mes: string; visao: "mes" | "lista"; de: string; ate: string; hoje: string; itens: ItemAgenda[];
  completas: Record<string, AtividadeEditavel>; tipos: TipoAtividade[]; membros: MembroResumo[];
  negocios: { id: string; titulo: string }[]; usuarioId: string; ehDiretorComercial: boolean;
  /** Botões do cabeçalho vindos da página (Google Agenda, Config) */
  acoes?: React.ReactNode;
}) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  const [criando, setCriando] = useState<string | null>(null); // dia pré-selecionado
  const [editando, setEditando] = useState<AtividadeEditavel | null>(null);
  const [vendo, setVendo] = useState<ItemAgenda | null>(null);

  const tipo = (id: string) => tipos.find((t) => t.id === id);
  const nome = (id: string | null) => membros.find((m) => m.id === id)?.nome ?? "—";
  const porDia = new Map<string, ItemAgenda[]>();
  for (const i of itens) {
    const d = diaBR(i.inicio);
    porDia.set(d, [...(porDia.get(d) ?? []), i]);
  }

  function irPara(mudancas: Record<string, string>) {
    const novo = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(mudancas)) {
      if (v) novo.set(k, v);
      else novo.delete(k);
    }
    router.replace(`${caminho}?${novo.toString()}`, { scroll: false });
  }

  const [ano, numMes] = mes.split("-").map(Number);
  const mesAnterior = numMes === 1 ? `${ano - 1}-12` : `${ano}-${String(numMes - 1).padStart(2, "0")}`;
  const proximoMes = numMes === 12 ? `${ano + 1}-01` : `${ano}-${String(numMes + 1).padStart(2, "0")}`;
  const dias: string[] = [];
  for (let d = de; d <= ate; d = somarDias(d, 1)) dias.push(d);

  return (
    <>
      <TituloPagina
        titulo="Agenda"
        acoes={<>
          <div className="flex rounded-md border border-borda bg-superficie">
            <button onClick={() => irPara({ visao: "" })} className={cn("flex items-center gap-1 rounded-l-md px-3 py-1.5 text-sm", visao === "mes" && "bg-marca text-marca-texto")}><CalendarDays className="h-4 w-4" /> Mês</button>
            <button onClick={() => irPara({ visao: "lista" })} className={cn("flex items-center gap-1 rounded-r-md px-3 py-1.5 text-sm", visao === "lista" && "bg-marca text-marca-texto")}><List className="h-4 w-4" /> Lista</button>
          </div>
          <Botao variante="destaque" onClick={() => setCriando(hoje)}><Plus className="h-4 w-4" /> Nova atividade</Botao>
          {acoes}
        </>}
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {visao === "mes" && (
            <>
              <Botao variante="secundario" tamanho="icone" aria-label="Mês anterior" onClick={() => irPara({ mes: mesAnterior })}><ChevronLeft className="h-4 w-4" /></Botao>
              <h2 className="min-w-44 text-center text-lg font-bold capitalize">{NOMES_MES[numMes - 1]} de {ano}</h2>
              <Botao variante="secundario" tamanho="icone" aria-label="Próximo mês" onClick={() => irPara({ mes: proximoMes })}><ChevronRight className="h-4 w-4" /></Botao>
              <Botao variante="fantasma" tamanho="sm" onClick={() => irPara({ mes: "" })}>Hoje</Botao>
            </>
          )}
          {visao === "lista" && <h2 className="text-lg font-bold">Próximos 30 dias</h2>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Selecao className="h-9 w-52" value={params.get("pessoa") ?? ""} onChange={(e) => irPara({ pessoa: e.target.value })}>
            <option value="">Toda a equipe</option>
            <option value="eu">Minha agenda</option>
            {membros.filter((m) => m.id !== usuarioId).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Selecao>
        </div>
      </div>

      {visao === "mes" ? (
        <Cartao className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-borda bg-superficie-2 text-center text-xs font-semibold uppercase text-texto-suave">
            {NOMES_DIA.map((d) => <div key={d} className="py-2">{d.slice(0, 3)}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {dias.map((d) => {
              const doDia = porDia.get(d) ?? [];
              const foraDoMes = d.slice(0, 7) !== mes;
              return (
                <div key={d} className={cn("min-h-28 border-b border-r border-borda p-1.5", foraDoMes && "bg-superficie-2/50")}
                  onDoubleClick={() => setCriando(d)}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                      d === hoje ? "bg-destaque text-white" : foraDoMes ? "text-texto-suave/60" : "text-texto-suave")}>
                      {Number(d.slice(8))}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {doDia.slice(0, 4).map((i) => <Chip key={i.id} item={i} tipo={tipo(i.tipoId)} aoClicar={() => setVendo(i)} />)}
                    {doDia.length > 4 && (
                      <button className="w-full text-left text-[11px] font-semibold text-marca" onClick={() => irPara({ visao: "lista" })}>
                        +{doDia.length - 4} mais
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Cartao>
      ) : (
        <div className="space-y-4">
          {dias.filter((d) => porDia.has(d)).map((d) => (
            <Cartao key={d}>
              <div className="border-b border-borda px-5 py-2.5 text-sm font-bold">
                {NOMES_DIA[new Date(`${d}T12:00:00Z`).getUTCDay()]}, {d.slice(8)}/{d.slice(5, 7)} {d === hoje && <Selo tom="destaque" className="ml-2">Hoje</Selo>}
              </div>
              <ul className="divide-y divide-borda">
                {porDia.get(d)!.map((i) => (
                  <li key={i.id}>
                    <button className="flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm hover:bg-superficie-2/60" onClick={() => setVendo(i)}>
                      <span className="w-24 shrink-0 font-semibold">{horaBR(i.inicio)}{i.fim ? `–${horaBR(i.fim)}` : ""}</span>
                      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", COR_TIPO[tipo(i.tipoId)?.cor ?? "marca"])}>{tipo(i.tipoId)?.nome}</span>
                      <span className={cn("min-w-0 flex-1 truncate", i.status === "cancelada" && "line-through opacity-60")}>{i.titulo}</span>
                      {!i.recorrente && <span className="hidden text-texto-suave sm:inline">{nome(i.responsavelId)}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </Cartao>
          ))}
          {itens.length === 0 && <Cartao className="p-8 text-center text-sm text-texto-suave">Nada agendado nos próximos 30 dias.</Cartao>}
        </div>
      )}

      {vendo && (
        <DetalheItem
          item={vendo}
          tipo={tipo(vendo.tipoId)}
          nome={nome}
          podeEditar={!vendo.recorrente && (ehDiretorComercial || vendo.responsavelId === usuarioId || vendo.participantes.includes(usuarioId))}
          ehDiretorComercial={ehDiretorComercial}
          aoFechar={() => setVendo(null)}
          aoEditar={() => { setEditando(completas[vendo.id]); setVendo(null); }}
        />
      )}
      {(criando || editando) && (
        <DialogoAtividade
          aberto
          aoFechar={() => { setCriando(null); setEditando(null); }}
          tipos={tipos.filter((t) => t.chave !== "rg" && t.chave !== "ri")}
          membros={membros}
          negocios={negocios}
          atividade={editando}
          padrao={criando ? { inicio: `${criando}T09:00` } : undefined}
          podeExcluir
        />
      )}
    </>
  );
}

function Chip({ item, tipo, aoClicar }: { item: ItemAgenda; tipo?: TipoAtividade; aoClicar: () => void }) {
  return (
    <button onClick={aoClicar} title={item.titulo}
      className={cn("block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-semibold",
        COR_TIPO[tipo?.cor ?? "marca"], (item.status === "cancelada" || item.status === "remarcada") && "line-through opacity-50",
        item.status === "pendente" && tipo?.exige_confirmacao && "ring-2 ring-destaque/60 ring-inset")}>
      {horaBR(item.inicio)} {item.titulo}
    </button>
  );
}

function DetalheItem({
  item, tipo, nome, podeEditar, ehDiretorComercial, aoFechar, aoEditar,
}: {
  item: ItemAgenda; tipo?: TipoAtividade; nome: (id: string | null) => string; podeEditar: boolean;
  ehDiretorComercial: boolean; aoFechar: () => void; aoEditar: () => void;
}) {
  const [pendente, iniciar] = useTransition();
  const [remarcando, setRemarcando] = useState(false);
  const mudar = (status: "confirmada" | "realizada" | "cancelada" | "pendente") =>
    iniciar(async () => {
      const r = await mudarStatusAtividade(item.id, status);
      if (!r.ok) return void toast.error(r.erro);
      toast.success(`Atividade marcada como ${NOME_STATUS[status].toLowerCase()}.`);
      aoFechar();
    });

  return (
    <Dialogo aberto aoFechar={aoFechar} titulo={item.titulo} descricao={tipo?.nome}>
      <div className="space-y-3 text-sm">
        <p><strong>Quando:</strong> {diaBR(item.inicio).split("-").reverse().join("/")} · {horaBR(item.inicio)}{item.fim ? ` às ${horaBR(item.fim)}` : ""}</p>
        {item.local && <p className="flex items-center gap-1"><MapPin className="h-4 w-4 text-texto-suave" /> {item.local}</p>}
        {item.empresaNome && <p><strong>Empresa:</strong> {item.empresaNome}</p>}
        {item.negocioId && <p><Link href={`/negocios/${item.negocioId}`} className="font-semibold text-marca hover:text-destaque">Abrir negócio</Link></p>}
        {!item.recorrente && (
          <>
            <p><strong>Responsável:</strong> {nome(item.responsavelId)}</p>
            {item.participantes.length > 0 && <p><strong>Participantes:</strong> {item.participantes.map(nome).join(", ")}</p>}
            <p><strong>Situação:</strong> <Selo tom={item.status === "realizada" ? "sucesso" : item.status === "cancelada" ? "perigo" : item.status === "confirmada" ? "marca" : item.status === "remarcada" ? "neutro" : "destaque"}>{NOME_STATUS[item.status!]}</Selo></p>
          </>
        )}
        {item.recorrente && (
          <p className="text-texto-suave">
            Reunião fixa. {ehDiretorComercial ? <>Mude o dia e o horário em <Link href="/agenda/configuracoes" className="font-semibold text-marca">Config da agenda</Link>.</> : "O diretor pode alterar o horário."}
          </p>
        )}
      </div>
      {podeEditar && remarcando && (
        <form className="mt-4 space-y-2 rounded-md border border-borda p-3" action={(form) => iniciar(async () => {
          const r = await remarcarAtividade(item.id, String(form.get("novo_inicio") ?? ""), String(form.get("motivo") ?? "") || null);
          if (!r.ok) return void toast.error(r.erro);
          toast.success("Atividade remarcada. A data original fica registrada.");
          aoFechar();
        })}>
          <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">Nova data e hora</p>
          <Entrada type="datetime-local" name="novo_inicio" required />
          <Entrada name="motivo" placeholder="Motivo da remarcação (opcional)" />
          <div className="flex justify-end gap-2">
            <Botao type="button" variante="fantasma" onClick={() => setRemarcando(false)}>Voltar</Botao>
            <Botao type="submit" carregando={pendente}>Remarcar</Botao>
          </div>
        </form>
      )}
      {podeEditar && !remarcando && item.status !== "remarcada" && (
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {!item.recorrente && (item.status === "pendente" || item.status === "confirmada") && (
            <Botao variante="secundario" onClick={() => setRemarcando(true)}>Remarcar</Botao>
          )}
          {item.status === "pendente" && <Botao variante="secundario" carregando={pendente} onClick={() => mudar("confirmada")}>Confirmar</Botao>}
          {item.status !== "realizada" && item.status !== "cancelada" && <Botao variante="secundario" carregando={pendente} onClick={() => mudar("realizada")}>Marcar como realizada</Botao>}
          {item.status !== "cancelada" && <Botao variante="fantasma" carregando={pendente} onClick={() => mudar("cancelada")}>Cancelar</Botao>}
          {item.status === "cancelada" && <Botao variante="fantasma" carregando={pendente} onClick={() => mudar("pendente")}>Reabrir</Botao>}
          <Link href="#" onClick={(e) => { e.preventDefault(); aoEditar(); }} className={classeBotao()}>Editar</Link>
        </div>
      )}
    </Dialogo>
  );
}

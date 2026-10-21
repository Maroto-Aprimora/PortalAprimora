"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { excluirAtividade, salvarAtividade } from "@/app/(app)/agenda/acoes";
import { paraHorarioLocal } from "@/lib/datas";
import type { TipoAtividade } from "@/lib/agenda";
import type { MembroResumo } from "@/lib/crm";

export type AtividadeEditavel = {
  id: string;
  tipo_id: string;
  titulo: string;
  inicio: string;
  fim: string | null;
  local: string | null;
  link_reuniao: string | null;
  negocio_id: string | null;
  /** Título do negócio atual, para mantê-lo na lista mesmo encerrado (vendido ou não vendido) */
  negocio_titulo?: string | null;
  responsavel_id: string | null;
  stakeholder: string | null;
  resumo: string | null;
  proximos_passos: string | null;
  participantes: string[];
};

/** Janela para criar ou editar uma atividade (visita, diagnóstico, ligação, evento…). */
export function DialogoAtividade({
  aberto, aoFechar, tipos, membros, negocios, atividade, padrao, podeExcluir,
}: {
  aberto: boolean;
  aoFechar: () => void;
  tipos: TipoAtividade[];
  membros: MembroResumo[];
  negocios?: { id: string; titulo: string }[];
  atividade?: AtividadeEditavel | null;
  padrao?: Partial<{ negocio_id: string; titulo: string; inicio: string; tipo_id: string; responsavel_id: string }>;
  podeExcluir?: boolean;
}) {
  const [pendente, iniciar] = useTransition();
  const [tipoId, setTipoId] = useState(atividade?.tipo_id ?? padrao?.tipo_id ?? tipos[0]?.id ?? "");
  const tipo = tipos.find((t) => t.id === tipoId);
  const a = atividade;

  function enviar(form: FormData) {
    const g = (k: string) => String(form.get(k) ?? "");
    iniciar(async () => {
      const r = await salvarAtividade(a?.id ?? null, {
        tipo_id: g("tipo_id"), titulo: g("titulo"), inicio: g("inicio"), fim: g("fim"), local: g("local"),
        link_reuniao: g("link_reuniao"), negocio_id: g("negocio_id") || padrao?.negocio_id || "", responsavel_id: g("responsavel_id"),
        stakeholder: g("stakeholder"), resumo: g("resumo"), proximos_passos: g("proximos_passos"),
      }, form.getAll("participantes").map(String));
      if (!r.ok) return void toast.error(r.erro);
      toast.success(a ? "Atividade atualizada." : "Atividade criada.");
      aoFechar();
    });
  }

  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo={a ? "Editar atividade" : "Nova atividade"} className="w-[min(94vw,720px)]">
      <form action={enviar} className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Tipo" obrigatorio>
          <Selecao name="tipo_id" value={tipoId} onChange={(e) => setTipoId(e.target.value)} required>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </Selecao>
        </Campo>
        <Campo rotulo="Título" obrigatorio>
          <Entrada name="titulo" defaultValue={a?.titulo ?? padrao?.titulo ?? ""} required placeholder={tipo?.nome} />
        </Campo>
        <Campo rotulo="Início" obrigatorio>
          <Entrada type="datetime-local" name="inicio" defaultValue={a ? paraHorarioLocal(a.inicio) : padrao?.inicio ?? ""} required />
        </Campo>
        <Campo rotulo="Fim">
          <Entrada type="datetime-local" name="fim" defaultValue={paraHorarioLocal(a?.fim)} />
        </Campo>
        <Campo rotulo="Local"><Entrada name="local" defaultValue={a?.local ?? ""} placeholder="Endereço ou sala" /></Campo>
        <Campo rotulo="Link da reunião"><Entrada type="url" name="link_reuniao" defaultValue={a?.link_reuniao ?? ""} placeholder="https://meet.google.com/…" /></Campo>
        {tipo?.ligada_a_lead && negocios && !padrao?.negocio_id && (
          <Campo rotulo="Negócio (lead)" className="sm:col-span-2">
            <Selecao name="negocio_id" defaultValue={a?.negocio_id ?? ""}>
              <option value="">—</option>
              {/* Negócio encerrado não está na lista de abertos: mantém o vínculo ao editar */}
              {a?.negocio_id && !negocios.some((n) => n.id === a.negocio_id) && (
                <option value={a.negocio_id}>{a.negocio_titulo ?? "Negócio atual"} (encerrado)</option>
              )}
              {negocios.map((n) => <option key={n.id} value={n.id}>{n.titulo}</option>)}
            </Selecao>
          </Campo>
        )}
        <Campo rotulo="Responsável">
          <Selecao name="responsavel_id" defaultValue={a?.responsavel_id ?? padrao?.responsavel_id ?? ""}>
            <option value="">Eu</option>
            {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Selecao>
        </Campo>
        {tipo?.ligada_a_lead && (
          <Campo rotulo="Stakeholder"><Entrada name="stakeholder" defaultValue={a?.stakeholder ?? ""} placeholder="Com quem foi a conversa" /></Campo>
        )}
        <div className="sm:col-span-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-texto-suave">Participantes</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {membros.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="participantes" value={m.id} defaultChecked={a?.participantes.includes(m.id)} />
                {m.nome}
              </label>
            ))}
          </div>
        </div>
        <Campo rotulo="Resumo" className="sm:col-span-2"><AreaTexto name="resumo" defaultValue={a?.resumo ?? ""} className="min-h-16" /></Campo>
        <Campo rotulo="Próximos passos" className="sm:col-span-2"><AreaTexto name="proximos_passos" defaultValue={a?.proximos_passos ?? ""} className="min-h-16" /></Campo>
        <div className="flex items-center justify-between gap-2 sm:col-span-2">
          {a && podeExcluir ? (
            <Botao type="button" variante="fantasma" className="text-perigo" carregando={pendente}
              onClick={() => confirm("Excluir esta atividade?") && iniciar(async () => {
                const r = await excluirAtividade(a.id);
                if (!r.ok) return void toast.error(r.erro);
                toast.success("Atividade excluída.");
                aoFechar();
              })}>
              <Trash2 className="h-4 w-4" /> Excluir
            </Botao>
          ) : <span />}
          <div className="flex gap-2">
            <Botao type="button" variante="secundario" onClick={aoFechar}>Cancelar</Botao>
            <Botao type="submit" carregando={pendente}>Salvar</Botao>
          </div>
        </div>
      </form>
    </Dialogo>
  );
}

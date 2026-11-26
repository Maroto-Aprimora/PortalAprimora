"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarPlus, Pencil, Settings } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { paraHorarioLocal } from "@/lib/datas";
import { agendarReuniao, editarAgendamento, salvarConfiguracoes } from "./acoes";

type Pessoa = { id: string; nome: string };
export type AgendamentoAtual = {
  id: string; membro_id: string; conduzida_por: string | null; agendada_para: string; duracao_min: number;
  modalidade: string; local: string | null; pauta: string | null;
};

/** Agendar uma 1:1 nova ou editar o agendamento de uma existente. */
export function AgendarReuniao({ membros, condutores, eu, atual, membroInicial }: {
  membros: Pessoa[]; condutores: Pessoa[]; eu: string; atual?: AgendamentoAtual; membroInicial?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <>
      {atual ? (
        <Botao variante="secundario" tamanho="sm" onClick={() => setAberto(true)}><Pencil className="h-4 w-4" /> Editar agendamento</Botao>
      ) : (
        <Botao onClick={() => setAberto(true)}><CalendarPlus className="h-4 w-4" /> Agendar 1:1</Botao>
      )}
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo={atual ? "Editar agendamento" : "Agendar 1:1"}
        descricao="O membro recebe um aviso no sino e no celular, e outro no dia da conversa.">
        <form className="space-y-4" action={(f) => iniciar(async () => {
          const g = (k: string) => String(f.get(k) ?? "");
          const dados = {
            membro_id: atual?.membro_id ?? g("membro_id"), conduzida_por: g("conduzida_por"), agendada_para: g("agendada_para"),
            duracao_min: g("duracao_min"), modalidade: g("modalidade"), local: g("local"), pauta: g("pauta"),
          };
          const r = atual ? await editarAgendamento(atual.id, dados) : await agendarReuniao(dados);
          if (!r.ok) return void toast.error(r.erro);
          toast.success(atual ? "Agendamento atualizado." : "1:1 agendada.");
          setAberto(false);
          if (!atual && r.id) router.push(`/vice-presidencia/1on1/${r.id}`);
          else router.refresh();
        })}>
          {!atual && (
            <Campo rotulo="Membro" obrigatorio>
              <Selecao name="membro_id" defaultValue={membroInicial ?? ""} required>
                <option value="" disabled>Escolha…</option>
                {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </Selecao>
            </Campo>
          )}
          <Campo rotulo="Quem conduz" obrigatorio dica="Alguém da Vice-Presidência.">
            <Selecao name="conduzida_por" defaultValue={atual?.conduzida_por ?? (condutores.some((c) => c.id === eu) ? eu : "")} required>
              <option value="" disabled>Escolha…</option>
              {condutores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Selecao>
          </Campo>
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <Campo rotulo="Data e hora" obrigatorio>
              <Entrada type="datetime-local" name="agendada_para" required defaultValue={paraHorarioLocal(atual?.agendada_para)} />
            </Campo>
            <Campo rotulo="Duração (min)">
              <Entrada type="number" name="duracao_min" min={5} max={480} step={5} defaultValue={atual?.duracao_min ?? 30} />
            </Campo>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <Campo rotulo="Modalidade">
              <Selecao name="modalidade" defaultValue={atual?.modalidade ?? "presencial"}>
                <option value="presencial">Presencial</option>
                <option value="online">Online</option>
              </Selecao>
            </Campo>
            <Campo rotulo="Local ou link">
              <Entrada name="local" defaultValue={atual?.local ?? ""} placeholder="Sala da EJ, link do Meet…" />
            </Campo>
          </div>
          <Campo rotulo="Pauta" dica="O membro vê a pauta junto com o agendamento.">
            <AreaTexto name="pauta" rows={3} defaultValue={atual?.pauta ?? ""} />
          </Campo>
          <div className="flex justify-end"><Botao type="submit" carregando={pendente}>{atual ? "Salvar" : "Agendar"}</Botao></div>
        </form>
      </Dialogo>
    </>
  );
}

/** Configurações da VP: frequência esperada de 1:1 e o agente A13 (só o diretor da VP). */
export function ConfiguracoesVp({ frequencia, a13Ativo }: { frequencia: number; a13Ativo: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <>
      <Botao variante="secundario" onClick={() => setAberto(true)}><Settings className="h-4 w-4" /> Configurações</Botao>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo="Configurações das 1:1">
        <form className="space-y-4" action={(f) => iniciar(async () => {
          const r = await salvarConfiguracoes(Number(f.get("frequencia")), f.get("a13") === "on");
          if (!r.ok) return void toast.error(r.erro);
          toast.success("Configurações salvas.");
          setAberto(false);
          router.refresh();
        })}>
          <Campo rotulo="Frequência esperada (dias)" dica="Quem teve 1:1 realizada dentro deste prazo conta como “em dia” nos relatórios.">
            <Entrada type="number" name="frequencia" min={7} max={180} defaultValue={frequencia} />
          </Campo>
          <label className="flex items-start gap-3 rounded-controle border border-borda p-3 text-sm">
            <input type="checkbox" name="a13" defaultChecked={a13Ativo} className="mt-0.5 h-4 w-4 accent-marca" />
            <span>
              <span className="font-semibold">Analista de 1:1 (A13) ligado</span>
              <span className="block text-texto-suave">
                Lê a transcrição pelo n8n (Gemini) e sugere o registro. A transcrição não passa pela fila geral; o resultado fica
                só no conteúdo privado da 1:1.
              </span>
            </span>
          </label>
          <div className="flex justify-end"><Botao type="submit" carregando={pendente}>Salvar</Botao></div>
        </form>
      </Dialogo>
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowRightLeft, Mail, Plus, Trash2, UserPlus } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Cartao, CabecalhoCartao } from "@/components/ui/cartao";
import { Dialogo } from "@/components/ui/dialogo";
import { criarClienteConvite } from "@/lib/supabase/client";
import { mensagemDeErro } from "@/lib/erros";
import { urlDoSite } from "@/lib/url";
import {
  alterarCargo, alterarDataEntrada, alterarRodizio, criarPreCadastro, definirAtivo, marcarConviteEnviado, removerPreCadastro,
  salvarProcessoSeletivo, transferirCarteira, type Resultado,
} from "./acoes";

function avisar(r: Resultado, sucesso: string) {
  if (r.ok) toast.success(sucesso);
  else toast.error(r.erro);
}

export function NovoPreCadastro({ diretorias }: { diretorias: { slug: string; nome: string }[] }) {
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();

  function enviar(form: FormData) {
    iniciar(async () => {
      const r = await criarPreCadastro({
        nome: String(form.get("nome")),
        email: String(form.get("email")),
        diretoria: String(form.get("diretoria")),
        cargo: String(form.get("cargo")) as "assessor",
      });
      avisar(r, "Pessoa pré-cadastrada. Agora envie o convite.");
      if (r.ok) setAberto(false);
    });
  }

  return (
    <>
      <Botao onClick={() => setAberto(true)}><UserPlus className="h-4 w-4" /> Pré-cadastrar pessoa</Botao>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo="Pré-cadastrar pessoa"
        descricao="Só e-mails pré-cadastrados conseguem criar conta. O cargo é definido aqui, nunca pela própria pessoa.">
        <form action={enviar} className="space-y-4">
          <Campo rotulo="Nome completo" obrigatorio><Entrada name="nome" required /></Campo>
          <Campo rotulo="E-mail @aprimoraej.com" obrigatorio><Entrada name="email" type="email" required /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Diretoria">
              <Selecao name="diretoria" defaultValue={diretorias[0]?.slug}>
                {diretorias.map((d) => <option key={d.slug} value={d.slug}>{d.nome}</option>)}
              </Selecao>
            </Campo>
            <Campo rotulo="Cargo">
              <Selecao name="cargo" defaultValue="assessor">
                <option value="trainee">Trainee</option>
                <option value="assessor">Assessor</option>
                <option value="diretor">Diretor</option>
              </Selecao>
            </Campo>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Botao type="button" variante="secundario" onClick={() => setAberto(false)}>Cancelar</Botao>
            <Botao type="submit" carregando={pendente}>Pré-cadastrar</Botao>
          </div>
        </form>
      </Dialogo>
    </>
  );
}

export function AcoesPreCadastro({ id, email, podeGerir }: { id: string; email: string; podeGerir: boolean }) {
  const [pendente, iniciar] = useTransition();
  if (!podeGerir) return null;

  function enviarConvite() {
    iniciar(async () => {
      // Dispara o e-mail com o link de ativação (o mesmo do "Primeiro acesso").
      const { error } = await criarClienteConvite().auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, emailRedirectTo: `${urlDoSite()}/auth/confirmar?proximo=/definir-senha` },
      });
      if (error) return void toast.error(mensagemDeErro(error));
      avisar(await marcarConviteEnviado(id), `Convite enviado para ${email}.`);
    });
  }

  return (
    <>
      <Botao tamanho="sm" variante="secundario" onClick={enviarConvite} carregando={pendente}>
        <Mail className="h-3.5 w-3.5" /> Enviar convite
      </Botao>
      <Botao tamanho="sm" variante="fantasma" aria-label="Remover pré-cadastro"
        onClick={() => confirm("Remover este pré-cadastro?") && iniciar(async () => avisar(await removerPreCadastro(id), "Pré-cadastro removido."))}>
        <Trash2 className="h-3.5 w-3.5" />
      </Botao>
    </>
  );
}

export function AcoesMembro({
  membroId, diretoria, cargo, ativo, participaRodizio, ehVoce, mostrarRodizio,
}: {
  membroId: string; diretoria: string; cargo: "diretor" | "assessor" | "trainee"; ativo: boolean;
  participaRodizio: boolean; ehVoce: boolean; mostrarRodizio: boolean;
}) {
  const [pendente, iniciar] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {mostrarRodizio && cargo !== "diretor" && (
        <label className="flex items-center gap-1.5 text-xs text-texto-suave" title="Recebe leads pelo rodízio automático">
          <input type="checkbox" defaultChecked={participaRodizio} disabled={pendente}
            onChange={(e) => iniciar(async () => avisar(await alterarRodizio(membroId, diretoria, e.target.checked), "Rodízio atualizado."))} />
          Rodízio
        </label>
      )}
      <Selecao className="h-8 w-32 text-xs" defaultValue={cargo} disabled={pendente}
        onChange={(e) => {
          const novo = e.target.value as typeof cargo;
          if (ehVoce && cargo === "diretor" && novo !== "diretor" && !confirm("Você vai deixar de ser diretor desta diretoria. Continuar?")) {
            e.target.value = cargo;
            return;
          }
          iniciar(async () => {
            const r = await alterarCargo(membroId, diretoria, novo);
            avisar(r, "Cargo atualizado.");
            if (!r.ok) e.target.value = cargo;
          });
        }}>
        <option value="trainee">Trainee</option>
        <option value="assessor">Assessor</option>
        <option value="diretor">Diretor</option>
      </Selecao>
      {!ehVoce && (
        <Botao tamanho="sm" variante={ativo ? "fantasma" : "secundario"} disabled={pendente}
          onClick={() => (ativo ? confirm("Desativar este membro? Ele perde o acesso imediatamente.") : true)
            && iniciar(async () => avisar(await definirAtivo(membroId, !ativo), ativo ? "Membro desativado." : "Membro reativado."))}>
          {ativo ? "Desativar" : "Reativar"}
        </Botao>
      )}
    </div>
  );
}

/** Data em que a pessoa entrou na EJ (processo seletivo). Só o diretor edita. */
export function DataEntrada({ membroId, valor, podeEditar }: { membroId: string; valor: string | null; podeEditar: boolean }) {
  const [pendente, iniciar] = useTransition();
  if (!podeEditar) {
    return valor ? <span className="text-xs text-texto-suave">Entrou em {valor.split("-").reverse().join("/")}</span> : null;
  }
  return (
    <label className="flex items-center gap-1.5 text-xs text-texto-suave" title="Data de entrada na Aprimora">
      Entrada
      <Entrada type="date" className="h-8 w-36 text-xs" defaultValue={valor ?? ""} disabled={pendente}
        onChange={(e) => {
          const nova = e.target.value || null;
          iniciar(async () => avisar(await alterarDataEntrada(membroId, nova), "Data de entrada atualizada."));
        }} />
    </label>
  );
}

/** Passa negócios abertos, tarefas abertas e atividades futuras de uma pessoa para outra. */
export function TransferirCarteira({
  membroId, nome, diretoria, destinos,
}: {
  membroId: string; nome: string; diretoria: string; destinos: { id: string; nome: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const opcoes = destinos.filter((d) => d.id !== membroId);

  function enviar(form: FormData) {
    const para = String(form.get("para"));
    const destino = opcoes.find((o) => o.id === para)?.nome;
    if (!confirm(`Transferir a carteira de ${nome} para ${destino}?`)) return;
    iniciar(async () => {
      const r = await transferirCarteira(membroId, para, diretoria);
      if (!r.ok) return void toast.error(r.erro);
      toast.success(r.resumo ?? "Carteira transferida.");
      setAberto(false);
    });
  }

  return (
    <>
      <Botao tamanho="sm" variante="fantasma" onClick={() => setAberto(true)} title="Transferir carteira">
        <ArrowRightLeft className="h-3.5 w-3.5" /> Carteira
      </Botao>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo={`Transferir carteira de ${nome}`}
        descricao="Negócios em aberto, tarefas não concluídas e atividades futuras passam para a pessoa escolhida. Fica registrado na auditoria.">
        <form action={enviar} className="space-y-4">
          <Campo rotulo="Transferir para" obrigatorio>
            <Selecao name="para" required defaultValue="">
              <option value="" disabled>Escolha…</option>
              {opcoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </Selecao>
          </Campo>
          <div className="flex justify-end gap-2 pt-2">
            <Botao type="button" variante="secundario" onClick={() => setAberto(false)}>Cancelar</Botao>
            <Botao type="submit" carregando={pendente}>Transferir</Botao>
          </div>
        </form>
      </Dialogo>
    </>
  );
}

export function ProcessosSeletivos({ processos }: { processos: { id: string; nome: string; data: string }[] }) {
  const [pendente, iniciar] = useTransition();
  return (
    <Cartao>
      <CabecalhoCartao titulo="Processos seletivos" descricao="Quem entrou a partir da data do último processo conta como membro novo nos indicadores. A data de cada pessoa é ajustada em Membros." />
      <div className="divide-y divide-borda">
        {processos.map((p) => (
          <form key={p.id} className="flex flex-wrap items-center gap-2 px-6 py-3"
            action={(f) => iniciar(async () => avisar(await salvarProcessoSeletivo(p.id, { nome: String(f.get("nome")), data: String(f.get("data")) }), "Processo seletivo salvo."))}>
            <Entrada name="nome" defaultValue={p.nome} className="h-9 min-w-0 flex-1" />
            <Entrada name="data" type="date" defaultValue={p.data} className="h-9 w-40" required />
            <Botao type="submit" tamanho="sm" variante="secundario" carregando={pendente}>Salvar</Botao>
          </form>
        ))}
        <form className="flex flex-wrap items-center gap-2 px-6 py-3"
          action={(f) => iniciar(async () => avisar(await salvarProcessoSeletivo(null, { nome: String(f.get("nome")), data: String(f.get("data")) }), "Processo seletivo cadastrado."))}>
          <Entrada name="nome" placeholder="Ex.: Processo seletivo 2027/1" className="h-9 min-w-0 flex-1" required />
          <Entrada name="data" type="date" className="h-9 w-40" required />
          <Botao type="submit" tamanho="sm" carregando={pendente}><Plus className="h-3.5 w-3.5" /> Adicionar</Botao>
        </form>
      </div>
    </Cartao>
  );
}

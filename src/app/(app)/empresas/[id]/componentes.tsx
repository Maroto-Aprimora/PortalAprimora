"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, UserOff } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Cartao, CabecalhoCartao, Vazio } from "@/components/ui/cartao";
import { Dialogo } from "@/components/ui/dialogo";
import { Selo } from "@/components/ui/selo";
import { CamposEmpresa, lerEmpresa, type ValoresEmpresa } from "@/components/crm/campos-empresa";
import type { MembroResumo } from "@/lib/crm";
import type { Tables } from "@/lib/supabase/database.types";
import { criarNegocio } from "../../negocios/acoes";
import { excluirContato, excluirEmpresa, salvarContato, salvarEmpresa } from "../acoes";

export function EditarEmpresa({ empresa, segmentos, podeExcluir }: { empresa: ValoresEmpresa & { id: string }; segmentos: { id: string; nome: string }[]; podeExcluir: boolean }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  return (
    <>
      <Botao variante="secundario" onClick={() => setAberto(true)}><Pencil className="h-4 w-4" /> Editar</Botao>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo="Editar empresa" className="w-[min(94vw,880px)]">
        <form action={(form) => iniciar(async () => {
          const r = await salvarEmpresa(empresa.id, lerEmpresa(form));
          if (!r.ok) return void toast.error(r.erro);
          toast.success("Empresa atualizada.");
          setAberto(false);
        })}>
          <CamposEmpresa segmentos={segmentos} valores={empresa} />
          <div className="mt-4 flex items-center justify-between gap-2">
            {podeExcluir ? (
              <Botao type="button" variante="fantasma" className="text-perigo" onClick={() =>
                confirm("Excluir esta empresa, seus contatos e todos os cards dela no funil? Esta ação não pode ser desfeita.") && iniciar(async () => {
                  const r = await excluirEmpresa(empresa.id);
                  if (!r.ok) return void toast.error(r.erro);
                  toast.success("Empresa excluída.");
                  router.replace("/empresas");
                })}>
                <Trash2 className="h-4 w-4" /> Excluir empresa
              </Botao>
            ) : <span />}
            <div className="flex gap-2">
              <Botao type="button" variante="secundario" onClick={() => setAberto(false)}>Cancelar</Botao>
              <Botao type="submit" carregando={pendente}>Salvar</Botao>
            </div>
          </div>
        </form>
      </Dialogo>
    </>
  );
}

export function NovoNegocio({
  empresaId, titulo, fases, origens, membros,
}: {
  empresaId: string; titulo: string; fases: { id: string; nome: string }[]; origens: { id: string; nome: string }[]; membros: MembroResumo[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  return (
    <>
      <Botao onClick={() => setAberto(true)}><Plus className="h-4 w-4" /> Novo negócio</Botao>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo="Novo negócio" descricao="Uma nova oportunidade com esta empresa (ex.: pós-venda ou retomada).">
        <form className="space-y-4" action={(form) => iniciar(async () => {
          const g = (k: string) => String(form.get(k) ?? "");
          const r = await criarNegocio({ empresa_id: empresaId, titulo: g("titulo"), fase_id: g("fase_id"), origem_id: g("origem_id"), responsavel_id: g("responsavel_id") });
          if (!r.ok) return void toast.error(r.erro);
          toast.success("Negócio criado.");
          router.push(`/negocios/${r.dados!.id}`);
        })}>
          <Campo rotulo="Título" obrigatorio><Entrada name="titulo" defaultValue={titulo} required /></Campo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Fase" obrigatorio>
              <Selecao name="fase_id" defaultValue={fases[0]?.id}>{fases.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</Selecao>
            </Campo>
            <Campo rotulo="Origem">
              <Selecao name="origem_id" defaultValue=""><option value="">—</option>{origens.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</Selecao>
            </Campo>
          </div>
          <Campo rotulo="Responsável">
            <Selecao name="responsavel_id" defaultValue=""><option value="">Rodízio automático</option>{membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</Selecao>
          </Campo>
          <div className="flex justify-end gap-2">
            <Botao type="button" variante="secundario" onClick={() => setAberto(false)}>Cancelar</Botao>
            <Botao type="submit" carregando={pendente}>Criar</Botao>
          </div>
        </form>
      </Dialogo>
    </>
  );
}

type Contato = Tables<"contatos">;

export function Contatos({ empresaId, contatos, podeEditar }: { empresaId: string; contatos: Contato[]; podeEditar: boolean }) {
  const [editando, setEditando] = useState<Contato | "novo" | null>(null);
  const [pendente, iniciar] = useTransition();
  const ordenados = [...contatos].sort((a, b) => Number(b.decisor) - Number(a.decisor) || a.nome.localeCompare(b.nome));

  return (
    <Cartao>
      <CabecalhoCartao titulo="Contatos" acoes={podeEditar && <Botao tamanho="sm" variante="secundario" onClick={() => setEditando("novo")}><Plus className="h-3.5 w-3.5" /> Contato</Botao>} />
      <ul className="divide-y divide-borda">
        {ordenados.map((c) => (
          <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 px-6 py-3 text-sm">
            <div className="min-w-0">
              <p className="font-semibold">
                {c.nome} {c.decisor && <Selo tom="destaque">Decisor</Selo>} {c.nao_contatar && <Selo tom="perigo">Não contatar</Selo>}
              </p>
              <p className="text-texto-suave">{[c.cargo, c.email, c.telefone].filter(Boolean).join(" · ") || "—"}</p>
              {c.linkedin && <a href={c.linkedin} target="_blank" rel="noreferrer" className="text-xs text-marca underline-offset-4 hover:underline">LinkedIn</a>}
            </div>
            {podeEditar && (
              <div className="flex gap-1">
                <Botao tamanho="icone" variante="fantasma" aria-label="Editar contato" onClick={() => setEditando(c)}><Pencil className="h-4 w-4" /></Botao>
                <Botao tamanho="icone" variante="fantasma" aria-label="Excluir contato" disabled={pendente} onClick={() =>
                  confirm(`Excluir ${c.nome}?`) && iniciar(async () => {
                    const r = await excluirContato(empresaId, c.id);
                    if (r.ok) toast.success("Contato excluído.");
                    else toast.error(r.erro);
                  })}>
                  <Trash2 className="h-4 w-4" />
                </Botao>
              </div>
            )}
          </li>
        ))}
        {contatos.length === 0 && <Vazio compacto elemento="li" icone={UserOff} titulo="Nenhum contato cadastrado." />}
      </ul>
      {editando && (
        <Dialogo aberto aoFechar={() => setEditando(null)} titulo={editando === "novo" ? "Novo contato" : "Editar contato"}>
          <form className="grid gap-4 sm:grid-cols-2" action={(form) => iniciar(async () => {
            const g = (k: string) => String(form.get(k) ?? "");
            const r = await salvarContato(empresaId, editando === "novo" ? null : editando.id, {
              nome: g("nome"), cargo: g("cargo"), email: g("email"), telefone: g("telefone"), linkedin: g("linkedin"), observacoes: g("observacoes"),
              decisor: form.get("decisor") === "on", nao_contatar: form.get("nao_contatar") === "on",
            });
            if (!r.ok) return void toast.error(r.erro);
            toast.success("Contato salvo.");
            setEditando(null);
          })}>
            {(() => {
              const c = editando === "novo" ? null : editando;
              return (
                <>
                  <Campo rotulo="Nome" obrigatorio className="sm:col-span-2"><Entrada name="nome" defaultValue={c?.nome ?? ""} required /></Campo>
                  <Campo rotulo="Cargo"><Entrada name="cargo" defaultValue={c?.cargo ?? ""} /></Campo>
                  <Campo rotulo="E-mail"><Entrada type="email" name="email" defaultValue={c?.email ?? ""} /></Campo>
                  <Campo rotulo="Telefone"><Entrada name="telefone" defaultValue={c?.telefone ?? ""} /></Campo>
                  <Campo rotulo="LinkedIn"><Entrada name="linkedin" defaultValue={c?.linkedin ?? ""} /></Campo>
                  <Campo rotulo="Observações" className="sm:col-span-2"><Entrada name="observacoes" defaultValue={c?.observacoes ?? ""} /></Campo>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="decisor" defaultChecked={c?.decisor ?? false} /> É decisor</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="nao_contatar" defaultChecked={c?.nao_contatar ?? false} /> Pediu para não ser contatado (LGPD)</label>
                  <div className="flex justify-end gap-2 sm:col-span-2">
                    <Botao type="button" variante="secundario" onClick={() => setEditando(null)}>Cancelar</Botao>
                    <Botao type="submit" carregando={pendente}>Salvar</Botao>
                  </div>
                </>
              );
            })()}
          </form>
        </Dialogo>
      )}
    </Cartao>
  );
}

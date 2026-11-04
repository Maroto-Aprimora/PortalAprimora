"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Cartao, CabecalhoCartao } from "@/components/ui/cartao";
import { CamposEmpresa, lerEmpresa } from "@/components/crm/campos-empresa";
import type { MembroResumo } from "@/lib/crm";
import { buscarSemelhantes, criarLead, type Semelhante } from "../acoes";

export function FormNovoLead({
  segmentos, origens, membros, fases,
}: {
  segmentos: { id: string; nome: string }[]; origens: { id: string; nome: string }[]; membros: MembroResumo[];
  fases: { id: string; nome: string; chave: string }[];
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [chave, setChave] = useState({ nome: "", cnpj: "", telefone: "", site: "" });
  const [semelhantes, setSemelhantes] = useState<Semelhante[]>([]);
  const ultimaBusca = useRef(0);

  // Verifica duplicidade enquanto a pessoa digita (com atraso para não consultar a cada tecla)
  useEffect(() => {
    const t = setTimeout(async () => {
      const id = ++ultimaBusca.current;
      const r = await buscarSemelhantes(chave.nome, chave.cnpj, chave.telefone, chave.site);
      if (id === ultimaBusca.current) setSemelhantes(r);
    }, 500);
    return () => clearTimeout(t);
  }, [chave]);

  function enviar(form: FormData) {
    if (semelhantes.some((s) => s.motivo === "Mesmo CNPJ")) {
      toast.error("Já existe uma empresa com este CNPJ. Abra o cadastro existente.");
      return;
    }
    if (semelhantes.length > 0 && !confirm("Encontramos empresas parecidas. Cadastrar mesmo assim?")) return;
    const g = (k: string) => String(form.get(k) ?? "");
    iniciar(async () => {
      const r = await criarLead({
        empresa: lerEmpresa(form),
        decisor: { nome: g("decisor_nome"), cargo: g("decisor_cargo"), email: g("decisor_email"), telefone: g("decisor_telefone"), linkedin: g("decisor_linkedin") },
        negocio: {
          fase_id: g("fase_id"), origem_id: g("origem_id"), origem_detalhe: g("origem_detalhe"), responsavel_id: g("responsavel_id"),
          data_coldcall_1: g("data_coldcall_1"), data_coldcall_2: g("data_coldcall_2"), dores_identificadas: g("dores_identificadas"),
        },
      });
      if (!r.ok) return void toast.error(r.erro);
      toast.success("Lead cadastrado!");
      router.push(`/negocios/${r.dados!.negocioId}`);
    });
  }

  return (
    <form action={enviar} className="space-y-6">
      <Cartao>
        <CabecalhoCartao titulo="Empresa" />
        <div className="px-6 py-4">
          <CamposEmpresa segmentos={segmentos} aoMudar={(c, v) => (c in chave ? setChave((s) => ({ ...s, [c]: v })) : undefined)} />
          {semelhantes.length > 0 && (
            <div className="mt-4 rounded-controle border border-destaque/50 bg-destaque-suave p-3 text-sm">
              <p className="flex items-center gap-2 font-semibold text-destaque"><AlertTriangle className="h-4 w-4" /> Possível duplicidade</p>
              <ul className="mt-2 space-y-1">
                {semelhantes.map((s) => (
                  <li key={s.id}>
                    <Link href={`/empresas/${s.id}`} target="_blank" className="font-semibold underline">{s.nome}</Link>
                    {s.cidade && <span className="text-texto-suave"> · {s.cidade}</span>}
                    <span className="text-texto-suave"> — {s.motivo}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Cartao>

      <Cartao>
        <CabecalhoCartao titulo="Decisor" descricao="Opcional. Você pode cadastrar mais contatos depois, na página da empresa." />
        <div className="grid gap-4 px-6 py-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo rotulo="Nome"><Entrada name="decisor_nome" /></Campo>
          <Campo rotulo="Cargo"><Entrada name="decisor_cargo" placeholder="Sócio, gerente de produção…" /></Campo>
          <Campo rotulo="E-mail"><Entrada type="email" name="decisor_email" /></Campo>
          <Campo rotulo="Telefone / WhatsApp"><Entrada name="decisor_telefone" /></Campo>
          <Campo rotulo="LinkedIn" className="lg:col-span-2"><Entrada name="decisor_linkedin" placeholder="https://linkedin.com/in/…" /></Campo>
        </div>
      </Cartao>

      <Cartao>
        <CabecalhoCartao titulo="Entrada no funil" />
        <div className="grid gap-4 px-6 py-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo rotulo="Fase inicial" obrigatorio dica="“Entrada de leads” vai automaticamente para Enriquecimento.">
            <Selecao name="fase_id" defaultValue={fases[0]?.id} required>
              {fases.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Origem do lead" obrigatorio>
            <Selecao name="origem_id" defaultValue="" required>
              <option value="" disabled>Selecione…</option>
              {origens.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Detalhe da origem"><Entrada name="origem_detalhe" placeholder="Quem indicou, qual evento…" /></Campo>
          <Campo rotulo="Responsável" dica="Vazio = rodízio automático ao entrar em E-mail.">
            <Selecao name="responsavel_id" defaultValue="">
              <option value="">Rodízio automático</option>
              {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Data coldcall 1"><Entrada type="date" name="data_coldcall_1" /></Campo>
          <Campo rotulo="Data coldcall 2"><Entrada type="date" name="data_coldcall_2" /></Campo>
          <Campo rotulo="Dores identificadas" className="sm:col-span-2 lg:col-span-3"><AreaTexto name="dores_identificadas" /></Campo>
        </div>
      </Cartao>

      <div className="flex justify-end gap-2">
        <Link href="/empresas" className="inline-flex h-10 items-center rounded-controle px-4 text-sm font-semibold text-texto-suave hover:bg-superficie-2">Cancelar</Link>
        <Botao type="submit" carregando={pendente}>Cadastrar lead</Botao>
      </div>
    </form>
  );
}

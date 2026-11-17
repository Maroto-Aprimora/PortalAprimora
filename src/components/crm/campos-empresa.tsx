import { Campo, Entrada, Selecao, AreaTexto } from "@/components/ui/campos";

export type ValoresEmpresa = Partial<{
  nome: string; razao_social: string | null; cnpj: string | null; segmento_id: string | null; telefone: string | null;
  email_principal: string | null; email_secundario: string | null; email_terciario: string | null; site: string | null;
  rede_social: string | null; endereco: string | null; cidade: string | null; uf: string | null; observacoes: string | null;
}>;

/** Campos da empresa (os mesmos do "Formulário inicial" do Pipefy). Usado no novo lead e na edição. */
export function CamposEmpresa({
  segmentos, valores = {}, aoMudar, prefixo = "", comAnotacao = false,
}: {
  segmentos: { id: string; nome: string }[]; valores?: ValoresEmpresa; aoMudar?: (campo: string, valor: string) => void; prefixo?: string;
  /** Só no novo lead: a primeira anotação vai para o card criado (as anotações moram no card, não na empresa). */
  comAnotacao?: boolean;
}) {
  const n = (c: string) => `${prefixo}${c}`;
  const mudar = (c: string) => (e: React.ChangeEvent<HTMLInputElement>) => aoMudar?.(c, e.target.value);
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Campo rotulo="Nome da empresa" obrigatorio className="sm:col-span-2">
        <Entrada name={n("nome")} defaultValue={valores.nome ?? ""} required onChange={mudar("nome")} />
      </Campo>
      <Campo rotulo="CNPJ"><Entrada name={n("cnpj")} defaultValue={valores.cnpj ?? ""} placeholder="00.000.000/0000-00" onChange={mudar("cnpj")} /></Campo>
      <Campo rotulo="Razão social" className="sm:col-span-2"><Entrada name={n("razao_social")} defaultValue={valores.razao_social ?? ""} /></Campo>
      <Campo rotulo="Segmento">
        <Selecao name={n("segmento_id")} defaultValue={valores.segmento_id ?? ""}>
          <option value="">—</option>
          {segmentos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </Selecao>
      </Campo>
      <Campo rotulo="Telefone"><Entrada name={n("telefone")} defaultValue={valores.telefone ?? ""} placeholder="(43) 3333-0000" onChange={mudar("telefone")} /></Campo>
      <Campo rotulo="E-mail principal"><Entrada type="email" name={n("email_principal")} defaultValue={valores.email_principal ?? ""} /></Campo>
      <Campo rotulo="Site"><Entrada name={n("site")} defaultValue={valores.site ?? ""} placeholder="www.empresa.com.br" onChange={mudar("site")} /></Campo>
      <Campo rotulo="E-mail secundário"><Entrada type="email" name={n("email_secundario")} defaultValue={valores.email_secundario ?? ""} /></Campo>
      <Campo rotulo="E-mail terciário"><Entrada type="email" name={n("email_terciario")} defaultValue={valores.email_terciario ?? ""} /></Campo>
      <Campo rotulo="Rede social"><Entrada name={n("rede_social")} defaultValue={valores.rede_social ?? ""} placeholder="@empresa" /></Campo>
      <Campo rotulo="Endereço" className="sm:col-span-2"><Entrada name={n("endereco")} defaultValue={valores.endereco ?? ""} /></Campo>
      <div className="grid grid-cols-[1fr_80px] gap-3">
        <Campo rotulo="Cidade"><Entrada name={n("cidade")} defaultValue={valores.cidade ?? ""} placeholder="Londrina" /></Campo>
        <Campo rotulo="UF"><Entrada name={n("uf")} defaultValue={valores.uf ?? ""} maxLength={2} placeholder="PR" /></Campo>
      </div>
      {comAnotacao && (
        <Campo rotulo="Primeira anotação" dica="Fica nas anotações do card." className="sm:col-span-2 lg:col-span-3">
          <AreaTexto name={n("observacoes")} defaultValue="" className="min-h-16" />
        </Campo>
      )}
    </div>
  );
}

const CHAVES_EMPRESA = ["nome", "razao_social", "cnpj", "segmento_id", "telefone", "email_principal", "email_secundario",
  "email_terciario", "site", "rede_social", "endereco", "cidade", "uf", "observacoes"] as const;

export function lerEmpresa(form: FormData, prefixo = "") {
  return Object.fromEntries(CHAVES_EMPRESA.map((k) => [k, String(form.get(`${prefixo}${k}`) ?? "")]));
}

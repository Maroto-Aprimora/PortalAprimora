"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarPlus, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { Botao, classeBotao } from "@/components/ui/botao";
import { Entrada } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { gerarLinkAgenda } from "@/app/(app)/agenda/acoes";
import { formatarDataHora } from "@/lib/formatar";

/**
 * Liga a agenda do portal ao Google Agenda de cada membro: gera um link pessoal (assinatura iCalendar) com os
 * compromissos em que a pessoa é responsável ou participante e as reuniões fixas. O link aparece uma única vez;
 * gerar outro desliga o anterior.
 */
export function GoogleAgenda({ conectadoEm }: { conectadoEm: string | null }) {
  const [aberto, setAberto] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function gerar() {
    iniciar(async () => {
      const r = await gerarLinkAgenda();
      if (!r.ok) return void toast.error(r.erro);
      setLink(`${window.location.origin}/api/agenda/${r.token}.ics`);
    });
  }
  const noGoogle = link ? `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(link.replace(/^https?:/, "webcal:"))}` : "";

  return (
    <>
      <Botao variante="secundario" onClick={() => setAberto(true)}><CalendarPlus className="h-4 w-4" /> Google Agenda</Botao>
      <Dialogo aberto={aberto} aoFechar={() => { setAberto(false); setLink(null); }} titulo="Conectar ao Google Agenda"
        descricao="Seus compromissos do portal (em que você é responsável ou participante) e as reuniões fixas aparecem no seu Google Agenda.">
        <div className="space-y-4 text-sm">
          {!link ? (
            <>
              <p className="text-texto-suave">
                {conectadoEm
                  ? `Você já gerou um link em ${formatarDataHora(conectadoEm)}. Se perdeu o link ou quer desligar o antigo, gere um novo: o anterior para de funcionar.`
                  : "Gere seu link pessoal e adicione no Google Agenda com um clique."}
              </p>
              <Botao onClick={gerar} carregando={pendente}>
                {conectadoEm ? <><RefreshCw className="h-4 w-4" /> Gerar novo link</> : <><CalendarPlus className="h-4 w-4" /> Gerar meu link</>}
              </Botao>
            </>
          ) : (
            <>
              <a href={noGoogle} target="_blank" rel="noreferrer" className={classeBotao("destaque")}>
                <ExternalLink className="h-4 w-4" /> Adicionar ao meu Google Agenda
              </a>
              <div className="space-y-1">
                <p className="text-texto-suave">Ou copie o link e, no Google Agenda, use <strong>Outras agendas → + → Do URL</strong>:</p>
                <div className="flex gap-2">
                  <Entrada readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
                  <Botao variante="secundario" tamanho="icone" aria-label="Copiar link"
                    onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Link copiado."))}><Copy className="h-4 w-4" /></Botao>
                </div>
              </div>
              <p className="text-xs text-texto-suave">
                Guarde este link só para você: quem tiver o link vê seus compromissos. O Google atualiza a agenda assinada sozinho,
                a cada poucas horas; mudanças no portal podem levar esse tempo para aparecer.
              </p>
            </>
          )}
        </div>
      </Dialogo>
    </>
  );
}

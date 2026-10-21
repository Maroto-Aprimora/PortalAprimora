import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/**
 * Agenda pessoal no formato iCalendar, para assinar no Google Agenda ("Adicionar agenda → Do URL").
 * O código do link é a credencial: o banco confere o hash (public.agenda_do_link) e devolve só os compromissos
 * do membro dono do link. O Google atualiza a assinatura sozinho, de algumas em algumas horas.
 */
export const dynamic = "force-dynamic";

type Atividade = { id: string; titulo: string; inicio: string; fim: string | null; local: string | null; link: string | null;
  status: string; tipo: string; empresa: string | null; atualizado: string };
type Recorrente = { id: string; titulo: string; dia_semana: number; hora_inicio: string; hora_fim: string; local: string | null;
  valida_de: string; valida_ate: string | null };

const DIAS_ICS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** Texto escapado e quebrado em linhas de até 75 caracteres (RFC 5545). */
function linha(chave: string, valor: string) {
  const escapado = valor.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const completa = `${chave}:${escapado}`;
  const partes: string[] = [];
  for (let i = 0; i < completa.length; i += 73) partes.push((i ? " " : "") + completa.slice(i, i + 73));
  return partes.join("\r\n");
}
const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const local = (dia: string, hora: string) => `${dia.replace(/-/g, "")}T${hora.slice(0, 5).replace(":", "")}00`;

/** Primeiro dia (a partir de `de`) que cai no dia da semana pedido. */
function primeiroDia(de: string, diaSemana: number) {
  const d = new Date(`${de}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + ((diaSemana - d.getUTCDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const codigo = token.replace(/\.ics$/, "");
  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc("agenda_do_link", { _token: codigo });
  if (error) return new Response("Erro ao montar a agenda", { status: 500 });
  if (!data) return new Response("Link inválido ou trocado. Gere um novo na Agenda do portal.", { status: 404 });

  const agenda = data as { membro: string; atividades: Atividade[]; recorrentes: Recorrente[] };
  const agora = utc(new Date().toISOString());
  const eventos: string[] = [];
  for (const a of agenda.atividades) {
    const fim = a.fim ?? new Date(new Date(a.inicio).getTime() + 60 * 60 * 1000).toISOString();
    eventos.push([
      "BEGIN:VEVENT",
      `UID:${a.id}@portal-aprimora`,
      `DTSTAMP:${agora}`,
      `LAST-MODIFIED:${utc(a.atualizado)}`,
      `DTSTART:${utc(a.inicio)}`,
      `DTEND:${utc(fim)}`,
      linha("SUMMARY", a.titulo),
      linha("DESCRIPTION", [a.tipo, a.empresa, a.link ? `Link: ${a.link}` : null, a.status === "pendente" ? "Ainda não confirmado" : null]
        .filter(Boolean).join("\n")),
      ...(a.local ? [linha("LOCATION", a.local)] : []),
      ...(a.link ? [linha("URL", a.link)] : []),
      `STATUS:${a.status === "pendente" ? "TENTATIVE" : "CONFIRMED"}`,
      "END:VEVENT",
    ].join("\r\n"));
  }
  for (const r of agenda.recorrentes) {
    const dia = primeiroDia(r.valida_de, r.dia_semana);
    eventos.push([
      "BEGIN:VEVENT",
      `UID:${r.id}@portal-aprimora`,
      `DTSTAMP:${agora}`,
      `DTSTART;TZID=America/Sao_Paulo:${local(dia, r.hora_inicio)}`,
      `DTEND;TZID=America/Sao_Paulo:${local(dia, r.hora_fim)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${DIAS_ICS[r.dia_semana]}${r.valida_ate ? `;UNTIL=${r.valida_ate.replace(/-/g, "")}T235959Z` : ""}`,
      linha("SUMMARY", r.titulo),
      ...(r.local ? [linha("LOCATION", r.local)] : []),
      "END:VEVENT",
    ].join("\r\n"));
  }

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Aprimora//Portal Aprimora//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    linha("X-WR-CALNAME", `Portal Aprimora · ${agenda.membro}`),
    "X-WR-TIMEZONE:America/Sao_Paulo",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    "BEGIN:VTIMEZONE",
    "TZID:America/Sao_Paulo",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:-0300",
    "TZOFFSETTO:-0300",
    "TZNAME:-03",
    "END:STANDARD",
    "END:VTIMEZONE",
    ...eventos,
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="portal-aprimora.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
}

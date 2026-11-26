import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/**
 * Envia os e-mails do sistema (fila emails_sistema). Chamada pelo banco (gatilho via pg_net), com o mesmo segredo do push
 * (PUSH_SEGREDO). Envio pelo Gmail com senha de app: GMAIL_USER e GMAIL_APP_PASSWORD na Vercel. O resultado volta ao banco
 * por email_resultado; o que falhar é tentado de novo pelo job reenviar-emails.
 */
export const maxDuration = 30;

const esquema = z.object({
  id: z.guid(),
  para: z.array(z.email()).min(1),
  copia: z.array(z.email()).default([]),
  assunto: z.string().min(1).max(300),
  texto: z.string().max(20000),
  link: z.string().nullable().optional(),
});

function segredoConfere(recebido: string | null) {
  const esperado = process.env.PUSH_SEGREDO;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function POST(request: Request) {
  const segredo = request.headers.get("x-email-segredo");
  if (!segredoConfere(segredo)) return Response.json({ erro: "não autorizado" }, { status: 401 });
  const v = esquema.safeParse(await request.json().catch(() => null));
  if (!v.success) return Response.json({ erro: v.error.issues[0]?.message ?? "dados inválidos" }, { status: 400 });
  const e = v.data;

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const registrar = (ok: boolean, erro?: string) =>
    supabase.rpc("email_resultado", { _segredo: segredo!, _id: e.id, _ok: ok, ...(erro ? { _erro: erro } : {}) });

  const usuario = process.env.GMAIL_USER;
  const senha = process.env.GMAIL_APP_PASSWORD;
  if (!usuario || !senha) {
    await registrar(false, "E-mail não configurado: defina GMAIL_USER e GMAIL_APP_PASSWORD na Vercel.");
    return Response.json({ erro: "e-mail não configurado" }, { status: 503 });
  }

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const link = e.link && site ? `${site}${e.link.startsWith("/") ? e.link : `/${e.link}`}` : null;
  const texto = link ? `${e.texto}\n\nAbrir no Portal: ${link}` : e.texto;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#1f2937">
${escapar(e.texto).replace(/\n/g, "<br>")}
${link ? `<p style="margin-top:20px"><a href="${escapar(link)}" style="background:#24476f;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Abrir no Portal</a></p>` : ""}
<p style="margin-top:24px;font-size:12px;color:#6b7280">Portal Aprimora · mensagem automática</p></div>`;

  try {
    const transporte = nodemailer.createTransport({ service: "gmail", auth: { user: usuario, pass: senha } });
    await transporte.sendMail({
      from: { name: "Portal Aprimora", address: usuario }, to: e.para, cc: e.copia.length ? e.copia : undefined,
      subject: e.assunto, text: texto, html,
    });
    await registrar(true);
    return Response.json({ ok: true });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    await registrar(false, mensagem.slice(0, 1000));
    return Response.json({ erro: "falha no envio" }, { status: 502 });
  }
}

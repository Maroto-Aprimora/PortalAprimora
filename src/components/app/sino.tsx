"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, BellRing, CheckCheck } from "@/components/ui/icones";
import { toast } from "sonner";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { formatarDataHora } from "@/lib/formatar";
import { cn } from "@/lib/utils";
import { Vazio } from "@/components/ui/cartao";

type Notificacao = { id: string; titulo: string; mensagem: string | null; link: string | null; lida_em: string | null; created_at: string };

/** Sino de notificações: lista as últimas, marca como lidas e ativa o push no aparelho. */
export function Sino({ claro = false }: { claro?: boolean }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<Notificacao[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const naoLidas = itens.filter((n) => !n.lida_em).length;

  const carregar = useCallback(async () => {
    const { data } = await criarClienteNavegador()
      .from("notificacoes").select("id, titulo, mensagem, link, lida_em, created_at")
      .order("created_at", { ascending: false }).limit(30);
    if (data) setItens(data);
  }, []);

  useEffect(() => {
    const primeira = setTimeout(carregar, 0);
    const t = setInterval(carregar, 60_000);
    const aoFocar = () => carregar();
    window.addEventListener("focus", aoFocar);
    return () => { clearTimeout(primeira); clearInterval(t); window.removeEventListener("focus", aoFocar); };
  }, [carregar]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setAberto(false);
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  async function marcarLidas(ids: string[]) {
    if (!ids.length) return;
    const agora = new Date().toISOString();
    setItens((xs) => xs.map((x) => (ids.includes(x.id) ? { ...x, lida_em: agora } : x)));
    await criarClienteNavegador().from("notificacoes").update({ lida_em: agora }).in("id", ids);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAberto((v) => !v)}
        className={cn("relative rounded-controle p-1.5", claro ? "hover:bg-white/10" : "hover:bg-superficie-2")}
        aria-label={`Notificações${naoLidas ? ` (${naoLidas} não lidas)` : ""}`}
      >
        {naoLidas ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        {naoLidas > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destaque px-1 text-2xs font-bold text-white">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>
      {aberto && (
        <div className={cn("absolute z-50 mt-2 w-80 max-w-[90vw] rounded-cartao border border-borda bg-superficie text-texto shadow-elevada", claro ? "left-0" : "right-0")}>
          <div className="flex items-center justify-between border-b border-borda px-4 py-3">
            <p className="text-sm font-bold">Notificações</p>
            {naoLidas > 0 && (
              <button className="flex items-center gap-1 text-xs font-semibold text-marca underline-offset-4 hover:underline"
                onClick={() => marcarLidas(itens.filter((n) => !n.lida_em).map((n) => n.id))}>
                <CheckCheck className="h-3.5 w-3.5" /> Marcar todas como lidas
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-borda overflow-y-auto">
            {itens.map((n) => (
              <li key={n.id}>
                <button className={cn("block w-full px-4 py-3 text-left text-sm hover:bg-superficie-2", !n.lida_em && "bg-destaque-suave/50")}
                  onClick={() => { marcarLidas([n.id]); setAberto(false); if (n.link) router.push(n.link); }}>
                  <p className="font-semibold">{n.titulo}</p>
                  {n.mensagem && <p className="text-texto-suave">{n.mensagem}</p>}
                  <p className="mt-0.5 text-2xs text-texto-suave">{formatarDataHora(n.created_at)}</p>
                </button>
              </li>
            ))}
            {itens.length === 0 && <Vazio compacto elemento="li" icone={BellOff} titulo="Nenhuma notificação." />}
          </ul>
          <AtivarPush />
        </div>
      )}
    </div>
  );
}

function base64ParaBytes(base64: string) {
  const preenchido = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(preenchido);
  return Uint8Array.from([...bruto].map((c) => c.charCodeAt(0)));
}

/** Botão para receber as notificações no celular/computador (Web Push). */
function AtivarPush() {
  const suportado = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const [estado, setEstado] = useState<NotificationPermission | "indisponivel">(suportado ? Notification.permission : "indisponivel");

  async function ativar() {
    try {
      const permissao = await Notification.requestPermission();
      setEstado(permissao);
      if (permissao !== "granted") return;
      const registro = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const assinatura = (await registro.pushManager.getSubscription())
        ?? (await registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64ParaBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
        }));
      const json = assinatura.toJSON();
      const { error } = await criarClienteNavegador().from("push_assinaturas").insert({
        endpoint: json.endpoint!, p256dh: json.keys!.p256dh, auth: json.keys!.auth, user_agent: navigator.userAgent.slice(0, 200),
      });
      if (error && error.code !== "23505") throw error;
      toast.success("Notificações ativadas neste aparelho.");
    } catch (e) {
      toast.error("Não foi possível ativar as notificações: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  if (estado === "indisponivel") {
    return <p className="border-t border-borda px-4 py-3 text-2xs text-texto-suave">No iPhone, instale o portal na tela de início (Compartilhar → Adicionar à Tela de Início) para receber notificações.</p>;
  }
  if (estado === "granted") return null;
  return (
    <div className="border-t border-borda px-4 py-3">
      <button onClick={ativar} className="text-xs font-semibold text-marca underline-offset-4 hover:underline">
        {estado === "denied" ? "Notificações bloqueadas no navegador — libere nas configurações do site." : "Receber notificações neste aparelho"}
      </button>
    </div>
  );
}

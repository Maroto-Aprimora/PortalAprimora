import { cn } from "@/lib/utils";

const base =
  "w-full rounded-controle border border-borda bg-superficie px-3 text-sm text-texto placeholder:text-texto-suave/70 " +
  "focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20 disabled:opacity-60";

export function Entrada({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, "h-10", className)} {...props} />;
}

export function AreaTexto({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, "min-h-24 py-2", className)} {...props} />;
}

export function Selecao({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(base, "h-10 pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Rotulo({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-xs font-semibold uppercase tracking-wide text-texto-suave", className)} {...props} />;
}

/** Rótulo + campo + dica/erro, empilhados. */
export function Campo({
  rotulo, dica, erro, obrigatorio, className, children, htmlFor,
}: {
  rotulo: string; dica?: string; erro?: string; obrigatorio?: boolean; className?: string; children: React.ReactNode; htmlFor?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Rotulo htmlFor={htmlFor}>
        {rotulo}
        {obrigatorio && <span className="ml-0.5 text-destaque">*</span>}
      </Rotulo>
      {children}
      {erro ? <p className="text-xs text-perigo">{erro}</p> : dica ? <p className="text-xs text-texto-suave">{dica}</p> : null}
    </div>
  );
}

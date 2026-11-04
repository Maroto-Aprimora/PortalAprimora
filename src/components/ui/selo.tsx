import { cn } from "@/lib/utils";

const tons = {
  neutro: "bg-superficie-2 text-texto-suave",
  marca: "bg-marca/10 text-marca dark:text-marca-forte",
  destaque: "bg-destaque-suave text-destaque",
  sucesso: "bg-sucesso-suave text-sucesso",
  perigo: "bg-perigo-suave text-perigo",
} as const;

export function Selo({ tom = "neutro", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tom?: keyof typeof tons }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold whitespace-nowrap", tons[tom], className)}
      {...props}
    />
  );
}

export function Avatar({ nome, iniciais, className }: { nome?: string | null; iniciais: string; className?: string }) {
  return (
    <span
      title={nome ?? undefined}
      className={cn("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marca text-2xs font-bold text-marca-texto", className)}
    >
      {iniciais}
    </span>
  );
}

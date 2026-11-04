import Image from "next/image";

/** Layout das telas de acesso: painel azul liso com a marca + formulário em fundo neutro. */
export default function LayoutAcesso({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden bg-institucional lg:flex lg:flex-col lg:items-center lg:justify-center">
        <Image src="/logo-vertical-branca.png" alt="Aprimora" width={560} height={460} priority className="h-auto w-64" />
        <p className="mt-6 font-titulo text-xs tracking-[0.3em] text-marca-texto/70">SOLUÇÕES EM PRODUÇÃO E GESTÃO EMPRESARIAL</p>
      </section>
      <section className="flex items-center justify-center bg-fundo px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image src="/marca-app.png" alt="" width={96} height={96} className="h-11 w-11" />
            <span className="font-titulo text-lg font-bold text-marca">Portal Aprimora</span>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}

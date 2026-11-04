import Image from "next/image";

/** Layout das telas de acesso: painel azul liso com a marca + formulário em fundo neutro. */
export default function LayoutAcesso({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden bg-institucional lg:flex lg:flex-col lg:items-center lg:justify-center">
        <Image src="/logo-quadrada.jpg" alt="Aprimora" width={240} height={240} priority />
        <p className="mt-6 font-titulo text-xs tracking-[0.3em] text-marca-texto/70">SOLUÇÕES EM PRODUÇÃO E GESTÃO EMPRESARIAL</p>
      </section>
      <section className="flex items-center justify-center bg-fundo px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image src="/logo-quadrada.jpg" alt="" width={44} height={44} className="rounded-controle" />
            <span className="font-titulo text-lg font-bold text-marca">Portal Aprimora</span>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}

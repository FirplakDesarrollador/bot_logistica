import { LoginForm } from "@/components/login-form";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f5ef] text-[#20231f]">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl gap-10 px-6 py-10 sm:px-10 lg:grid-cols-[1fr_420px] lg:items-center">
        <div className="space-y-7">
          <div className="inline-flex w-fit items-center gap-3 border border-[#d9d2c2] bg-white px-4 py-2 text-sm font-medium text-[#5d6f52]">
            <span className="h-2.5 w-2.5 bg-[#6c8f5e]" />
            Acceso operativo
          </div>

          <div className="space-y-5">
            <h1 className="max-w-3xl text-5xl font-semibold leading-tight sm:text-6xl">
              Bot Logistica
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[#5f625c]">
              Ingresa para consultar el estado de la operacion, revisar
              actividades pendientes y administrar los procesos logisticos.
            </p>
          </div>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}

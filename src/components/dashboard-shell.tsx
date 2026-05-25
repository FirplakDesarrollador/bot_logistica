"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase, supabaseRestUrl } from "@/lib/supabase";

type AgendamientoOrder = {
  ov: string;
  color: string;
  itemCount?: number;
  nombreCliente: string;
  clienteFinal: string;
  telefono: string;
  direccion: string;
  descCant: string;
};

type AgendamientoMeta = {
  fileName?: string;
  sheet?: string;
  matchedRows?: number;
  skippedZeroRows?: number;
  summary?: {
    total: number;
    yellow: number;
    green: number;
  };
};

export function DashboardShell() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [orders, setOrders] = useState<AgendamientoOrder[]>([]);
  const [ordersMeta, setOrdersMeta] = useState<AgendamientoMeta>({});
  const [ordersError, setOrdersError] = useState("");
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/");
        return;
      }

      setUser(data.session.user);
      setIsLoading(false);
      loadOrders();
    });
  }, [router]);

  async function loadOrders() {
    setIsLoadingOrders(true);
    setOrdersError("");

    try {
      const response = await fetch("/api/agendamiento", { cache: "no-store" });
      const data = (await response.json()) as {
        orders?: AgendamientoOrder[];
        fileName?: string;
        sheet?: string;
        matchedRows?: number;
        skippedZeroRows?: number;
        summary?: AgendamientoMeta["summary"];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudieron cargar las ordenes.");
      }

      setOrders(data.orders ?? []);
      setOrdersMeta({
        fileName: data.fileName,
        sheet: data.sheet,
        matchedRows: data.matchedRows,
        skippedZeroRows: data.skippedZeroRows,
        summary: data.summary,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudieron cargar las ordenes.";
      setOrdersError(message);
    } finally {
      setIsLoadingOrders(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  const yellowOrders = orders.filter((order) =>
    order.color.toUpperCase().includes("AMARILLO"),
  );
  const greenOrders = orders.filter((order) =>
    order.color.toUpperCase().includes("VERDE"),
  );

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f5ef] px-6 text-[#20231f]">
        <p className="border border-[#d9d2c2] bg-white px-5 py-4 text-sm font-medium">
          Cargando dashboard...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef] text-[#20231f]">
      <header className="border-b border-[#d9d2c2] bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <div>
            <p className="text-sm font-medium uppercase text-[#6c8f5e]">
              Dashboard
            </p>
            <h1 className="text-2xl font-semibold">Bot Logistica</h1>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="break-all text-sm text-[#5f625c]">{user?.email}</p>
            <button
              type="button"
              onClick={handleLogout}
              className="h-10 border border-[#20231f] px-4 text-sm font-semibold transition hover:bg-[#20231f] hover:text-white"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8 sm:px-10">
        <div className="grid gap-4 md:grid-cols-3">
          <article className="border border-[#d9d2c2] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#5f625c]">Ordenes para hablar hoy</p>
            <p className="mt-3 text-4xl font-semibold">
              {ordersMeta.summary?.total ?? orders.length}
            </p>
          </article>
          <article className="border border-[#d9d2c2] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#5f625c]">Amarillas</p>
            <p className="mt-3 text-4xl font-semibold">
              {ordersMeta.summary?.yellow ?? yellowOrders.length}
            </p>
          </article>
          <article className="border border-[#d9d2c2] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#5f625c]">Verdes</p>
            <p className="mt-3 text-4xl font-semibold">
              {ordersMeta.summary?.green ?? greenOrders.length}
            </p>
          </article>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="border border-[#d9d2c2] bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase text-[#6c8f5e]">
                  Operacion
                </p>
                <h2 className="text-xl font-semibold">
                  Ordenes para hablar hoy
                </h2>
                {ordersMeta.fileName ? (
                  <p className="mt-1 text-sm text-[#5f625c]">
                    {ordersMeta.fileName}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={loadOrders}
                disabled={isLoadingOrders}
                className="h-10 border border-[#20231f] px-4 text-sm font-semibold transition hover:bg-[#20231f] hover:text-white disabled:cursor-not-allowed disabled:border-[#8f928b] disabled:text-[#8f928b]"
              >
                {isLoadingOrders ? "Consultando..." : "Actualizar"}
              </button>
            </div>

            {ordersError ? (
              <p className="border border-[#e7c7b5] bg-[#fff4ef] px-4 py-3 text-sm text-[#9b432a]">
                {ordersError}
              </p>
            ) : null}

            {!ordersError && isLoadingOrders ? (
              <p className="py-6 text-sm text-[#5f625c]">Consultando ordenes...</p>
            ) : null}

            {!ordersError && !isLoadingOrders && orders.length === 0 ? (
              <p className="py-6 text-sm text-[#5f625c]">
                No hay ordenes verdes o amarillas para agendamiento.
              </p>
            ) : null}

            {orders.length > 0 ? (
              <div className="divide-y divide-[#ece6d8]">
                {orders.map((order) => (
                  <article key={order.ov} className="py-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-base font-semibold">
                          {order.color} OV {order.ov}
                        </p>
                        <p className="mt-2 text-sm text-[#5f625c]">
                          <strong className="text-[#20231f] font-medium">Cliente:</strong> {order.nombreCliente}
                          {order.itemCount ? ` - ${order.itemCount} items` : ""}
                        </p>
                        <p className="mt-1 text-sm text-[#5f625c]">
                          <strong className="text-[#20231f] font-medium">Teléfono:</strong>{" "}
                          <a
                            className="font-medium text-[#5d6f52] hover:underline"
                            href={`tel:${order.telefono}`}
                          >
                            {order.telefono}
                          </a>
                        </p>
                        <p className="mt-1 text-sm text-[#3e423b]">
                          <strong className="text-[#20231f] font-medium">Dirección:</strong> {order.direccion}
                        </p>
                        <p className="mt-1 text-sm text-[#5f625c]">
                          <strong className="text-[#20231f] font-medium">Artículos:</strong> {order.descCant}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>

          <aside className="space-y-6">
            <div className="border border-[#d9d2c2] bg-white p-6 shadow-sm">
              <p className="text-sm font-medium uppercase text-[#6c8f5e]">
                Conexion
              </p>
              <h2 className="mt-2 text-xl font-semibold">Supabase REST</h2>
              <p className="mt-4 break-all font-mono text-sm text-[#3e423b]">
                {supabaseRestUrl}
              </p>
              {ordersMeta.matchedRows !== undefined ? (
                <div className="mt-6 space-y-2 border-t border-[#ece6d8] pt-5 text-sm text-[#5f625c]">
                  <p>Filas verdes/amarillas: {ordersMeta.matchedRows}</p>
                  <p>Filas descartadas en cero: {ordersMeta.skippedZeroRows ?? 0}</p>
                  <p>Hoja: {ordersMeta.sheet}</p>
                </div>
              ) : null}
            </div>

            <WhatsAppTestPanel />
          </aside>
        </div>
      </section>
    </main>
  );
}

function WhatsAppTestPanel() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("Hola, esto es una prueba desde el Bot de Logistica.");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!phone) return;
    setIsLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: phone, text: message }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al enviar");
      }
      setResult({ type: "success", text: "¡Mensaje enviado correctamente!" });
    } catch (err: any) {
      setResult({ type: "error", text: err.message });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="border border-[#d9d2c2] bg-white p-6 shadow-sm">
      <p className="text-sm font-medium uppercase text-[#6c8f5e]">
        Prueba API WhatsApp
      </p>
      <form onSubmit={handleSend} className="mt-4 flex flex-col gap-3">
        <div>
          <label className="text-xs font-semibold text-[#5f625c]">Número destino</label>
          <input
            type="text"
            placeholder="Ej: 3001234567"
            className="mt-1 w-full border border-[#d9d2c2] p-2 text-sm focus:border-[#6c8f5e] focus:outline-none"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-[#5f625c]">Mensaje</label>
          <textarea
            className="mt-1 w-full resize-none border border-[#d9d2c2] p-2 text-sm focus:border-[#6c8f5e] focus:outline-none"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="mt-2 flex h-10 items-center justify-center bg-[#25D366] px-4 text-sm font-semibold text-white transition hover:bg-[#20b858] disabled:opacity-50"
        >
          {isLoading ? "Enviando..." : "Enviar por WP"}
        </button>

        {result && (
          <p
            className={`mt-2 text-xs font-medium p-2 border ${
              result.type === "success"
                ? "border-[#c6efce] bg-[#e2f9e6] text-[#00b050]"
                : "border-[#f5c6cb] bg-[#f8d7da] text-[#721c24]"
            }`}
          >
            {result.text}
          </p>
        )}
      </form>
    </div>
  );
}

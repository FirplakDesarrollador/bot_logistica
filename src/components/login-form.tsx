"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/dashboard");
      } else {
        setIsCheckingSession(false);
      }
    });
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      setError("No pudimos iniciar sesion. Revisa el correo y la clave.");
      setIsLoading(false);
      return;
    }

    router.replace("/dashboard");
  }

  return (
    <div className="border border-[#d9d2c2] bg-white p-6 shadow-sm">
      <div className="mb-8 space-y-2">
        <p className="text-sm font-medium uppercase text-[#6c8f5e]">
          Iniciar sesion
        </p>
        <h2 className="text-2xl font-semibold">Bienvenido de nuevo</h2>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="email">
            Correo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="h-12 w-full border border-[#d9d2c2] bg-[#fbfaf7] px-4 text-base outline-none transition focus:border-[#6c8f5e]"
            placeholder="usuario@empresa.com"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="password">
            Clave
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="h-12 w-full border border-[#d9d2c2] bg-[#fbfaf7] px-4 text-base outline-none transition focus:border-[#6c8f5e]"
            placeholder="Tu clave"
          />
        </div>

        {error ? (
          <p className="border border-[#e7c7b5] bg-[#fff4ef] px-4 py-3 text-sm text-[#9b432a]">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isLoading || isCheckingSession}
          className="h-12 w-full bg-[#20231f] px-5 text-sm font-semibold text-white transition hover:bg-[#3b4137] disabled:cursor-not-allowed disabled:bg-[#8f928b]"
        >
          {isLoading || isCheckingSession ? "Validando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

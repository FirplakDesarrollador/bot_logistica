import { NextResponse } from "next/server";

const functionUrl = process.env.SUPABASE_BOT_LOGISTICA_FUNCTION_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET() {
  if (!functionUrl || !anonKey) {
    return NextResponse.json(
      { error: "Falta configurar la URL de la Edge Function o la anon key." },
      { status: 500 },
    );
  }

  try {
    const url = new URL(functionUrl);
    url.searchParams.set("action", "fechas_disponibles");

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${anonKey}`,
      },
      cache: "no-store",
    });

    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: payload.error || "La Edge Function no respondió correctamente." },
        { status: response.status },
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo consultar la Edge Function.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

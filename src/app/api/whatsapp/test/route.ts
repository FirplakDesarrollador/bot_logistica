import { NextResponse } from "next/server";

// Hardcoded for testing purposes based on the Edge Function credentials
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || "";
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || "";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, text } = body;

    if (!to || !text) {
      return NextResponse.json(
        { error: "Falta el número de destino o el texto del mensaje" },
        { status: 400 }
      );
    }

    // Asegurar que el número tenga el código de país (57 para Colombia si no lo tiene)
    let cleanNumber = to.replace(/\D/g, "");
    if (cleanNumber.length === 10) {
      cleanNumber = `57${cleanNumber}`;
    }

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanNumber,
          type: "text",
          text: { body: text },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message || "Error al enviar mensaje WP" },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

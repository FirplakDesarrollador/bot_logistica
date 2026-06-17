import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, nombre, proveedor, producto, fechaEstimada, diasEntrega, direccion } = body;

    if (!to || !nombre || !proveedor || !producto || !fechaEstimada || !diasEntrega || !direccion) {
      return NextResponse.json(
        { error: "Faltan parámetros requeridos para la plantilla." },
        { status: 400 }
      );
    }

    // Call the Edge Function
    const url = "https://vuiuorjzonpyobpelyld.supabase.co/functions/v1/enviar_plantilla_despacho";
    const payload = {
      to,
      nombre,
      proveedor,
      producto,
      fechaEstimada,
      diasEntrega,
      direccion
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.EDGE_FUNCTION_API_KEY || "super-secret-key"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || "Error al enviar plantilla desde Edge Function", details: data.details },
        { status: response.status }
      );
    }

    // Asegurar que el número tenga el código de país (57 para Colombia si no lo tiene)
    let cleanNumber = to.replace(/\D/g, "");
    if (cleanNumber.length === 10) {
      cleanNumber = `57${cleanNumber}`;
    }

    // Guardar el mensaje simulado en la base de datos para que aparezca en el chat
    const simulatedText = `[PLANTILLA ENVIADA]\nHola ${nombre}, somos FIRPLAK S.A, el proveedor aliado de ${proveedor} y nos estamos comunicando para confirmar la entrega del producto 📦 : ${producto}\n\nDespacho estimado: ${fechaEstimada}\nEntre: ${diasEntrega}\nDirección: ${direccion}`;
    
    const { error: dbError } = await supabase.from("whatsapp_messages").insert([
      {
        phone_number: cleanNumber,
        direction: "outbound",
        message_body: simulatedText,
        status: "sent",
      },
    ]);

    if (dbError) {
      console.error("Error guardando mensaje de plantilla en BD:", dbError);
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

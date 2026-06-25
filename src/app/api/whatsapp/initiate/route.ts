import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, ov, nombre, proveedor, producto, fechaEstimada, diasEntrega, direccion } = body;

    if (!to || !ov || !nombre || !producto || !direccion) {
      return NextResponse.json(
        { error: "Faltan parámetros requeridos para la plantilla de inicio." },
        { status: 400 }
      );
    }

    // Call the Edge Function for template
    const url = "https://vuiuorjzonpyobpelyld.supabase.co/functions/v1/enviar_plantilla_despacho";
    const payload = {
      to,
      nombre,
      proveedor: proveedor || "nuestro distribuidor",
      producto,
      fechaEstimada: fechaEstimada || "próximamente",
      diasEntrega: diasEntrega || "a coordinar",
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
        { error: data.error || "Error al enviar plantilla", details: data.details },
        { status: response.status }
      );
    }

    // Asegurar que el número tenga el código de país (57 para Colombia si no lo tiene)
    let cleanNumber = to.replace(/\D/g, "");
    if (cleanNumber.length === 10) {
      cleanNumber = `57${cleanNumber}`;
    }

    // Guardar el mensaje simulado en la base de datos para que aparezca en el chat
    const simulatedText = `[PLANTILLA ENVIADA]\nHola ${nombre}, somos FIRPLAK S.A, el proveedor aliado de ${payload.proveedor} y nos estamos comunicando para confirmar la entrega del producto 📦 : ${producto}\n\nDespacho estimado: ${payload.fechaEstimada}\nEntre: ${payload.diasEntrega}\nDirección: ${direccion}`;
    
    await supabase.from("whatsapp_messages").insert([
      {
        phone_number: cleanNumber,
        direction: "outbound",
        message_body: simulatedText,
        status: "sent",
      },
    ]);

    // Upsert into ordenes_agendamiento
    const { error: upsertError } = await supabase
      .from("ordenes_agendamiento")
      .upsert({
        ov: String(ov),
        estado: "Primer contacto enviado",
        telefono: String(to),
        nombre: String(nombre),
        articulos: String(producto),
        fecha_actualizacion: new Date().toISOString()
      }, { onConflict: 'ov' });

    if (upsertError) {
      console.error("Error upserting order state:", upsertError);
    }

    return NextResponse.json({ success: true, text: simulatedText });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

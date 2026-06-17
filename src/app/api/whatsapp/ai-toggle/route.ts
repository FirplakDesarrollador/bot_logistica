import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone");

  if (!phone) return NextResponse.json({ error: "Phone required" }, { status: 400 });

  const { data, error } = await supabase
    .from("whatsapp_contacts")
    .select("ai_enabled")
    .eq("phone_number", phone)
    .single();

  if (error && error.code !== "PGRST116") { // PGRST116 = JSON object requested, multiple (or no) rows returned
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ai_enabled: data?.ai_enabled ?? false });
}

export async function POST(request: Request) {
  try {
    const { phone, ai_enabled } = await request.json();
    if (!phone) return NextResponse.json({ error: "Phone required" }, { status: 400 });

    const { data, error } = await supabase
      .from("whatsapp_contacts")
      .upsert({ phone_number: phone, ai_enabled })
      .select("ai_enabled")
      .single();

    if (error) throw error;
    return NextResponse.json({ ai_enabled: data?.ai_enabled ?? false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone");

  try {
    if (phone) {
      // Fetch messages for a specific phone number
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("phone_number", phone)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return NextResponse.json({ messages: data });
    } else {
      // Fetch distinct phone numbers for the sidebar
      // Since Supabase REST doesn't support SELECT DISTINCT natively on specific columns easily via JS client,
      // we can fetch the latest messages and group them in memory (assuming not millions of chats for now)
      // Or we can use a raw SQL query via RPC.
      // Let's just fetch recent messages and group them.
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("phone_number, created_at, message_body")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;

      const chatsMap = new Map();
      for (const msg of data) {
        if (!chatsMap.has(msg.phone_number)) {
          chatsMap.set(msg.phone_number, msg);
        }
      }

      const chats = Array.from(chatsMap.values());
      return NextResponse.json({ chats });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

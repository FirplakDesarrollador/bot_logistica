import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("ordenes_agendamiento")
      .select("ov, estado");

    if (error) {
      throw error;
    }

    // Convert array to a dictionary for easier lookup in frontend
    const statuses: Record<string, string> = {};
    if (data) {
      data.forEach((row) => {
        if (row.ov) {
          statuses[row.ov] = row.estado || "Sin contactar";
        }
      });
    }

    return NextResponse.json({ statuses });
  } catch (error) {
    console.error("Error fetching order statuses:", error);
    return NextResponse.json(
      { error: "Error consultando el estado de las órdenes." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import * as https from "node:https";

const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

async function fetchSAPNode(url: string, options: any = {}) {
  // We use node:https to bypass TLS errors since Next.js fetch ignores it
  return new Promise<any>((resolve, reject) => {
    options.headers = options.headers || {};
    if (options.body) {
      options.headers['Content-Length'] = Buffer.byteLength(options.body);
      options.headers['Content-Type'] = 'application/json';
    }
    const req = https.request(url, {
      method: options.method || "GET",
      headers: options.headers || {},
      agent: httpsAgent
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        resolve({
          ok: res.statusCode && res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          rawHeaders: res.headers, // Node.js http.IncomingMessage.headers has set-cookie as an array
          headers: { 
            get: (name: string) => {
              const val = res.headers[name.toLowerCase()];
              return Array.isArray(val) ? val[0] : (val || "");
            } 
          },
          json: () => Promise.resolve(JSON.parse(data)),
          text: () => Promise.resolve(data)
        });
      });
    });
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

const functionUrl = process.env.SUPABASE_BOT_LOGISTICA_FUNCTION_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const SAP_CONFIG = {
  baseUrl: process.env.SAP_BASE_URL || "https://200.7.96.194:50000/b1s/v1",
  companyDb: process.env.SAP_COMPANY_DB || "Firplak_SA",
  userName: process.env.SAP_USERNAME || "manager",
  password: process.env.SAP_PASSWORD || "2023Fir#.*"
};

const DEPTO_MAP: Record<string, string> = {
  "5": "ANTIOQUIA", "8": "ATLÁNTICO", "11": "BOGOTÁ D.C.", "13": "BOLÍVAR",
  "15": "BOYACÁ", "17": "CALDAS", "18": "CAQUETÁ", "19": "CAUCA",
  "20": "CESAR", "23": "CÓRDOBA", "25": "CUNDINAMARCA", "27": "CHOCÓ",
  "41": "HUILA", "44": "LA GUAJIRA", "47": "MAGDALENA", "50": "META",
  "52": "NARIÑO", "54": "NORTE DE SANTANDER", "63": "QUINDÍO", "66": "RISARALDA",
  "68": "SANTANDER", "70": "SUCRE", "73": "TOLIMA", "76": "VALLE DEL CAUCA",
  "81": "ARAUCA", "85": "CASANARE", "86": "PUTUMAYO", "88": "SAN ANDRÉS",
  "91": "AMAZONAS", "94": "GUAINÍA", "95": "GUAVIARE", "97": "VAUPÉS", "99": "VICHADA"
};

export type AgendamientoOrder = {
  ov: string;
  color: string;
  itemCount?: number;
  nombreCliente: string;
  clienteFinal: string;
  telefono: string;
  direccion: string;
  descCant: string;
};

type AgendamientoResponse = {
  rows?: AgendamientoOrder[];
  data?: AgendamientoOrder[];
  fileName?: string;
  sheet?: string;
  matchedRows?: number;
  skippedZeroRows?: number;
  summary?: {
    total: number;
    yellow: number;
    green: number;
  };
  error?: string;
};

export async function GET() {
  if (!functionUrl || !anonKey) {
    return NextResponse.json(
      { error: "Falta configurar la URL de la Edge Function o la anon key." },
      { status: 500 },
    );
  }

  try {
    const url = new URL(functionUrl);
    url.searchParams.set("action", "agendamiento");

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${anonKey}`,
      },
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? ((await response.json()) as AgendamientoResponse)
      : null;

    if (!response.ok) {
      const fallbackMessage =
        response.status === 403
          ? "La Edge Function publicada aun no tiene activo el GET ?action=agendamiento. Despliega la version nueva de bot_logistica."
          : "La Edge Function no respondio correctamente.";

      return NextResponse.json(
        { error: payload?.error ?? fallbackMessage },
        { status: response.status },
      );
    }

    const orders = payload?.rows ?? payload?.data;
    if (!orders) {
      return NextResponse.json(
        {
          error:
            "La Edge Function respondio, pero aun no devuelve la lista en JSON. Despliega la version con GET ?action=agendamiento.",
        },
        { status: 502 },
      );
    }

    // --- SAP FALLBACK VIA NEXT.JS (NODE.JS) ---
    try {
      const pendingOrders = orders.filter((o) => o.nombreCliente?.includes("Pendiente SAP"));
      if (pendingOrders.length > 0) {
        // Bypass Node TLS strict certificate checks for SAP's malformed certificate
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

        const loginBody = JSON.stringify({
            CompanyDB: SAP_CONFIG.companyDb,
            Password: SAP_CONFIG.password || "2023Fir#.*",
            UserName: SAP_CONFIG.userName
          });
        console.log("DEBUG SAP LOGIN BODY:", loginBody);
        console.log("DEBUG SAP_PASSWORD env:", JSON.stringify(process.env.SAP_PASSWORD));
        const loginRes = await fetchSAPNode(`${SAP_CONFIG.baseUrl}/Login`, {
          method: "POST",
          body: loginBody
        });

        if (!loginRes.ok) {
           const errBody = await loginRes.text();
           throw new Error(`Login failed with status ${loginRes.status}: ${errBody}`);
        }

        console.log("NEXT.JS SAP LOGIN STATUS:", loginRes.status);
        const cookieHeaderVal = loginRes.rawHeaders ? loginRes.rawHeaders['set-cookie'] : "";
        console.log("NEXT.JS SAP LOGIN COOKIE HEADER:", cookieHeaderVal);

        const cookieHeader = loginRes.headers.get("set-cookie") || "";
        let cookie = cookieHeader;
        if (typeof cookieHeader === 'string') {
          const match = cookieHeader.match(/B1SESSION=[^;]+/);
          if (match) cookie = match[0];
        } else if (Array.isArray(cookieHeaderVal)) {
           for (const c of cookieHeaderVal) {
             const match = c.match(/B1SESSION=[^;]+/);
             if (match) { cookie = match[0]; break; }
           }
        }
        console.log("NEXT.JS EXTRACTED COOKIE:", cookie);

        const ovs = pendingOrders.map((o) => o.ov);
        const chunkSize = 20;
        let sapDataMap: Record<string, any> = {};

        for (let i = 0; i < ovs.length; i += chunkSize) {
          const chunk = ovs.slice(i, i + chunkSize);
          const filterStr = chunk.map(ov => `DocNum eq ${ov}`).join(" or ");
          const res = await fetchSAPNode(`${SAP_CONFIG.baseUrl}/Orders?$filter=${encodeURIComponent(filterStr)}&$select=DocNum,CardCode,CardName,AddressExtension`, {
            headers: { "Cookie": cookie }
          });
          console.log("NEXT.JS SAP ORDERS STATUS:", res.status);
          
          if (res.ok) {
            const data = await res.json();
            for (const order of (data.value || [])) {
              sapDataMap[String(order.DocNum)] = order;
            }
          }
        }

        // Apply SAP data to orders payload
        for (const order of orders) {
          if (sapDataMap[order.ov]) {
            const sapOrder = sapDataMap[order.ov];
            const addr = sapOrder.AddressExtension;
            const cCode = sapOrder.CardCode ? `${sapOrder.CardCode} - ` : "";
            order.nombreCliente = `${cCode}${sapOrder.CardName || "N/A"}`;
            order.clienteFinal = addr?.ShipToAddress2 || "N/A";
            order.telefono = addr?.ShipToCounty || "N/A";
            const calle = addr?.ShipToStreet || "";
            const ciudad = addr?.ShipToCity || "";
            const deptoCode = String(addr?.ShipToState || "").trim();
            const depto = DEPTO_MAP[deptoCode] || deptoCode;
            order.direccion = [calle, ciudad, depto].filter(p => p).join(", ") || "N/A";
          }
        }
      }
    } catch (e) {
      console.error("Error on fallback SAP fetch in Next.js:", e);
      for (const order of orders) {
        if (order.nombreCliente?.includes("Pendiente SAP")) {
          order.nombreCliente = `FALLBACK ERROR: ${String(e)}`;
        }
      }
    }

    return NextResponse.json({
      orders,
      fileName: payload?.fileName,
      sheet: payload?.sheet,
      matchedRows: payload?.matchedRows,
      skippedZeroRows: payload?.skippedZeroRows,
      summary: payload?.summary,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo consultar la Edge Function.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

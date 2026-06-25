import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";
import * as fflate from "npm:fflate";
import ExcelJS from "npm:exceljs";
import { Buffer } from "node:buffer";

const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") || "";
const PHONE_NUMBER_ID = Deno.env.get("PHONE_NUMBER_ID") || "";
const VERIFY_TOKEN = "Firplak_Logistica_WH_8a9B2c!_2026";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

const AZURE_CONFIG = {
  tenantId: Deno.env.get("AZURE_TENANT_ID") || "",
  clientId: Deno.env.get("AZURE_CLIENT_ID") || "",
  clientSecret: Deno.env.get("AZURE_CLIENT_SECRET") || "",
  siteId: Deno.env.get("AZURE_SITE_ID") || "",
  driveId: Deno.env.get("AZURE_DRIVE_ID") || "",
  folderPath: "/1. Programación de Despachos",
  sheetName: "Programador Despachos"
};

const SAP_CONFIG = {
  baseUrl: Deno.env.get("SAP_BASE_URL") || "https://200.7.96.194:50000/b1s/v1",
  companyDb: Deno.env.get("SAP_COMPANY_DB") || "Firplak_SA",
  userName: Deno.env.get("SAP_USERNAME") || "manager",
  password: Deno.env.get("SAP_PASSWORD") || ""
};

const httpClient = Deno.createHttpClient({
  tls: { rejectUnauthorized: false }
});

async function fetchSAP(url: string, options: any = {}) {
  options.client = httpClient;
  return fetch(url, options);
}

const DEPT_MAP: Record<string, string> = {
  "5": "ANTIOQUIA", "8": "ATLANTICO", "11": "BOGOTA D.C.", "13": "BOLIVAR", "15": "BOYACA",
  "17": "CALDAS", "18": "CAQUETA", "19": "CAUCA", "20": "CESAR", "23": "CORDOBA",
  "25": "CUNDINAMARCA", "27": "CHOCO", "41": "HUILA", "44": "LA GUAJIRA", "47": "MAGDALENA",
  "50": "META", "52": "NARIÑO", "54": "NORTE DE SANTANDER", "63": "QUINDIO", "66": "RISARALDA",
  "68": "SANTANDER", "70": "SUCRE", "73": "TOLIMA", "76": "VALLE DEL CAUCA"
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

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, apikey, Content-Type",
};

Deno.serve(async (req: Request) => {
  const { method } = req;

  // --- OPTIONS (CORS preflight) ---
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // --- GET ---
  if (method === "GET") {
    const url = new URL(req.url);

    // GET ?action=agendamiento  → lightweight, NO SAP
    if (url.searchParams.get("action") === "agendamiento") {
      try {
        const dateStr = url.searchParams.get("date") || undefined;
        const rows = await getAgendamientoExcelOnly(dateStr);
        return new Response(
          JSON.stringify({
            rows,
            data: rows,
            summary: {
              total: rows.length,
              yellow: rows.filter((r: any) => r.color === "🟡").length,
              green: rows.filter((r: any) => r.color === "🟢").length,
            },
          }),
          { status: 200, headers: CORS_HEADERS },
        );
      } catch (err) {
        return new Response(
          JSON.stringify({ error: err instanceof Error ? err.message : "Error generando agendamiento" }),
          { status: 500, headers: CORS_HEADERS },
        );
      }
    }

    // GET ?action=fechas_disponibles
    if (url.searchParams.get("action") === "fechas_disponibles") {
      try {
        const token = await getGraphToken();
        const headers = { "Authorization": `Bearer ${token}` };
        const driveRes = await fetch(`https://graph.microsoft.com/v1.0/drives/${AZURE_CONFIG.driveId}/root:${encodeURIComponent(AZURE_CONFIG.folderPath)}:/children`, { headers });
        if (!driveRes.ok) throw new Error("No se pudo listar los archivos de SharePoint.");
        const files = await driveRes.json();
        
        const datesFound = new Set<string>();
        const monthsMap: Record<string, string> = { "ENERO": "01", "FEBRERO": "02", "MARZO": "03", "ABRIL": "04", "MAYO": "05", "JUNIO": "06", "JULIO": "07", "AGOSTO": "08", "SEPTIEMBRE": "09", "OCTUBRE": "10", "NOVIEMBRE": "11", "DICIEMBRE": "12" };
        const regex = /^FIRPLAK VISOR OV ([A-Z]+) (\d+) AÑO (\d+)\.xlsm$/i;
        
        for (const file of files.value || []) {
          const match = file.name.toUpperCase().replace(/\s+/g, " ").match(regex);
          if (match) {
            const [, mesName, dia, anio] = match;
            const mes = monthsMap[mesName];
            if (mes) {
              const diaPad = dia.padStart(2, "0");
              datesFound.add(`${anio}-${mes}-${diaPad}`);
            }
          }
        }
        
        const sortedDates = Array.from(datesFound).sort((a, b) => b.localeCompare(a));
        return new Response(JSON.stringify({ dates: sortedDates }), { status: 200, headers: CORS_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Error" }), { status: 500, headers: CORS_HEADERS });
      }
    }

    // WhatsApp webhook verification
    if (url.searchParams.get("hub.verify_token") === VERIFY_TOKEN) {
      return new Response(url.searchParams.get("hub.challenge"), { status: 200 });
    }

    return new Response("Forbidden", { status: 403 });
  }

  // --- POST (WhatsApp webhook) ---
  if (method === "POST") {
    try {
      const body = await req.json();
      const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

      if (message) {
        const from = message.from;
        
        let originalText = message.text?.body;
        if (!originalText) {
           if (message.type === 'audio') originalText = "🎙️ [Mensaje de audio]";
           else if (message.type === 'image') originalText = "📷 [Imagen]";
           else if (message.type === 'location') originalText = "📍 [Ubicación]";
           else if (message.type === 'button') originalText = message.button?.text;
           else if (message.type === 'interactive') {
             originalText = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title;
           }
           else originalText = `[Mensaje no soportado: ${message.type || 'desconocido'}]`;
        }
        
        const text = originalText?.toLowerCase() || "";

        // Guardar mensaje entrante en la BD
        if (originalText && from) {
          const { error: dbError } = await supabase.from("whatsapp_messages").insert([
            {
              phone_number: from,
              direction: "inbound",
              message_body: originalText,
              status: "received",
            },
          ]);
          if (dbError) console.error("Error guardando inbound message:", dbError);
        }

        // --- Lógica del Agente IA ---
        const { data: contact } = await supabase
          .from("whatsapp_contacts")
          .select("ai_enabled")
          .eq("phone_number", from)
          .single();

        if (contact?.ai_enabled) {
          const { data: recentMsgs } = await supabase
            .from("whatsapp_messages")
            .select("direction, message_body")
            .eq("phone_number", from)
            .order("created_at", { ascending: false })
            .limit(10);

          // Extract OVs from user messages to fetch real SAP info
          const ovsToFetch = new Set<string>();
          if (recentMsgs) {
            for (const m of recentMsgs) {
              if (m.direction === "inbound") {
                const matches = m.message_body.match(/\b(1\d{5})\b/g);
                if (matches) matches.forEach((match: string) => ovsToFetch.add(match));
              }
            }
          }

          let extraContext = "";
          if (ovsToFetch.size > 0) {
            try {
               const loginRes = await fetchSAP(`${SAP_CONFIG.baseUrl}/Login`, { 
                 method: "POST", 
                 body: JSON.stringify({ CompanyDB: SAP_CONFIG.companyDb, Password: SAP_CONFIG.password, UserName: SAP_CONFIG.userName }) 
               });
               
               // Extract cookie safely
               let cookie = "";
               const cookieHeader = loginRes.headers.get("set-cookie");
               if (cookieHeader) {
                 const match = cookieHeader.match(/B1SESSION=[^;]+/);
                 if (match) cookie = match[0];
               }
               
               for (const ov of ovsToFetch) {
                 const res = await fetchSAP(`${SAP_CONFIG.baseUrl}/Orders?$filter=DocNum eq ${ov}&$select=DocNum,CardCode,CardName,AddressExtension,DocumentLines`, { headers: { "Cookie": cookie } });
                 if (res.ok) {
                   const data = await res.json();
                   if (data.value && data.value.length > 0) {
                     const order = data.value[0];
                     const items = order.DocumentLines?.map((l: any) => `${l.Quantity} x ${l.ItemDescription}`).join(", ") || "";
                     const cliente = order.CardName;
                     const dir = order.AddressExtension?.ShipToStreet || "N/A";
                     const city = order.AddressExtension?.ShipToCity || "N/A";
                     
                     extraContext += `\n- OV ${ov}: Cliente: ${cliente}. Dirección: ${dir}, ${city}. Artículos: ${items}.`;
                   } else {
                     extraContext += `\n- OV ${ov}: No se encontró en el sistema.`;
                   }
                 }
               }
            } catch (err) {
               console.error("Error fetching SAP info for AI:", err);
            }
          }

          let systemPrompt = `Eres de servicio al cliente de logística en FIRPLAK S.A. Actúa como un humano, sé EXTREMADAMENTE breve y al grano. Saluda muy corto. NO des explicaciones largas ni ofrezcas ayuda repetitiva.
Tu objetivo AHORA MISMO es validar si el cliente confirma o rechaza los datos de despacho que se le enviaron recientemente.
- REGLA 1: Si el cliente confirma que los datos están bien, respóndele agradeciendo e infórmale que pronto le notificaremos cuando el pedido vaya en camino. OBLIGATORIAMENTE incluye al final de tu respuesta EXACTAMENTE esto: [ESTADO: CONFIRMADO].
- REGLA 2: Si el cliente indica que NO PUEDE RECIBIR en la fecha planteada y te DA UNA NUEVA FECHA (exacta o aproximada), agradécele e indícale que has registrado la nueva fecha. OBLIGATORIAMENTE incluye al final: [ESTADO: NUEVA_FECHA, VALOR: <la nueva fecha que dio el cliente>].
- REGLA 3: Si el cliente indica que la DIRECCIÓN ESTÁ MAL y te DA LA NUEVA DIRECCIÓN, agradécele e indícale que has actualizado la dirección en el sistema. OBLIGATORIAMENTE incluye al final: [ESTADO: NUEVA_DIRECCION, VALOR: <la nueva dirección que dio el cliente>].
- REGLA 4: Si el cliente dice que algo está mal (dirección, fecha, nombre) pero NO te da el dato nuevo, pregúntale: "¿Me podrías indicar cuál es el dato correcto para actualizarlo?". OBLIGATORIAMENTE incluye al final: [ESTADO: RECHAZADO].
- Si el cliente hace una pregunta general, respóndele normalmente.`;

          if (extraContext) {
            systemPrompt += `\n\nDatos de las OVs consultadas:\n${extraContext}`;
          }

          const groqMessages = [
            { role: "system", content: systemPrompt }
          ];

          if (recentMsgs) {
            const ordered = recentMsgs.reverse();
            for (const m of ordered) {
              groqMessages.push({
                role: m.direction === "inbound" ? "user" : "assistant",
                content: m.message_body
              });
            }
          }

          try {
            const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("GROQ_API_KEY")}`
              },
              body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: groqMessages,
                max_tokens: 300
              })
            });

            if (aiRes.ok) {
              const aiData = await aiRes.json();
              let reply = aiData.choices[0].message.content;
              
              // Detect Intent and Update State
              let newState = "";
              let excelObs = "";
              let newAddress = "";
              
              const matchFecha = reply.match(/\[ESTADO:\s*NUEVA_FECHA,\s*VALOR:\s*(.+?)\]/i);
              const matchDir = reply.match(/\[ESTADO:\s*NUEVA_DIRECCION,\s*VALOR:\s*(.+?)\]/i);

              if (reply.includes("[ESTADO: CONFIRMADO]")) {
                newState = "Datos confirmados";
                excelObs = "Direccion confirmada";
                reply = reply.replace(/\[ESTADO:\s*CONFIRMADO\]/ig, "").trim();
              } else if (matchFecha) {
                newState = "Cambio de fecha solicitado";
                excelObs = "Nueva fecha a recibir: " + matchFecha[1].trim();
                reply = reply.replace(matchFecha[0], "").trim();
              } else if (matchDir) {
                newState = "Dirección actualizada";
                newAddress = matchDir[1].trim();
                excelObs = "Nueva direccion: " + newAddress;
                reply = reply.replace(matchDir[0], "").trim();
              } else if (reply.includes("[ESTADO: RECHAZADO]")) {
                newState = "Datos incorrectos - Validando";
                reply = reply.replace(/\[ESTADO:\s*RECHAZADO\]/ig, "").trim();
              }

              if (newState) {
                const possiblePhone2 = from.startsWith("57") ? from.substring(2) : from;
                const { error: updErr, data: updatedOrders } = await supabase
                  .from("ordenes_agendamiento")
                  .update({ estado: newState })
                  .in("telefono", [from, possiblePhone2])
                  .in("estado", ["Primer contacto enviado", "Datos incorrectos - Validando"])
                  .select("ov");
                
                if (updErr) {
                  console.error("Error updating intent state:", updErr);
                } else if (updatedOrders && updatedOrders.length > 0) {
                  const ovs = updatedOrders.map(o => String(o.ov));
                  if (excelObs) {
                    updateExcelObservation(ovs, excelObs).catch(e => console.error("Error updating Excel:", e));
                  }
                  if (newAddress) {
                    updateSAPAddress(ovs, newAddress).catch(e => console.error("Error updating SAP:", e));
                  }
                }
              }

              await sendWhatsAppMessage(from, reply);
              return new Response("OK", { status: 200 }); // Termina aquí si la IA respondió
            } else {
              console.error("Groq error:", await aiRes.text());
            }
          } catch (err) {
            console.error("AI fetch error:", err);
          }
        }
        // --- Fin Lógica Agente IA ---

        if (text.includes("confirmar")) {
          const orden = text.split(" ").pop();
          await sendWhatsAppMessage(from, `⚙️ Buscando la OV ${orden} en la hoja "Programador Despachos"...`);
          try {
            await updateExcelOrder(orden, "CONFIRMADO");
            await sendWhatsAppMessage(from, `✅ ¡Hecho! La OV ${orden} ha sido actualizada en el Excel.`);
          } catch (err: any) {
            await sendWhatsAppMessage(from, "❌ Error al actualizar: " + err.message);
          }
        } else if (text.includes("resumen") || text.includes("colores")) {
          try {
            await sendWhatsAppMessage(from, "⏳ Generando resumen de colores (Amarillos y Verdes)...");
            const report = await getOrdersByColor();
            let msg = `📊 *Resumen de Despachos Hoy*\n\n`;
            msg += `🟡 *Amarillos (${report.yellowCount} OVs):*\n${report.yellow || "Ninguno"}\n\n`;
            msg += `🟢 *Verdes (${report.greenCount} OVs):*\n${report.green || "Ninguno"}`;
            await sendWhatsAppMessage(from, msg);
          } catch (err: any) {
            await sendWhatsAppMessage(from, "❌ Error al generar resumen: " + err.message);
          }
        } else if (text.includes("sap") || text.includes("direccion") || text.includes("contacto")) {
          const orden = text.split(" ").pop();
          try {
            await sendWhatsAppMessage(from, `⚙️ Consultando SAP para la OV ${orden}...`);
            const addr = await getSAPOrderAddress(orden);
            if (addr) {
              const deptName = DEPT_MAP[addr.departamento] || addr.departamento;
              let msg = `📍 *Datos de Despacho (SAP) OV ${orden}*\n\n`;
              msg += `👤 *Cliente Final:* ${addr.clienteFinal || "No definido"}\n`;
              msg += `🏠 *Dirección:* ${addr.direccion}\n`;
              msg += `🏙️ *Ciudad:* ${addr.ciudad}\n`;
              msg += `🗺️ *Departamento:* ${deptName}\n`;
              msg += `📞 *Teléfono:* ${addr.telefono || "No definido (Campo 6 vacío)"}`;
              await sendWhatsAppMessage(from, msg);
            } else {
              await sendWhatsAppMessage(from, `❌ No se encontró la OV ${orden} en SAP.`);
            }
          } catch (err: any) {
            await sendWhatsAppMessage(from, "❌ Error SAP: " + err.message);
          }
        } else if (text.includes("agendamiento")) {
          try {
            await sendWhatsAppMessage(from, "⏳ Generando listado de agendamiento (OVs Verdes y Amarillas)...");
            const rows = await getAgendamiento();
            if (rows.length === 0) {
              await sendWhatsAppMessage(from, "ℹ️ No se encontraron órdenes en verde o amarillo.");
            } else {
              let msg = `📋 *Listado de Agendamiento (${rows.length} OVs)*\n\n`;
              for (const r of rows.slice(0, 10)) {
                msg += `*OV ${r.ov}* ${r.color}\n`;
                msg += `👤 ${r.nombreCliente}\n`;
                msg += `📞 ${r.telefono}\n`;
                msg += `📍 ${r.direccion}\n`;
                msg += `📦 ${r.descCant}\n\n`;
              }
              if (rows.length > 10) msg += `_...y ${rows.length - 10} OVs más._`;
              await sendWhatsAppMessage(from, msg);
            }
          } catch (err: any) {
            await sendWhatsAppMessage(from, "❌ Error al generar agendamiento: " + err.message);
          }
        }
        // else {
        //   await sendWhatsAppMessage(from, "🤖 *Bot Logística Firplak*\\n\\n- *'resumen'*: Ver OVs en amarillo y verde.\\n- *'agendamiento'*: Listado completo con cliente, dirección y artículos.\\n- *'confirmar [OV]'*: Marcar orden en Excel.\\n- *'sap [OV]'*: Ver dirección y contacto de SAP.");
        // }
      }
      return new Response("OK", { status: 200 });
    } catch (_error) {
      return new Response("Error", { status: 500 });
    }
  }
  return new Response("Not Allowed", { status: 405 });
});

// ─── Helpers ───────────────────────────────────────────

function getTargetFilePattern(dateStr?: string) {
  const months = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
  const d = dateStr ? new Date(`${dateStr}T12:00:00`) : new Date();
  const parts = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(d);
  const day = parts.find(p => p.type === 'day')?.value;
  const monthIdx = parseInt(parts.find(p => p.type === 'month')?.value || "1") - 1;
  const year = parts.find(p => p.type === 'year')?.value;
  return `FIRPLAK VISOR OV ${months[monthIdx]} ${day} AÑO ${year}.xlsm`;
}

async function getGraphToken() {
  const url = `https://login.microsoftonline.com/${AZURE_CONFIG.tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({ client_id: AZURE_CONFIG.clientId, client_secret: AZURE_CONFIG.clientSecret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" });
  const res = await fetch(url, { method: "POST", body });
  const data = await res.json();
  return data.access_token;
}

async function findTargetFile(headers: any, dateStr?: string) {
  const pattern = getTargetFilePattern(dateStr).toUpperCase().replace(/\s+/g, " ");

  const hydrateFile = async (file: any) => {
    if (file?.["@microsoft.graph.downloadUrl"]) return file;
    if (!file?.id) throw new Error(`El archivo encontrado no tiene id ni downloadUrl`);
    const itemRes = await fetch(`https://graph.microsoft.com/v1.0/drives/${AZURE_CONFIG.driveId}/items/${file.id}`, { headers });
    const item = await itemRes.json();
    if (!itemRes.ok) throw new Error(`No se pudo obtener detalle del archivo: ${JSON.stringify(item)}`);
    if (!item["@microsoft.graph.downloadUrl"]) throw new Error(`El archivo encontrado no tiene downloadUrl: ${item.name || file.name}`);
    return item;
  };

  const driveRes = await fetch(`https://graph.microsoft.com/v1.0/drives/${AZURE_CONFIG.driveId}/root:${encodeURIComponent(AZURE_CONFIG.folderPath)}:/children`, { headers });
  if (driveRes.ok) {
    const files = await driveRes.json();
    const file = files.value?.find((f: any) => f.name.toUpperCase().replace(/\s+/g, " ").includes(pattern));
    if (file) return await hydrateFile(file);
  }

  const searchText = getTargetFilePattern(dateStr).replace(".xlsm", "");
  const searchRes = await fetch(`https://graph.microsoft.com/v1.0/drives/${AZURE_CONFIG.driveId}/root/search(q='${encodeURIComponent(searchText)}')`, { headers });
  const matches = await searchRes.json();
  if (!searchRes.ok) throw new Error(`Error buscando archivo en SharePoint: ${JSON.stringify(matches)}`);
  const file = matches.value?.find((f: any) => f.name.toUpperCase().replace(/\s+/g, " ").includes(pattern));
  if (!file) {
    const names = matches.value?.map((f: any) => f.name).slice(0, 10).join(", ");
    throw new Error(`No se encontró el archivo de hoy para "${pattern}". Coincidencias: ${names || "ninguna"}`);
  }
  return await hydrateFile(file);
}

// Color detection helpers
const isYellow = (argb: string | undefined) => {
  if (!argb || argb.length < 8) return false;
  const r = parseInt(argb.substring(2, 4), 16);
  const g = parseInt(argb.substring(4, 6), 16);
  const b = parseInt(argb.substring(6, 8), 16);
  return (argb === 'FFFFFF00' || argb === 'FFFFFF99' || argb === 'FFFFFFCC' || argb === 'FFFFC000') || (r > 200 && g > 180 && b < 150);
};

const isGreen = (argb: string | undefined) => {
  if (!argb || argb.length < 8) return false;
  const r = parseInt(argb.substring(2, 4), 16);
  const g = parseInt(argb.substring(4, 6), 16);
  const b = parseInt(argb.substring(6, 8), 16);
  return (argb === 'FF92D050' || argb === 'FF00B050' || argb === 'FFC6EFCE' || argb === 'FF00FF00') || (g > 160 && r < 210 && b < 210 && g > r && g > b);
};

// ─── OPTIMIZED XML PARSER ──────────────────────────────

async function extractOVsOptimized(arrayBuffer: ArrayBuffer) {
  const zip = fflate.unzipSync(new Uint8Array(arrayBuffer));

  // 1. Get the sheet ID for "Programador Despachos"
  const workbookXml = new TextDecoder().decode(zip["xl/workbook.xml"]);
  const sheetMatch = workbookXml.match(/<sheet[^>]+name="Programador Despachos"[^>]+sheetId="([^"]+)"[^>]*\/?>(?:<\/sheet>)?/i) || 
                     workbookXml.match(/<sheet[^>]+sheetId="([^"]+)"[^>]+name="Programador Despachos"[^>]*\/?>(?:<\/sheet>)?/i);
  if (!sheetMatch) throw new Error("Sheet not found");

  const relsXml = new TextDecoder().decode(zip["xl/_rels/workbook.xml.rels"]);
  const rIdMatch = workbookXml.match(new RegExp(`<sheet[^>]+name="Programador Despachos"[^>]+r:id="([^"]+)"`, "i")) || 
                   workbookXml.match(new RegExp(`<sheet[^>]+r:id="([^"]+)"[^>]+name="Programador Despachos"`, "i"));
  let targetFile = "xl/worksheets/sheet1.xml";
  if (rIdMatch) {
    const relMatch = relsXml.match(new RegExp(`<Relationship[^>]+Id="${rIdMatch[1]}"[^>]+Target="([^"]+)"`, "i"));
    if (relMatch) targetFile = `xl/${relMatch[1]}`;
  }

  // 2. Parse Shared Strings
  const sharedStringsXml = zip["xl/sharedStrings.xml"] ? new TextDecoder().decode(zip["xl/sharedStrings.xml"]) : "";
  const sharedStrings: string[] = [];
  const ssRegex = /<t[^>]*>([^<]*)<\/t>/g;
  let match;
  while ((match = ssRegex.exec(sharedStringsXml)) !== null) {
      sharedStrings.push(match[1]);
  }

  // 3. Parse Styles
  const stylesXml = zip["xl/styles.xml"] ? new TextDecoder().decode(zip["xl/styles.xml"]) : "";
  const fills: (string|null)[] = [];
  const fillsBlock = stylesXml.match(/<fills.*?>([\s\S]*?)<\/fills>/);
  if (fillsBlock) {
      const fillRegex = /<fill>([\s\S]*?)<\/fill>/g;
      let fMatch;
      while ((fMatch = fillRegex.exec(fillsBlock[1])) !== null) {
          const fgColorMatch = fMatch[1].match(/<fgColor[^>]+rgb="([^"]+)"/);
          fills.push(fgColorMatch ? fgColorMatch[1] : null);
      }
  }
  const cellXfs: number[] = [];
  const cellXfsBlock = stylesXml.match(/<cellXfs.*?>([\s\S]*?)<\/cellXfs>/);
  if (cellXfsBlock) {
      const xfRegex = /<xf([\s\S]*?)\/?>/g;
      let xMatch;
      while ((xMatch = xfRegex.exec(cellXfsBlock[1])) !== null) {
          const fillIdMatch = xMatch[1].match(/fillId="([^"]+)"/);
          cellXfs.push(fillIdMatch ? parseInt(fillIdMatch[1]) : 0);
      }
  }

  // 4. Parse Sheet
  const sheetXml = new TextDecoder().decode(zip[targetFile]);
  const rows: any[] = [];
  
  const rowBlocks = sheetXml.split('<row ');
  for (let i = 1; i < rowBlocks.length; i++) {
     const block = rowBlocks[i];
     const rMatch = block.match(/^r="(\d+)"/);
     if (!rMatch) continue;
     const rIdx = parseInt(rMatch[1]);
     if (rIdx === 1) continue;
     
     const cBlocks = block.split('<c ');
     const rowData: any = { argb: null, ov: null, item: null, desc: null, cant: null, totalNeto: 0 };
     for (let j = 1; j < cBlocks.length; j++) {
         const cBlock = cBlocks[j];
         const colMatch = cBlock.match(/^r="([A-Z]+)\d+"/);
         if (!colMatch) continue;
         const col = colMatch[1];
         const styleIdMatch = cBlock.match(/s="(\d+)"/);
         const styleId = styleIdMatch ? parseInt(styleIdMatch[1]) : 0;
         const typeMatch = cBlock.match(/t="([^"]+)"/);
         const type = typeMatch ? typeMatch[1] : null;
         
         let val = null;
         const vMatch = cBlock.match(/<v>([\s\S]*?)<\/v>/);
         if (vMatch) {
             val = type === "s" ? sharedStrings[parseInt(vMatch[1])] : vMatch[1];
         }
         
         if (col === "A") {
              const fillId = cellXfs[styleId];
              if (fillId !== undefined && fills[fillId]) rowData.argb = fills[fillId];
              rowData.ov = val;
          } else if (col === "B") {
              rowData.item = val;
          } else if (col === "H") {
              rowData.desc = val;
          } else if (col === "I") {
              rowData.cant = val;
          } else if (col === "O") {
              rowData.totalNeto = parseFloat(val || "0") || 0;
          }
     }
     
     if (rowData.ov && rowData.argb) {
         if (rowData.argb.match(/FF[A-Z0-9]{6}/i)) {
             if (isYellow(rowData.argb)) rowData.color = "🟡";
             else if (isGreen(rowData.argb)) rowData.color = "🟢";
             if (rowData.color && rowData.totalNeto !== 0) {
                 rows.push(rowData);
             }
         }
     }
  }
  
  // Group by OV
  const ovData: Record<string, { items: string[], desc: string[], cant: string[], color: string }> = {};
  for (const r of rows) {
      const ov = String(r.ov).trim();
      if (!ovData[ov]) ovData[ov] = { items: [], desc: [], cant: [], color: r.color };
      ovData[ov].items.push(String(r.item || ''));
      ovData[ov].desc.push(String(r.desc || '').trim());
      ovData[ov].cant.push(String(r.cant || ''));
  }
  return ovData;
}

// ─── LIGHTWEIGHT: Excel + SAP Batch agendamiento ────

async function getAgendamientoExcelOnly(dateStr?: string) {
  const token = await getGraphToken();
  const headers = { "Authorization": `Bearer ${token}` };
  const file = await findTargetFile(headers, dateStr);
  const fileRes = await fetch(file["@microsoft.graph.downloadUrl"]);
  const arrayBuffer = await fileRes.arrayBuffer();

  const ovData = await extractOVsOptimized(arrayBuffer);
  const ovs = Object.keys(ovData);

  // --- SAP BATCH QUERY ---
  let sapDataMap: Record<string, any> = {};
  let sapErrorStr = "";
  if (ovs.length > 0) {
    try {
      const loginRes = await fetchSAP(`${SAP_CONFIG.baseUrl}/Login`, {
        method: "POST",
        body: JSON.stringify({ CompanyDB: SAP_CONFIG.companyDb, Password: SAP_CONFIG.password, UserName: SAP_CONFIG.userName })
      });
      const cookie = loginRes.headers.get("set-cookie") || "";

      // Chunk OVs into groups of 20
      const chunkSize = 20;
      for (let i = 0; i < ovs.length; i += chunkSize) {
        const chunk = ovs.slice(i, i + chunkSize);
        const filterStr = chunk.map(ov => `DocNum eq ${ov}`).join(" or ");
        // Explicitly URL encode the filter string to be safe
        const res = await fetchSAP(`${SAP_CONFIG.baseUrl}/Orders?$filter=${encodeURIComponent(filterStr)}&$select=DocNum,CardCode,CardName,AddressExtension`, {
          headers: { "Cookie": cookie }
        });
        if (res.ok) {
          const data = await res.json();
          for (const order of (data.value || [])) {
            sapDataMap[String(order.DocNum)] = order;
          }
        } else {
          sapErrorStr = `Status ${res.status}: ${await res.text()}`;
        }
      }
    } catch (e) {
      console.error("Error batching SAP:", e);
      sapErrorStr = String(e);
    }
  }

  const results = [];
  for (const ov of ovs) {
    const combined = ovData[ov].desc.map((d, i) => `${ovData[ov].cant[i]} ${d}`);
    const order = sapDataMap[ov];
    let nombreCliente = "N/A", clienteFinal = "N/A", telefono = "N/A", direccion = "N/A";

    if (order) {
      const addr = order.AddressExtension;
      const cCode = order.CardCode ? `${order.CardCode} - ` : "";
      nombreCliente = `${cCode}${order.CardName || "N/A"}`;
      clienteFinal = addr?.ShipToAddress2 || "N/A";
      telefono = addr?.ShipToCounty || "N/A";
      const calle = addr?.ShipToStreet || "";
      const ciudad = addr?.ShipToCity || "";
      const deptoCode = String(addr?.ShipToState || "").trim();
      const depto = DEPTO_MAP[deptoCode] || deptoCode;
      direccion = [calle, ciudad, depto].filter(p => p).join(", ") || "N/A";
    } else {
      nombreCliente = `Pendiente SAP ${sapErrorStr ? `(Error: ${sapErrorStr})` : "(No encontrado)"}`;
    }

    results.push({
      ov,
      color: ovData[ov].color,
      nombreCliente,
      clienteFinal,
      telefono,
      direccion,
      descCant: combined.join(", "),
    });
  }
  return results;
}

// ─── HEAVY: Full agendamiento with SAP (WhatsApp only) ─

async function getAgendamiento() {
  const token = await getGraphToken();
  const headers = { "Authorization": `Bearer ${token}` };
  const file = await findTargetFile(headers);
  const fileRes = await fetch(file["@microsoft.graph.downloadUrl"]);
  const arrayBuffer = await fileRes.arrayBuffer();
  
  const ovData = await extractOVsOptimized(arrayBuffer);

  const loginRes = await fetchSAP(`${SAP_CONFIG.baseUrl}/Login`, {
    method: "POST",
    body: JSON.stringify({ CompanyDB: SAP_CONFIG.companyDb, Password: SAP_CONFIG.password, UserName: SAP_CONFIG.userName })
  });
  const cookie = loginRes.headers.get("set-cookie") || "";

  const results = [];
  for (const ov of Object.keys(ovData)) {
    const res = await fetchSAP(`${SAP_CONFIG.baseUrl}/Orders?$filter=DocNum eq ${ov}&$select=DocNum,CardCode,CardName,AddressExtension`, {
      headers: { "Cookie": cookie }
    });
    let nombreCliente = "N/A", clienteFinal = "N/A", telefono = "N/A", direccion = "N/A";
    if (res.ok) {
      const data = await res.json();
      const order = data.value?.[0];
      const addr = order?.AddressExtension;
      const cCode = order?.CardCode ? `${order.CardCode} - ` : "";
      nombreCliente = `${cCode}${order?.CardName || "N/A"}`;
      clienteFinal = addr?.ShipToAddress2 || "N/A";
      telefono = addr?.ShipToCounty || "N/A";
      const calle = addr?.ShipToStreet || "";
      const ciudad = addr?.ShipToCity || "";
      const deptoCode = String(addr?.ShipToState || "").trim();
      const depto = DEPTO_MAP[deptoCode] || deptoCode;
      direccion = [calle, ciudad, depto].filter(p => p).join(", ") || "N/A";
    }
    const combined = ovData[ov].desc.map((d, i) => `${ovData[ov].cant[i]} ${d}`);
    results.push({
      ov,
      color: ovData[ov].color,
      nombreCliente,
      clienteFinal,
      telefono,
      direccion,
      descCant: combined.join(", ")
    });
  }
  return results;
}

// ─── Other existing functions ──────────────────────────

async function getOrdersByColor() {
  const token = await getGraphToken();
  const headers = { "Authorization": `Bearer ${token}` };
  const file = await findTargetFile(headers);
  const fileRes = await fetch(file["@microsoft.graph.downloadUrl"]);
  const arrayBuffer = await fileRes.arrayBuffer();
  
  const ovData = await extractOVsOptimized(arrayBuffer);

  const yellowCounts: Record<string, string[]> = {};
  const greenCounts: Record<string, string[]> = {};

  for (const ov of Object.keys(ovData)) {
      if (ovData[ov].color === '🟡') {
          yellowCounts[ov] = ovData[ov].items;
      } else if (ovData[ov].color === '🟢') {
          greenCounts[ov] = ovData[ov].items;
      }
  }

  const formatList = (counts: Record<string, string[]>) => {
    return Object.keys(counts).map(ov => `${ov} (${counts[ov].length} ítems)`).join(", ");
  };

  return {
    yellow: formatList(yellowCounts),
    green: formatList(greenCounts),
    yellowCount: Object.keys(yellowCounts).length,
    greenCount: Object.keys(greenCounts).length
  };
}

async function getSAPOrderAddress(docNum: string) {
  const loginRes = await fetchSAP(`${SAP_CONFIG.baseUrl}/Login`, {
    method: "POST",
    body: JSON.stringify({ CompanyDB: SAP_CONFIG.companyDb, Password: SAP_CONFIG.password, UserName: SAP_CONFIG.userName })
  });
  const cookie = loginRes.headers.get("set-cookie");
  const queryUrl = `${SAP_CONFIG.baseUrl}/Orders?$filter=DocNum eq ${docNum}&$select=AddressExtension`;
  const res = await fetchSAP(queryUrl, { headers: { "Cookie": cookie || "" } });
  const data = await res.json();
  const addr = data.value?.[0]?.AddressExtension;
  if (addr) {
    return {
      clienteFinal: addr.ShipToAddress2,
      direccion: addr.ShipToStreet,
      ciudad: addr.ShipToCity,
      departamento: addr.ShipToState,
      telefono: addr.ShipToCounty
    };
  }
  return null;
}

async function updateExcelOrder(orderId: string, newStatus: string) {
  const token = await getGraphToken();
  const headers = { "Authorization": `Bearer ${token}` };
  const file = await findTargetFile(headers);
  const fileRes = await fetch(file["@microsoft.graph.downloadUrl"]);
  const arrayBuffer = await fileRes.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(arrayBuffer));
  const sheet = workbook.getWorksheet(AZURE_CONFIG.sheetName);
  let statusCol = 0;
  sheet.getRow(1).eachCell((cell: any, colNumber: number) => {
    if (cell.value === 'Estado_Bot') statusCol = colNumber;
  });
  if (statusCol === 0) statusCol = sheet.columnCount + 1;
  sheet.getRow(1).getCell(statusCol).value = 'Estado_Bot';
  sheet.eachRow((row: any, rowNumber: number) => {
    if (rowNumber === 1) return;
    if (String(row.getCell(1).value || "") === orderId) {
      row.getCell(statusCol).value = newStatus;
    }
  });
  const outBuffer = await workbook.xlsx.writeBuffer();
  await fetch(`https://graph.microsoft.com/v1.0/drives/${AZURE_CONFIG.driveId}/items/${file.id}/content`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    body: outBuffer
  });
}

async function updateExcelObservation(orderIds: string[], text: string) {
  const token = await getGraphToken();
  const headers = { "Authorization": `Bearer ${token}` };
  const file = await findTargetFile(headers);
  const fileRes = await fetch(file["@microsoft.graph.downloadUrl"]);
  const arrayBuffer = await fileRes.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(arrayBuffer));
  const sheet = workbook.getWorksheet(AZURE_CONFIG.sheetName);
  
  let obsCol = 0;
  sheet.getRow(1).eachCell((cell: any, colNumber: number) => {
    const val = String(cell.value || "").toUpperCase();
    if (val.includes('OBSERVACION') || val.includes('OBSERVACIONES')) {
      obsCol = colNumber;
    }
  });
  
  if (obsCol === 0) {
    obsCol = sheet.columnCount + 1;
    sheet.getRow(1).getCell(obsCol).value = 'Observaciones';
  }

  sheet.eachRow((row: any, rowNumber: number) => {
    if (rowNumber === 1) return;
    const currentOv = String(row.getCell(1).value || "");
    if (orderIds.includes(currentOv)) {
      const currentVal = row.getCell(obsCol).value || "";
      row.getCell(obsCol).value = currentVal ? `${currentVal} - ${text}` : text;
    }
  });

  const outBuffer = await workbook.xlsx.writeBuffer();
  await fetch(`https://graph.microsoft.com/v1.0/drives/${AZURE_CONFIG.driveId}/items/${file.id}/content`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    body: outBuffer
  });
}

async function sendWhatsAppMessage(to: string, text: string) {
  let cleanNumber = to.replace(/\D/g, "");
  if (cleanNumber.length === 10) {
    cleanNumber = `57${cleanNumber}`;
  }

  const res = await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: cleanNumber, type: "text", text: { body: text } })
  });

  if (res.ok) {
    await supabase.from("whatsapp_messages").insert([
      {
        phone_number: cleanNumber,
        direction: "outbound",
        message_body: text,
        status: "sent",
      },
    ]);
  } else {
    const errorText = await res.text();
    console.error("Error enviando mensaje de WP:", errorText);
  }
}

async function updateSAPAddress(ovs: string[], newAddress: string) {
  const loginRes = await fetchSAP(`${SAP_BASE_URL}/Login`, {
    method: "POST",
    body: JSON.stringify({ CompanyDB: SAP_COMPANY_DB, Password: SAP_PASSWORD, UserName: SAP_USERNAME })
  });
  const cookie = loginRes.headers.get("set-cookie") || "";

  for (const ov of ovs) {
    try {
      const res = await fetchSAP(`${SAP_BASE_URL}/Orders?$filter=DocNum eq ${ov}&$select=DocEntry`, {
        headers: { "Cookie": cookie }
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.value || data.value.length === 0) continue;
      const docEntry = data.value[0].DocEntry;

      const patchRes = await fetchSAP(`${SAP_BASE_URL}/Orders(${docEntry})`, {
        method: "PATCH",
        headers: { "Cookie": cookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          AddressExtension: {
            ShipToStreet: newAddress
          }
        })
      });
      if (!patchRes.ok) {
         console.error(`Error patching SAP OV ${ov}:`, await patchRes.text());
      }
    } catch (e) {
      console.error(`Error in SAP address update for OV ${ov}:`, e);
    }
  }
}

function getExcelColumnLetter(colIndex: number): string {
  let letter = "";
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode(65 + (temp % 26)) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

async function updateExcelObservation(ovs: string[], observation: string) {
  try {
    const token = await getGraphToken();
    const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
    
    // Buscar el archivo del día (reutilizando la función que hace fallback a search)
    const file = await findTargetFile(headers);
    if (!file) {
      console.error("No se pudo encontrar el archivo Excel para actualizar observaciones.");
      return;
    }

    // Extraer el rango de datos usados
    const rangeRes = await fetch(`https://graph.microsoft.com/v1.0/drives/${AZURE_CONFIG.driveId}/items/${file.id}/workbook/worksheets('${AZURE_CONFIG.sheetName}')/usedRange`, { headers });
    if (!rangeRes.ok) throw new Error("Error getting usedRange: " + await rangeRes.text());
    
    const rangeData = await rangeRes.json();
    if (!rangeData || !rangeData.values || rangeData.values.length === 0) return;

    // Buscar los índices de las columnas
    const headersRow = rangeData.values[0];
    const ovColIndex = headersRow.findIndex((h: string) => h === "DOCUMENTO" || h === "OV" || String(h).toUpperCase().includes("OV"));
    const obsColIndex = headersRow.findIndex((h: string) => typeof h === 'string' && h.toUpperCase().includes("OBSERVACI"));

    if (ovColIndex === -1 || obsColIndex === -1) {
      console.error(`Columnas no encontradas. OV col: ${ovColIndex}, Obs col: ${obsColIndex}`);
      return;
    }

    const colLetter = getExcelColumnLetter(obsColIndex);

    // Iterar y actualizar cada OV solicitada
    for (const ov of ovs) {
      const rowIndex = rangeData.values.findIndex((row: any[]) => String(row[ovColIndex]) === String(ov));
      if (rowIndex > -1) {
        const cellAddress = `${colLetter}${rowIndex + 1}`;
        console.log(`Updating OV ${ov} at ${cellAddress} con observación: '${observation}'`);
        
        // Parchar la celda específica vía Graph API
        const patchRes = await fetch(`https://graph.microsoft.com/v1.0/drives/${AZURE_CONFIG.driveId}/items/${file.id}/workbook/worksheets('${AZURE_CONFIG.sheetName}')/range(address='${cellAddress}')`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ values: [[observation]] })
        });
        
        if (!patchRes.ok) {
          console.error(`Failed to patch cell ${cellAddress} for OV ${ov}:`, await patchRes.text());
        } else {
          console.log(`Excel actualizado correctamente para OV ${ov}`);
        }
      } else {
        console.log(`OV ${ov} no encontrada en el Excel.`);
      }
    }
  } catch (err) {
    console.error("Error en updateExcelObservation:", err);
  }
}

const baseUrl = "https://200.7.96.194:50000/b1s/v1";
const httpClient = Deno.createHttpClient({ tls: { rejectUnauthorized: false } });

async function run() {
  const loginRes = await fetch(`${baseUrl}/Login`, {
    method: "POST",
    client: httpClient,
    body: JSON.stringify({ CompanyDB: "Firplak_SA", Password: "2023Fir#.*", UserName: "manager" })
  });
  console.log("Login status:", loginRes.status);
  const cookie = loginRes.headers.get("set-cookie");
  
  const res = await fetch(`${baseUrl}/ProductionOrders?$top=1&$select=DocNum,CustomerCode,OriginNum`, {
    headers: { "Cookie": cookie || "" },
    client: httpClient
  });
  const data = await res.json();
  console.log("ProductionOrder:", data.value[0]);
}

run();

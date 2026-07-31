// Web Push com VAPID via Web Crypto API nativa do Deno
// Envia push sem payload (empty push) para testar VAPID

async function buildVapidJwt(endpoint: string, vapidPrivRaw: string, vapidPub: string, subject: string): Promise<string> {
  const origin = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;

  const header = btoa(JSON.stringify({ typ: "JWT", alg: "ES256" }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payload = btoa(JSON.stringify({ aud: origin, exp, sub: subject }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const sigInput = `${header}.${payload}`;

  // Importa a chave privada raw
  function b64urlToBytes(s: string): Uint8Array {
    const pad = "=".repeat((4 - (s.length % 4)) % 4);
    const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  }

  const rawBytes = b64urlToBytes(vapidPrivRaw);

  // Constroi JWK para importar a chave privada
  const pubBytes = b64urlToBytes(vapidPub);
  const x = btoa(String.fromCharCode(...pubBytes.slice(1, 33))).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
  const y = btoa(String.fromCharCode(...pubBytes.slice(33, 65))).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
  const d = btoa(String.fromCharCode(...rawBytes)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");

  const jwk = { kty: "EC", crv: "P-256", x, y, d, key_ops: ["sign"] };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(sigInput)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");

  return `${sigInput}.${sigB64}`;
}

export async function sendWebPush(opts: {
  endpoint: string;
  p256dh: string;
  auth: string;
  vapidPublicKey: string;
  vapidPrivateKeyRaw: string;
  vapidSubject: string;
  payload: string;
}): Promise<void> {
  const { endpoint, vapidPublicKey, vapidPrivateKeyRaw, vapidSubject } = opts;

  const jwt = await buildVapidJwt(endpoint, vapidPrivateKeyRaw, vapidPublicKey, vapidSubject);

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `vapid t=${jwt},k=${vapidPublicKey}`,
      "TTL": "86400",
      "Content-Length": "0",
    },
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`HTTP ${resp.status}: ${body}`);
  }
}

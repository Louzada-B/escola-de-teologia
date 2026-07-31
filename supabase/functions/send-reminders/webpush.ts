// Web Push encryption (RFC 8291) using Deno Web Crypto API

async function importPublicKey(rawBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", rawBytes, { name: "ECDH", namedCurve: "P-256" }, false, []);
}

function base64UrlDecode(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

function base64UrlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

async function buildVapidJwt(endpoint: string, subject: string, publicKeyB64: string, privateKeyPkcs8: Uint8Array): Promise<string> {
  const origin = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ aud: origin, exp, sub: subject })));
  const sigInput = `${header}.${payload}`;
  const privKey = await crypto.subtle.importKey("pkcs8", privateKeyPkcs8, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privKey, new TextEncoder().encode(sigInput));
  return `${sigInput}.${base64UrlEncode(sig)}`;
}

export async function sendWebPush(opts: {
  endpoint: string;
  p256dh: string;
  auth: string;
  vapidPublicKey: string;
  vapidPrivateKeyPkcs8: Uint8Array;
  vapidSubject: string;
  payload: string;
}): Promise<void> {
  const { endpoint, p256dh, auth, vapidPublicKey, vapidPrivateKeyPkcs8, vapidSubject, payload } = opts;

  // Generate ephemeral key pair
  const ephem = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const ephemPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", ephem.publicKey));

  // Subscriber public key
  const subPubRaw = base64UrlDecode(p256dh);
  const subPubKey = await importPublicKey(subPubRaw);
  const authRaw = base64UrlDecode(auth);

  // ECDH shared secret
  const sharedBits = await crypto.subtle.deriveBits({ name: "ECDH", public: subPubKey }, ephem.privateKey, 256);
  const sharedSecret = new Uint8Array(sharedBits);

  // Salt (16 random bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // PRK (pseudo-random key)
  const prkInfoParts = [
    new TextEncoder().encode("WebPush: info\0"),
    subPubRaw,
    ephemPubRaw,
  ];
  const prkInfo = new Uint8Array(prkInfoParts.reduce((a, b) => a + b.length, 0));
  let offset = 0;
  prkInfoParts.forEach(p => { prkInfo.set(p, offset); offset += p.length; });
  const prk = await hkdf(authRaw, sharedSecret, prkInfo, 32);

  // CEK and nonce
  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");
  const cek = await hkdf(salt, prk, cekInfo, 16);
  const nonce = await hkdf(salt, prk, nonceInfo, 12);

  // Encrypt payload
  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const payloadBytes = new TextEncoder().encode(payload);
  // Add padding delimiter (0x02 = record delimiter)
  const padded = new Uint8Array(payloadBytes.length + 1);
  padded.set(payloadBytes);
  padded[payloadBytes.length] = 2;
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded));

  // Build body: salt(16) + record_size(4) + key_id_len(1) + key_id + encrypted
  const recordSize = encrypted.length + 16;
  const body = new Uint8Array(16 + 4 + 1 + ephemPubRaw.length + encrypted.length);
  let pos = 0;
  body.set(salt, pos); pos += 16;
  new DataView(body.buffer).setUint32(pos, recordSize + 16, false); pos += 4;
  body[pos++] = ephemPubRaw.length;
  body.set(ephemPubRaw, pos); pos += ephemPubRaw.length;
  body.set(encrypted, pos);

  // VAPID JWT
  const jwt = await buildVapidJwt(endpoint, vapidSubject, vapidPublicKey, vapidPrivateKeyPkcs8);

  await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `vapid t=${jwt},k=${vapidPublicKey}`,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
    },
    body,
  });
}

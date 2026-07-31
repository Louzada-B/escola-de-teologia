// Web Push usando npm:web-push via Deno npm compatibility
// deno-lint-ignore-file

import webpush from "npm:web-push@3.6.7";

export async function sendWebPush(opts: {
  endpoint: string;
  p256dh: string;
  auth: string;
  vapidPublicKey: string;
  vapidPrivateKeyRaw: string;
  vapidSubject: string;
  payload: string;
}): Promise<void> {
  webpush.setVapidDetails(
    opts.vapidSubject,
    opts.vapidPublicKey,
    opts.vapidPrivateKeyRaw,
  );

  await webpush.sendNotification(
    {
      endpoint: opts.endpoint,
      keys: {
        p256dh: opts.p256dh,
        auth: opts.auth,
      },
    },
    opts.payload,
  );
}

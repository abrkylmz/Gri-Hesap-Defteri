import { describe, expect, it } from "vitest";
import { isPushEndpoint } from "@/lib/push-endpoint";

describe("bildirim aboneliği adresi (SSRF koruması)", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc:APA91b",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
    "https://web.push.apple.com/QGuQyavXutnMH",
    "https://wns2-par02p.notify.windows.com/w/?token=BQYAAA",
  ])("kabul: %s", (u) => expect(isPushEndpoint(u)).toBe(true));

  it.each([
    "http://fcm.googleapis.com/fcm/send/x", // https değil
    "https://fcmXgoogleapis.com/x", // benzer ad
    "https://fcm.googleapis.com.evil.com/x", // alt alan hilesi
    "https://evil.com/fcm.googleapis.com",
    "https://169.254.169.254/latest/meta-data/",
    "https://localhost/x",
    "https://fcm.googleapis.com:8443/x", // farklı port
    "https://user:pass@fcm.googleapis.com/x",
    "https://a.b.notify.windows.com/x", // derin alt alan
    "javascript:alert(1)",
    "",
  ])("red: %s", (u) => expect(isPushEndpoint(u)).toBe(false));
});

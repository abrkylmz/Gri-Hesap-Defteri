import type { Instrumentation } from "next";

// Sunucu hatalarını (sayfa çizimi, route, server action) yönetim panelindeki "Son hatalar"a yazar.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const message = err instanceof Error ? err.message : String(err);
  const digest = typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : null;
  // Yönlendirme ve "bulunamadı" Next'in normal akışıdır; hata sayılmaz.
  if (/NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK/.test(`${message} ${digest ?? ""}`)) return;
  const { recordError } = await import("@/lib/errors");
  await recordError({ source: "server", message: `[${context.routeType}] ${message}`, path: request.path, digest });
};

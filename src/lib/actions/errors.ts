"use server";

import { currentUser } from "@/lib/auth";
import { recordError } from "@/lib/errors";
import { allow, clientIp } from "@/lib/rate-limit";

/** Tarayıcıdaki hata ekranlarından gelen hata özeti (oturum gerekmez; IP başına sınırlı). */
export async function reportClientError(input: { message: string; path: string; digest?: string | null }) {
  if (typeof input?.message !== "string" || typeof input?.path !== "string") return;
  const user = await currentUser().catch(() => null);
  if (!(await allow("errorReport", user?.userId ?? (await clientIp())))) return;
  await recordError({ source: "client", message: input.message, path: input.path, digest: input.digest ?? null });
}

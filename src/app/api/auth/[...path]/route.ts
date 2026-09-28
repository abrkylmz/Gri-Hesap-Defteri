import { getAuth } from "@/lib/auth";

// Tarayıcıdan gelen auth isteklerini (ör. e-posta doğrulama dönüşü) Neon Auth'a aktarır.
type Ctx = { params: Promise<{ path: string[] }> };

let handlers: ReturnType<ReturnType<typeof getAuth>["handler"]> | null = null;
const h = () => (handlers ??= getAuth().handler());

export const GET = (req: Request, ctx: Ctx) => h().GET(req, ctx);
export const POST = (req: Request, ctx: Ctx) => h().POST(req, ctx);

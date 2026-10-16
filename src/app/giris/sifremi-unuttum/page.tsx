import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { RecoverForm } from "./recover-form";

export const metadata: Metadata = { title: "Şifremi unuttum" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <RecoverForm />
    </AuthShell>
  );
}

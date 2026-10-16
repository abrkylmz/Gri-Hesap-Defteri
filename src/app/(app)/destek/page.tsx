import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { isSupportStaff } from "@/lib/auth";
import { getSession } from "@/lib/data";
import { getOwnThread } from "@/lib/support";
import { PageHeader } from "@/components/page-header";
import { SupportChat } from "@/components/support/chat";

export const metadata: Metadata = { title: "Canlı destek" };

export default async function SupportPage() {
  const user = await getSession();
  const { messages } = await getOwnThread(user.userId);
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-10rem)] max-w-2xl flex-col px-5 lg:px-10">
      <PageHeader
        eyebrow="Yardım"
        title="Canlı destek"
        action={
          isSupportStaff(user) ? (
            <Link href="/destek/gelen" className="btn btn-ghost h-10 text-sm">
              <Inbox size={16} /> Destek kutusu
            </Link>
          ) : undefined
        }
      >
        Sorunu ya da önerini yaz; destek ekibi buradan yanıtlar. Yanıt gelince bildirim alırsın.
      </PageHeader>
      <div className="mt-6 flex min-h-0 flex-1 flex-col">
        <SupportChat
          initial={messages}
          emptyHint={
            <>
              <p className="font-semibold text-ink">Bize yaz</p>
              <p className="mt-1">
                Uygulamayla ilgili soru, hata ya da öneri… Mesajlarını yalnızca destek ekibi görür.
              </p>
            </>
          }
        />
      </div>
    </div>
  );
}

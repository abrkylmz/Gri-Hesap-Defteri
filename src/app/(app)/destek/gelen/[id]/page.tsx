import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { isSupportStaff } from "@/lib/auth";
import { getSession } from "@/lib/data";
import { db } from "@/lib/db";
import { getSnippets, getThreadInfo, threadMessages } from "@/lib/support";
import { ThreadView } from "./thread-view";

export const metadata: Metadata = { title: "Destek sohbeti", robots: { index: false } };

export default async function SupportThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!isSupportStaff(user)) notFound();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const info = await getThreadInfo(id.data);
  if (!info) notFound();
  const [messages, snippets] = await Promise.all([
    threadMessages(id.data, true),
    getSnippets().catch(() => []),
    db()`update support_threads set staff_read_at = now() where id = ${id.data}`,
  ]);
  return <ThreadView info={info} initial={messages} snippets={snippets} />;
}

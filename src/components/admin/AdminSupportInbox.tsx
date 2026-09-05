/* eslint-disable @typescript-eslint/no-explicit-any -- support responses are defined by the support migration. */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCheck,
  CheckCircle2,
  ImagePlus,
  Loader2,
  MessageSquare,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getSupportConversation,
  getSupportInbox,
  markSupportRead,
  resolveSupportConversation,
  sendSupportMessage,
} from "@/lib/support.functions";

type InboxItem = any;
type Message = any;
function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

export function AdminSupportInbox() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inboxFn = useServerFn(getSupportInbox);
  const detailFn = useServerFn(getSupportConversation);
  const sendFn = useServerFn(sendSupportMessage);
  const readFn = useServerFn(markSupportRead);
  const resolveFn = useServerFn(resolveSupportConversation);
  const inbox = useQuery({
    queryKey: ["support-inbox"],
    queryFn: () => inboxFn(),
    staleTime: 0,
    retry: false,
  });
  const detail = useQuery({
    queryKey: ["support-conversation", selectedId],
    queryFn: () => detailFn({ data: { conversationId: selectedId! } }),
    enabled: !!selectedId,
    staleTime: 0,
    retry: false,
  });
  useEffect(() => {
    const channel = supabase
      .channel("support-admin-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["support-inbox"] });
        if (selectedId)
          void queryClient.invalidateQueries({ queryKey: ["support-conversation", selectedId] });
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_conversations" },
        () => void queryClient.invalidateQueries({ queryKey: ["support-inbox"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, selectedId]);
  useEffect(() => {
    if (selectedId && detail.data?.conversation && detail.data.conversation.status === "active") {
      void readFn({ data: { conversationId: selectedId } })
        .then(() => queryClient.invalidateQueries({ queryKey: ["support-inbox"] }))
        .catch(() => undefined);
    }
  }, [
    selectedId,
    detail.data?.conversation?.id,
    detail.data?.messages?.length,
    readFn,
    queryClient,
  ]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail.data?.messages?.length]);
  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId || !detail.data?.conversation)
        throw new Error("Select an active conversation.");
      let path: string | null = null;
      let type: "image/jpeg" | "image/png" | "image/webp" | null = null;
      if (file) {
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 5 * 1024 * 1024
        )
          throw new Error("Choose a JPEG, PNG, or WebP image up to 5 MB.");
        type = file.type as "image/jpeg" | "image/png" | "image/webp";
        path = `${detail.data.conversation.user_id}/${crypto.randomUUID()}.${file.type.split("/")[1]}`;
        const uploaded = await supabase.storage
          .from("support-attachments")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploaded.error) throw new Error(`Image upload failed: ${uploaded.error.message}`);
      }
      return sendFn({
        data: {
          conversationId: selectedId,
          content: draft,
          attachmentPath: path,
          attachmentType: type,
        },
      });
    },
    onSuccess: () => {
      setDraft("");
      setFile(null);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["support-conversation", selectedId] });
      void queryClient.invalidateQueries({ queryKey: ["support-inbox"] });
    },
    onError: (reason) =>
      setError(reason instanceof Error ? reason.message : "Reply could not be sent."),
  });
  const resolveMutation = useMutation({
    mutationFn: () => resolveFn({ data: { conversationId: selectedId! } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["support-conversation", selectedId] });
      void queryClient.invalidateQueries({ queryKey: ["support-inbox"] });
    },
    onError: (reason) =>
      setError(reason instanceof Error ? reason.message : "Conversation could not be resolved."),
  });
  const items = (inbox.data?.conversations ?? []) as InboxItem[];
  return (
    <section className="mt-8">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-md bg-gold/10 p-2 text-gold">
          <MessageSquare className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold">Support Inbox</h2>
          <p className="text-sm text-muted-foreground">
            Respond to active conversations and review resolved history.
          </p>
        </div>
      </div>
      <div className="grid min-h-[620px] overflow-hidden rounded-xl border border-border bg-surface md:grid-cols-[300px_1fr]">
        <aside className="border-b border-border md:border-b-0 md:border-r">
          <div className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Conversations ({items.length})
          </div>
          <div className="max-h-[620px] overflow-y-auto">
            {inbox.isLoading && <Loader2 className="m-5 h-4 w-4 animate-spin text-gold" />}
            {inbox.error && (
              <p className="p-4 text-xs text-bear">{(inbox.error as Error).message}</p>
            )}
            {items.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full border-b border-border/60 p-4 text-left hover:bg-surface-2 ${selectedId === item.id ? "bg-surface-2" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="truncate text-sm font-semibold">
                    {item.profile?.display_name || item.profile?.email || "Platform user"}
                  </div>
                  {item.unreadCount > 0 && (
                    <span className="rounded-full bg-bear px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {item.unreadCount}
                    </span>
                  )}
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {item.latestMessage?.content || "Image attachment"}
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span
                    className={item.status === "active" ? "text-bull" : "text-muted-foreground"}
                  >
                    {item.status}
                  </span>
                  <span>{formatTime(item.updated_at)}</span>
                </div>
              </button>
            ))}
            {!inbox.isLoading && items.length === 0 && (
              <p className="p-5 text-sm text-muted-foreground">No support conversations yet.</p>
            )}
          </div>
        </aside>
        <div className="flex min-h-[620px] flex-col">
          {!selectedId && (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 text-gold" />
              <p className="mt-3 text-sm">Select a conversation to view the complete history.</p>
            </div>
          )}
          {selectedId && (
            <>
              <header className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <div className="text-sm font-semibold">
                    {detail.data?.conversation?.user_id
                      ? items.find((item) => item.id === selectedId)?.profile?.email ||
                        "Support conversation"
                      : "Loading…"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {detail.data?.conversation?.status === "resolved"
                      ? "Resolved conversation"
                      : "Active conversation"}
                  </div>
                </div>
                {detail.data?.conversation?.status === "active" && (
                  <button
                    type="button"
                    onClick={() => resolveMutation.mutate()}
                    disabled={resolveMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-md border border-bull/40 px-3 py-2 text-xs font-semibold text-bull hover:bg-bull/10"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {resolveMutation.isPending ? "Resolving…" : "Resolve"}
                  </button>
                )}
              </header>
              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                {detail.isLoading && <Loader2 className="h-4 w-4 animate-spin text-gold" />}
                {(detail.data?.messages ?? []).map((message: Message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender_role === "support" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[78%] rounded-xl px-3 py-2 ${message.sender_role === "support" ? "bg-gold text-primary-foreground" : "bg-surface-2"}`}
                    >
                      {message.attachment_url && (
                        <a href={message.attachment_url} target="_blank" rel="noreferrer">
                          <img
                            src={message.attachment_url}
                            alt="Support attachment"
                            className="mb-2 max-h-56 rounded-md"
                          />
                        </a>
                      )}
                      {message.content && (
                        <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                      )}
                      <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
                        {formatTime(message.created_at)}
                        {message.sender_role === "support" && <CheckCheck className="h-3 w-3" />}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              {error && (
                <div className="border-t border-bear/30 bg-bear/5 px-5 py-2 text-xs text-bear">
                  {error}
                </div>
              )}
              {detail.data?.conversation?.status === "active" && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (draft.trim() || file) sendMutation.mutate();
                  }}
                  className="border-t border-border p-3"
                >
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="rounded-md p-2 text-muted-foreground hover:bg-surface-2 hover:text-gold"
                      aria-label="Attach image"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(event) => {
                        setFile(event.target.files?.[0] ?? null);
                        event.currentTarget.value = "";
                      }}
                    />
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      maxLength={4000}
                      rows={1}
                      placeholder="Reply to customer…"
                      className="min-h-10 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-gold"
                    />
                    <button
                      type="submit"
                      disabled={sendMutation.isPending || (!draft.trim() && !file)}
                      className="rounded-md bg-gold p-2.5 text-primary-foreground disabled:opacity-40"
                      aria-label="Send reply"
                    >
                      {sendMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {file && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <ImagePlus className="h-4 w-4 text-gold" />
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        className="ml-auto text-bear"
                        onClick={() => setFile(null)}
                        aria-label="Remove attachment"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

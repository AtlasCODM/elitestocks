import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Headphones,
  Loader2,
  MessageCircle,
  Paperclip,
  Send,
  X,
  CheckCheck,
  RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { featureFlags } from "@/lib/feature-flags";
import {
  getSupportState,
  markSupportRead,
  sendSupportMessage,
  startSupportConversation,
} from "@/lib/support.functions";

type SupportMessage = {
  id: string;
  sender_id: string;
  sender_role: "user" | "support";
  content: string;
  attachment_url: string | null;
  attachment_type: string | null;
  created_at: string;
  read_at: string | null;
};
type SupportState = {
  conversation: { id: string; status: "active" | "resolved"; updated_at: string } | null;
  messages: SupportMessage[];
};

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(
    new Date(value),
  );
}
async function optimizeImage(file: File) {
  if (file.size <= 1_500_000) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, file.type, 0.82));
  bitmap.close();
  return blob ? new File([blob], file.name, { type: file.type, lastModified: Date.now() }) : file;
}

export function SupportWidget() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fetchState = useServerFn(getSupportState);
  const start = useServerFn(startSupportConversation);
  const send = useServerFn(sendSupportMessage);
  const markRead = useServerFn(markSupportRead);
  const stateQuery = useQuery<SupportState>({
    queryKey: ["support-state", user?.id],
    queryFn: () => fetchState(),
    enabled: featureFlags.inAppSupport && !!user,
    staleTime: 0,
    retry: false,
  });
  const state = stateQuery.data;
  const unreadCount = useMemo(
    () =>
      state?.messages.filter((message) => message.sender_role === "support" && !message.read_at)
        .length ?? 0,
    [state?.messages],
  );
  const startMutation = useMutation({
    mutationFn: () => start(),
    onSuccess: (next) => {
      queryClient.setQueryData(["support-state", user?.id], next);
    },
    onError: (error) =>
      setLocalError(
        error instanceof Error ? error.message : "Unable to start support conversation.",
      ),
  });
  const sendMutation = useMutation({
    mutationFn: async (payload: { content: string; file: File | null }) => {
      if (!state?.conversation) throw new Error("Start a conversation first.");
      let path: string | null = null;
      let type: "image/jpeg" | "image/png" | "image/webp" | null = null;
      if (payload.file) {
        const optimized = await optimizeImage(payload.file);
        type = optimized.type as typeof type;
        const extension = optimized.type.split("/")[1];
        path = `${user?.id}/${crypto.randomUUID()}.${extension}`;
        const upload = await supabase.storage
          .from("support-attachments")
          .upload(path, optimized, { contentType: optimized.type, upsert: false });
        if (upload.error) throw new Error(`Image upload failed: ${upload.error.message}`);
      }
      return send({
        data: {
          conversationId: state.conversation.id,
          content: payload.content,
          attachmentPath: path,
          attachmentType: type,
        },
      });
    },
    onSuccess: () => {
      setDraft("");
      setAttachment(null);
      setPreview(null);
      setLocalError(null);
      void queryClient.invalidateQueries({ queryKey: ["support-state", user?.id] });
    },
    onError: (error) =>
      setLocalError(
        error instanceof Error ? error.message : "Message could not be sent. Please try again.",
      ),
  });
  useEffect(() => {
    if (!open || !state?.conversation || state.conversation.status !== "active") return;
    const unread = state.messages.some(
      (message) => message.sender_role === "support" && !message.read_at,
    );
    if (unread) {
      markRead({ data: { conversationId: state.conversation.id } })
        .then(() => queryClient.invalidateQueries({ queryKey: ["support-state", user?.id] }))
        .catch(() => undefined);
    }
  }, [
    open,
    state?.conversation?.id,
    state?.conversation?.status,
    state?.messages,
    markRead,
    queryClient,
    user?.id,
  ]);
  useEffect(() => {
    if (!state?.conversation?.id) return;
    const channel = supabase
      .channel(`support-user-${state.conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_messages",
          filter: `conversation_id=eq.${state.conversation.id}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["support-state", user?.id] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [state?.conversation?.id, queryClient, user?.id]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.messages.length, open]);
  if (!featureFlags.inAppSupport || !user) return null;

  const chooseAttachment = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setLocalError("Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLocalError("Images must be 5 MB or smaller.");
      return;
    }
    setAttachment(file);
    setPreview(URL.createObjectURL(file));
    setLocalError(null);
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim() && !attachment) return;
    sendMutation.mutate({ content: draft, file: attachment });
  };
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[75] bg-black/30 md:pointer-events-none md:bg-transparent"
          onClick={() => setOpen(false)}
        />
      )}
      {open && (
        <section
          className="fixed inset-x-2 bottom-2 z-[80] flex h-[min(680px,calc(100dvh-1rem))] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl md:inset-x-auto md:bottom-24 md:right-6 md:h-[620px] md:w-[390px]"
          aria-label="Customer support"
        >
          <header className="flex items-center justify-between border-b border-border bg-surface/80 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-gold/10 p-2 text-gold">
                <Headphones className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Elite Support</div>
                <div className="text-[11px] text-bull">Support team available</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-2 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              aria-label="Close support"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto p-4">
            {stateQuery.isLoading && (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-gold" />
              </div>
            )}
            {!stateQuery.isLoading && !state?.conversation && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="rounded-full bg-gold/10 p-4 text-gold">
                  <MessageCircle className="h-7 w-7" />
                </div>
                <h2 className="mt-5 font-display text-xl font-bold">How can we help?</h2>
                <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                  Send us a message and our support team will get back to you.
                </p>
                <button
                  type="button"
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending}
                  className="mt-6 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  {startMutation.isPending ? "Opening…" : "Start a conversation"}
                </button>
              </div>
            )}
            {!stateQuery.isLoading && state?.conversation?.status === "resolved" && (
              <div className="mb-5 rounded-lg border border-border bg-surface p-4 text-center">
                <CheckCheck className="mx-auto h-6 w-6 text-bull" />
                <div className="mt-2 text-sm font-semibold">Conversation resolved</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  This conversation has been closed. Start a new conversation if you need further
                  assistance.
                </p>
                <button
                  type="button"
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending}
                  className="mt-4 inline-flex items-center gap-2 rounded-md border border-gold/50 px-3 py-2 text-xs font-semibold text-gold hover:bg-gold/10"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Start a new conversation
                </button>
              </div>
            )}
            <div className="space-y-3">
              {state?.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender_role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 ${message.sender_role === "user" ? "bg-gold text-primary-foreground" : "bg-surface-2 text-foreground"}`}
                  >
                    {message.attachment_url && (
                      <a href={message.attachment_url} target="_blank" rel="noreferrer">
                        <img
                          src={message.attachment_url}
                          alt="Support attachment"
                          className="mb-2 max-h-48 rounded-md object-cover"
                        />
                      </a>
                    )}
                    {message.content && (
                      <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                    )}
                    <div
                      className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${message.sender_role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                    >
                      {timeLabel(message.created_at)}
                      {message.sender_role === "user" && <CheckCheck className="h-3 w-3" />}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          </div>
          {localError && (
            <div className="flex items-center justify-between gap-2 border-t border-b border-bear/20 bg-bear/5 px-4 py-2 text-xs text-bear">
              <span>{localError}</span>
              <button type="button" onClick={() => setLocalError(null)}>
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {state?.conversation?.status === "active" && (
            <form
              onSubmit={submit}
              className="border-t border-border bg-surface/60 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
            >
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="rounded-md p-2 text-muted-foreground hover:bg-surface-2 hover:text-gold"
                  aria-label="Attach image"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    void chooseAttachment(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={1}
                  maxLength={4000}
                  placeholder="Write a message…"
                  className="max-h-28 min-h-10 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-gold"
                />
                <button
                  type="submit"
                  disabled={sendMutation.isPending || (!draft.trim() && !attachment)}
                  className="rounded-md bg-gold p-2.5 text-primary-foreground disabled:opacity-40"
                  aria-label="Send message"
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
              {preview && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <img
                    src={preview}
                    alt="Attachment preview"
                    className="h-12 w-12 rounded object-cover"
                  />
                  <span className="truncate">{attachment?.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachment(null);
                      setPreview(null);
                    }}
                    className="ml-auto text-bear"
                    aria-label="Remove attachment"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </form>
          )}
        </section>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-20 right-4 z-[70] flex h-12 w-12 items-center justify-center rounded-full border border-gold/50 bg-gold text-primary-foreground shadow-xl transition-transform hover:scale-105 md:bottom-6 md:right-6"
        aria-label="Open support"
      >
        <Headphones className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-bear px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    </>
  );
}

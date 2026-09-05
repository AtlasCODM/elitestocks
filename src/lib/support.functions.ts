/* eslint-disable @typescript-eslint/no-explicit-any -- support tables are added by the accompanying migration. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function requireAdmin(userId: string) {
  const { data, error } = await (supabaseAdmin as any)
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .limit(1);
  if (error) throw new Error(`Unable to verify support role: ${error.message}`);
  if (!data?.length) throw new Error("Forbidden: administrator access required");
}

async function withSignedAttachments(messages: any[]) {
  return Promise.all(
    (messages ?? []).map(async (message) => {
      if (!message.attachment_url) return { ...message, attachment_url: null };
      const { data } = await supabaseAdmin.storage
        .from("support-attachments")
        .createSignedUrl(message.attachment_url, 3600);
      return { ...message, attachment_url: data?.signedUrl ?? null };
    }),
  );
}

async function conversationPayload(conversation: any) {
  if (!conversation) return { conversation: null, messages: [] };
  const { data: messages, error } = await (supabaseAdmin as any)
    .from("support_messages")
    .select("*")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return { conversation, messages: await withSignedAttachments(messages ?? []) };
}

export const getSupportState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: conversation, error } = await (supabaseAdmin as any)
      .from("support_conversations")
      .select("*")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return conversationPayload(conversation);
  });

export const startSupportConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (supabaseAdmin as any).rpc("support_get_or_create_conversation", {
      p_actor_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return conversationPayload(data);
  });

const MessageInput = z.object({
  conversationId: z.string().uuid(),
  content: z.string().trim().max(4000).default(""),
  attachmentPath: z.string().trim().max(500).nullable().optional(),
  attachmentType: z.enum(["image/jpeg", "image/png", "image/webp"]).nullable().optional(),
});
export const sendSupportMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => MessageInput.parse(data))
  .handler(async ({ context, data }) => {
    const { data: message, error } = await (supabaseAdmin as any).rpc("support_send_message", {
      p_actor_id: context.userId,
      p_conversation_id: data.conversationId,
      p_content: data.content,
      p_attachment_url: data.attachmentPath ?? null,
      p_attachment_type: data.attachmentType ?? null,
    });
    if (error) throw new Error(error.message);
    const [withUrl] = await withSignedAttachments([message]);
    return withUrl;
  });

const ConversationInput = z.object({ conversationId: z.string().uuid() });
export const markSupportRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ConversationInput.parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await (supabaseAdmin as any).rpc("support_mark_read", {
      p_actor_id: context.userId,
      p_conversation_id: data.conversationId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSupportConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ConversationInput.parse(data))
  .handler(async ({ context, data }) => {
    const { data: conversation, error } = await (supabaseAdmin as any)
      .from("support_conversations")
      .select("*")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!conversation) throw new Error("Conversation not found");
    if (conversation.user_id !== context.userId) await requireAdmin(context.userId);
    return conversationPayload(conversation);
  });

export const getSupportInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { data: conversations, error } = await (supabaseAdmin as any)
      .from("support_conversations")
      .select("*")
      .order("status", { ascending: true })
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    const userIds = [...new Set((conversations ?? []).map((item: any) => item.user_id))];
    const { data: profiles } = userIds.length
      ? await (supabaseAdmin as any)
          .from("profiles")
          .select("id,email,display_name")
          .in("id", userIds)
      : { data: [] };
    const { data: messages } = conversations?.length
      ? await (supabaseAdmin as any)
          .from("support_messages")
          .select("*")
          .in(
            "conversation_id",
            conversations.map((item: any) => item.id),
          )
          .order("created_at", { ascending: false })
      : { data: [] };
    const latest = new Map<string, any>();
    for (const message of messages ?? [])
      if (!latest.has(message.conversation_id)) latest.set(message.conversation_id, message);
    const unread = new Map<string, number>();
    for (const message of messages ?? [])
      if (!message.read_at && message.sender_role === "user")
        unread.set(message.conversation_id, (unread.get(message.conversation_id) ?? 0) + 1);
    return {
      conversations: (conversations ?? []).map((conversation: any) => ({
        ...conversation,
        profile:
          (profiles ?? []).find((profile: any) => profile.id === conversation.user_id) ?? null,
        latestMessage: latest.get(conversation.id) ?? null,
        unreadCount: unread.get(conversation.id) ?? 0,
      })),
    };
  });

export const resolveSupportConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ConversationInput.parse(data))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { data: conversation, error } = await (supabaseAdmin as any).rpc(
      "support_resolve_conversation",
      {
        p_actor_id: context.userId,
        p_conversation_id: data.conversationId,
      },
    );
    if (error) throw new Error(error.message);
    return conversation;
  });

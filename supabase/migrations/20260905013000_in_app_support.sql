-- In-app support: persistent conversations, messages, secure RPCs, and private image storage.
-- Authorization is enforced by user ownership or public.is_admin(actor).

CREATE TABLE IF NOT EXISTS public.support_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS support_one_active_conversation_per_user
  ON public.support_conversations (user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS support_conversations_activity_idx
  ON public.support_conversations (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS support_conversations_user_idx
  ON public.support_conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('user', 'support')),
  content text NOT NULL DEFAULT '' CHECK (char_length(content) <= 4000),
  attachment_url text,
  attachment_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CONSTRAINT support_message_has_content_or_attachment CHECK (
    char_length(trim(content)) > 0 OR attachment_url IS NOT NULL
  ),
  CONSTRAINT support_message_attachment_type CHECK (
    attachment_type IS NULL OR attachment_type IN ('image/jpeg', 'image/png', 'image/webp')
  )
);
CREATE INDEX IF NOT EXISTS support_messages_conversation_idx
  ON public.support_messages (conversation_id, created_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS support_messages_unread_idx
  ON public.support_messages (conversation_id, read_at) WHERE read_at IS NULL;

ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support conversation participant read" ON public.support_conversations;
CREATE POLICY "support conversation participant read" ON public.support_conversations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "support conversation owner create" ON public.support_conversations;
CREATE POLICY "support conversation owner create" ON public.support_conversations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
-- Conversation status, ownership, and read state are changed only by the
-- SECURITY DEFINER RPCs below; participants must not update these columns directly.

DROP POLICY IF EXISTS "support message participant read" ON public.support_messages;
CREATE POLICY "support message participant read" ON public.support_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_conversations c
      WHERE c.id = conversation_id
        AND (c.user_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  );
DROP POLICY IF EXISTS "support message participant create" ON public.support_messages;
CREATE POLICY "support message participant create" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      (sender_role = 'user' AND EXISTS (
        SELECT 1 FROM public.support_conversations c
        WHERE c.id = conversation_id AND c.user_id = auth.uid() AND c.status = 'active'
      ))
      OR (sender_role = 'support' AND public.is_admin(auth.uid()) AND EXISTS (
        SELECT 1 FROM public.support_conversations c
        WHERE c.id = conversation_id AND c.status = 'active'
      ))
    )
  );

GRANT SELECT ON public.support_conversations, public.support_messages TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.support_conversations, public.support_messages FROM authenticated;
GRANT ALL ON public.support_conversations, public.support_messages TO service_role;

CREATE OR REPLACE FUNCTION public.support_get_or_create_conversation(p_actor_id uuid)
RETURNS public.support_conversations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE result public.support_conversations;
BEGIN
  IF p_actor_id IS NULL OR public.is_admin(p_actor_id) THEN
    RAISE EXCEPTION 'Only a non-admin authenticated user can create a support conversation';
  END IF;
  SELECT * INTO result FROM public.support_conversations
    WHERE user_id = p_actor_id AND status = 'active'
    ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN result; END IF;
  INSERT INTO public.support_conversations (user_id) VALUES (p_actor_id)
    ON CONFLICT (user_id) WHERE status = 'active' DO NOTHING
    RETURNING * INTO result;
  IF NOT FOUND THEN
    SELECT * INTO result FROM public.support_conversations
      WHERE user_id = p_actor_id AND status = 'active' LIMIT 1;
  END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.support_send_message(
  p_actor_id uuid,
  p_conversation_id uuid,
  p_content text DEFAULT '',
  p_attachment_url text DEFAULT NULL,
  p_attachment_type text DEFAULT NULL
)
RETURNS public.support_messages
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE conversation public.support_conversations; result public.support_messages; role_name text;
BEGIN
  SELECT * INTO conversation FROM public.support_conversations WHERE id = p_conversation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not found'; END IF;
  IF conversation.status <> 'active' THEN RAISE EXCEPTION 'Conversation is resolved'; END IF;
  IF conversation.user_id = p_actor_id THEN role_name := 'user';
  ELSIF public.is_admin(p_actor_id) THEN role_name := 'support';
  ELSE RAISE EXCEPTION 'Forbidden'; END IF;
  IF char_length(trim(COALESCE(p_content, ''))) = 0 AND p_attachment_url IS NULL THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;
  IF char_length(COALESCE(p_content, '')) > 4000 THEN RAISE EXCEPTION 'Message is too long'; END IF;
  IF p_attachment_type IS NOT NULL AND p_attachment_type NOT IN ('image/jpeg', 'image/png', 'image/webp') THEN
    RAISE EXCEPTION 'Unsupported attachment type';
  END IF;
  INSERT INTO public.support_messages (conversation_id, sender_id, sender_role, content, attachment_url, attachment_type)
    VALUES (p_conversation_id, p_actor_id, role_name, trim(COALESCE(p_content, '')), p_attachment_url, p_attachment_type)
    RETURNING * INTO result;
  UPDATE public.support_conversations SET updated_at = now() WHERE id = p_conversation_id;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.support_mark_read(p_actor_id uuid, p_conversation_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE changed integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.support_conversations c
    WHERE c.id = p_conversation_id AND (c.user_id = p_actor_id OR public.is_admin(p_actor_id))
  ) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.support_messages SET read_at = now()
    WHERE conversation_id = p_conversation_id AND read_at IS NULL AND sender_id <> p_actor_id;
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$$;

CREATE OR REPLACE FUNCTION public.support_resolve_conversation(p_actor_id uuid, p_conversation_id uuid)
RETURNS public.support_conversations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE result public.support_conversations;
BEGIN
  IF NOT public.is_admin(p_actor_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.support_conversations SET status = 'resolved', resolved_at = now(), resolved_by = p_actor_id, updated_at = now()
    WHERE id = p_conversation_id AND status = 'active' RETURNING * INTO result;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active conversation not found'; END IF;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.support_get_or_create_conversation(uuid), public.support_send_message(uuid, uuid, text, text, text), public.support_mark_read(uuid, uuid), public.support_resolve_conversation(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_get_or_create_conversation(uuid), public.support_send_message(uuid, uuid, text, text, text), public.support_mark_read(uuid, uuid), public.support_resolve_conversation(uuid, uuid) TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('support-attachments', 'support-attachments', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "support attachments read" ON storage.objects;
CREATE POLICY "support attachments read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'support-attachments' AND (public.is_admin(auth.uid()) OR (storage.foldername(name))[1] = auth.uid()::text));
DROP POLICY IF EXISTS "support attachments upload" ON storage.objects;
CREATE POLICY "support attachments upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'support-attachments' AND (public.is_admin(auth.uid()) OR (storage.foldername(name))[1] = auth.uid()::text));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'support_messages'
  ) THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'support_conversations'
  ) THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations; END IF;
END $$;

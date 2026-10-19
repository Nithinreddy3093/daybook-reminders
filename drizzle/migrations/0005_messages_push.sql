CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL DEFAULT auth.uid(),
  recipient_id uuid NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_id <> recipient_id)
);
CREATE INDEX messages_pair_idx ON public.messages (sender_id, recipient_id, created_at DESC);
CREATE INDEX messages_recipient_idx ON public.messages (recipient_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own messages" ON public.messages FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "send as self" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "recipient marks read" ON public.messages FOR UPDATE TO authenticated USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);
CREATE OR REPLACE FUNCTION public.messages_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.content <> OLD.content OR NEW.sender_id <> OLD.sender_id OR NEW.recipient_id <> OLD.recipient_id OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Only read status can change';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER messages_guard BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.messages_guard();
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subs" ON public.push_subscriptions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS push_sent_for timestamptz;
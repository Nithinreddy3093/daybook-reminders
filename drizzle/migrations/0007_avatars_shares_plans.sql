ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar text;

CREATE OR REPLACE FUNCTION public.get_avatars(_ids uuid[]) RETURNS TABLE(id uuid, avatar text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.avatar FROM public.profiles p WHERE p.id = ANY(_ids[1:200]) AND p.avatar IS NOT NULL AND auth.uid() IS NOT NULL;
$$;
REVOKE EXECUTE ON FUNCTION public.get_avatars(uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_avatars(uuid[]) TO authenticated;

CREATE TABLE public.task_shares (
  owner_id uuid NOT NULL,
  viewer_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, viewer_id),
  CHECK (status IN ('pending','accepted')),
  CHECK (owner_id <> viewer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_shares TO authenticated;
GRANT ALL ON public.task_shares TO service_role;
ALTER TABLE public.task_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see own shares" ON public.task_shares FOR SELECT TO authenticated USING (auth.uid() = owner_id OR auth.uid() = viewer_id);
CREATE POLICY "request or grant" ON public.task_shares FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = viewer_id AND status = 'pending') OR auth.uid() = owner_id);
CREATE POLICY "owner approves" ON public.task_shares FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "either removes" ON public.task_shares FOR DELETE TO authenticated USING (auth.uid() = owner_id OR auth.uid() = viewer_id);

CREATE POLICY "shared tasks readable" ON public.tasks FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.task_shares s WHERE s.owner_id = tasks.user_id AND s.viewer_id = auth.uid() AND s.status = 'accepted')
);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS plan jsonb;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS plan_status text;

CREATE OR REPLACE FUNCTION public.messages_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.content <> OLD.content OR NEW.sender_id <> OLD.sender_id OR NEW.recipient_id <> OLD.recipient_id OR NEW.created_at <> OLD.created_at
     OR NEW.kind <> OLD.kind OR NEW.plan IS DISTINCT FROM OLD.plan OR NEW.plan_status IS DISTINCT FROM OLD.plan_status THEN
    IF current_setting('keep.plan_reply', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'Only read status can change';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.respond_plan(_msg uuid, _accept boolean) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.messages; t text; d timestamptz; r timestamptz;
BEGIN
  SELECT * INTO m FROM public.messages WHERE id = _msg FOR UPDATE;
  IF m.id IS NULL OR m.recipient_id <> auth.uid() OR m.kind <> 'plan' OR m.plan_status <> 'pending' THEN
    RAISE EXCEPTION 'Plan not available';
  END IF;
  PERFORM set_config('keep.plan_reply', 'on', true);
  IF _accept THEN
    t := left(coalesce(m.plan->>'title', 'Plan'), 200);
    d := nullif(m.plan->>'due_at', '')::timestamptz;
    r := nullif(m.plan->>'remind_at', '')::timestamptz;
    INSERT INTO public.tasks (user_id, title, notes, due_at, remind_at, category)
      VALUES (m.sender_id, t, left(m.plan->>'notes', 1000), d, r, 'together'),
             (m.recipient_id, t, left(m.plan->>'notes', 1000), d, r, 'together');
    UPDATE public.messages SET plan_status = 'accepted' WHERE id = _msg;
    RETURN 'accepted';
  END IF;
  UPDATE public.messages SET plan_status = 'declined' WHERE id = _msg;
  RETURN 'declined';
END $$;
REVOKE EXECUTE ON FUNCTION public.respond_plan(uuid, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.respond_plan(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.messages_insert_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kind = 'plan' THEN NEW.plan_status := 'pending';
  ELSE NEW.kind := 'text'; NEW.plan := NULL; NEW.plan_status := NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER messages_insert_guard BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.messages_insert_guard();
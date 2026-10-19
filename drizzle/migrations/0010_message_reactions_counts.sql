ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reactions jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.react_message(_msg uuid, _emoji text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.messages; r jsonb; k text := auth.uid()::text;
BEGIN
  SELECT * INTO m FROM public.messages WHERE id = _msg FOR UPDATE;
  IF m.id IS NULL OR auth.uid() IS NULL OR (m.sender_id <> auth.uid() AND m.recipient_id <> auth.uid()) THEN
    RAISE EXCEPTION 'Message not available';
  END IF;
  IF coalesce(_emoji, '') = '' OR m.reactions->>k = _emoji THEN r := m.reactions - k;
  ELSE r := m.reactions || jsonb_build_object(k, left(_emoji, 8)); END IF;
  UPDATE public.messages SET reactions = r WHERE id = _msg;
  RETURN r;
END $$;
REVOKE EXECUTE ON FUNCTION public.react_message(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.react_message(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.public_profile(_id uuid)
RETURNS TABLE (id uuid, display_name text, username text, bio text, streak int, last_active date, followers bigint, following bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.username, p.bio, p.streak, p.last_active,
    (SELECT count(*) FROM public.follows f JOIN public.profiles x ON x.id = f.follower_id WHERE f.following_id = p.id),
    (SELECT count(*) FROM public.follows f JOIN public.profiles x ON x.id = f.following_id WHERE f.follower_id = p.id)
  FROM public.profiles p WHERE auth.uid() IS NOT NULL AND p.id = _id
$$;
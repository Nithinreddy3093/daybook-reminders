CREATE OR REPLACE FUNCTION public.is_connected(_other uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    auth.uid() = _other
    OR EXISTS (SELECT 1 FROM public.follows f WHERE (f.follower_id = auth.uid() AND f.following_id = _other) OR (f.follower_id = _other AND f.following_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM public.messages m WHERE (m.sender_id = auth.uid() AND m.recipient_id = _other) OR (m.sender_id = _other AND m.recipient_id = auth.uid()))
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_connected(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_connected(uuid) TO authenticated;

DROP POLICY IF EXISTS "signed in can view profiles" ON public.profiles;
CREATE POLICY "view connected profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_connected(id));

DROP POLICY IF EXISTS "view follows" ON public.follows;
CREATE POLICY "view own follows" ON public.follows FOR SELECT TO authenticated USING (auth.uid() = follower_id OR auth.uid() = following_id);

-- Public profile card fields only (no private data), for search and profile pages.
CREATE OR REPLACE FUNCTION public.search_profiles(_q text)
RETURNS TABLE (id uuid, display_name text, username text, bio text, streak int, last_active date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.username, p.bio, p.streak, p.last_active FROM public.profiles p
  WHERE auth.uid() IS NOT NULL AND p.id <> auth.uid()
    AND (coalesce(trim(_q), '') = '' OR p.display_name ILIKE '%' || left(trim(_q), 50) || '%' OR p.username ILIKE '%' || left(trim(_q), 50) || '%')
  ORDER BY p.updated_at DESC LIMIT 20
$$;

CREATE OR REPLACE FUNCTION public.public_profile(_id uuid)
RETURNS TABLE (id uuid, display_name text, username text, bio text, streak int, last_active date, followers bigint, following bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.username, p.bio, p.streak, p.last_active,
    (SELECT count(*) FROM public.follows WHERE following_id = p.id),
    (SELECT count(*) FROM public.follows WHERE follower_id = p.id)
  FROM public.profiles p WHERE auth.uid() IS NOT NULL AND p.id = _id
$$;

CREATE OR REPLACE FUNCTION public.follow_list(_id uuid, _tab text)
RETURNS TABLE (id uuid, display_name text, username text, bio text, streak int, last_active date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.username, p.bio, p.streak, p.last_active
  FROM public.follows f JOIN public.profiles p
    ON p.id = CASE WHEN _tab = 'following' THEN f.following_id ELSE f.follower_id END
  WHERE auth.uid() IS NOT NULL
    AND (CASE WHEN _tab = 'following' THEN f.follower_id ELSE f.following_id END) = _id
  LIMIT 500
$$;

REVOKE EXECUTE ON FUNCTION public.search_profiles(text), public.public_profile(uuid), public.follow_list(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_profiles(text), public.public_profile(uuid), public.follow_list(uuid, text) TO authenticated;
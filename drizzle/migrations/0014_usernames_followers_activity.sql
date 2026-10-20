CREATE OR REPLACE FUNCTION public.username_available(_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles WHERE lower(username) = lower(_name) AND id <> auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public.username_available(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.recent_followers()
RETURNS TABLE (id uuid, display_name text, username text, bio text, streak int, last_active date, followed_at timestamptz, follows_back boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.username, p.bio, p.streak, p.last_active, f.created_at,
    EXISTS (SELECT 1 FROM follows b WHERE b.follower_id = auth.uid() AND b.following_id = f.follower_id)
  FROM follows f JOIN profiles p ON p.id = f.follower_id
  WHERE f.following_id = auth.uid()
  ORDER BY f.created_at DESC LIMIT 50
$$;
REVOKE EXECUTE ON FUNCTION public.recent_followers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recent_followers() TO authenticated;
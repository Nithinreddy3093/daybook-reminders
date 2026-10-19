CREATE OR REPLACE FUNCTION public.unfriend(_other uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth'; END IF;
  DELETE FROM follows WHERE (follower_id = auth.uid() AND following_id = _other) OR (follower_id = _other AND following_id = auth.uid());
  DELETE FROM friend_requests WHERE (sender_id = auth.uid() AND receiver_id = _other) OR (sender_id = _other AND receiver_id = auth.uid());
END $$;
REVOKE EXECUTE ON FUNCTION public.unfriend(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.unfriend(uuid) TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;
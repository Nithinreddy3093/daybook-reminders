CREATE TABLE public.friend_requests (
  sender_id uuid NOT NULL DEFAULT auth.uid(),
  receiver_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sender_id, receiver_id)
);
GRANT SELECT, INSERT, DELETE ON public.friend_requests TO authenticated;
GRANT ALL ON public.friend_requests TO service_role;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see own requests" ON public.friend_requests FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "send as self" ON public.friend_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id AND status = 'pending' AND sender_id <> receiver_id);
CREATE POLICY "either removes" ON public.friend_requests FOR DELETE TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE OR REPLACE FUNCTION public.incoming_friend_requests()
RETURNS TABLE(id uuid, display_name text, username text, bio text, streak integer, last_active date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.username, p.bio, p.streak, p.last_active
  FROM friend_requests r JOIN profiles p ON p.id = r.sender_id
  WHERE r.receiver_id = auth.uid() AND r.status = 'pending'
  ORDER BY r.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.respond_friend_request(_sender uuid, _accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM friend_requests WHERE sender_id = _sender AND receiver_id = auth.uid() AND status = 'pending') THEN
    RAISE EXCEPTION 'no request';
  END IF;
  DELETE FROM friend_requests WHERE sender_id = _sender AND receiver_id = auth.uid();
  IF _accept THEN
    INSERT INTO follows(follower_id, following_id) VALUES (auth.uid(), _sender) ON CONFLICT DO NOTHING;
    INSERT INTO follows(follower_id, following_id) VALUES (_sender, auth.uid()) ON CONFLICT DO NOTHING;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.incoming_friend_requests() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.respond_friend_request(uuid, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.incoming_friend_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_friend_request(uuid, boolean) TO authenticated;
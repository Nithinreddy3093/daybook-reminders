ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text, ADD COLUMN IF NOT EXISTS streak int NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS last_active date;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (lower(username));
CREATE POLICY "signed in can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE TABLE public.follows (
  follower_id uuid NOT NULL DEFAULT auth.uid(),
  following_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view follows" ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "follow as self" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "unfollow as self" ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

CREATE OR REPLACE FUNCTION public.bump_streak() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := NEW.user_id; d date := (now() AT TIME ZONE 'utc')::date;
BEGIN
  IF TG_TABLE_NAME = 'tasks' AND NOT (NEW.done AND NOT COALESCE(OLD.done,false)) THEN RETURN NEW; END IF;
  INSERT INTO public.profiles (id, streak, last_active) VALUES (uid, 1, d)
  ON CONFLICT (id) DO UPDATE SET
    streak = CASE WHEN profiles.last_active = d THEN profiles.streak
                  WHEN profiles.last_active = d - 1 THEN profiles.streak + 1 ELSE 1 END,
    last_active = d;
  RETURN NEW;
END $$;
CREATE TRIGGER memories_streak AFTER INSERT ON public.memories FOR EACH ROW EXECUTE FUNCTION public.bump_streak();
CREATE TRIGGER tasks_streak AFTER UPDATE OF done ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.bump_streak();
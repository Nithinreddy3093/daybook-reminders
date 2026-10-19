CREATE OR REPLACE FUNCTION public.bump_streak()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := NEW.user_id; d date := (now() AT TIME ZONE 'utc')::date;
BEGIN
  IF TG_TABLE_NAME = 'tasks' THEN
    IF NOT (NEW.done AND NOT COALESCE(OLD.done,false)) THEN RETURN NEW; END IF;
  END IF;
  INSERT INTO public.profiles (id, streak, last_active) VALUES (uid, 1, d)
  ON CONFLICT (id) DO UPDATE SET
    streak = CASE WHEN profiles.last_active = d THEN profiles.streak
                  WHEN profiles.last_active = d - 1 THEN profiles.streak + 1 ELSE 1 END,
    last_active = d;
  RETURN NEW;
END $function$;
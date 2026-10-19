CREATE OR REPLACE FUNCTION public.protect_streak() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.streak := 0; NEW.last_active := NULL;
    ELSE
      NEW.streak := OLD.streak; NEW.last_active := OLD.last_active;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profiles_protect_streak ON public.profiles;
CREATE TRIGGER profiles_protect_streak BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_streak();
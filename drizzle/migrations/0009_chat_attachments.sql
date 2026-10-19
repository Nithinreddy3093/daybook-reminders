ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment jsonb;

CREATE OR REPLACE FUNCTION public.messages_insert_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kind = 'plan' THEN NEW.plan_status := 'pending'; NEW.attachment := NULL;
  ELSIF NEW.kind = 'file' AND NEW.attachment IS NOT NULL
    AND (NEW.attachment->>'path') LIKE (NEW.sender_id::text || '/' || NEW.recipient_id::text || '/%') THEN
    NEW.plan := NULL; NEW.plan_status := NULL;
  ELSE NEW.kind := 'text'; NEW.plan := NULL; NEW.plan_status := NULL; NEW.attachment := NULL; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.messages_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.content <> OLD.content OR NEW.sender_id <> OLD.sender_id OR NEW.recipient_id <> OLD.recipient_id OR NEW.created_at <> OLD.created_at
     OR NEW.kind <> OLD.kind OR NEW.plan IS DISTINCT FROM OLD.plan OR NEW.plan_status IS DISTINCT FROM OLD.plan_status
     OR NEW.attachment IS DISTINCT FROM OLD.attachment THEN
    IF current_setting('keep.plan_reply', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'Only read status can change';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE POLICY "chat files upload by sender" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "chat files read by participants" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-files' AND (auth.uid()::text = (storage.foldername(name))[1] OR auth.uid()::text = (storage.foldername(name))[2]));
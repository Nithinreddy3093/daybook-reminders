ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS hidden_for uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS reminded_for timestamptz;
GRANT DELETE ON public.messages TO authenticated;
CREATE POLICY "sender unsends" ON public.messages FOR DELETE TO authenticated USING (auth.uid() = sender_id);
ALTER TABLE public.messages REPLICA IDENTITY FULL;
CREATE OR REPLACE FUNCTION public.hide_message(_msg uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.messages SET hidden_for = array_append(hidden_for, auth.uid())
  WHERE id = _msg AND (sender_id = auth.uid() OR recipient_id = auth.uid()) AND NOT (auth.uid() = ANY(hidden_for));
$$;
GRANT EXECUTE ON FUNCTION public.hide_message(uuid) TO authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='chat files sender delete') THEN
    CREATE POLICY "chat files sender delete" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'chat-files' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;
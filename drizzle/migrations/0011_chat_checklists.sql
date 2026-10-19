CREATE OR REPLACE FUNCTION public.messages_insert_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE items jsonb := '[]'::jsonb; it jsonb;
BEGIN
  IF NEW.kind = 'plan' THEN NEW.plan_status := 'pending'; NEW.attachment := NULL;
  ELSIF NEW.kind = 'file' AND NEW.attachment IS NOT NULL
    AND (NEW.attachment->>'path') LIKE (NEW.sender_id::text || '/' || NEW.recipient_id::text || '/%') THEN
    NEW.plan := NULL; NEW.plan_status := NULL;
  ELSIF NEW.kind = 'checklist' AND jsonb_typeof(NEW.plan->'items') = 'array' THEN
    FOR it IN SELECT * FROM jsonb_array_elements(NEW.plan->'items') LIMIT 50 LOOP
      IF coalesce(btrim(it->>'text'), '') <> '' THEN
        items := items || jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'text', left(btrim(it->>'text'), 200), 'done', false, 'by', null));
      END IF;
    END LOOP;
    NEW.plan := jsonb_build_object('title', left(coalesce(nullif(btrim(NEW.plan->>'title'), ''), 'Checklist'), 120), 'items', items);
    NEW.plan_status := NULL; NEW.attachment := NULL;
  ELSE NEW.kind := 'text'; NEW.plan := NULL; NEW.plan_status := NULL; NEW.attachment := NULL; END IF;
  RETURN NEW;
END $$;

-- Toggle (or add) checklist items; either chat participant may do this.
CREATE OR REPLACE FUNCTION public.checklist_update(_msg uuid, _item text, _add text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.messages; items jsonb; out jsonb := '[]'::jsonb; it jsonb; me text := auth.uid()::text;
BEGIN
  SELECT * INTO m FROM public.messages WHERE id = _msg FOR UPDATE;
  IF m.id IS NULL OR auth.uid() IS NULL OR m.kind <> 'checklist' OR (m.sender_id <> auth.uid() AND m.recipient_id <> auth.uid()) THEN
    RAISE EXCEPTION 'Checklist not available';
  END IF;
  items := coalesce(m.plan->'items', '[]'::jsonb);
  FOR it IN SELECT * FROM jsonb_array_elements(items) LOOP
    IF it->>'id' = _item THEN
      IF (it->>'done')::boolean THEN it := it || jsonb_build_object('done', false, 'by', null);
      ELSE it := it || jsonb_build_object('done', true, 'by', me); END IF;
    END IF;
    out := out || jsonb_build_array(it);
  END LOOP;
  IF coalesce(btrim(_add), '') <> '' AND jsonb_array_length(out) < 50 THEN
    out := out || jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'text', left(btrim(_add), 200), 'done', false, 'by', null));
  END IF;
  PERFORM set_config('keep.plan_reply', 'on', true);
  UPDATE public.messages SET plan = jsonb_set(m.plan, '{items}', out) WHERE id = _msg;
  RETURN out;
END $$;
REVOKE EXECUTE ON FUNCTION public.checklist_update(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checklist_update(uuid, text, text) TO authenticated;
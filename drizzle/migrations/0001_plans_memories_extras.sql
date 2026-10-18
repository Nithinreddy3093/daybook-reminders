ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('high','medium','normal'));
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none','daily','weekly','monthly'));
ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS favorite boolean NOT NULL DEFAULT false;
ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
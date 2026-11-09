-- Staff-only cover thumbnails, stored alongside their private Teacher PDFs.
create or replace function public.teacher_key_path_ok(p text)
returns boolean language sql immutable as $$
 select p ~ '^((a1/((student-book|practice-book|speak-up)/)?|a2/(practice-book/)?)[a-z0-9][a-z0-9._-]{0,120}\.pdf|library-20261109/[a-z0-9-]{3,60}\.(pdf|webp))$';
$$;
-- Bucket teacher-keys must remain private; add image/webp to allowed MIME types through Storage settings.

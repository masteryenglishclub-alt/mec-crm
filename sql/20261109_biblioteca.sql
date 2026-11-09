-- Biblioteca MEC: private files, current-level student access, staff-only Teacher books.
-- Originals remain on D:. This changes no user roles or credentials.
begin;
do $$ begin if exists (select 1 from storage.buckets where id in ('materiales','teacher-keys') and public) or (select count(*) from storage.buckets where id in ('materiales','teacher-keys')) <> 2 then raise exception 'Library buckets must exist and be private'; end if; end $$;
alter table public.books add column if not exists storage_bucket text not null default 'materiales';
alter table public.books add column if not exists resource_type text not null default 'student_book';
alter table public.books add column if not exists description text not null default '';
alter table public.books add column if not exists published boolean not null default true;
alter table public.books add column if not exists page_count integer;
alter table public.books drop constraint if exists books_storage_path_check;
alter table public.books add constraint books_storage_path_check check (storage_path is null or storage_path ~ '^((a1|a2|b1|b2)/(student-book|practice-book|speak-up)/[A-Za-z0-9][A-Za-z0-9._-]{0,120}|library-20261109/[a-z0-9-]{3,60})\.pdf$');
alter table public.books drop constraint if exists books_cover_thumb_check;
alter table public.books add constraint books_cover_thumb_check check (cover_thumb is null or cover_thumb ~ '^img/web/(libros|biblioteca)/[a-z0-9-]+\.(webp|jpg)$');
alter table public.books drop constraint if exists books_library_type_check;
alter table public.books add constraint books_library_type_check check (resource_type in ('student_book','practice_book','speak_up','teachers_book'));
alter table public.books drop constraint if exists books_library_bucket_check;
alter table public.books add constraint books_library_bucket_check check (storage_bucket in ('materiales','teacher-keys'));
alter table public.books drop constraint if exists books_teacher_protection_check;
alter table public.books add constraint books_teacher_protection_check check ((resource_type <> 'teachers_book' or teacher_only) and ((storage_bucket = 'teacher-keys') = teacher_only));
alter table public.books drop constraint if exists books_pages_check;
alter table public.books add constraint books_pages_check check (page_count is null or page_count > 0);
update public.books set resource_type = case when teacher_only then 'teachers_book' when slug like '%practice-book' then 'practice_book' when slug like '%speak-up' then 'speak_up' else 'student_book' end where resource_type = 'student_book';

create or replace function public.library_can_read_book(p_bucket text, p_path text)
returns boolean language sql stable security definer set search_path = public
as $$
 select public.is_staff() or (public.app_role() = 'student' and exists (
   select 1 from public.books b join public.students s on s.id = auth.uid()
   where b.storage_bucket = p_bucket and b.storage_path = p_path and b.published
     and not b.teacher_only and b.resource_type <> 'teachers_book'
     and b.level_index = s.current_level and b.program in (s.program,'ambos')
 ));
$$;
revoke all on function public.library_can_read_book(text,text) from public, anon;
grant execute on function public.library_can_read_book(text,text) to authenticated;

drop policy if exists books_read on public.books;
create policy books_read on public.books for select to authenticated using (
 public.is_staff() or (public.app_role() = 'student' and published and not teacher_only
 and resource_type <> 'teachers_book' and level_index = public.my_level_index()
 and exists (select 1 from public.students s where s.id = auth.uid() and books.program in (s.program,'ambos')))
);
drop policy if exists materiales_read on storage.objects;
create policy materiales_read on storage.objects for select to authenticated using (
 bucket_id = 'materiales' and public.library_can_read_book(bucket_id,name)
);
drop policy if exists materiales_ins on storage.objects;
create policy materiales_ins on storage.objects for insert to authenticated with check (
 bucket_id = 'materiales' and public.is_admin()
 and name ~ '^((a1|a2|b1|b2)/(student-book|practice-book|speak-up)/[A-Za-z0-9][A-Za-z0-9._-]{0,120}|library-20261109/[a-z0-9-]{3,60})\.pdf$'
);
-- Existing teacher-keys reads remain staff-only. Extend only its admin upload path validation.
create or replace function public.teacher_key_path_ok(p text)
returns boolean language sql immutable as $$
 select p ~ '^((a1/((student-book|practice-book|speak-up)/)?|a2/(practice-book/)?)[a-z0-9][a-z0-9._-]{0,120}\.pdf|library-20261109/[a-z0-9-]{3,60}\.(pdf|webp))$';
$$;

-- Empty, expandable catalogue for upcoming readers, podcasts, blogs and class videos.
create table if not exists public.library_resources (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check (slug ~ '^[a-z0-9-]{3,100}$'),
 title text not null check (length(title) between 1 and 200),
 description text not null default '',
 type text not null check (type in ('story','podcast','blog','video')),
 level_index smallint references public.levels(level_index),
 program text not null default 'adultos' check (program in ('adultos','kids','ambos')),
 teacher_only boolean not null default false,
 collection_slug text not null default '',
 sort_order integer not null default 0,
 lesson_code text,
 external_url text check (external_url is null or external_url ~ '^https://'),
 cover_url text check (cover_url is null or cover_url ~ '^(https://|img/web/)'),
 published boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.library_resources enable row level security;
revoke all on public.library_resources from anon;
grant select,insert,update,delete on public.library_resources to authenticated;
drop policy if exists library_resources_admin on public.library_resources;
create policy library_resources_admin on public.library_resources for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists library_resources_read on public.library_resources;
create policy library_resources_read on public.library_resources for select to authenticated using (
 public.is_staff() or (public.app_role() = 'student' and published and not teacher_only
 and (level_index is null or level_index = public.my_level_index())
 and exists (select 1 from public.students s where s.id = auth.uid() and library_resources.program in (s.program,'ambos')))
);
commit;
select 'Biblioteca schema ready; no new files published yet' as result;

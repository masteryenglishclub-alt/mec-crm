-- MEC: republicación aprobada por Diego de cuatro Speak Up con portada búho.
-- Ejecutar completo como postgres en Supabase SQL Editor DESPUÉS de subir los cuatro PDF privados nuevos y las cuatro
-- portadas WebP públicas indicadas en MANIFEST_PUBLICACION.json.
-- No elimina originales ni objetos anteriores. No modifica policies ni Teacher books.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
create temporary table mec_speak_up_expected (
 slug text primary key, level_index smallint not null, old_path text not null,
 new_path text not null unique, cover_path text not null, bytes bigint not null,
 page_count integer not null
) on commit drop;
insert into mec_speak_up_expected values
('a1-speak-up',1,'library-20261109/a1-speak-up.pdf','library-20261109/a1-speak-up-buho-v2.pdf','img/web/biblioteca/a1-speak-up-buho-v2.webp',38862865,100),
('a2-speak-up',2,'library-20261109/a2-speak-up.pdf','library-20261109/a2-speak-up-buho-v2.pdf','img/web/biblioteca/a2-speak-up-buho-v2.webp',48059833,100),
('b1-speak-up',3,'library-20261109/b1-speak-up.pdf','library-20261109/b1-speak-up-buho-v2.pdf','img/web/biblioteca/b1-speak-up-buho-v2.webp',47174222,104),
('b2-speak-up',4,'library-20261109/b2-speak-up.pdf','library-20261109/b2-speak-up-buho-v2.pdf','img/web/biblioteca/b2-speak-up-buho-v2.webp',46826476,68);
create temporary table mec_speak_up_before on commit drop as select * from public.books;
do $speak_up_publish$
declare v_updated integer;
begin
 if (select count(*) from pg_temp.mec_speak_up_expected) <> 4
    or exists (select 1 from pg_temp.mec_speak_up_expected where bytes <= 0) then
   raise exception 'Expected exactly four approved Speak Up PDF sizes';
 end if;
 if (select count(*) from storage.buckets where id in ('materiales','teacher-keys') and public is false) <> 2 then
   raise exception 'Library buckets must exist and remain private';
 end if;
 perform 1 from public.books b join pg_temp.mec_speak_up_expected e on e.slug=b.slug for update of b;
 if (select count(*) from public.books b join pg_temp.mec_speak_up_expected e on e.slug=b.slug
     where b.resource_type='speak_up' and b.teacher_only is false
       and b.storage_bucket='materiales' and b.program='adultos'
       and b.kind='book' and b.url is null and b.level_index=e.level_index
       and b.storage_path in (e.old_path,e.new_path)) <> 4 then
   raise exception 'Four exact approved student Speak Up records are required; no catalog change made';
 end if;
 if exists (
   select 1 from pg_temp.mec_speak_up_expected e
   left join storage.objects o on o.bucket_id='materiales' and o.name=e.new_path
   where o.id is null or case when o.metadata->>'size' ~ '^[0-9]+$'
     then (o.metadata->>'size')::bigint else -1 end is distinct from e.bytes
 ) then
   raise exception 'A new approved Speak Up PDF is missing or has an unexpected byte size';
 end if;
 update public.books b set storage_path=e.new_path, cover_thumb=e.cover_path,
   published=true, page_count=e.page_count
 from pg_temp.mec_speak_up_expected e
 where b.slug=e.slug and b.resource_type='speak_up' and b.teacher_only is false
   and b.storage_bucket='materiales' and b.level_index=e.level_index and b.program='adultos';
 get diagnostics v_updated = row_count;
 if v_updated <> 4 then raise exception 'Expected exactly four updated Speak Up records'; end if;
 if exists (
   select 1 from public.books b full join pg_temp.mec_speak_up_before prior on prior.id=b.id
   where not exists (select 1 from pg_temp.mec_speak_up_expected e where e.slug=coalesce(b.slug,prior.slug))
     and to_jsonb(b) is distinct from to_jsonb(prior)
 ) then raise exception 'An unrelated catalog record changed; republication rolled back'; end if;
 if (select count(*) from public.books where published) <> 16
    or (select count(*) from public.books b join pg_temp.mec_speak_up_expected e on e.slug=b.slug
        where b.published and b.storage_path=e.new_path and b.cover_thumb=e.cover_path
          and b.page_count=e.page_count and b.resource_type='speak_up'
          and not b.teacher_only and b.storage_bucket='materiales') <> 4 then
   raise exception 'Final catalog must contain sixteen published books with the four new approved Speak Up files';
 end if;
end;
$speak_up_publish$;
select count(*) filter (where b.published) as libros_publicados,
       count(*) filter (where b.published and b.resource_type='speak_up') as speak_up_publicados,
       count(*) filter (where b.published and b.teacher_only) as teachers_protegidos
from public.books b;
commit;
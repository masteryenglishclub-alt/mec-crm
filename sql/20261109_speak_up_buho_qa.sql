-- MEC: QA de lectura para republicación Speak Up búho v2.
-- Ejecutar el archivo COMPLETO como postgres en Supabase SQL Editor.
-- No altera datos de producción, roles, perfiles, policies ni objetos Storage.
-- Solo escribe tablas temporales de agregados; termina siempre en ROLLBACK.
-- Usa perfiles activos reales sin imprimir nombres, correos ni identificadores.
-- Los JWT locales prueban RLS; no sustituyen la validación HTTP ni la caducidad
-- de enlaces firmados. SKIP indica fixture no disponible y nunca equivale a PASS.
-- Audita referencias actuales y cuatro PDF nuevos, NO un total fijo en Storage:
-- los cuatro PDF Speak Up anteriores se conservan privados, sin referencia.
-- Si la conexión se interrumpe, ejecutar ROLLBACK en la misma sesión.
begin;
set local row_security = on;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
create temporary table mec_repub_qa_results (
 test_name text primary key, status text not null check (status in ('PASS','FAIL','SKIP')),
 observed bigint, expected bigint, detail text not null
) on commit drop;
create temporary table mec_repub_expected (
 slug text primary key, level_index smallint, old_path text, new_path text,
 cover_path text, bytes bigint, page_count integer
) on commit drop;
insert into mec_repub_expected values
('a1-speak-up',1,'library-20261109/a1-speak-up.pdf','library-20261109/a1-speak-up-buho-v2.pdf','img/web/biblioteca/a1-speak-up-buho-v2.webp',38862865,100),
('a2-speak-up',2,'library-20261109/a2-speak-up.pdf','library-20261109/a2-speak-up-buho-v2.pdf','img/web/biblioteca/a2-speak-up-buho-v2.webp',48059833,100),
('b1-speak-up',3,'library-20261109/b1-speak-up.pdf','library-20261109/b1-speak-up-buho-v2.pdf','img/web/biblioteca/b1-speak-up-buho-v2.webp',47174222,104),
('b2-speak-up',4,'library-20261109/b2-speak-up.pdf','library-20261109/b2-speak-up-buho-v2.pdf','img/web/biblioteca/b2-speak-up-buho-v2.webp',46826476,68);
create temporary table mec_repub_refs on commit drop as
 select b.storage_bucket as bucket, b.storage_path as path,
        case when b.teacher_only then 'teacher_pdf' else 'student_pdf' end as category
 from public.books b where b.published
 union all
 select b.storage_bucket, regexp_replace(b.storage_path,'\.pdf$','.webp'), 'teacher_cover'
 from public.books b where b.published and b.teacher_only and b.resource_type='teachers_book';
do $qa_grants$
begin
 execute format('grant usage on schema %I to authenticated, anon', pg_my_temp_schema()::regnamespace::text);
end;
$qa_grants$;
grant select,insert on table pg_temp.mec_repub_qa_results to authenticated,anon;
grant select on table pg_temp.mec_repub_expected,pg_temp.mec_repub_refs to authenticated,anon;
do $qa_setup$
declare v_student uuid; v_teacher uuid; v_admin uuid; v_unknown uuid;
        v_count bigint; v_expected bigint;
begin
 perform set_config('mec_repub_qa.fixture_ready','false',true);
 perform set_config('mec_repub_qa.student_uid','',true);
 perform set_config('mec_repub_qa.teacher_uid','',true);
 perform set_config('mec_repub_qa.admin_uid','',true);
 perform set_config('mec_repub_qa.unknown_uid','',true);
 begin
  select p.id into v_student from public.profiles p join public.students s on s.id=p.id
    where p.active is true and p.role='student' and s.program='adultos'
      and s.current_level between 1 and 4 order by p.id limit 1;
  select p.id into v_teacher from public.profiles p where p.active is true and p.role='teacher' order by p.id limit 1;
  select p.id into v_admin from public.profiles p where p.active is true and p.role='admin' order by p.id limit 1;
  loop
   v_unknown:=gen_random_uuid();
   exit when not exists (select 1 from public.profiles p where p.id=v_unknown);
  end loop;
  perform set_config('mec_repub_qa.student_uid',coalesce(v_student::text,''),true);
  perform set_config('mec_repub_qa.teacher_uid',coalesce(v_teacher::text,''),true);
  perform set_config('mec_repub_qa.admin_uid',coalesce(v_admin::text,''),true);
  perform set_config('mec_repub_qa.unknown_uid',v_unknown::text,true);
  perform set_config('mec_repub_qa.fixture_ready','true',true);
  v_count:=(case when v_student is null then 0 else 1 end)+(case when v_teacher is null then 0 else 1 end)+(case when v_admin is null then 0 else 1 end);
  insert into pg_temp.mec_repub_qa_results values ('setup.active_fixtures',case when v_count=3 then 'PASS' else 'SKIP' end,v_count,3,'Existing active adult student, teacher and admin selected internally; no identities disclosed.');
 exception when others then
  insert into pg_temp.mec_repub_qa_results values ('setup.active_fixtures','FAIL',null,3,'Fixture selection failed; SQLSTATE '||sqlstate||'.');
 end;
 begin
  select count(*) into v_count from pg_roles where rolname in ('authenticated','anon') and not rolbypassrls and not rolsuper;
  insert into pg_temp.mec_repub_qa_results values ('setup.non_bypass_roles',case when v_count=2 then 'PASS' else 'FAIL' end,v_count,2,'Client database roles must be subject to RLS.');
  select count(*) into v_count from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relrowsecurity and ((n.nspname='public' and c.relname in ('books','library_resources')) or (n.nspname='storage' and c.relname='objects'));
  insert into pg_temp.mec_repub_qa_results values ('setup.rls_enabled',case when v_count=3 then 'PASS' else 'FAIL' end,v_count,3,'RLS enabled on both catalogs and Storage objects.');
  select count(*) into v_count from storage.buckets where id in ('materiales','teacher-keys') and public is false;
  insert into pg_temp.mec_repub_qa_results values ('setup.private_buckets',case when v_count=2 then 'PASS' else 'FAIL' end,v_count,2,'Both file buckets remain private.');
  select count(*) into v_count from public.books where published;
  insert into pg_temp.mec_repub_qa_results values ('setup.published_catalog',case when v_count=16 then 'PASS' else 'FAIL' end,v_count,16,'Sixteen current published books.');
  select count(*) into v_count from public.books b join pg_temp.mec_repub_expected e on e.slug=b.slug
   where b.published and b.resource_type='speak_up' and b.teacher_only is false
    and b.storage_bucket='materiales' and b.storage_path=e.new_path and b.cover_thumb=e.cover_path
    and b.page_count=e.page_count and b.level_index=e.level_index and b.program='adultos';
  insert into pg_temp.mec_repub_qa_results values ('setup.approved_speak_up',case when v_count=4 then 'PASS' else 'FAIL' end,v_count,4,'Four approved Speak Up rows point to the new private PDFs and cover thumbnails.');
  select count(*) into v_count from pg_temp.mec_repub_expected e join storage.objects o on o.bucket_id='materiales' and o.name=e.new_path
   where case when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::bigint else -1 end=e.bytes;
  insert into pg_temp.mec_repub_qa_results values ('setup.new_pdf_bytes',case when v_count=4 then 'PASS' else 'FAIL' end,v_count,4,'Four new PDFs match exact approved-manifest byte sizes.');
  select count(*) into v_expected from pg_temp.mec_repub_refs;
  select count(*) into v_count from pg_temp.mec_repub_refs r join storage.objects o on o.bucket_id=r.bucket and o.name=r.path;
  insert into pg_temp.mec_repub_qa_results values ('setup.referenced_objects_exist',case when v_count=v_expected then 'PASS' else 'FAIL' end,v_count,v_expected,'Only current catalog PDF references and their private Teacher covers are counted; retained old PDFs are outside this total.');
 exception when query_canceled then
  insert into pg_temp.mec_repub_qa_results values ('setup.preflight_error','FAIL',null,null,'Preflight canceled.');
 when others then
  insert into pg_temp.mec_repub_qa_results values ('setup.preflight_error','FAIL',null,null,'Preflight failed; SQLSTATE '||sqlstate||'.');
 end;
end;
$qa_setup$;
-- This block is deliberately NOT SECURITY DEFINER: all counts below use RLS.
set local role authenticated;
do $qa_authenticated$
declare v_fixture text; v_uid text; v_test record; v_count bigint;
begin
 foreach v_fixture in array array['student','teacher','admin','unknown'] loop
  v_uid:=coalesce(current_setting('mec_repub_qa.'||v_fixture||'_uid',true),'');
  for v_test in select * from (values
   ('student','visible_books',3::bigint,'select count(*) from public.books where published'),
   ('student','new_speak_up',1::bigint,'select count(*) from public.books b join pg_temp.mec_repub_expected e on e.slug=b.slug and e.new_path=b.storage_path join storage.objects o on o.bucket_id=b.storage_bucket and o.name=e.new_path where b.published and b.resource_type=''speak_up'' and o.bucket_id=''materiales'''),
   ('student','old_speak_up_paths',0::bigint,'select count(*) from storage.objects o join pg_temp.mec_repub_expected e on e.old_path=o.name where o.bucket_id=''materiales'''),
   ('student','teacher_books',0::bigint,'select count(*) from public.books where teacher_only or resource_type=''teachers_book'''),
   ('student','teacher_pdf_and_covers',0::bigint,'select count(*) from storage.objects o join pg_temp.mec_repub_refs r on r.bucket=o.bucket_id and r.path=o.name where r.category in (''teacher_pdf'',''teacher_cover'')'),
   ('student','own_referenced_pdfs',3::bigint,'select count(*) from storage.objects o join pg_temp.mec_repub_refs r on r.bucket=o.bucket_id and r.path=o.name where r.category=''student_pdf'''),
   ('student','wrong_level_or_program',0::bigint,'select count(*) from public.books b where b.level_index is distinct from public.my_level_index() or not exists(select 1 from public.students s where s.id=auth.uid() and b.program in(s.program,''ambos''))'),
   ('teacher','visible_books',16::bigint,'select count(*) from public.books where published'),
   ('teacher','new_speak_up',4::bigint,'select count(*) from public.books b join pg_temp.mec_repub_expected e on e.slug=b.slug and e.new_path=b.storage_path join storage.objects o on o.bucket_id=b.storage_bucket and o.name=e.new_path where b.published and b.resource_type=''speak_up'' and o.bucket_id=''materiales'''),
   ('teacher','teacher_pdfs',4::bigint,'select count(*) from storage.objects o join pg_temp.mec_repub_refs r on r.bucket=o.bucket_id and r.path=o.name where r.category=''teacher_pdf'''),
   ('teacher','teacher_covers',4::bigint,'select count(*) from storage.objects o join pg_temp.mec_repub_refs r on r.bucket=o.bucket_id and r.path=o.name where r.category=''teacher_cover'''),
   ('admin','visible_books',16::bigint,'select count(*) from public.books where published'),
   ('admin','new_speak_up',4::bigint,'select count(*) from public.books b join pg_temp.mec_repub_expected e on e.slug=b.slug and e.new_path=b.storage_path join storage.objects o on o.bucket_id=b.storage_bucket and o.name=e.new_path where b.published and b.resource_type=''speak_up'' and o.bucket_id=''materiales'''),
   ('admin','teacher_pdfs',4::bigint,'select count(*) from storage.objects o join pg_temp.mec_repub_refs r on r.bucket=o.bucket_id and r.path=o.name where r.category=''teacher_pdf'''),
   ('admin','teacher_covers',4::bigint,'select count(*) from storage.objects o join pg_temp.mec_repub_refs r on r.bucket=o.bucket_id and r.path=o.name where r.category=''teacher_cover'''),
   ('unknown','visible_books',0::bigint,'select count(*) from public.books'),
   ('unknown','visible_resources',0::bigint,'select count(*) from public.library_resources'),
   ('unknown','referenced_objects',0::bigint,'select count(*) from storage.objects o join pg_temp.mec_repub_refs r on r.bucket=o.bucket_id and r.path=o.name')
  ) as tests(fixture,name,wanted,query) where fixture=v_fixture loop
   if current_setting('mec_repub_qa.fixture_ready',true) is distinct from 'true' or v_uid='' then
    insert into pg_temp.mec_repub_qa_results values (v_fixture||'.'||v_test.name,'SKIP',null,v_test.wanted,'Required existing active fixture is unavailable; no account was created.'); continue;
   end if;
   begin
    perform set_config('request.jwt.claim.sub',v_uid,true);
    perform set_config('request.jwt.claim.role','authenticated',true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_uid,'role','authenticated','aud','authenticated')::text,true);
    if current_user<>'authenticated' or auth.uid()::text is distinct from v_uid
      or (v_fixture<>'unknown' and public.app_role() is distinct from v_fixture)
      or (v_fixture='unknown' and public.app_role() is not null) then
     insert into pg_temp.mec_repub_qa_results values (v_fixture||'.'||v_test.name,'FAIL',null,v_test.wanted,'Expected database/JWT/profile role context was not applied.'); continue;
    end if;
    execute v_test.query into v_count;
    insert into pg_temp.mec_repub_qa_results values (v_fixture||'.'||v_test.name,case when v_count=v_test.wanted then 'PASS' else 'FAIL' end,v_count,v_test.wanted,'Observed under authenticated RLS; no row contents or identities disclosed.');
   exception when query_canceled then
    insert into pg_temp.mec_repub_qa_results values (v_fixture||'.'||v_test.name,'FAIL',null,v_test.wanted,'Assertion canceled.');
   when others then
    insert into pg_temp.mec_repub_qa_results values (v_fixture||'.'||v_test.name,'FAIL',null,v_test.wanted,'Assertion failed; SQLSTATE '||sqlstate||'.');
   end;
  end loop;
 end loop;
exception when query_canceled then
 insert into pg_temp.mec_repub_qa_results values ('authenticated.runner','FAIL',null,null,'Authenticated runner canceled.');
when others then
 insert into pg_temp.mec_repub_qa_results values ('authenticated.runner','FAIL',null,null,'Authenticated runner failed; SQLSTATE '||sqlstate||'.');
end;
$qa_authenticated$;
reset role;
set local role anon;
do $qa_guest$
declare v_test record; v_count bigint;
begin
 perform set_config('request.jwt.claim.sub','',true);
 perform set_config('request.jwt.claim.role','anon',true);
 perform set_config('request.jwt.claims',jsonb_build_object('role','anon')::text,true);
 if current_user<>'anon' or auth.uid() is not null then
  insert into pg_temp.mec_repub_qa_results values ('guest.context','FAIL',null,null,'Guest context was not applied.'); return;
 end if;
 for v_test in select * from (values
  ('guest.visible_books','select count(*) from public.books'),
  ('guest.visible_resources','select count(*) from public.library_resources'),
  ('guest.referenced_objects','select count(*) from storage.objects o join pg_temp.mec_repub_refs r on r.bucket=o.bucket_id and r.path=o.name')
 ) as tests(name,query) loop
  begin
   execute v_test.query into v_count;
   insert into pg_temp.mec_repub_qa_results values (v_test.name,case when v_count=0 then 'PASS' else 'FAIL' end,v_count,0,'Observed under anon RLS; no row contents or identities disclosed.');
  exception when insufficient_privilege then
   insert into pg_temp.mec_repub_qa_results values (v_test.name,'PASS',0,0,'Guest access denied by table permissions (42501).');
  when query_canceled then
   insert into pg_temp.mec_repub_qa_results values (v_test.name,'FAIL',null,0,'Guest assertion canceled.');
  when others then
   insert into pg_temp.mec_repub_qa_results values (v_test.name,'FAIL',null,0,'Guest assertion failed; SQLSTATE '||sqlstate||'.');
  end;
 end loop;
exception when others then
 insert into pg_temp.mec_repub_qa_results values ('guest.runner','FAIL',null,null,'Guest runner failed; SQLSTATE '||sqlstate||'.');
end;
$qa_guest$;
reset role;
select test_name,status,observed,expected,detail from pg_temp.mec_repub_qa_results
 order by case status when 'FAIL' then 0 when 'SKIP' then 1 else 2 end,test_name;
rollback;
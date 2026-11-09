-- MEC Biblioteca: real RLS checks, intended for Supabase SQL Editor as postgres.
-- Run the WHOLE file after all 16 books and 20 current-release objects are published.
-- This is not a migration. It must not be run as a selected fragment.
-- No user is created, no profile is changed, and no identity is printed.
-- JWT settings emulate existing users only inside this transaction; they test RLS,
-- not password login, JWT validation at the gateway, or signed-URL expiry.
-- The only production write attempted is a student no-op UPDATE title = title.
-- Even an unexpectedly allowed update is rolled back at the end.
-- Existing triggers could run if that update is incorrectly permitted. Review
-- nontransactional/external triggers first if any are installed on public.books.
-- PASS = assertion satisfied; FAIL = unexpected result/error; SKIP = missing fixture.
-- A missing active adult student in A1-B2, teacher, or admin is never a PASS.
-- If the editor/connection is interrupted before the last line, issue ROLLBACK
-- in that same session. Do not replace the final ROLLBACK with COMMIT.

begin;
set local row_security = on;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

create temporary table mec_biblioteca_qa_results (
  test_name text primary key,
  status text not null check (status in ('PASS', 'FAIL', 'SKIP')),
  observed bigint,
  expected bigint,
  detail text not null
) on commit drop;
-- These grants affect only this transaction's aggregate-results temp table.
do $qa_temp_grants$
declare
  v_temp_schema text := pg_my_temp_schema()::regnamespace::text;
begin
  execute format('grant usage on schema %I to authenticated, anon', v_temp_schema);
end;
$qa_temp_grants$;
grant select, insert on table pg_temp.mec_biblioteca_qa_results to authenticated, anon;

do $qa_setup$
declare
  v_student uuid;
  v_teacher uuid;
  v_admin uuid;
  v_unknown uuid;
  v_count bigint;
begin
  -- Settings carry fixture IDs internally. Never SELECT these settings in results.
  perform set_config('mec_biblioteca_qa.fixture_ready', 'false', true);
  perform set_config('mec_biblioteca_qa.student_uid', '', true);
  perform set_config('mec_biblioteca_qa.teacher_uid', '', true);
  perform set_config('mec_biblioteca_qa.admin_uid', '', true);
  perform set_config('mec_biblioteca_qa.unknown_uid', '', true);
  begin
    select p.id into v_student
      from public.profiles p join public.students s on s.id = p.id
      where p.active is true and p.role = 'student' and s.program = 'adultos'
        and s.current_level between 1 and 4
      order by p.id limit 1;
    select p.id into v_teacher from public.profiles p
      where p.active is true and p.role = 'teacher' order by p.id limit 1;
    select p.id into v_admin from public.profiles p
      where p.active is true and p.role = 'admin' order by p.id limit 1;
    loop
      v_unknown := gen_random_uuid();
      exit when not exists (select 1 from public.profiles p where p.id = v_unknown);
    end loop;
    perform set_config('mec_biblioteca_qa.student_uid', coalesce(v_student::text, ''), true);
    perform set_config('mec_biblioteca_qa.teacher_uid', coalesce(v_teacher::text, ''), true);
    perform set_config('mec_biblioteca_qa.admin_uid', coalesce(v_admin::text, ''), true);
    perform set_config('mec_biblioteca_qa.unknown_uid', v_unknown::text, true);
    perform set_config('mec_biblioteca_qa.fixture_ready', 'true', true);
  exception
    when query_canceled then
      insert into pg_temp.mec_biblioteca_qa_results values
        ('setup.fixtures', 'FAIL', null, null, 'Fixture selection canceled; no identities disclosed.');
    when others then
      insert into pg_temp.mec_biblioteca_qa_results values
        ('setup.fixtures', 'FAIL', null, null, 'Fixture selection failed; SQLSTATE ' || sqlstate || '.');
  end;

  begin
    select count(*) into v_count from pg_roles
      where rolname in ('authenticated', 'anon') and not rolbypassrls and not rolsuper;
    insert into pg_temp.mec_biblioteca_qa_results values
      ('setup.non_bypass_roles', case when v_count = 2 then 'PASS' else 'FAIL' end,
       v_count, 2, 'Both client database roles must be non-superuser and subject to RLS.');
    select count(*) into v_count from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relrowsecurity and ((n.nspname = 'public' and c.relname in ('books', 'library_resources'))
                                 or (n.nspname = 'storage' and c.relname = 'objects'));
    insert into pg_temp.mec_biblioteca_qa_results values
      ('setup.rls_enabled', case when v_count = 3 then 'PASS' else 'FAIL' end,
       v_count, 3, 'RLS must be enabled on both catalogs and Storage objects.');
    select count(*) into v_count from storage.buckets
      where id in ('materiales', 'teacher-keys') and public is false;
    insert into pg_temp.mec_biblioteca_qa_results values
      ('setup.private_buckets', case when v_count = 2 then 'PASS' else 'FAIL' end,
       v_count, 2, 'Both file buckets must remain private.');
    select count(*) into v_count from public.books
      where published and storage_path like 'library-20261109/%';
    insert into pg_temp.mec_biblioteca_qa_results values
      ('setup.published_release', case when v_count = 16 then 'PASS' else 'FAIL' end,
       v_count, 16, 'Current release must contain 16 published books.');
    select count(*) into v_count from public.books
      where published and storage_path like 'library-20261109/%'
        and not teacher_only and resource_type in ('student_book', 'practice_book', 'speak_up')
        and storage_bucket = 'materiales';
    insert into pg_temp.mec_biblioteca_qa_results values
      ('setup.student_release', case when v_count = 12 then 'PASS' else 'FAIL' end,
       v_count, 12, 'Current release must contain 12 student books.');
    select count(*) into v_count from public.books
      where published and storage_path like 'library-20261109/%'
        and teacher_only and resource_type = 'teachers_book' and storage_bucket = 'teacher-keys';
    insert into pg_temp.mec_biblioteca_qa_results values
      ('setup.teacher_release', case when v_count = 4 then 'PASS' else 'FAIL' end,
       v_count, 4, 'Current release must contain four protected Teacher books.');
  exception
    when query_canceled then
      insert into pg_temp.mec_biblioteca_qa_results values
        ('setup.preflight_error', 'FAIL', null, null, 'Preflight canceled.');
    when others then
      insert into pg_temp.mec_biblioteca_qa_results values
        ('setup.preflight_error', 'FAIL', null, null, 'Preflight failed; SQLSTATE ' || sqlstate || '.');
  end;
end;
$qa_setup$;

-- The DO block below is NOT SECURITY DEFINER. Every query executes with the
-- authenticated role, so postgres privileges cannot bypass the policies.
set local role authenticated;
do $qa_authenticated$
declare
  v_fixture text;
  v_uid text;
  v_test record;
  v_count bigint;
  v_expected bigint;
  v_sql text;
begin
  foreach v_fixture in array array['student', 'teacher', 'admin', 'unknown'] loop
    v_uid := coalesce(current_setting('mec_biblioteca_qa.' || v_fixture || '_uid', true), '');
    for v_test in
      select * from (values
        ('student', 'visible_books', 3::bigint),
        ('student', 'teacher_books', 0::bigint),
        ('student', 'other_levels', 0::bigint),
        ('student', 'teacher_storage', 0::bigint),
        ('student', 'own_book_storage', 3::bigint),
        ('student', 'book_update_rows', 0::bigint),
        ('teacher', 'visible_books', 16::bigint),
        ('teacher', 'release_objects', 20::bigint),
        ('teacher', 'student_pdf_objects', 12::bigint),
        ('teacher', 'teacher_pdf_objects', 4::bigint),
        ('teacher', 'teacher_cover_objects', 4::bigint),
        ('admin', 'visible_books', 16::bigint),
        ('admin', 'release_objects', 20::bigint),
        ('admin', 'student_pdf_objects', 12::bigint),
        ('admin', 'teacher_pdf_objects', 4::bigint),
        ('admin', 'teacher_cover_objects', 4::bigint),
        ('unknown', 'visible_books', 0::bigint),
        ('unknown', 'visible_resources', 0::bigint),
        ('unknown', 'private_release_objects', 0::bigint)
      ) as tests(fixture, name, wanted) where fixture = v_fixture
    loop
      if current_setting('mec_biblioteca_qa.fixture_ready', true) is distinct from 'true'
         or v_uid = '' then
        insert into pg_temp.mec_biblioteca_qa_results values
          (v_fixture || '.' || v_test.name, 'SKIP', null, v_test.wanted,
           'Required active fixture is unavailable; no account was created.');
        continue;
      end if;
      begin
        -- No role is read from untrusted user_metadata. The existing profile and
        -- the production policy functions decide the application role.
        perform set_config('request.jwt.claim.sub', v_uid, true);
        perform set_config('request.jwt.claim.role', 'authenticated', true);
        perform set_config('request.jwt.claims',
          jsonb_build_object('sub', v_uid, 'role', 'authenticated', 'aud', 'authenticated')::text, true);
        if current_user <> 'authenticated' or auth.uid()::text is distinct from v_uid then
          insert into pg_temp.mec_biblioteca_qa_results values
            (v_fixture || '.' || v_test.name, 'FAIL', null, v_test.wanted,
             'Test identity or database role was not applied.');
          continue;
        end if;
        v_expected := v_test.wanted;
        v_sql := case v_test.name
          when 'visible_books' then
            'select count(*) from public.books where published'
          when 'teacher_books' then
            'select count(*) from public.books where teacher_only or resource_type = ''teachers_book'''
          when 'other_levels' then
            'select count(*) from public.books b where b.level_index is distinct from
               (select s.current_level from public.students s where s.id = auth.uid())'
          when 'teacher_storage' then
            'select count(*) from storage.objects where bucket_id = ''teacher-keys''
               and name like ''library-20261109/%'''
          when 'own_book_storage' then
            'select count(*) from storage.objects where bucket_id = ''materiales''
               and name like ''library-20261109/%'' and name like ''%.pdf'''
          when 'book_update_rows' then
            'with attempted as (update public.books set title = title
               where published and storage_path like ''library-20261109/%'' returning 1)
             select count(*) from attempted'
          when 'release_objects' then
            'select count(*) from storage.objects where bucket_id in (''materiales'', ''teacher-keys'')
               and name like ''library-20261109/%''
               and (name like ''%.pdf'' or name like ''%.webp'')'
          when 'student_pdf_objects' then
            'select count(*) from storage.objects where bucket_id = ''materiales''
               and name like ''library-20261109/%'' and name like ''%.pdf'''
          when 'teacher_pdf_objects' then
            'select count(*) from storage.objects where bucket_id = ''teacher-keys''
               and name like ''library-20261109/%'' and name like ''%.pdf'''
          when 'teacher_cover_objects' then
            'select count(*) from storage.objects where bucket_id = ''teacher-keys''
               and name like ''library-20261109/%'' and name like ''%.webp'''
          when 'visible_resources' then
            'select count(*) from public.library_resources'
          when 'private_release_objects' then
            'select count(*) from storage.objects where bucket_id in (''materiales'', ''teacher-keys'')
               and name like ''library-20261109/%'''
          else null
        end;
        if v_sql is null then raise exception using errcode = 'P0001', message = 'Unknown QA assertion'; end if;
        execute v_sql into v_count;
        insert into pg_temp.mec_biblioteca_qa_results values
          (v_fixture || '.' || v_test.name, case when v_count = v_expected then 'PASS' else 'FAIL' end,
           v_count, v_expected, 'Observed under authenticated RLS; no identity or row content disclosed.');
      exception
        when query_canceled then
          insert into pg_temp.mec_biblioteca_qa_results values
            (v_fixture || '.' || v_test.name, 'FAIL', null, v_test.wanted, 'Assertion canceled.');
        when others then
          insert into pg_temp.mec_biblioteca_qa_results values
            (v_fixture || '.' || v_test.name, 'FAIL', null, v_test.wanted,
             'Assertion failed; SQLSTATE ' || sqlstate || '.');
      end;
    end loop;
  end loop;
exception
  when query_canceled then
    insert into pg_temp.mec_biblioteca_qa_results values
      ('authenticated.runner', 'FAIL', null, null, 'Authenticated assertions canceled.');
  when others then
    insert into pg_temp.mec_biblioteca_qa_results values
      ('authenticated.runner', 'FAIL', null, null, 'Authenticated runner failed; SQLSTATE ' || sqlstate || '.');
end;
$qa_authenticated$;
reset role;

-- The anon role has no JWT subject. A table permission denial is also a valid
-- denial for a guest; it is recorded explicitly, rather than hidden as a count.
set local role anon;
do $qa_anon$
declare
  v_test record;
  v_count bigint;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
  -- Validate the anonymous context outside permission-denial catch blocks,
  -- so a failure to read auth.uid() can never create a false PASS.
  if current_user <> 'anon' or auth.uid() is not null then
    insert into pg_temp.mec_biblioteca_qa_results values
      ('guest.context', 'FAIL', null, null, 'Guest identity or database role was not applied.');
    return;
  end if;
  for v_test in
    select * from (values
      ('guest.teacher_books',
       'select count(*) from public.books where teacher_only or resource_type = ''teachers_book'''),
      ('guest.all_books', 'select count(*) from public.books'),
      ('guest.private_release_objects',
       'select count(*) from storage.objects where bucket_id in (''materiales'', ''teacher-keys'')
          and name like ''library-20261109/%'''),
      ('guest.resources', 'select count(*) from public.library_resources')
    ) as tests(name, query)
  loop
    begin
      execute v_test.query into v_count;
      insert into pg_temp.mec_biblioteca_qa_results values
        (v_test.name, case when v_count = 0 then 'PASS' else 'FAIL' end,
         v_count, 0, 'Observed under anon RLS; no identity or row content disclosed.');
    exception
      when insufficient_privilege then
        insert into pg_temp.mec_biblioteca_qa_results values
          (v_test.name, 'PASS', 0, 0, 'Guest access denied by table permissions (42501).');
      when query_canceled then
        insert into pg_temp.mec_biblioteca_qa_results values
          (v_test.name, 'FAIL', null, 0, 'Guest assertion canceled.');
      when others then
        insert into pg_temp.mec_biblioteca_qa_results values
          (v_test.name, 'FAIL', null, 0, 'Guest assertion failed; SQLSTATE ' || sqlstate || '.');
    end;
  end loop;
exception
  when query_canceled then
    insert into pg_temp.mec_biblioteca_qa_results values
      ('guest.runner', 'FAIL', null, null, 'Guest assertions canceled.');
  when others then
    insert into pg_temp.mec_biblioteca_qa_results values
      ('guest.runner', 'FAIL', null, null, 'Guest runner failed; SQLSTATE ' || sqlstate || '.');
end;
$qa_anon$;
reset role;

-- Only aggregates leave the transaction. Review every SKIP as an untested case.
select test_name, status, observed, expected, detail
  from pg_temp.mec_biblioteca_qa_results
  order by case status when 'FAIL' then 0 when 'SKIP' then 1 else 2 end, test_name;

-- Mandatory: discard temp grants, JWT/fixture settings and any unexpected UPDATE.
rollback;

-- Publish only after all 16 PDFs and 4 private covers are uploaded.
begin;
create temporary table mec_library_expected(bucket text,path text,bytes bigint) on commit drop;
insert into mec_library_expected values
('materiales','library-20261109/a1-students-book.pdf',28482215),
('materiales','library-20261109/a1-practice-book.pdf',38358517),
('materiales','library-20261109/a1-speak-up.pdf',34444526),
('materiales','library-20261109/a2-students-book.pdf',23181948),
('materiales','library-20261109/a2-practice-book.pdf',43514907),
('materiales','library-20261109/a2-speak-up.pdf',43635527),
('materiales','library-20261109/b1-students-book.pdf',7250285),
('materiales','library-20261109/b1-practice-book.pdf',5802219),
('materiales','library-20261109/b1-speak-up.pdf',42755938),
('materiales','library-20261109/b2-students-book.pdf',9525282),
('materiales','library-20261109/b2-practice-book.pdf',17052120),
('materiales','library-20261109/b2-speak-up.pdf',42406762),
('teacher-keys','library-20261109/a1-teachers-book.pdf',25959843),
('teacher-keys','library-20261109/a1-teachers-book.webp',31552),
('teacher-keys','library-20261109/a2-teachers-book.pdf',36406100),
('teacher-keys','library-20261109/a2-teachers-book.webp',32154),
('teacher-keys','library-20261109/b1-teachers-book.pdf',13912941),
('teacher-keys','library-20261109/b1-teachers-book.webp',31500),
('teacher-keys','library-20261109/b2-teachers-book.pdf',24561170),
('teacher-keys','library-20261109/b2-teachers-book.webp',31582);
do $$ begin
 if exists(select 1 from mec_library_expected e left join storage.objects o on o.bucket_id=e.bucket and o.name=e.path where o.id is null or (o.metadata->>'size')::bigint is distinct from e.bytes) then raise exception 'Library upload is incomplete or has an unexpected file size'; end if;
end $$;
insert into public.books(program,level_index,kind,title,url,teacher_only,slug,cover_thumb,sort_order,storage_path,storage_bucket,resource_type,description,published,page_count) values
('adultos',1,'book','Student’s Book · A1',null,false,'a1-students-book','img/web/biblioteca/a1-students-book.webp',1,'library-20261109/a1-students-book.pdf','materiales','student_book','El libro principal de tu recorrido.',true,234),
('adultos',1,'book','Practice Book · A1',null,false,'a1-practice-book','img/web/biblioteca/a1-practice-book.webp',2,'library-20261109/a1-practice-book.pdf','materiales','practice_book','Ejercicios para consolidar lo aprendido.',true,202),
('adultos',1,'book','Speak Up · A1',null,false,'a1-speak-up','img/web/biblioteca/a1-speak-up.webp',3,'library-20261109/a1-speak-up.pdf','materiales','speak_up','Conversación guiada para poner tu inglés en práctica.',true,100),
('adultos',2,'book','Student’s Book · A2',null,false,'a2-students-book','img/web/biblioteca/a2-students-book.webp',1,'library-20261109/a2-students-book.pdf','materiales','student_book','El libro principal de tu recorrido.',true,280),
('adultos',2,'book','Practice Book · A2',null,false,'a2-practice-book','img/web/biblioteca/a2-practice-book.webp',2,'library-20261109/a2-practice-book.pdf','materiales','practice_book','Ejercicios para consolidar lo aprendido.',true,158),
('adultos',2,'book','Speak Up · A2',null,false,'a2-speak-up','img/web/biblioteca/a2-speak-up.webp',3,'library-20261109/a2-speak-up.pdf','materiales','speak_up','Conversación guiada para poner tu inglés en práctica.',true,100),
('adultos',3,'book','Student’s Book · B1',null,false,'b1-students-book','img/web/biblioteca/b1-students-book.webp',1,'library-20261109/b1-students-book.pdf','materiales','student_book','El libro principal de tu recorrido.',true,137),
('adultos',3,'book','Practice Book · B1',null,false,'b1-practice-book','img/web/biblioteca/b1-practice-book.webp',2,'library-20261109/b1-practice-book.pdf','materiales','practice_book','Ejercicios para consolidar lo aprendido.',true,68),
('adultos',3,'book','Speak Up · B1',null,false,'b1-speak-up','img/web/biblioteca/b1-speak-up.webp',3,'library-20261109/b1-speak-up.pdf','materiales','speak_up','Conversación guiada para poner tu inglés en práctica.',true,104),
('adultos',4,'book','Student’s Book · B2',null,false,'b2-students-book','img/web/biblioteca/b2-students-book.webp',1,'library-20261109/b2-students-book.pdf','materiales','student_book','El libro principal de tu recorrido.',true,99),
('adultos',4,'book','Practice Book · B2',null,false,'b2-practice-book','img/web/biblioteca/b2-practice-book.webp',2,'library-20261109/b2-practice-book.pdf','materiales','practice_book','Ejercicios para consolidar lo aprendido.',true,68),
('adultos',4,'book','Speak Up · B2',null,false,'b2-speak-up','img/web/biblioteca/b2-speak-up.webp',3,'library-20261109/b2-speak-up.pdf','materiales','speak_up','Conversación guiada para poner tu inglés en práctica.',true,68),
('adultos',1,'book','Teacher’s Book · A1',null,true,'a1-teachers-book',null,4,'library-20261109/a1-teachers-book.pdf','teacher-keys','teachers_book','Guía docente y claves de la colección.',true,295),
('adultos',2,'book','Teacher’s Book · A2',null,true,'a2-teachers-book',null,4,'library-20261109/a2-teachers-book.pdf','teacher-keys','teachers_book','Guía docente y claves de la colección.',true,322),
('adultos',3,'book','Teacher’s Book · B1',null,true,'b1-teachers-book',null,4,'library-20261109/b1-teachers-book.pdf','teacher-keys','teachers_book','Guía docente y claves de la colección.',true,276),
('adultos',4,'book','Teacher’s Book · B2',null,true,'b2-teachers-book',null,4,'library-20261109/b2-teachers-book.pdf','teacher-keys','teachers_book','Guía docente y claves de la colección.',true,292)
on conflict(slug) do update set program=excluded.program,level_index=excluded.level_index,kind=excluded.kind,title=excluded.title,url=null,teacher_only=excluded.teacher_only,cover_thumb=excluded.cover_thumb,sort_order=excluded.sort_order,storage_path=excluded.storage_path,storage_bucket=excluded.storage_bucket,resource_type=excluded.resource_type,description=excluded.description,published=true,page_count=excluded.page_count;
commit;
select count(*) as current_books,count(*) filter(where teacher_only) as staff_books,sum(page_count) as pages from public.books where storage_path like 'library-20261109/%' and published;

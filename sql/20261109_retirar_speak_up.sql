-- Speak Up: retirada temporal autorizada por Diego; NO reactivar sin nueva aprobación.
begin;
do $$
begin
 if (select count(*) from public.books where resource_type='speak_up' and slug in ('a1-speak-up','a2-speak-up','b1-speak-up','b2-speak-up')) <> 4 then raise exception 'Se esperaban exactamente cuatro Speak Up'; end if;
 update public.books set published=false where resource_type='speak_up' and slug in ('a1-speak-up','a2-speak-up','b1-speak-up','b2-speak-up');
end $$;
select slug, title, published from public.books where resource_type='speak_up' and slug in ('a1-speak-up','a2-speak-up','b1-speak-up','b2-speak-up') order by slug;
select count(*) filter(where published) as libros_publicados, count(*) filter(where published and resource_type='speak_up') as speak_up_publicados from public.books;
commit;

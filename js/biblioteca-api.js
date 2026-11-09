/* MEC Biblioteca: the database and private Storage authorize every read. */
(() => {
  "use strict";
  const M = window.MEC, api = M.api;
  const staff = (me) => me && ["admin", "teacher"].includes(me.role);
  const bookType = (b) => b.teacher_only || /teachers?-book/.test(b.slug || "") ? "teachers_book"
    : /practice-book/.test(b.slug || "") ? "practice_book" : /speak-up/.test(b.slug || "") ? "speak_up" : "student_book";
  function https(value) {
    if (typeof value !== "string") throw new Error("Este recurso todavía no tiene un enlace disponible.");
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password) throw new Error("El enlace del recurso no es válido.");
    return u.href;
  }
  function dto(b) {
    const teacher = !!b.teacher_only || b.resource_type === "teachers_book";
    return {
      id: "book:" + b.id, slug: b.slug || "book-" + b.id, title: b.title,
      description: b.description || ({student_book:"El libro principal de tu recorrido.",practice_book:"Ejercicios para consolidar lo aprendido.",speak_up:"Conversación guiada para poner tu inglés en práctica.",teachers_book:"Guía docente y claves de la colección."})[bookType(b)],
      type: b.resource_type || bookType(b), level_index: b.level_index,
      program: b.program, teacher_only: teacher, cover_url: teacher ? "" : (b.cover_thumb || ""),
      storage_path: b.storage_path || "", collection_slug: "course-books",
      sort_order: b.sort_order || 0, page_count: b.page_count || null, published: b.published !== false
    };
  }
  async function result(request) {
    const r = await request;
    if (r.error) throw new Error("No se pudo cargar la biblioteca. Intenta de nuevo en un momento.");
    return r.data || [];
  }
  api.libraryListItems = async function () {
    const me = await api.currentUser();
    if (!me || !["student", "teacher", "admin"].includes(me.role)) throw new Error("Inicia sesión para entrar a la biblioteca.");
    let books, resources = [], clientForCovers;
    if (api.mode === "supabase") {
      const c = await api._client(); clientForCovers = c;
      [books, resources] = await Promise.all([
        result(c.from("books").select("*").order("level_index").order("sort_order")),
        result(c.from("library_resources").select("id,slug,title,description,type,level_index,program,teacher_only,collection_slug,sort_order,lesson_code,external_url,cover_url,published").eq("published", true).order("sort_order"))
      ]);
    } else books = await api.listBooks();
    const items = books.map(dto).concat(resources.map((r) => Object.assign({}, r, {id:"resource:" + r.id})));
    if (clientForCovers && staff(me)) {
      await Promise.all(books.map(async (b, i) => {
        if (!b.teacher_only || b.storage_bucket !== "teacher-keys" || !/^library-20261109\/[a-z0-9-]+\.pdf$/.test(b.storage_path || "")) return;
        try {
          const coverPath = b.storage_path.replace(/\.pdf$/, ".webp");
          const r = await clientForCovers.storage.from("teacher-keys").createSignedUrl(coverPath, 3600);
          if (!r.error && r.data && r.data.signedUrl) items[i].cover_url = https(r.data.signedUrl);
        } catch (_) { /* The typographic cover remains available if the thumbnail is missing. */ }
      }));
    }
    return items.filter((r) => r.published !== false && (staff(me) || (!r.teacher_only && r.type !== "teachers_book")));
  };
  api.libraryItemUrl = async function (item) {
    if (!item || typeof item.id !== "string" || !/^(book:\d+|resource:[0-9a-f-]{36})$/i.test(item.id)) throw new Error("Selecciona un recurso de la biblioteca.");
    const me = await api.currentUser();
    if (!me || !["student", "teacher", "admin"].includes(me.role)) throw new Error("Tu sesión terminó. Vuelve a iniciar sesión.");
    if (api.mode !== "supabase") throw new Error("Los archivos privados no están disponibles en la demostración.");
    const c = await api._client();
    const [kind, id] = item.id.split(":");
    if (kind === "book" && /^\d+$/.test(id || "")) {
      // Re-read the row under RLS. Never sign a path received from the browser UI.
      const rows = await result(c.from("books").select("id,teacher_only,resource_type,published,storage_bucket,storage_path").eq("id", id));
      const b = rows[0];
      if (!b || !b.published || ((b.teacher_only || b.resource_type === "teachers_book") && !staff(me))) throw new Error("Este libro no está disponible para tu perfil.");
      if (!b.storage_path || !["materiales", "teacher-keys"].includes(b.storage_bucket)) throw new Error("El archivo de este libro todavía no está disponible.");
      const r = await c.storage.from(b.storage_bucket).createSignedUrl(b.storage_path, 600);
      if (r.error || !r.data || !r.data.signedUrl) throw new Error("No se pudo abrir el libro. Comprueba tu sesión e inténtalo de nuevo.");
      return https(r.data.signedUrl);
    }
    if (kind === "resource" && /^[0-9a-f-]{36}$/i.test(id || "")) {
      const rows = await result(c.from("library_resources").select("external_url,published,teacher_only").eq("id", id));
      const r = rows[0];
      if (!r || !r.published || (r.teacher_only && !staff(me))) throw new Error("Este recurso no está disponible para tu perfil.");
      return https(r.external_url);
    }
    throw new Error("El recurso seleccionado no es válido.");
  };
})();

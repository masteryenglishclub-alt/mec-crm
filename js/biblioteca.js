/* MEC · Biblioteca: estantes, colecciones y mediateca. Los permisos reales se verifican en el servidor. */
(function () {
  "use strict";
  const M = (window.MEC = window.MEC || {});
  const LEVELS = ["A1", "A2", "B1", "B2", "C1"];
  const TYPE = { student_book: "Student’s Book", practice_book: "Practice Book", speak_up: "Speak Up", teachers_book: "Teacher’s Book", story: "Historia", podcast: "Podcast", blog: "Blog", video: "Clase en vídeo" };
  const COURSE_TYPES = new Set(["student_book", "practice_book", "speak_up"]);
  const STAFF = new Set(["teacher", "admin"]);
  const ROLES = new Set(["student", "teacher", "admin"]);
  const FIRST_BLOG_RESOURCE = Object.freeze({
    id: "public-blog:entender-pero-no-recordar-b1",
    slug: "entender-pero-no-recordar-b1",
    title: "Entiendo inglés, pero no encuentro las palabras al hablar",
    description: "Nivel B1 · Por Diego Gonzalez. Una práctica breve para recordar expresiones y usarlas en una conversación.",
    type: "blog",
    level_index: 3,
    program: "adultos",
    teacher_only: false,
    published: true,
    sort_order: -1000,
    public_article_url: "https://masteryenglishclub-alt.github.io/mec-crm/blog-recuperar-frases.html"
  });
  const esc = (v) => M.esc ? M.esc(v) : String(v == null ? "" : v).replace(/[&<>"']/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[x]));
  const isStaffItem = (x) => x && (x.teacher_only === true || x.teacher_only === "true" || x.teacher_only === 1 || x.type === "teachers_book" || /(?:^|[-_/])(?:teachers?|docentes?)(?:[-_/]|$)/i.test(String(x.slug || "")));
  const isPublished = (x) => x && x.published !== false && x.published !== "false" && (!x.status || x.status === "published");
  function visibleItems(items, role) {
    if (!ROLES.has(role)) return [];
    return (Array.isArray(items) ? items : []).filter((x) => x && typeof x === "object" && Object.prototype.hasOwnProperty.call(TYPE, x.type) && isPublished(x) && (!isStaffItem(x) || STAFF.has(role)));
  }
  function safeURL(value, allowRelative) {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      const base = window.location && window.location.href || "https://masteryenglishclub-alt.github.io/mec-crm/";
      const url = new URL(value, base);
      const sameOrigin = url.origin === new URL(base).origin;
      if (url.username || url.password) return null;
      if (url.protocol !== "https:" && !(allowRelative && sameOrigin && url.protocol === "http:")) return null;
      if (!allowRelative && !/^https:\/\//i.test(value.trim())) return null;
      return url.href;
    } catch (_) { return null; }
  }
  function youtubeEmbed(value) {
    const clean = safeURL(value, false);
    if (!clean) return null;
    const u = new URL(clean), host = u.hostname.toLowerCase();
    let id = null;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    if (["youtube.com", "www.youtube.com", "m.youtube.com", "www.youtube-nocookie.com"].includes(host)) {
      id = u.searchParams.get("v") || (/^\/(?:embed|shorts)\//.test(u.pathname) ? u.pathname.split("/")[2] : null);
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? "https://www.youtube-nocookie.com/embed/" + id + "?rel=0" : null;
  }
  function sortItems(a, b) {
    const level = (Number(a.level_index) || 99) - (Number(b.level_index) || 99);
    const typeOrder = { student_book: 1, practice_book: 2, speak_up: 3, teachers_book: 4 };
    return level || (Number(a.sort_order) || typeOrder[a.type] || 50) - (Number(b.sort_order) || typeOrder[b.type] || 50) || String(a.title || "").localeCompare(String(b.title || ""), "es");
  }
  const icon = (name) => {
    const paths = {
      book: '<path d="M4 5h6c1.2 0 2 .8 2 2v13c0-1.2-.8-2-2-2H4zm16 0h-6c-1.2 0-2 .8-2 2v13c0-1.2.8-2 2-2h6z"/>',
      audio: '<path d="M5 14v-3a7 7 0 0 1 14 0v3M5 12H3v7h4v-7zm14 0h2v7h-4v-7z"/>',
      blog: '<path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/>',
      play: '<path d="m9 6 9 6-9 6z"/>',
      lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
      search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
      arrow: '<path d="m14 5-7 7 7 7M7 12h14"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || paths.book) + '</svg>';
  };
  function cover(item, small) {
    const url = safeURL(item && item.cover_url, true);
    return url ? '<img class="bib-cover' + (small ? ' bib-cover--small' : '') + '" src="' + esc(url) + '" alt="Portada de ' + esc(item.title || TYPE[item.type]) + '" loading="lazy" decoding="async">'
      : '<span class="bib-cover bib-cover--fallback" aria-hidden="true">' + icon("book") + '<b>MEC</b><span>' + esc(TYPE[item && item.type] || "Biblioteca") + '</span></span>';
  }
  const empty = (title, text) => '<div class="bib-empty">' + icon("book") + '<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p></div>';

  async function view(app, opts) {
    opts = opts || {};
    const me = opts.me || {}, role = me.role, staff = STAFF.has(role);
    const loading = document.createElement("div");
    loading.className = "bib-loading"; loading.setAttribute("role", "status"); loading.textContent = "Abriendo la biblioteca…";
    app.replaceChildren(loading);
    if (!ROLES.has(role)) {
      loading.textContent = "Inicia sesión para entrar a la biblioteca."; return;
    }
    let catalog;
    try {
      if (!M.api || typeof M.api.libraryListItems !== "function") throw new Error("La biblioteca todavía no está disponible. Inténtalo de nuevo más tarde.");
      const received = await M.api.libraryListItems();
      if (!Array.isArray(received)) throw new Error("El catálogo recibido no es válido. Inténtalo de nuevo.");
      const items = received.some((x) => x && x.slug === FIRST_BLOG_RESOURCE.slug) ? received : received.concat(FIRST_BLOG_RESOURCE);
      catalog = visibleItems(items, role).sort(sortItems);
    } catch (e) {
      if (!app.contains(loading)) return;
      app.innerHTML = '<section class="biblioteca"><div class="bib-error" role="alert"><h1>Biblioteca</h1><p>No pudimos cargar el catálogo.</p><p>' + esc(e.message || "Comprueba tu conexión e inténtalo de nuevo.") + '</p><button class="bib-button" type="button" data-bib-retry>Volver a intentar</button></div></section>';
      app.querySelector("[data-bib-retry]").onclick = () => view(app, opts); return;
    }
    if (!app.contains(loading)) return;
    const current = Number(opts.currentLevel) || 1;
    let selected = "", query = "";
    const byType = (type) => catalog.filter((x) => x.type === type);
    const levelItems = (n) => catalog.filter((x) => Number(x.level_index) === n && COURSE_TYPES.has(x.type) && !isStaffItem(x));
    const groups = LEVELS.map((level, i) => ({ key: "nivel-" + level.toLowerCase(), label: level, title: "Colección " + level, type: "level", level: i + 1, items: levelItems(i + 1) }))
      .filter((x) => x.level <= 4 || x.items.length);
    groups.push({ key: "historias", label: "Historias", title: "Historias y lecturas", type: "stories", items: byType("story") });
    if (staff) groups.push({ key: "docentes", label: "Docentes", title: "Teacher’s Books", type: "staff", items: catalog.filter(isStaffItem) });
    const counter = catalog.filter((x) => COURSE_TYPES.has(x.type) || x.type === "story" || x.type === "teachers_book").length;
    const countLabel = (n, single, plural) => n + " " + (n === 1 ? single : plural);
    const humanList = (labels) => labels.length < 2 ? (labels[0] || "") : labels.slice(0, -1).join(", ") + " y " + labels[labels.length - 1];
    function groupBookLabels(group) {
      return group.items.map((item) => group.type === "level" ? TYPE[item.type]
        : group.type === "staff" ? (LEVELS[Number(item.level_index) - 1] || item.title || TYPE[item.type])
        : item.title || TYPE[item.type]);
    }
    function collectionSubtitle(group) {
      if (!group.items.length) return group.type === "staff" ? "Acceso reservado a teachers y administradores." : "Los materiales de esta colección se muestran según los permisos de tu cuenta.";
      if (group.type === "staff") {
        const levels = Array.from(new Set(group.items.map((item) => LEVELS[Number(item.level_index) - 1]).filter(Boolean)));
        return "Guías y recursos disponibles" + (levels.length ? " de " + humanList(levels) : "") + ". Acceso reservado a teachers y administradores.";
      }
      if (group.type === "stories") return countLabel(group.items.length, "historia disponible", "historias disponibles") + " para disfrutar del inglés.";
      return "En este estante: " + humanList(Array.from(new Set(groupBookLabels(group)))) + ".";
    }
    function cluster(group) {
      const titles = groupBookLabels(group).slice(0, 4);
      const vacantLabel = group.type === "level" && role === "student" && current !== group.level ? "Acceso según tu curso" : "En preparación";
      return '<span class="bib-book-cluster" aria-hidden="true">' + (titles.length ? titles.map((label, j) => '<span class="bib-spine bib-spine--' + (j % 4) + '"><span class="bib-spine-rule"></span><b>' + esc(label) + '</b><small>MEC</small></span>').join("") : '<span class="bib-shelf-vacancy">' + esc(vacantLabel) + '</span>') + '</span>';
    }
    const shelf = groups.map((g) => {
      const active = g.type === "level" && current === g.level, available = g.items.length;
      const badge = g.type === "staff" ? "Solo teachers y admin" : available ? countLabel(available, "libro", "libros") : g.type === "level" && role === "student" && !active ? "Según tu acceso" : "En preparación";
      return '<button type="button" class="bib-shelf-group bib-shelf-group--' + esc(g.type === "level" ? g.label.toLowerCase() : g.type) + '" data-bib-section="' + g.key + '" aria-expanded="false" aria-controls="bib-collection"><span class="bib-group-top"><span>' + esc(g.title) + '</span>' + (active ? '<small>Tu nivel</small>' : g.type === "staff" ? icon("lock") : '') + '</span>' + cluster(g) + '<span class="bib-shelf-board"></span><span class="bib-brass-label"><b>' + esc(g.label) + '</b><small>' + esc(badge) + '</small><span aria-hidden="true">↗</span></span></button>';
    }).join("");
    app.innerHTML = '<section class="biblioteca" aria-labelledby="bib-title"><div class="bib-shell"><header class="bib-hero"><div><p class="bib-eyebrow">Mastery English Club</p><h1 id="bib-title">Biblioteca</h1><p>Abre un estante. Encuentra tu próxima idea.</p></div><span class="bib-hero-seal" aria-hidden="true">MC<span>Biblioteca</span></span></header><div class="bib-tools"><label class="bib-search">' + icon("search") + '<span class="bib-sr-only">Buscar en la biblioteca</span><input type="search" data-bib-search placeholder="Buscar por título o tema…" autocomplete="off"></label><p class="bib-inventory">' + countLabel(counter, "libro disponible", "libros disponibles") + (staff ? '<span class="bib-staff-badge">' + icon("lock") + ' Vista docente</span>' : '') + '</p></div><div class="bib-cabinet" aria-label="Estantes de la biblioteca"><div class="bib-cabinet-crown"><span aria-hidden="true">✦</span> Las colecciones <span aria-hidden="true">✦</span></div><div class="bib-shelves">' + shelf + '</div><div class="bib-cabinet-base"></div></div><section class="bib-collection" id="bib-collection" tabindex="-1" aria-labelledby="bib-collection-title" hidden></section><div class="bib-media-heading"><p class="bib-eyebrow">Más maneras de descubrir</p><h2>Escucha, lee y explora</h2><p>Una biblioteca que sigue creciendo contigo.</p></div><div class="bib-media-grid"><section class="bib-media-panel" aria-labelledby="bib-podcasts-title"><div class="bib-media-icon">' + icon("audio") + '</div><h3 id="bib-podcasts-title">Podcasts</h3><p>Historias, lenguas y conversaciones para escuchar en inglés.</p><div data-bib-podcasts></div></section><section class="bib-media-panel" aria-labelledby="bib-blogs-title"><div class="bib-media-icon">' + icon("blog") + '</div><h3 id="bib-blogs-title">Blogs</h3><p>Lecturas para seguir descubriendo ideas y aprender algo nuevo.</p><div data-bib-blogs></div></section></div><section class="bib-videoteca" aria-labelledby="bib-video-title"><div class="bib-video-heading"><div><p class="bib-eyebrow">La pantalla de la biblioteca</p><h2 id="bib-video-title">Videoteca de clases</h2><p>Encuentra los vídeos por nivel y por clase.</p></div><div class="bib-video-filters"><label>Buscar clase<input type="search" data-bib-video-search placeholder="Ej.: A1.1.1 o saludos" aria-label="Buscar vídeo por clase o tema"></label><label>Nivel<select data-bib-video-level aria-label="Filtrar vídeos por nivel"><option value="">Todos los niveles</option>' + LEVELS.map((x, i) => '<option value="' + (i + 1) + '">' + x + '</option>').join("") + '</select></label></div></div><div class="bib-video-layout"><div class="bib-screen"><div class="bib-screen-inner" data-bib-player><div class="bib-screen-welcome"><span class="bib-screen-logo">MC</span><h3>Elige una clase</h3><p>Los vídeos disponibles aparecerán en esta biblioteca.</p><span class="bib-screen-play" aria-hidden="true">' + icon("play") + '</span></div></div><div class="bib-screen-ledge"><span>MEC · Videoteca</span><span aria-hidden="true">●</span></div></div><div class="bib-video-list" data-bib-videos></div></div></section><div class="bib-action-status" data-bib-status role="status" aria-live="polite"></div></div></section>';
    const root = app.querySelector(".biblioteca"), detail = root.querySelector("#bib-collection"), search = root.querySelector("[data-bib-search]"), status = root.querySelector("[data-bib-status]");
    const index = (x) => catalog.indexOf(x);
    const itemButton = (x, label, cls) => {
      if (x && x.public_article_url) {
        const url = safeURL(x.public_article_url, false);
        return url ? '<a class="' + (cls || "bib-button") + '" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label || "Leer artículo") + '</a>' : "";
      }
      return '<button type="button" class="' + (cls || "bib-button") + '" data-bib-open="' + index(x) + '">' + esc(label || "Abrir libro") + '</button>';
    };
    function cards(items) {
      return '<div class="bib-book-grid">' + items.map((x) => '<article class="bib-book-card"><div class="bib-card-cover">' + cover(x) + '</div><div class="bib-card-body"><p class="bib-card-type">' + esc(TYPE[x.type]) + (LEVELS[Number(x.level_index) - 1] ? ' · ' + LEVELS[Number(x.level_index) - 1] : '') + '</p><h3>' + esc(x.title || TYPE[x.type]) + '</h3>' + (x.description ? '<p>' + esc(x.description) + '</p>' : '') + itemButton(x, x.type === "story" ? "Leer historia" : x.type === "video" ? "Ver clase" : x.type === "blog" ? "Leer artículo" : x.type === "podcast" ? "Escuchar" : "Abrir libro") + (isStaffItem(x) ? '<span class="bib-private-note">' + icon("lock") + ' Solo para docentes</span>' : '') + '</div></article>').join("") + '</div>';
    }
    function choose(key, focus) {
      selected = key;
      let group = groups.find((x) => x.key === key), items, title, subtitle;
      if (key === "busqueda") {
        const needle = query.toLocaleLowerCase("es");
        items = catalog.filter((x) => [x.title, x.description, TYPE[x.type], LEVELS[Number(x.level_index) - 1]].join(" ").toLocaleLowerCase("es").includes(needle));
        title = "Resultados de búsqueda"; subtitle = countLabel(items.length, "resultado", "resultados") + ' para “' + query + '”';
      } else if (group) {
        items = group.items; title = group.title;
        subtitle = collectionSubtitle(group);
      } else return;
      detail.hidden = false;
      detail.innerHTML = '<header class="bib-collection-heading"><div><p class="bib-eyebrow">Estante abierto</p><h2 id="bib-collection-title">' + esc(title) + '</h2><p>' + esc(subtitle) + '</p></div><button type="button" class="bib-back" data-bib-close>' + icon("arrow") + ' Volver al estante</button></header>' + (items.length ? cards(items) : empty(group && group.type === "level" && role === "student" && current !== group.level ? "No hay libros disponibles para tu cuenta en este estante" : "En preparación", group && group.type === "level" && role === "student" && current !== group.level ? "Los materiales se muestran según el nivel y los permisos de tu curso." : "Aquí aparecerán las publicaciones de esta colección cuando estén disponibles."));
      root.querySelectorAll("[data-bib-section]").forEach((b) => { const on = b.dataset.bibSection === selected; b.classList.toggle("is-open", on); b.setAttribute("aria-expanded", String(on)); });
      if (focus) { detail.focus({ preventScroll: true }); detail.scrollIntoView({ behavior: window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); }
    }
    function closeCollection() {
      const button = root.querySelector('[data-bib-section="' + selected + '"]');
      detail.hidden = true; detail.replaceChildren(); selected = ""; query = ""; search.value = "";
      root.querySelectorAll("[data-bib-section]").forEach((b) => { b.classList.remove("is-open"); b.setAttribute("aria-expanded", "false"); });
      if (button) button.focus(); else search.focus();
    }
    function mediaList(type, target) {
      const items = byType(type);
      root.querySelector(target).innerHTML = items.length ? '<ul class="bib-media-items">' + items.map((x) => '<li><span class="bib-item-label">' + esc(TYPE[x.type]) + (LEVELS[Number(x.level_index)-1] ? ' · ' + LEVELS[Number(x.level_index)-1] : '') + '</span><h4>' + esc(x.title || TYPE[x.type]) + '</h4>' + (x.description ? '<p>' + esc(x.description) + '</p>' : '') + itemButton(x, type === "podcast" ? "Escuchar episodio" : "Leer artículo", "bib-text-button") + '</li>').join("") + '</ul>' : '<p class="bib-coming">En preparación</p>';
    }
    function videoList() {
      const filter = root.querySelector("[data-bib-video-level]").value;
      const needle = root.querySelector("[data-bib-video-search]").value.trim().toLocaleLowerCase("es");
      const items = byType("video").filter((x) => (!filter || String(x.level_index) === filter) && (!needle || [x.title, x.description, x.slug, x.lesson_code].join(" ").toLocaleLowerCase("es").includes(needle)));
      root.querySelector("[data-bib-videos]").innerHTML = items.length ? '<ul>' + items.map((x) => '<li><button type="button" class="bib-video-choice" data-bib-open="' + index(x) + '"><span class="bib-video-choice-icon">' + icon("play") + '</span><span><small>' + esc(LEVELS[Number(x.level_index)-1] || "MEC") + '</small><b>' + esc(x.title || "Clase en vídeo") + '</b>' + (x.description ? '<span>' + esc(x.description) + '</span>' : '') + '</span></button></li>').join("") + '</ul>' : '<div class="bib-video-empty">' + icon("play") + '<h3>En preparación</h3><p>Las clases de este nivel aparecerán aquí cuando estén disponibles.</p></div>';
    }
    mediaList("podcast", "[data-bib-podcasts]"); mediaList("blog", "[data-bib-blogs]"); videoList();
    root.querySelector("[data-bib-video-level]").onchange = videoList;
    root.querySelector("[data-bib-video-search]").addEventListener("input", videoList);
    root.addEventListener("click", async (event) => {
      const section = event.target.closest("[data-bib-section]");
      if (section && root.contains(section)) { search.value = ""; query = ""; choose(section.dataset.bibSection, true); return; }
      if (event.target.closest("[data-bib-close]")) { closeCollection(); return; }
      const action = event.target.closest("[data-bib-open]");
      if (!action || !root.contains(action)) return;
      const x = catalog[Number(action.dataset.bibOpen)];
      if (!x || (isStaffItem(x) && !staff)) return;
      const inline = x.type === "video" || x.type === "podcast";
      const newWindow = inline ? null : window.open("about:blank", "_blank");
      if (newWindow) newWindow.opener = null;
      action.disabled = true; status.classList.remove("is-error"); status.textContent = "Abriendo “" + (x.title || TYPE[x.type]) + "”…";
      try {
        if (!M.api || typeof M.api.libraryItemUrl !== "function") throw new Error("No se pudo abrir la publicación.");
        const raw = await M.api.libraryItemUrl(x), url = safeURL(raw, false);
        if (!url) throw new Error("La publicación no tiene un enlace seguro disponible.");
        if (!root.isConnected) { if (newWindow) newWindow.close(); return; }
        if (x.type === "video") {
          const screen = root.querySelector("[data-bib-player]"), embed = youtubeEmbed(url);
          screen.replaceChildren();
          if (embed) {
            const iframe = document.createElement("iframe"); iframe.src = embed; iframe.title = x.title || "Clase MEC"; iframe.allow = "fullscreen; picture-in-picture"; iframe.allowFullscreen = true; iframe.referrerPolicy = "strict-origin-when-cross-origin"; screen.appendChild(iframe);
          } else {
            const video = document.createElement("video"); video.controls = true; video.preload = "metadata"; video.src = url; video.setAttribute("aria-label", x.title || "Clase MEC"); screen.appendChild(video);
          }
          root.querySelectorAll(".bib-video-choice").forEach((b) => b.classList.toggle("is-active", Number(b.dataset.bibOpen) === index(x)));
          screen.scrollIntoView({ behavior: "auto", block: "nearest" });
        } else if (x.type === "podcast") {
          let player = root.querySelector("[data-bib-audio]");
          if (!player) { player = document.createElement("div"); player.dataset.bibAudio = ""; player.className = "bib-audio-player"; root.querySelector("[data-bib-podcasts]").prepend(player); }
          const title = document.createElement("p"); title.textContent = x.title || "Podcast MEC";
          const audio = document.createElement("audio"); audio.controls = true; audio.preload = "metadata"; audio.src = url; audio.setAttribute("aria-label", x.title || "Podcast MEC"); player.replaceChildren(title, audio);
        } else if (newWindow) newWindow.location.href = url;
        else window.location.assign(url);
        status.textContent = inline ? "Listo. Usa los controles para reproducir “" + (x.title || TYPE[x.type]) + "”." : "Publicación abierta.";
      } catch (e) {
        if (newWindow) newWindow.close();
        status.textContent = e.message || "No se pudo abrir esta publicación. Inténtalo de nuevo.";
        status.classList.add("is-error");
      } finally { action.disabled = false; }
    });
    search.addEventListener("input", () => {
      query = search.value.trim();
      if (query) choose("busqueda", false); else if (selected === "busqueda") closeCollection();
    });
    root.addEventListener("keydown", (event) => { if (event.key === "Escape" && !detail.hidden) { event.preventDefault(); closeCollection(); } });
    const start = (window.location.hash || "").split("/")[1];
    if (groups.some((g) => g.key === start)) choose(start, false);
  }
  M.biblioteca = Object.assign(M.biblioteca || {}, { view });
  if (window.__MEC_LIBRARY_TEST__) M.biblioteca._test = { isStaffItem, visibleItems, safeURL, youtubeEmbed, sortItems };
})();
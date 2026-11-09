"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.resolve(__dirname, "../../js/biblioteca.js"), "utf8");
let checked = 0;
function check(name, task) { return Promise.resolve().then(task).then(() => { checked++; process.stdout.write("PASS " + name + "\n"); }); }
class FakeElement {
  constructor(tag = "div") { this.tagName = tag; this.innerHTML = ""; this.textContent = ""; this.value = ""; this.dataset = {}; this.hidden = false; this.isConnected = true; this.handlers = {}; this.nodes = new Map(); this.classes = new Set(); this.classList = { add: x => this.classes.add(x), remove: x => this.classes.delete(x), toggle: (x, on) => on ? this.classes.add(x) : this.classes.delete(x), contains: x => this.classes.has(x) }; }
  setAttribute(k, v) { this[k] = v; }
  replaceChildren(...children) { this.children = children; this.innerHTML = ""; }
  appendChild(child) { (this.children ||= []).push(child); }
  prepend(child) { (this.children ||= []).unshift(child); }
  querySelector(key) { if (!this.nodes.has(key)) this.nodes.set(key, new FakeElement()); return this.nodes.get(key); }
  querySelectorAll() { return []; }
  addEventListener(k, h) { (this.handlers[k] ||= []).push(h); }
  contains() { return true; }
  focus() { this.focused = true; }
  scrollIntoView() {}
}
function harness(role = "student", list = [], getUrl = async () => "https://files.example/book.pdf") {
  const app = new FakeElement(), root = app.querySelector(".biblioteca");
  const windows = [], requests = [];
  const context = {
    URL, Set, console,
    document: { createElement: tag => new FakeElement(tag) },
    window: { __MEC_LIBRARY_TEST__: true, location: { href: "https://masteryenglishclub-alt.github.io/mec-crm/student.html", hash: "", assign: url => { context.assigned = url; } }, matchMedia: () => ({ matches: true }), open: () => { const w = { location: {}, close() { this.closed = true; } }; windows.push(w); return w; }, MEC: { api: { libraryListItems: async () => list, libraryItemUrl: async x => { requests.push(x); return getUrl(x); } } } }
  };
  vm.runInNewContext(source, context, { filename: "biblioteca.js" });
  const api = context.window.MEC.biblioteca;
  return { app, root, windows, requests, context, api, helpers: api._test, view: () => api.view(app, { me: { role }, currentLevel: 1, program: "english", hasPackage: true }) };
}
const book = { id: "1", slug: "a1-student-book", title: "A1 Student Book", type: "student_book", level_index: 1, published: true, sort_order: 1 };
const teacher = { id: "2", slug: "a1-teachers-book", title: "Secret Teacher Book", type: "teachers_book", level_index: 1, teacher_only: true, published: true };
async function click(h, index) {
  const action = new FakeElement("button"); action.dataset.bibOpen = String(index);
  const target = { closest: selector => selector === "[data-bib-open]" ? action : null };
  await h.root.handlers.click[0]({ target });
  return action;
}
function shelfHTML(h, key) {
  const match = h.app.innerHTML.match(new RegExp('<button[^>]*data-bib-section="' + key + '"[^>]*>([\\s\\S]*?)</button>'.replace(/\\\\/g, "\\")));
  assert.ok(match, "Missing shelf " + key); return match[1];
}
async function chooseSection(h, key) {
  const section = new FakeElement("button"); section.dataset.bibSection = key;
  await h.root.handlers.click[0]({ target: { closest: selector => selector === "[data-bib-section]" ? section : null } });
  return h.root.querySelector("#bib-collection").innerHTML;
}
(async () => {
  await check("students never receive Teacher records in their visible catalog", () => {
    const h = harness();
    const items = h.helpers.visibleItems([book, teacher, { ...teacher, slug: "guide", type: "story", teacher_only: "true" }, { ...teacher, slug: "guide", type: "story", teacher_only: 1 }, { ...teacher, teacher_only: false, type: "story" }], "student");
    assert.equal(items.length, 1); assert.equal(items[0].id, book.id);
  });
  await check("unknown roles see no catalog", () => assert.equal(harness().helpers.visibleItems([book, teacher], "guardian").length, 0));
  await check("staff can see the Teacher collection", () => assert.equal(harness().helpers.visibleItems([book, teacher], "teacher").length, 2));
  await check("unpublished, unknown and inherited-property types are rejected", () => {
    const h = harness();
    assert.equal(h.helpers.visibleItems([{ ...book, published: false }, { ...book, published: "false" }, { ...book, status: "draft" }, { ...book, type: "invented" }, { ...book, type: "toString" }], "admin").length, 0);
  });
  await check("URL validation blocks script, credentials and external HTTP", () => {
    const h = harness();
    for (const url of ["javascript:alert(1)", "data:text/html,bad", "http://outside.example/file", "https://user:password@example.com/file", "file:///D:/MEC/private.pdf", "//example.com/file.pdf"]) assert.equal(h.helpers.safeURL(url, false), null, url);
    assert.equal(h.helpers.safeURL("https://files.example/file.pdf", false), "https://files.example/file.pdf");
    assert.equal(h.helpers.safeURL("/mec-crm/img/cover.webp", true), "https://masteryenglishclub-alt.github.io/mec-crm/img/cover.webp");
  });
  await check("local preview covers accept only same-origin HTTP", () => {
    const h = harness(); h.context.window.location.href = "http://127.0.0.1:8500/student.html";
    assert.equal(h.helpers.safeURL("/img/cover.webp", true), "http://127.0.0.1:8500/img/cover.webp");
    assert.equal(h.helpers.safeURL("http://outside.example/cover.webp", true), null);
  });
  await check("YouTube embed allowlist rejects deceptive domains", () => {
    const h = harness();
    assert.equal(h.helpers.youtubeEmbed("https://www.youtube.com/watch?v=AbCdEf123_-"), "https://www.youtube-nocookie.com/embed/AbCdEf123_-?rel=0");
    assert.equal(h.helpers.youtubeEmbed("https://youtu.be/AbCdEf123_-"), "https://www.youtube-nocookie.com/embed/AbCdEf123_-?rel=0");
    for (const bad of ["https://youtube.com.evil.example/watch?v=AbCdEf123_-", "https://evil.example/embed/AbCdEf123_-", "https://youtube.com/watch?v=short", "javascript:alert(1)"]) assert.equal(h.helpers.youtubeEmbed(bad), null);
  });
  await check("student view omits private shelf and private titles", async () => {
    const h = harness("student", [book, teacher]); await h.view();
    assert.match(h.app.innerHTML, /Biblioteca/); assert.match(h.app.innerHTML, /nivel-b2/);
    assert.doesNotMatch(h.app.innerHTML, /data-bib-section="docentes"|Secret Teacher Book|a1-teachers-book/);
    assert.equal(h.requests.length, 0);
  });
  await check("teacher view includes private shelf", async () => { const h = harness("teacher", [book, teacher]); await h.view(); assert.match(h.app.innerHTML, /data-bib-section="docentes"/); });
  await check("empty future media labels do not invent episodes or posts", async () => {
    const h = harness("student", [book]); await h.view();
    assert.match(h.root.querySelector("[data-bib-podcasts]").innerHTML, /En preparación/);
    assert.match(h.root.querySelector("[data-bib-blogs]").innerHTML, /En preparación/);
    assert.match(h.root.querySelector("[data-bib-videos]").innerHTML, /En preparación/);
  });
  await check("malformed catalog produces visible error instead of empty success", async () => {
    const h = harness("student", null); await h.view(); assert.match(h.app.innerHTML, /role="alert"/); assert.match(h.app.innerHTML, /catálogo recibido no es válido/);
  });
  await check("API errors are escaped in the visible error panel", async () => {
    const h = harness(); h.context.window.MEC.api.libraryListItems = async () => { throw Error('<img src=x onerror="bad()">'); }; await h.view();
    assert.match(h.app.innerHTML, /&lt;img/); assert.doesNotMatch(h.app.innerHTML, /<img src=x/);
  });
  await check("search escapes metadata in book cards", async () => {
    const title = '<img src=x onerror="bad()"> Test'; const h = harness("student", [{ ...book, title, description: "<script>bad()</script>", cover_url: "javascript:bad()" }]); await h.view();
    const search = h.root.querySelector("[data-bib-search]"); search.value = "Test"; search.handlers.input[0]();
    const html = h.root.querySelector("#bib-collection").innerHTML;
    assert.match(html, /&lt;img/); assert.match(html, /&lt;script/); assert.doesNotMatch(html, /<script>|onerror="bad|src="javascript/);
  });
  await check("opening a PDF preopens a window and uses the approved URL", async () => {
    const h = harness("student", [book]); await h.view(); await click(h, 0);
    assert.equal(h.windows.length, 1); assert.equal(h.windows[0].opener, null); assert.equal(h.windows[0].location.href, "https://files.example/book.pdf"); assert.equal(h.requests.length, 1);
  });
  await check("failed/unsafe URLs close their preopened windows", async () => {
    const h = harness("student", [book], async () => "javascript:bad()"); await h.view(); await click(h, 0);
    assert.equal(h.windows[0].closed, true); assert.equal(h.root.querySelector("[data-bib-status]").classes.has("is-error"), true);
  });
  await check("a subsequent successful open clears the error state", async () => {
    let attempts = 0; const h = harness("student", [book], async () => ++attempts === 1 ? "javascript:bad()" : "https://files.example/book.pdf"); await h.view(); await click(h, 0); await click(h, 0);
    assert.equal(h.root.querySelector("[data-bib-status]").classes.has("is-error"), false);
  });
  await check("student cannot request a filtered Teacher URL with a forged index", async () => {
    const h = harness("student", [teacher]); await h.view(); await click(h, 0); assert.equal(h.requests.length, 0); assert.equal(h.windows.length, 0);
  });
  await check("video class search filters a large future collection", async () => {
    const videos = [1,2].map(i => ({ ...book, id: String(i), type: "video", title: "A1.1." + i, slug: "a1-1-" + i }));
    const h = harness("student", videos); await h.view(); const field = h.root.querySelector("[data-bib-video-search]"); field.value = "A1.1.2"; field.handlers.input[0]();
    const html = h.root.querySelector("[data-bib-videos]").innerHTML; assert.match(html, /A1\.1\.2/); assert.doesNotMatch(html, /A1\.1\.1/);
  });
  await check("native video playback uses controls without injected HTML", async () => {
    const h = harness("student", [{ ...book, type: "video" }], async () => "https://files.example/video.mp4"); await h.view(); await click(h, 0);
    const player = h.root.querySelector("[data-bib-player]").children[0]; assert.equal(player.tagName, "video"); assert.equal(player.controls, true); assert.equal(player.src, "https://files.example/video.mp4");
  });
  await check("stale catalog response does not overwrite a changed app page", async () => {
    let resolve; const pending = new Promise(r => { resolve = r; }); const h = harness(); h.context.window.MEC.api.libraryListItems = () => pending;
    const render = h.view(); h.app.contains = () => false; h.app.innerHTML = "Other page"; resolve([book]); await render; assert.equal(h.app.innerHTML, "Other page");
  });
  await check("two-book shelves across A1 to B2 omit unpublished Speak Up spines and descriptions", async () => {
    const levels = [1,2,3,4], names = ["A1","A2","B1","B2"];
    const books = levels.flatMap(level_index => [
      { ...book, id: "s" + level_index, slug: names[level_index-1].toLowerCase() + "-student-book", level_index },
      { ...book, id: "p" + level_index, slug: names[level_index-1].toLowerCase() + "-practice-book", type: "practice_book", title: names[level_index-1] + " Practice Book", level_index, sort_order: 2 },
      { ...book, id: "u" + level_index, slug: names[level_index-1].toLowerCase() + "-speak-up", type: "speak_up", title: names[level_index-1] + " Speak Up", level_index, published: false }
    ]);
    const h = harness("admin", books); await h.view(); assert.doesNotMatch(h.app.innerHTML, /Speak Up/);
    for (const level of names) {
      const shelf = shelfHTML(h, "nivel-" + level.toLowerCase());
      assert.equal((shelf.match(/class="bib-spine bib-spine--/g) || []).length, 2); assert.match(shelf, /Student/); assert.match(shelf, /Practice Book/); assert.match(shelf, /2 libros/);
      const detail = await chooseSection(h, "nivel-" + level.toLowerCase()); assert.doesNotMatch(detail, /Speak Up/); assert.match(detail, /En este estante: Student.* y Practice Book\./); assert.equal((detail.match(/data-bib-open=/g) || []).length, 2);
    }
  });
  await check("a genuinely published third book appears in its shelf and subtitle", async () => {
    const h = harness("student", [book, { ...book, id: "p", slug: "a1-practice-book", type: "practice_book", title: "A1 Practice Book", sort_order: 2 }, { ...book, id: "u", slug: "a1-speak-up", type: "speak_up", title: "A1 Speak Up", sort_order: 3 }]); await h.view();
    const shelf = shelfHTML(h, "nivel-a1"); assert.equal((shelf.match(/class="bib-spine bib-spine--/g) || []).length, 3); assert.match(shelf, /Speak Up/); assert.match(shelf, /3 libros/);
    const detail = await chooseSection(h, "nivel-a1"); assert.match(detail, /En este estante: Student.*Practice Book y Speak Up\./); assert.equal((detail.match(/data-bib-open=/g) || []).length, 3);
  });
  await check("staff spine levels and subtitle follow only its available guides", async () => {
    const h = harness("teacher", [{ ...teacher, title: "A1 guide" }, { ...teacher, id: "t4", slug: "b2-teachers-book", title: "B2 guide", level_index: 4 }]); await h.view();
    const shelf = shelfHTML(h, "docentes"); assert.equal((shelf.match(/class="bib-spine bib-spine--/g) || []).length, 2); assert.match(shelf, /<b>A1<\/b>/); assert.match(shelf, /<b>B2<\/b>/); assert.doesNotMatch(shelf, /<b>A2<\/b>|<b>B1<\/b>/);
    const detail = await chooseSection(h, "docentes"); assert.match(detail, /Guías y recursos disponibles de A1 y B2\./); assert.doesNotMatch(detail, /Speak Up/);
  });
  await check("empty shelves and future stories do not fabricate spine titles", async () => {
    const h = harness("student", []); await h.view();
    assert.doesNotMatch(h.app.innerHTML, /class="bib-spine bib-spine--/); assert.doesNotMatch(h.app.innerHTML, /Speak Up|Practice Book|Mitos|Viajes|Aventuras/);
    const detail = await chooseSection(h, "nivel-a1"); assert.match(detail, /En preparación/); assert.doesNotMatch(detail, /Student.*Book|Speak Up/);
  });
  await check("story spines use escaped titles from their actual published records", async () => {
    const h = harness("student", [{ ...book, type: "story", slug: "real-story", title: '<img src=x onerror="bad()"> Aurora' }]); await h.view();
    const shelf = shelfHTML(h, "historias"); assert.match(shelf, /Aurora/); assert.match(shelf, /&lt;img/); assert.doesNotMatch(shelf, /<img src=x|Mitos|Aventuras/);
  });  process.stdout.write("\n" + checked + " library UI/security checks passed.\n");
})().catch(error => { console.error(error); process.exitCode = 1; });
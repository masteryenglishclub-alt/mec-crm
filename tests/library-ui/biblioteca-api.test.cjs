"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.resolve(__dirname, "../../js/biblioteca-api.js"), "utf8");
const published = { id: 12, slug: "a1-student-book", title: "A1 Student Book", resource_type: "student_book", level_index: 1, program: "adultos", teacher_only: false, published: true, storage_bucket: "materiales", storage_path: "library-20261109/a1-student-book.pdf", cover_thumb: "img/web/biblioteca/a1-student-book.webp", sort_order: 1 };
const teacher = { ...published, id: 90, slug: "a1-teachers-book", title: "A1 Teacher Book", resource_type: "teachers_book", teacher_only: true, storage_bucket: "teacher-keys", storage_path: "library-20261109/a1-teachers-book.pdf", cover_thumb: "https://files.example/private-teacher-cover.webp" };
const resource = { id: "12345678-abcd-4abc-8abc-123456789abc", slug: "a1-lesson-1", title: "A1.1.1", type: "video", level_index: 1, published: true, teacher_only: false, external_url: "https://www.youtube.com/watch?v=AbCdEf123_-" };
function mock(options = {}) {
  const calls = { queries: [], signed: [], clients: 0, demoBooks: 0 };
  const rows = { books: options.books ?? [published], library_resources: options.resources ?? [resource] };
  const api = { mode: options.mode ?? "supabase", currentUser: async () => "me" in options ? options.me : { id: "student-id", role: options.role || "student", active: true }, listBooks: async () => { calls.demoBooks++; return rows.books; } };
  const client = {
    from(table) {
      const request = { table, columns: null, eq: [], order: [] };
      const chain = {
        select(columns) { request.columns = columns; return chain; },
        eq(k, v) { request.eq.push([k,v]); return chain; },
        order(k) { request.order.push(k); return chain; },
        then(resolve, reject) {
          calls.queries.push(request);
          let selected = (rows[table] || []).filter(row => request.eq.every(([k,v]) => String(row[k]) === String(v)));
          if (options.rlsDeny) selected = [];
          if (options.rls) selected = selected.filter(row => options.rls(table, row, options.role || "student"));
          const error = options.queryError ? { message: "Internal RLS database detail" } : null;
          return Promise.resolve({ data: error ? null : selected, error }).then(resolve, reject);
        }
      };
      return chain;
    },
    storage: { from(bucket) { return { createSignedUrl: async (storagePath, expires) => {
      calls.signed.push({ bucket, path: storagePath, expires });
      if (options.signError) return { data: null, error: { message: "Storage policy detail" } };
      if (options.emptySigned) return { data: {}, error: null };
      return { data: { signedUrl: options.signedUrl ?? "https://storage.example/signed/book.pdf?token=abc" }, error: null };
    } }; } }
  };
  api._client = async () => { calls.clients++; return client; };
  vm.runInNewContext(source, { URL, window: { MEC: { api } } }, { filename: "biblioteca-api.js" });
  return { api, calls, rows };
}
let passed = 0, failed = 0;
async function check(name, fn) { try { await fn(); passed++; process.stdout.write("PASS " + name + "\n"); } catch (error) { failed++; process.stdout.write("FAIL " + name + "\n  " + error.message + "\n"); } }
(async () => {
  await check("list reads books and published resources under the client RLS", async () => {
    const h = mock(); const rows = await h.api.libraryListItems();
    assert.equal(h.calls.queries.length, 2); assert.equal(rows.length, 2); assert.equal(rows[0].id, "book:12");
    assert.ok(h.calls.queries.find(q => q.table === "library_resources").eq.some(([k,v]) => k === "published" && v === true));
  });
  await check("student list removes Teacher metadata even if a mistaken query returns it", async () => {
    const h = mock({ books: [published, teacher], resources: [{ ...resource, teacher_only: true }] }); const rows = await h.api.libraryListItems();
    assert.equal(rows.length, 1); assert.equal(rows[0].id, "book:12"); assert.equal(h.calls.signed.length, 0);
  });
  await check("Teacher covers are signed only for staff using protected row paths, ignoring cover_thumb", async () => {
    for (const role of ["teacher", "admin"]) {
      const h = mock({ role, books: [published, { ...teacher, cover_thumb: "https://evil.example/forged.webp" }], resources: [] }); const rows = await h.api.libraryListItems();
      assert.equal(rows.length, 2); assert.equal(rows[1].teacher_only, true);
      assert.equal(rows[1].cover_url, "https://storage.example/signed/book.pdf?token=abc");
      assert.notEqual(rows[1].cover_url, teacher.cover_thumb);
      assert.equal(h.calls.signed.length, 1); assert.equal(h.calls.signed[0].bucket, "teacher-keys");
      assert.equal(h.calls.signed[0].path, "library-20261109/a1-teachers-book.webp"); assert.equal(h.calls.signed[0].expires, 3600);
      assert.equal(rows[0].cover_url, published.cover_thumb);
    }
  });
  await check("students never sign Teacher covers even when a mistaken catalog response returns private rows", async () => {
    const h = mock({ books: [teacher], resources: [] }); assert.equal((await h.api.libraryListItems()).length, 0); assert.equal(h.calls.signed.length, 0);
  });
  await check("missing, failed or unsafe Teacher thumbnails preserve an empty fallback cover", async () => {
    for (const options of [{ signError: true }, { emptySigned: true }, { signedUrl: "javascript:bad()" }, { signedUrl: "https://user:password@example.com/private.webp" }]) {
      const h = mock({ role: "teacher", books: [teacher], resources: [], ...options }); const rows = await h.api.libraryListItems();
      assert.equal(rows.length, 1); assert.equal(rows[0].cover_url, ""); assert.equal(h.calls.signed.length, 1);
    }
  });
  await check("Teacher cover derivation refuses unrecognized buckets, traversal and non-PDF paths", async () => {
    for (const patch of [{ storage_bucket: "materiales" }, { storage_path: "library-20261109/../secret.pdf" }, { storage_path: "other/secret.pdf" }, { storage_path: "library-20261109/a1-teachers-book.webp" }]) {
      const h = mock({ role: "admin", books: [{ ...teacher, ...patch }], resources: [] }); const rows = await h.api.libraryListItems();
      assert.equal(rows[0].cover_url, ""); assert.equal(h.calls.signed.length, 0);
    }
  });
  await check("demo Teacher metadata never signs a private cover", async () => {
    const h = mock({ mode: "demo", role: "teacher", books: [teacher], resources: [] }); const rows = await h.api.libraryListItems();
    assert.equal(rows[0].cover_url, ""); assert.equal(h.calls.signed.length, 0); assert.equal(h.calls.clients, 0);
  });
  await check("resource lesson_code is preserved for class-code searches", async () => {
    const h = mock({ books: [], resources: [{ ...resource, title: "Greetings", slug: "greetings", lesson_code: "A1.1.1" }] });
    const rows = await h.api.libraryListItems(); assert.equal(rows[0].lesson_code, "A1.1.1");
  });
  await check("admin list includes guides", async () => { const h = mock({ role: "admin", books: [teacher], resources: [] }); assert.equal((await h.api.libraryListItems())[0].type, "teachers_book"); });
  await check("no session and unknown roles cannot enumerate the catalog", async () => {
    for (const me of [null, { role: "other" }]) { const h = mock({ me }); await assert.rejects(h.api.libraryListItems()); assert.equal(h.calls.clients, 0); }
  });
  await check("unpublished records are omitted from list results", async () => { const h = mock({ books: [{ ...published, published: false }], resources: [] }); assert.equal((await h.api.libraryListItems()).length, 0); });
  await check("database failures remain visible and do not leak internal error messages", async () => {
    const h = mock({ queryError: true }); await assert.rejects(h.api.libraryListItems(), error => !/Internal RLS/.test(error.message));
  });
  await check("manipulated DTO path and bucket are never signed", async () => {
    const h = mock(); await h.api.libraryItemUrl({ id: "book:12", storage_path: "secret/admin.pdf", storage_bucket: "teacher-keys", teacher_only: false, external_url: "https://evil.example" });
    assert.equal(h.calls.signed.length, 1); assert.equal(h.calls.signed[0].path, published.storage_path); assert.equal(h.calls.signed[0].bucket, "materiales"); assert.equal(h.calls.signed[0].expires, 600);
  });
  await check("opening a book reconsults its server row by id before signing", async () => {
    const h = mock(); await h.api.libraryItemUrl({ id: "book:12" });
    assert.equal(h.calls.queries.length, 1); assert.equal(h.calls.queries[0].table, "books"); assert.deepEqual(h.calls.queries[0].eq, [["id", "12"]]);
    assert.match(h.calls.queries[0].columns, /teacher_only/); assert.match(h.calls.queries[0].columns, /storage_bucket/);
  });
  await check("RLS-denied paths including inactive or wrong-level users never reach Storage", async () => {
    const h = mock({ rlsDeny: true }); await assert.rejects(h.api.libraryItemUrl({ id: "book:12" })); assert.equal(h.calls.signed.length, 0);
  });
  await check("student cannot open Teacher guides even if row is mistakenly returned", async () => {
    const h = mock({ books: [teacher] }); await assert.rejects(h.api.libraryItemUrl({ id: "book:90", teacher_only: false })); assert.equal(h.calls.signed.length, 0);
  });
  await check("student cannot open type-flagged Teacher guide with false teacher_only", async () => {
    const h = mock({ books: [{ ...teacher, teacher_only: false }] }); await assert.rejects(h.api.libraryItemUrl({ id: "book:90" })); assert.equal(h.calls.signed.length, 0);
  });
  await check("teacher and admin can sign private Teacher guide paths", async () => {
    for (const role of ["teacher", "admin"]) { const h = mock({ role, books: [teacher] }); await h.api.libraryItemUrl({ id: "book:90" }); assert.equal(h.calls.signed[0].bucket, "teacher-keys"); }
  });
  await check("unpublished book cannot be opened by any role", async () => {
    for (const role of ["student", "teacher", "admin"]) { const h = mock({ role, books: [{ ...published, published: false }] }); await assert.rejects(h.api.libraryItemUrl({ id: "book:12" })); assert.equal(h.calls.signed.length, 0); }
  });
  await check("unknown buckets and missing storage paths cannot be signed", async () => {
    for (const patch of [{ storage_bucket: "public" }, { storage_path: "" }]) { const h = mock({ books: [{ ...published, ...patch }] }); await assert.rejects(h.api.libraryItemUrl({ id: "book:12" })); assert.equal(h.calls.signed.length, 0); }
  });
  await check("Storage errors and missing signed URLs reject the operation", async () => {
    for (const options of [{ signError: true }, { emptySigned: true }]) { const h = mock(options); await assert.rejects(h.api.libraryItemUrl({ id: "book:12" })); }
  });
  await check("signed URL must use HTTPS and cannot contain credentials", async () => {
    for (const signedUrl of ["http://storage.example/file.pdf", "javascript:alert(1)", "https://user:password@storage.example/file.pdf"]) { const h = mock({ signedUrl }); await assert.rejects(h.api.libraryItemUrl({ id: "book:12" })); }
  });
  await check("external resources are re-read under RLS and ignore a forged DTO URL", async () => {
    const h = mock(); const url = await h.api.libraryItemUrl({ id: "resource:" + resource.id, external_url: "https://evil.example" });
    assert.equal(url, resource.external_url); assert.equal(h.calls.queries[0].table, "library_resources"); assert.equal(h.calls.signed.length, 0);
  });
  await check("private or unpublished external resources remain unavailable to students", async () => {
    for (const patch of [{ teacher_only: true }, { published: false }]) { const h = mock({ resources: [{ ...resource, ...patch }] }); await assert.rejects(h.api.libraryItemUrl({ id: "resource:" + resource.id })); assert.equal(h.calls.signed.length, 0); }
  });
  await check("malicious external protocols and credentials are rejected", async () => {
    for (const external_url of ["javascript:bad()", "data:text/html,hello", "http://example.com", "https://user:password@example.com"]) { const h = mock({ resources: [{ ...resource, external_url }] }); await assert.rejects(h.api.libraryItemUrl({ id: "resource:" + resource.id })); }
  });
  await check("demo never signs or opens private files", async () => {
    const h = mock({ mode: "demo", books: [published, teacher], resources: [] }); const rows = await h.api.libraryListItems();
    assert.equal(rows.length, 1); assert.equal(h.calls.clients, 0); assert.equal(h.calls.demoBooks, 1);
    await assert.rejects(h.api.libraryItemUrl({ id: "book:12" }), /demostración/); assert.equal(h.calls.clients, 0); assert.equal(h.calls.signed.length, 0);
  });
  await check("missing or malformed identities cannot trigger a query or signature", async () => {
    for (const item of [null, {}, { id: "book:../../secret" }, { id: "resource:12" }, { id: 12 }, { id: "other:12" }]) { const h = mock(); await assert.rejects(h.api.libraryItemUrl(item)); assert.equal(h.calls.queries.length, 0); assert.equal(h.calls.signed.length, 0); }
  });
  await check("opening rejects an unknown currentUser role before querying", async () => {
    const h = mock({ me: { role: "other" } }); await assert.rejects(h.api.libraryItemUrl({ id: "book:12" })); assert.equal(h.calls.queries.length, 0);
  });
  await check("opening rejects IDs with extra colon suffixes", async () => {
    const h = mock(); await assert.rejects(h.api.libraryItemUrl({ id: "book:12:forged" })); assert.equal(h.calls.queries.length, 0);
  });
  process.stdout.write("\n" + passed + " passed, " + failed + " failed.\n"); if (failed) process.exitCode = 1;
})();
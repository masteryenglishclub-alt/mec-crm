/* MEC CRM – gráficas ligeras en SVG en línea (sin librerías ni CDN) para los resultados de los tests.
   Sin números cuando opts.numbers === false (vista del estudiante). Accesibles: role="img", título y tabla de texto equivalente. */
(function () {
  const M = window.MEC, esc = (s) => M.esc(s == null ? "" : String(s));
  const GOLD = "#d9ad5c", GOLD2 = "#f0c46a", LINE = "#3a4a63", COLORS = [GOLD2, "#7fdcff", "#9be28f", "#ff9a8a", "#c8a2ff", "#ffd27f"];
  /* Barras horizontales. items: [{label, value (0-100), text?}] */
  function bars(items, o) { o = o || {}; const W = 560, rowH = 38, padL = o.labelW || 150, H = items.length * rowH + 10, bw = W - padL - 70;
    const rows = items.map((it, i) => { const v = Math.max(0, Math.min(100, Number(it.value) || 0)), y = i * rowH + 6;
      return `<text x="${padL - 10}" y="${y + 18}" text-anchor="end">${esc(it.label)}</text><rect x="${padL}" y="${y}" width="${bw}" height="22" rx="5" fill="#0d1a2d" stroke="${LINE}"/>` +
        `<rect x="${padL}" y="${y}" width="${(bw * v) / 100}" height="22" rx="5" fill="${o.colors ? o.colors[i % o.colors.length] : GOLD}"/>` +
        (o.numbers === false ? "" : `<text x="${padL + bw + 8}" y="${y + 17}">${esc(it.text != null ? it.text : Math.round(v) + "%")}</text>`); }).join("");
    const alt = items.map((it) => esc(it.label) + (o.numbers === false ? "" : ": " + (it.text != null ? it.text : Math.round(it.value) + "%"))).join("; ");
    return `<svg class="tch" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || "Gráfica de barras")}: ${alt}"><title>${esc(o.title || "Gráfica de barras")}</title>${rows}</svg>`; }
  /* Radar. items: [{label, value (0-100) | null}] (null = sin dato) */
  function radar(items, o) { o = o || {}; const n = items.length, S = 360, cx = S / 2, cy = S / 2 + 4, R = 118, pt = (i, f) => { const a = (-90 + (360 / n) * i) * Math.PI / 180; return [cx + R * f * Math.cos(a), cy + R * f * Math.sin(a)]; };
    const rings = [0.25, 0.5, 0.75, 1].map((f) => `<polygon points="${items.map((_, i) => pt(i, f).map((x) => x.toFixed(1)).join(",")).join(" ")}" fill="none" stroke="${LINE}"/>`).join("");
    const axes = items.map((it, i) => { const p = pt(i, 1), l = pt(i, 1.22); return `<line x1="${cx}" y1="${cy}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" stroke="${LINE}"/><text x="${l[0].toFixed(1)}" y="${(l[1] + 4).toFixed(1)}" text-anchor="${l[0] < cx - 6 ? "end" : l[0] > cx + 6 ? "start" : "middle"}">${esc(it.label)}</text>`; }).join("");
    const have = items.map((it) => it.value != null), poly = items.map((it, i) => pt(i, Math.max(0.02, (Number(it.value) || 0) / 100)).map((x) => x.toFixed(1)).join(",")).join(" ");
    const dots = items.map((it, i) => it.value == null ? "" : `<circle cx="${pt(i, Math.max(0.02, it.value / 100))[0].toFixed(1)}" cy="${pt(i, Math.max(0.02, it.value / 100))[1].toFixed(1)}" r="4" fill="${GOLD2}"/>`).join("");
    const alt = items.map((it) => esc(it.label) + ": " + (it.value == null ? "sin dato" : Math.round(it.value) + "%")).join("; ");
    return `<svg class="tch" viewBox="-100 0 ${S + 200} ${S + 8}" role="img" aria-label="${esc(o.title || "Gráfica radar")}: ${alt}" style="max-width:520px;margin:auto"><title>${esc(o.title || "Gráfica radar")}</title>${rings}${axes}${have.some(Boolean) ? `<polygon points="${poly}" fill="${GOLD}55" stroke="${GOLD2}" stroke-width="2"/>` : ""}${dots}</svg>`; }
  /* Línea de evolución. points: [{label, value}] (0-100) */
  function line(points, o) { o = o || {}; const W = 560, H = 190, pl = 34, pr = 14, pt = 14, pb = 34, n = points.length, x = (i) => pl + (n < 2 ? (W - pl - pr) / 2 : ((W - pl - pr) * i) / (n - 1)), y = (v) => pt + (H - pt - pb) * (1 - v / 100);
    const grid = [0, 50, 100].map((g) => `<line x1="${pl}" x2="${W - pr}" y1="${y(g)}" y2="${y(g)}" stroke="${LINE}"/><text class="tch-t" x="${pl - 6}" y="${y(g) + 4}" text-anchor="end">${g}</text>`).join("");
    const path = points.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.value).toFixed(1)).join(" ");
    const dots = points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="4" fill="${GOLD2}"/><text class="tch-t" x="${x(i).toFixed(1)}" y="${H - 12}" text-anchor="middle">${esc(p.label)}</text>`).join("");
    return `<svg class="tch" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || "Evolución")}: ${points.map((p) => esc(p.label) + " " + Math.round(p.value) + "%").join("; ")}"><title>${esc(o.title || "Evolución")}</title>${grid}<path d="${path}" fill="none" stroke="${GOLD2}" stroke-width="2.5"/>${dots}</svg>`; }
  M.tcharts = { bars, radar, line, COLORS };
})();

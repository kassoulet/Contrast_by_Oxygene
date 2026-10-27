"use strict";
// Runs the ported demo: one scene step per 70.086 Hz tick, the music's sync values from a table recorded from the original, and the screen drawn from the 8-bit frame + 6-bit DAC palette.
// Seeking restarts the scene that contains the target tick (scenes are set up from nothing, see CHAPTERS) and replays it up to the target.
(function () {
  const HZ = 70.086, $ = id => document.getElementById(id);
  const cv = $("screen"), ctx = cv.getContext("2d"), img = ctx.createImageData(320, 200), px = new Uint32Array(img.data.buffer), lut = new Uint32Array(256);
  let seq, syncRuns, total = 1, audio = null, tick = 0, last = null, paused = false, t0 = 0, started = false, ended = false, seekTo = -1, resumeAfter = false, chapter = 0, dragging = false;
  const dac = v => (v << 2) | (v >> 4), clock = s => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  function syncAt(i) { let lo = 0, hi = syncRuns.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (syncRuns[m][0] <= i) lo = m; else hi = m - 1; } return syncRuns[lo][1]; }
  function draw(r) {
    for (let i = 0; i < 256; i++) lut[i] = 0xFF000000 | (dac(r.pal[3 * i + 2]) << 16) | (dac(r.pal[3 * i + 1]) << 8) | dac(r.pal[3 * i]);
    const f = r.frame; for (let i = 0; i < 64000; i++) px[i] = lut[f[i]];
    ctx.putImageData(img, 0, 0);
  }
  function ui() {
    if (!dragging) $("seek").value = tick;
    $("time").textContent = clock(tick / HZ) + " / " + clock(total / HZ);
    $("pp").innerHTML = paused || !started ? "&#9654;" : "&#9208;";
    const c = OXG.CHAPTERS.findIndex((x, k) => tick >= x[1] && (k + 1 >= OXG.CHAPTERS.length || tick < OXG.CHAPTERS[k + 1][1]));
    if (c !== chapter && c >= 0) { chapter = c; $("chap").value = c; }
  }
  function setPaused(p) {
    if (!started || ended) return; paused = p;
    if (audio) { if (p) audio.pause(); else audio.play().catch(() => {}); } else if (!p) t0 = performance.now() - tick / HZ * 1000;
  }
  function seek(target) {
    if (!started) { $("start").style.display = "none"; started = true; paused = true; }
    target = Math.max(0, Math.min(total - 1, target | 0));
    if (ended) { ended = false; $("credits").style.display = "none"; }
    const k = OXG.CHAPTERS.reduce((a, x, j) => (x[1] <= target ? j : a), 0);
    if (!(seq.index === k && tick <= target)) { last = seq.startAt(k); tick = OXG.CHAPTERS[k][1]; }
    if (seekTo < 0) resumeAfter = !paused; seekTo = target;
    if (audio) audio.pause(); $("seeking").style.display = "block";
  }
  function stepTo(n, budgetMs) {
    const t = performance.now(); let c = 0;
    while (tick < n && (c++ & 15 || performance.now() - t < budgetMs)) {
      const r = seq.step(syncAt(tick)); tick++;
      if (!r) { ended = true; $("credits").style.display = "block"; if (audio) audio.pause(); return false; }
      last = r;
    }
    return true;
  }
  function frameLoop(now) {
    requestAnimationFrame(frameLoop);
    if (!started) return;
    if (seekTo >= 0) {                                         // replaying up to the target
      if (!stepTo(seekTo, 12)) { seekTo = -1; $("seeking").style.display = "none"; return; }
      if (last) draw(last); ui();
      if (tick >= seekTo) {
        seekTo = -1; $("seeking").style.display = "none";
        if (audio) { audio.currentTime = tick / HZ; if (resumeAfter) audio.play().catch(() => {}); } else if (resumeAfter) t0 = performance.now() - tick / HZ * 1000;
        paused = !resumeAfter; ui();
      }
      return;
    }
    if (paused || ended) { ui(); return; }
    const want = Math.floor((audio && !audio.paused ? audio.currentTime : (now - t0) / 1000) * HZ);
    const before = tick; stepTo(Math.min(want, tick + 400), 12);
    if (tick !== before && last) { draw(last); ui(); }
    if (tick >= total && !ended) { ended = true; $("credits").style.display = "block"; if (audio) audio.pause(); }
  }
  function begin() { if (!seq || started) return; $("start").style.display = "none"; started = true; t0 = performance.now(); if (audio) audio.play().catch(() => { audio = null; }); }
  async function load() {
    const get = async (u, type) => { const r = await fetch(u); if (!r.ok) throw new Error(u + ": " + r.status); return type === "json" ? r.json() : r.arrayBuffer(); };
    globalThis.OXG_TRIG16 = await get("assets/trig16.bin");
    const files = OXG.parseArchive(new Uint8Array(await get("assets/CONTRAST.BIN")));
    const sj = await get("assets/sync.json", "json"); syncRuns = sj.runs; total = sj.ticks;
    $("credits").textContent = await (await fetch("assets/credits.txt")).text();
    seq = OXG.chain(files);
    $("seek").max = total; $("chap").innerHTML = OXG.CHAPTERS.map((c, k) => `<option value="${k}">${c[0]}</option>`).join("");
    try { const probe = new Audio(), a = new Audio(probe.canPlayType("audio/ogg; codecs=vorbis") ? "assets/music.ogg" : "assets/music.mp3"); a.preload = "auto"; await new Promise((ok, bad) => { a.oncanplaythrough = ok; a.onerror = bad; setTimeout(ok, 4000); }); audio = a; } catch (e) { audio = null; }
    $("status").textContent = "ready"; ui();
  }
  function setCrt(on) { $("wrap").classList.toggle("crt", on); $("crt").checked = on; store.set("oxg-crt", on ? "1" : "0"); }
  $("start").addEventListener("click", begin);
  $("pp").addEventListener("click", () => { if (!started) begin(); else setPaused(!paused); ui(); });
  $("seek").addEventListener("input", e => { dragging = true; $("time").textContent = clock(e.target.value / HZ) + " / " + clock(total / HZ); });
  $("seek").addEventListener("change", e => { dragging = false; seek(+e.target.value); });
  $("chap").addEventListener("change", e => seek(OXG.CHAPTERS[+e.target.value][1]));
  $("crt").addEventListener("change", e => setCrt(e.target.checked));
  $("fs").addEventListener("click", () => { if (document.fullscreenElement) document.exitFullscreen(); else $("wrap").requestFullscreen(); });
  addEventListener("keydown", e => {
    if (e.target.tagName === "SELECT") return;
    const k = e.key;
    if (k === "f" || k === "F") $("fs").click();
    else if (k === "c" || k === "C") setCrt(!$("crt").checked);
    else if (k === " " || k === "p" || k === "P") { e.preventDefault(); $("pp").click(); }
    else if (k === "ArrowRight") { e.preventDefault(); seek(tick + 5 * HZ); }
    else if (k === "ArrowLeft") { e.preventDefault(); seek(tick - 5 * HZ); }
    else if (k === "Home") seek(0);
  });
  setCrt(store.get("oxg-crt") === "1" || /crt/.test(location.hash));
  // test hook: index.html#test=N runs N ticks at once and writes the screen as a PNG data URL into <pre id="shot">; #seek=N does the same through the seek path
  const testTicks = /test=(\d+)/.exec(location.hash), testSeek = /seek=(\d+)/.exec(location.hash);
  function shot() { const pre = document.createElement("pre"); pre.id = "shot"; pre.textContent = cv.toDataURL("image/png"); document.body.appendChild(pre); }
  load().then(() => {
    if (testTicks) { stepTo(+testTicks[1], 1e9); if (last) draw(last); shot(); }
    else if (testSeek) { started = true; $("start").style.display = "none"; seek(+testSeek[1]); stepTo(seekTo, 1e9); seekTo = -1; if (last) draw(last); shot(); }
    else requestAnimationFrame(frameLoop);
  }).catch(e => { $("status").textContent = "error: " + e.message; });
})();

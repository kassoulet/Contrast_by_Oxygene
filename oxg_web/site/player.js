"use strict";
// Runs the ported demo: one scene step per 70.086 Hz tick, the music's sync values from a table recorded from the original, and the screen drawn from the 8-bit frame + 6-bit DAC palette.
(function () {
  const HZ = 70.086, $ = id => document.getElementById(id);
  const cv = $("screen"), ctx = cv.getContext("2d"), img = ctx.createImageData(320, 200), px = new Uint32Array(img.data.buffer), lut = new Uint32Array(256);
  let seq, syncRuns, audio = null, tick = 0, last = null, paused = false, t0 = 0, started = false, ended = false;
  const dac = v => (v << 2) | (v >> 4);
  function syncAt(i) { let lo = 0, hi = syncRuns.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (syncRuns[m][0] <= i) lo = m; else hi = m - 1; } return syncRuns[lo][1]; }
  function draw(r) {
    for (let i = 0; i < 256; i++) lut[i] = 0xFF000000 | (dac(r.pal[3 * i + 2]) << 16) | (dac(r.pal[3 * i + 1]) << 8) | dac(r.pal[3 * i]);
    const f = r.frame; for (let i = 0; i < 64000; i++) px[i] = lut[f[i]];
    ctx.putImageData(img, 0, 0);
  }
  function frameLoop(now) {
    requestAnimationFrame(frameLoop);
    if (!started || paused || ended) return;
    const want = Math.floor((audio && !audio.paused ? audio.currentTime : (now - t0) / 1000) * HZ);
    let n = 0;
    while (tick < want && n < 400) {
      const r = seq.step(syncAt(tick)); tick++; n++;
      if (!r) { ended = true; finish(); return; }
      last = r;
    }
    if (n && last) draw(last);
  }
  function finish() {
    if (audio) audio.pause();
    $("credits").style.display = "block";
  }
  async function load() {
    const get = async (u, type) => { const r = await fetch(u); if (!r.ok) throw new Error(u + ": " + r.status); return type === "json" ? r.json() : r.arrayBuffer(); };
    globalThis.OXG_TRIG16 = await get("assets/trig16.bin");
    const files = OXG.parseArchive(new Uint8Array(await get("assets/CONTRAST.BIN")));
    syncRuns = (await get("assets/sync.json", "json")).runs;
    $("credits").textContent = await (await fetch("assets/credits.txt")).text();
    seq = OXG.chain(files);
    try { const probe = new Audio(), a = new Audio(probe.canPlayType("audio/ogg; codecs=vorbis") ? "assets/music.ogg" : "assets/music.mp3"); a.preload = "auto"; await new Promise((ok, bad) => { a.oncanplaythrough = ok; a.onerror = bad; setTimeout(ok, 4000); }); audio = a; } catch (e) { audio = null; }
    $("status").textContent = "ready";
  }
  $("start").addEventListener("click", () => {
    if (!seq || started) return;
    $("start").style.display = "none"; started = true; t0 = performance.now(); if (audio) audio.play().catch(() => { audio = null; });
  });
  addEventListener("keydown", e => {
    if (e.key === "f" || e.key === "F") { if (document.fullscreenElement) document.exitFullscreen(); else $("wrap").requestFullscreen(); }
    if ((e.key === "p" || e.key === "P") && started && !ended) { paused = !paused; if (audio) { if (paused) audio.pause(); else audio.play(); } else if (!paused) t0 = performance.now() - tick / HZ * 1000; }
  });
  // test hook: index.html#test=N runs N ticks at once and writes the screen as a PNG data URL into <pre id="shot">
  const testTicks = /test=(\d+)/.exec(location.hash);
  function runTest(n) {
    while (tick < n) { const r = seq.step(syncAt(tick)); tick++; if (!r) break; last = r; }
    if (last) draw(last);
    const pre = document.createElement("pre"); pre.id = "shot"; pre.textContent = cv.toDataURL("image/png"); document.body.appendChild(pre);
  }
  load().then(() => { if (testTicks) runTest(+testTicks[1]); else requestAnimationFrame(frameLoop); }).catch(e => { $("status").textContent = "error: " + e.message; });
})();

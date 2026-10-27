/* Render CONTRAST.XM with libopenmpt, optionally time-warped so that every row starts when the original demo's music (MIDAS, "No Sound") was at that row.
   pass 1:  render_xm in.xm rows.txt                 -> rows.txt: one line per visited row: order row nominal_time_s   (tempo factor 1)
   pass 2:  render_xm in.xm out.raw target.txt rows.txt -> raw s16le stereo 44100 Hz; target.txt: one line per visited row (same order): wanted start time in s
   build:   gcc -O2 -o render_xm render_xm.c -lopenmpt */
#include <libopenmpt/libopenmpt.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#define SR 44100
#define BLK 64
int main(int argc, char **argv) {
  if (argc < 3) return 1;
  FILE *f = fopen(argv[1], "rb"); fseek(f, 0, SEEK_END); long n = ftell(f); fseek(f, 0, SEEK_SET); void *buf = malloc(n); if (fread(buf, 1, n, f) != (size_t)n) return 1; fclose(f);
  int err; openmpt_module *m = openmpt_module_create_from_memory2(buf, n, NULL, NULL, NULL, NULL, &err, NULL, NULL);
  if (!m) { fprintf(stderr, "load failed %d\n", err); return 1; }
  openmpt_module_set_repeat_count(m, 0);
  int pass2 = argc >= 5; FILE *out = fopen(argv[2], pass2 ? "wb" : "w");
  double *target = NULL, *nomt = NULL; long nt = 0, cap = 0, nn = 0;
  if (pass2) { FILE *t = fopen(argv[3], "r"); double v; while (fscanf(t, "%lf", &v) == 1) { if (nt == cap) { cap = cap ? cap * 2 : 8192; target = realloc(target, cap * sizeof(double)); } target[nt++] = v; } fclose(t); FILE *rr = fopen(argv[4], "r"); int a, b; double v2; nomt = malloc(nt * sizeof(double) + 8 * 16384); while (fscanf(rr, "%d %d %lf", &a, &b, &v2) == 3) nomt[nn++] = v2; fclose(rr); }
  short sbuf[BLK * 2]; long frames = 0; int lo = -1, lr = -1; long k = -1; double rowstart_actual = 0, factor = 1.0;
  /* before the first row the original is silent for target[0] seconds */
  if (pass2) { long pad = (long)(target[0] * SR); short z[BLK * 2] = {0}; for (long i = 0; i < pad; i += BLK) fwrite(z, 4, BLK, out); frames = pad; }
  for (;;) {
    int o = openmpt_module_get_current_order(m), r = openmpt_module_get_current_row(m);
    if (o != lo || r != lr) {
      lo = o; lr = r; k++;
      double now = (double)frames / SR;
      if (!pass2) fprintf(out, "%d %d %.5f\n", o, r, openmpt_module_get_position_seconds(m));
      else if (k + 1 < nt) {
        double nom = 0; /* nominal duration of this row = from the pass-1 table is not available here: use the module's own estimate below */
        (void)nom; rowstart_actual = now;
        double want = target[k + 1] - target[k] - 0.5 * (now - target[k]);   /* correct half of the accumulated error on this row */
        if (want < 0.02) want = 0.02;
        /* nominal row duration: tick time at the current tempo/speed */
        nom = nomt[k + 1] - nomt[k];
        factor = nom / want; if (factor < 0.5) factor = 0.5; if (factor > 2) factor = 2;
        openmpt_module_ctl_set_floatingpoint(m, "play.tempo_factor", factor);
      }
    }
    size_t got = openmpt_module_read_interleaved_stereo(m, SR, BLK, sbuf);
    if (!got) break;
    if (pass2) fwrite(sbuf, 4, got, out);
    frames += got;
  }
  fclose(out); fprintf(stderr, "%ld rows, %.1f s\n", k + 1, (double)frames / SR);
  return 0;
}

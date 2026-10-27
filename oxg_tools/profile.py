"""Where does a scene spend its instructions?  Load a snapshot, run WINDOW virtual seconds with a code hook, print the hottest functions (call targets in the program code).
usage: profile.py SNAPSHOT WINDOW"""
import sys, collections, bisect, re
import run
from unicorn import *
pc = run.PC(); pc.load_snapshot(sys.argv[1]); win = float(sys.argv[2])
starts = sorted({int(m.group(1), 16) for m in re.finditer(r'call 0x([0-9a-f]+)', open(run.HERE + '/../oxg_out/code.asm').read()) if 0x10000 <= int(m.group(1), 16) < 0x1d2e9})
cnt = collections.Counter(); addr = collections.Counter()
def code(mu, a, sz, ud): addr[a] += 1
pc.mu.hook_add(UC_HOOK_CODE, code)
t = pc.clock; pc.run(pc.clock + win)
for a, n in addr.items():
    i = bisect.bisect_right(starts, a) - 1; cnt[starts[i] if i >= 0 and a < 0x1d2e9 else 0] += n
tot = sum(cnt.values()); print('instructions', tot)
for f, n in cnt.most_common(12): print('%7x %5.1f%%' % (f, 100 * n / tot))
hot = addr.most_common(12); print('hot addresses', [(hex(a), n) for a, n in hot])

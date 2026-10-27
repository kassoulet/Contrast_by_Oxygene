// compare the real program's fill calls (log_fill.py json) with mine for a range of animation frames: node test/dbg_calls.js JSON CFGNAME FIRSTFRAME LASTFRAME
const fs=require("fs"),path=require("path"),{parseArchive}=require("../src/archive"),sc3=require("../src/scene3");
const files=parseArchive(fs.readFileSync(path.join(__dirname,"../../oxg_cont/CONTRAST.BIN")));
const J=JSON.parse(fs.readFileSync(process.argv[2])),s=new sc3.Scene3(files,sc3[process.argv[3]]);
const key=(k,X,Y)=>k+":"+X.join(",")+":"+Y.join(",");
const want=J.kind.map((k,i)=>key(k,J.v[i],J.y[i]));
for(let f=+process.argv[4];f<=+process.argv[5];f++){const env={fb:new Uint8Array(64000),cpl:s.cpl,log:[]};sc3.renderFrame(s,env,f);
 const mine=env.log.map(l=>key(...l));
 const i0=want.indexOf(mine[0]);
 if(i0>=0){let n=0;while(n<mine.length&&want[i0+n]===mine[n])n++;
  console.log("frame",f,"mine",mine.length,"calls; matches original from",i0,"for",n,"calls");
  if(n<mine.length){console.log(" first diff: mine",mine[n]," orig",want[i0+n]);console.log(" orig has",want.slice(i0).indexOf(mine[n]))}}}
// best frame by overlap with the original's second frame block
{const blk=new Set(want.slice(357,713));let best=[];
for(let f=0;f<40;f++){const env={fb:new Uint8Array(64000),cpl:s.cpl,log:[]};sc3.renderFrame(s,env,f);const m=env.log.map(l=>key(...l));let c=0;for(const k of m)if(blk.has(k))c++;best.push([c,f,m.length]);}
best.sort((a,b)=>b[0]-a[0]);console.log("overlap with orig frame block (count,frame,mycalls):",best.slice(0,4).join(" | "))}
{const env={fb:new Uint8Array(64000),cpl:s.cpl,log:[]};sc3.renderFrame(s,env,14);const m=env.log.map(l=>key(...l));const w=want.slice(357,713);
 const ws=new Set(w),ms=new Set(m);console.log("only mine:",m.filter(k=>!ws.has(k)),"only orig:",w.filter(k=>!ms.has(k)));
 let firstdiff=-1;for(let i=0;i<w.length;i++)if(m[i]!==w[i]){firstdiff=i;break}
 console.log("first order difference at",firstdiff, "mine",m.slice(firstdiff,firstdiff+3),"orig",w.slice(firstdiff,firstdiff+3));}

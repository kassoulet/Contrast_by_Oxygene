// per-scene cost of one step: node test/perf.js
const fs=require("fs"),path=require("path"),{parseArchive}=require("../src/archive"),{chain}=require("../src/sequence"),{loadRec,sync}=require("./rec");
const files=parseArchive(fs.readFileSync(path.join(__dirname,"../../oxg_cont/CONTRAST.BIN")));
const recs=loadRec(path.join(__dirname,"../../oxg_out/rec_a.rawz")),seq=chain(files),S={};
const sy=[];for(let i=0;i<recs.length-4;i++)sy.push(sync(recs[i+3]));
for(let i=0;i<sy.length;i++){const nm=seq.name,t=process.hrtime.bigint();const r=seq.step(sy[i]);const d=Number(process.hrtime.bigint()-t)/1e6;if(!r)break;const o=S[nm]||(S[nm]={n:0,sum:0,max:0});o.n++;o.sum+=d;o.max=Math.max(o.max,d)}
for(const k in S)console.log(k.padEnd(8),"steps",S[k].n,"mean %.2f ms  max %.1f ms",S[k].sum/S[k].n,S[k].max);

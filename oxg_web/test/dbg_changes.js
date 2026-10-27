// list the ticks (from..to) where the recorded frame / my frame changes compared to the previous tick
const fs=require("fs"),path=require("path"),{parseArchive}=require("../src/archive"),{chain}=require("../src/sequence"),{loadRec,sync}=require("./rec");
const files=parseArchive(fs.readFileSync(path.join(__dirname,"../../oxg_cont/CONTRAST.BIN")));
const recs=loadRec(path.join(__dirname,"../../oxg_out/rec_a.rawz")),A=+process.argv[2],B=+process.argv[3],seq=chain(files);
let pm=null,pr=null;const out=[];
for(let i=0;i<=B;i++){const r=seq.step(sync(recs[Math.min(recs.length-1,i+3)]));const t=recs[i+3];
 if(i>=A){let cm=0,cr=0;if(pm){for(let k=0;k<64000;k++){if(r.frame[k]!==pm[k])cm++;if(t.frame[k]!==pr[k])cr++}}out.push(i+":"+cm+"/"+cr);}
 pm=Uint8Array.from(r.frame);pr=Uint8Array.from(t.frame);}
console.log(out.join(" "));

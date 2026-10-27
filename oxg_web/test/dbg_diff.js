// show the differing pixels / palette entries of one tick: node test/dbg_diff.js TICK
const fs=require("fs"),path=require("path"),{parseArchive}=require("../src/archive"),{chain}=require("../src/sequence"),{loadRec,sync}=require("./rec");
const files=parseArchive(fs.readFileSync(path.join(__dirname,"../../oxg_cont/CONTRAST.BIN")));
const recs=loadRec(path.join(__dirname,"../../oxg_out/rec_a.rawz")),T=+process.argv[2],seq=chain(files);
for(let i=0;i<=T;i++){const r=seq.step(sync(recs[Math.min(recs.length-1,i+3)]));if(i===T){const t=recs[i+3];
 for(let k=0;k<64000;k++)if(r.frame[k]!==t.frame[k])console.log("px",k%320,Math.floor(k/320),"mine",r.frame[k],"rec",t.frame[k]);
 for(let k=0;k<768;k++)if(r.pal[k]!==t.pal[k])console.log("pal",k,"mine",r.pal[k],"rec",t.pal[k]);console.log(seq.name)}}

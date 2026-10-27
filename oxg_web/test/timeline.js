// Scene timeline of the port against the recorded music syncs: node test/timeline.js  (needs rec_a.rawz)
const fs=require("fs"),path=require("path"),{parseArchive}=require("../src/archive"),{chain}=require("../src/sequence"),{loadRec,sync}=require("./rec");
const files=parseArchive(fs.readFileSync(path.join(__dirname,"../../oxg_cont/CONTRAST.BIN")));
const recs=loadRec(path.join(__dirname,"../../oxg_out/rec_a.rawz")),seq=chain(files);
const waiting=s=>s.waiting===true||s.state==="wait"||(s.s3&&s.s3.waiting===true);
let cur=null,rows=[];
for(let i=0;i<recs.length-4;i++){const nm=seq.name;if(nm!==cur){cur=nm;rows.push({name:nm,created:i,play:null,end:null});}
 const s=seq.scene,r=rows[rows.length-1];if(r.play===null&&!waiting(s)&&i>=r.created)r.play=i;
 const out=seq.step(sync(recs[i+3]));if(!out){r.end=i;break}if(seq.name!==nm)rows[rows.length-2<0?0:rows.length-1].end=i}
const P=70.0864;for(const r of rows)console.log(r.name.padEnd(8),"created",r.created,"play from",r.play,"("+(r.play/P).toFixed(1)+" s)","ends",r.end,r.end!=null?"("+(r.end/P).toFixed(1)+" s)":"");

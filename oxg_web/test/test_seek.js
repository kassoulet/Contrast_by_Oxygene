// starting a chapter directly gives the recorded frames: node test/test_seek.js
const fs=require("fs"),path=require("path"),{parseArchive}=require("../src/archive"),{chain,CHAPTERS}=require("../src/sequence"),{loadRec,sync}=require("./rec");
const files=parseArchive(fs.readFileSync(path.join(__dirname,"../../oxg_cont/CONTRAST.BIN"))),recs=loadRec(path.join(__dirname,"../../oxg_out/rec_a.rawz"));
const cmp=(a,b)=>{let n=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])n++;return n};
for(const [k,span,skip] of [[1,800,0],[2,900,0],[3,900,0],[5,900,400],[7,600,0],[8,600,0]]){
  const seq=chain(files);seq.startAt(k);const T=CHAPTERS[k][1];let bad=0;
  for(let i=T;i<T+span;i++){const r=seq.step(sync(recs[i+3]));if(i>=T+skip){const t=recs[i+3];bad+=(cmp(r.frame,t.frame)+cmp(r.pal,t.pal))?1:0}}
  console.log(CHAPTERS[k][0].padEnd(14),"from tick",T,span,"ticks:",bad?bad+" differ":"identical");}

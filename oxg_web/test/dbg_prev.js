const fs=require("fs"),path=require("path"),{parseArchive}=require("../src/archive"),{chain}=require("../src/sequence"),{loadRec,sync}=require("./rec");
const files=parseArchive(fs.readFileSync(path.join(__dirname,"../../oxg_cont/CONTRAST.BIN")));
const recs=loadRec(path.join(__dirname,"../../oxg_out/rec_a.rawz")),T=+process.argv[2],seq=chain(files);let sc;
for(let i=0;i<T;i++){sc=seq.scene;seq.step(sync(recs[i+3]));}
sc=seq.scene;const want=recs[T+3].frame;let d=0;for(const k of ["fb","back","shown"]){d=0;for(let i=0;i<64000;i++)if(sc[k][i]!==want[i])d++;console.log(seq.name,k,"differs in",d)}

const fs=require("fs"),path=require("path"),{parseArchive}=require("../src/archive"),{chain}=require("../src/sequence"),{loadRec,sync}=require("./rec");
const files=parseArchive(fs.readFileSync(path.join(__dirname,"../../oxg_cont/CONTRAST.BIN")));
const recs=loadRec(path.join(__dirname,"../../oxg_out/rec_a.rawz")),T=+process.argv[2],seq=chain(files);let sc;
for(let i=0;i<=T;i++){seq.step(sync(recs[i+3]));}
console.log(seq.name,"tick",T,"clock",recs[T+3].t,"frame",seq.scene.frame);

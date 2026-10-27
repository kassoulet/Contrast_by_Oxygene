// Replay logged filler calls (oxg_tools/log_fill.py) through fillTri: node test/replay_fill.js PREFIX [cplfile]
const fs=require("fs"),{fillTri}=require("../src/fill");
const P=process.argv[2],J=JSON.parse(fs.readFileSync(P+".json")),B=fs.readFileSync(P+"_before.raw"),A=fs.readFileSync(P+"_after.raw"),T=fs.readFileSync(P+"_tex.raw");
let cpl=process.argv[3]?fs.readFileSync(process.argv[3]):null;if(cpl&&process.argv[4]){const {readGif}=require("../src/gif"),{fadeTable}=require("../src/fade"),f=require("../src/archive").parseArchive(fs.readFileSync("../oxg_cont/CONTRAST.BIN"));const fd=fadeTable(null,readGif(f[process.argv[4]]).pal);const c2=new Uint8Array(0x4004+fd.length);c2.set(cpl.subarray(0,0x4000));c2.set([0x0D,0x10,0x18,0x0A],0x4000);c2.set(fd,0x4004);cpl=c2}let bad=0;
for(let i=0;i<J.kind.length;i++){const fb=Uint8Array.from(B.subarray(i*64000,(i+1)*64000)),env={fb,tex:T.subarray(i*65536,(i+1)*65536),cpl};
 try{fillTri(env,J.kind[i],J.v[i],J.y[i],J.u[i],J.w[i],J.s[i],J.col[i])}catch(e){console.log("call",i,"threw",e.message);bad++;continue}
 let d=0;const a=A.subarray(i*64000,(i+1)*64000);for(let k=0;k<64000;k++)if(fb[k]!==a[k])d++;
 if(d){bad++;if(bad<=6)console.log("call",i,"kind",J.kind[i],"X",J.v[i],"Y",J.y[i],"U",J.u[i],"V",J.w[i],"diff px",d)}}
console.log(J.kind.length,"calls,",bad,"differ");

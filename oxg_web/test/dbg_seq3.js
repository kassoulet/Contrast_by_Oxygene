// where do my frames land in the recording? for the ticks in [A,B], find the recorded index whose frame equals mine
const fs=require("fs"),path=require("path");
const {Scene3}=require("../src/scene3"),{parseArchive}=require("../src/archive"),{Intro}=require("../src/intro"),{Scene2}=require("../src/scene2"),{loadRec,sync}=require("./rec");
const files=parseArchive(fs.readFileSync(path.join(__dirname,"../../oxg_cont/CONTRAST.BIN")));
const recs=loadRec(path.join(__dirname,"../../oxg_out/rec_a.rawz"));const A=+process.argv[2],B=+process.argv[3];
const eq=(a,b)=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true};
let scene=new Intro(files),name="intro",G=null;
for(let i=0;i<=B;i++){const sy=sync(recs[Math.min(recs.length-1,i+3)]);let r=scene.step(sy);
 if(scene.done){if(name==="intro"){G={angle:scene.angle,o8c:0x800000,o90:0x800000};scene=new Scene2(files,G);name="scene2";r={frame:scene.shown,pal:scene.pal}}else if(name==="scene2"){scene=new Scene3(files);name="scene3";r={frame:scene.shown,pal:scene.pal}}}
 if(i>=A){let hit=[];for(let k=i-6;k<=i+14;k++)if(eq(r.frame,recs[k].frame))hit.push(k-i);console.log(i,"scene3 tick",scene.tick,"frame#",scene.frame,"matches rec offsets",hit.join(","));}}
if(process.argv[4]){const k=+process.argv[4];const w=(n,f,p)=>{const o=Buffer.alloc(64000*3+20);const fs=require("fs");let s="P6 320 200 255\n";const b=Buffer.alloc(64000*3);for(let i=0;i<64000;i++){for(let c=0;c<3;c++)b[i*3+c]=Math.min(255,p[f[i]*3+c]*4)}fs.writeFileSync(n,Buffer.concat([Buffer.from(s),b]))};
 w("/tmp/mine.ppm",scene.shown,scene.pal);w("/tmp/rec.ppm",recs[k+3].frame,recs[k+3].pal);}

const fs=require("fs"),path=require("path"),{parseArchive}=require("../src/archive"),sc3=require("../src/scene3"),{load}=require("./vec");
const files=parseArchive(fs.readFileSync(path.join(__dirname,"../../oxg_cont/CONTRAST.BIN")));
const s=new sc3.Scene3(files,sc3.CIRK4),v=load(path.join(__dirname,"../../oxg_out/v_sort5.bin")),m=v.before,n=m.u32(0x593B0);
const keys=[];for(let i=0;i<n;i++)keys.push(m.u16(0x4CC60+10*i));
const {lookAt}=require("../src/camera"),{objectMatrix}=require("../src/objmat"),{setupHierarchy}=require("../src/hier"),{prepare}=require("../src/prepare"),{collect}=require("../src/faces");
for(let F=10;F<22;F++){const M=lookAt(s.ss,F,s.t),c=s.ss.cur;const light={x:(c.px+c.tx)|0,y:(c.pz+c.tz)|0,z:(c.py+c.ty)|0};
 for(const o of s.objects)o.local=objectMatrix(o,F);setupHierarchy(s.root,M);const list=[];for(const o of s.objects){prepare(o,{light,zoff:0,materials:s.materials});collect(o,2,list)}
 let same=list.length===n;if(same)for(let i=0;i<n;i++)if(list[i].key!==keys[i]){same=false;break}
 let eq=0;for(let i=0;i<Math.min(n,list.length);i++)if(list[i].key===keys[i])eq++;
 console.log("frame",F,"mine",list.length,"orig",n,same?"IDENTICAL key sequence":"differs, equal keys at "+eq+" positions");}
{const F=15;const M=lookAt(s.ss,F,s.t),c=s.ss.cur;const light={x:(c.px+c.tx)|0,y:(c.pz+c.tz)|0,z:(c.py+c.ty)|0};
 for(const o of s.objects)o.local=objectMatrix(o,F);setupHierarchy(s.root,M);const list=[];for(const o of s.objects){prepare(o,{light,zoff:0,materials:s.materials});collect(o,2,list)}
 console.log("mine",list.slice(0,8).map(e=>e.key).join(","));console.log("orig",keys.slice(0,8).join(","));
 console.log("mine tail",list.slice(-5).map(e=>e.key).join(","),"orig tail",keys.slice(-5).join(","));
 console.log("sorted mine?",[...list].map(e=>e.key).sort((a,b)=>a-b).slice(0,6).join(","),"orig",[...keys].sort((a,b)=>a-b).slice(0,6).join(","))}

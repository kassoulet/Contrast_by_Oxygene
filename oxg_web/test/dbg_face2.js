const fs=require("fs"),path=require("path"),{parseArchive}=require("../src/archive"),sc3=require("../src/scene3");
const files=parseArchive(fs.readFileSync(path.join(__dirname,"../../oxg_cont/CONTRAST.BIN")));
const s=new sc3.Scene3(files,sc3[process.argv[2]]),F=+process.argv[3],N=+process.argv[4];
const {lookAt}=require("../src/camera"),{objectMatrix}=require("../src/objmat"),{setupHierarchy}=require("../src/hier"),{prepare}=require("../src/prepare"),{collect,sortList}=require("../src/faces");
const M=lookAt(s.ss,F,s.t),c=s.ss.cur;const light={x:(c.px+c.tx)|0,y:(c.pz+c.tz)|0,z:(c.py+c.ty)|0};
for(const o of s.objects)o.local=objectMatrix(o,F);setupHierarchy(s.root,M);
const list=[],st={light,zoff:0,materials:s.materials};
s.objects.forEach((o,i)=>{o.idx=i;prepare(o,st);collect(o,2,list)});
const sorted=sortList(list);
for(const e of sorted.slice(0,N)){const f=e.o.f,a=e.face*0x18,q=[0,2,4].map(k=>f.getInt16(a+k,true));
 console.log("obj",e.o.idx,"id",e.o.id,"face",e.face,"key",e.key,"mat",f.getInt16(a+6,true),"flags",f.getUint16(a+6,true).toString(16),q.map(i=>[e.o.v.getInt32(i*0x2E+0x10,true),e.o.v.getInt32(i*0x2E+0x14,true),e.o.v.getInt32(i*0x2E+0x18,true)].join("/")).join("  "))}
console.log(s.objects.map(o=>o.idx+":"+o.nf+(o.visible?"v":"-")).join(" "))

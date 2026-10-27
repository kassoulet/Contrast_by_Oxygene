const fs=require("fs"),path=require("path");
const {Scene3,drawFaces}=require("../src/scene3"),{parseArchive}=require("../src/archive");
const sc3=require("../src/scene3");
const files=parseArchive(fs.readFileSync(path.join(__dirname,"../../oxg_cont/CONTRAST.BIN")));
const s=new Scene3(files);const F=+process.argv[2];
const {lookAt}=require("../src/camera"),{objectMatrix}=require("../src/objmat"),{setupHierarchy}=require("../src/hier"),{prepare}=require("../src/prepare"),{collect,sortList}=require("../src/faces"),{fillTri}=require("../src/fill");
const M=lookAt(s.ss,F,s.t),c=s.ss.cur;const light={x:(c.px+c.tx)|0,y:(c.pz+c.tz)|0,z:(c.py+c.ty)|0};
for(const o of s.objects)o.local=objectMatrix(o,F);setupHierarchy(s.root,M);
const list=[],st={light,zoff:0,materials:s.materials};
s.objects.forEach((o,i)=>{prepare(o,st);o.idx=i;collect(o,2,list)});
const sorted=sortList(list);
// draw one at a time, report big flat faces
const env={fb:new Uint8Array(64000),tex:null,cpl:s.cpl};
sorted.forEach((e,n)=>{const before=env.fb.slice();drawFaces(env,[e],s.materials);let ch=0;for(let i=0;i<64000;i++)if(env.fb[i]!==before[i])ch++;
 if(ch>4000){const f=e.o.f,a=e.face*0x18;const mt=s.materials[f.getInt16(a+6,true)];const q=[0,2,4].map(k=>f.getInt16(a+k,true));
  console.log("order",n,"/",sorted.length,"obj",e.o.idx,"face",e.face,"key",e.key,"mat",mt.name,"flags",mt.flags,"px",ch,"verts",q.map(i=>[e.o.v.getInt32(i*0x2E+0x10,true),e.o.v.getInt32(i*0x2E+0x14,true),e.o.v.getInt32(i*0x2E+0x18,true)].join("/")).join(" "));}});

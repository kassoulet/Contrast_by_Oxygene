const path=require("path"),{load}=require("./vec"),{fillTri}=require("../src/fill");
const name=process.argv[2],kind={flat:0,tex:1,shade:2}[name];const v=load(path.join(__dirname,"../../oxg_out/v_"+name+".bin")),m=v.before,a=v.after;
const X=[m.i32(0x5A804),m.i32(0x5A808),m.i32(0x5A80C)],Y=[m.i32(0x5A81C),m.i32(0x5A820),m.i32(0x5A824)],U=[m.i32(0x5A828),m.i32(0x5A82C),m.i32(0x5A830)],V=[m.i32(0x5A7F4),m.i32(0x5A7F8),m.i32(0x5A7FC)],S=[m.i32(0x5A818),m.i32(0x5A810),m.i32(0x5A814)];
console.log({X,Y,U,V,S});
const fbp=m.u32(0x44E38),fb=Uint8Array.from(m.bytes(fbp,64000)),orig=Uint8Array.from(fb);
fillTri({fb,tex:m.bytes(m.u32(0x5A7A0),65536),cpl:kind==2?m.bytes(m.u32(0x4C7F4),16384):null},kind,X,Y,U,V,S,0);
const want=a.bytes(fbp,64000);
for(let y=0;y<200;y++){let s="";for(let x=0;x<320;x++){const i=y*320+x;if(fb[i]!==orig[i]||want[i]!==orig[i]){s+=(fb[i]===want[i]?"=":"X");}}
 if(s){let x0=0;for(let x=0;x<320;x++){const i=y*320+x;if(fb[i]!==orig[i]||want[i]!==orig[i]){x0=x;break}}
 console.log(y,x0,s);}}
for(const y of [0,1,2]){let a1=[],b1=[];for(let x=0;x<320;x++){const i=y*320+x;if(fb[i]!==orig[i]||want[i]!==orig[i]){a1.push(x+":"+fb[i]+"/"+want[i]);}}console.log(y,a1.slice(0,12).join(" "), a1.length)}

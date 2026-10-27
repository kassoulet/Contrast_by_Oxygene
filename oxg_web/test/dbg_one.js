const fs=require("fs"),{fillTri}=require("../src/fill");const P=process.argv[2],I=+process.argv[3],J=JSON.parse(fs.readFileSync(P+".json")),B=fs.readFileSync(P+"_before.raw"),A=fs.readFileSync(P+"_after.raw"),T=fs.readFileSync(P+"_tex.raw"),cpl=fs.readFileSync(process.argv[4]);
const fb=Uint8Array.from(B.subarray(I*64000,(I+1)*64000));fillTri({fb,tex:T.subarray(I*65536,(I+1)*65536),cpl},J.kind[I],J.v[I],J.y[I],J.u[I],J.w[I],J.s[I],J.col[I]);
const a=A.subarray(I*64000,(I+1)*64000),b=B.subarray(I*64000,(I+1)*64000);console.log(JSON.stringify({X:J.v[I],Y:J.y[I],U:J.u[I],V:J.w[I],S:J.s[I]}));
for(let k=0;k<64000;k++)if(fb[k]!==a[k])console.log("px",k%320,Math.floor(k/320),"mine",fb[k],"orig",a[k],"before",b[k]);
for(const y of [28,29,30]){let m="",o="";for(let x=108;x<120;x++){m+=(fb[y*320+x]-b[y*320+x]?"#":".");o+=(a[y*320+x]-b[y*320+x]?"#":".")}console.log("row",y,"mine",m,"orig",o)}

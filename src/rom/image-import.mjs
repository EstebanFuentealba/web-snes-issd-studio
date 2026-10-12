// Palette extraction works in SNES RGB555 space, so preview matches exported ROM.
const snap=value=>Math.round(Math.round(value*31/255)*255/31);
const distance=(a,b)=>a.reduce((sum,v,i)=>sum+(v-b[i])**2,0);
const hex=color=>'#'+color.map(v=>v.toString(16).padStart(2,'0')).join('');
export function imagePixels(data,width,height,colors,baseline,editable){
  const rgb=colors.map(c=>/^#[0-9a-f]{6}$/i.test(c)?[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)):null);
  let changed=0;
  const matrix=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>{
    if(editable&&!editable[y]?.[x])return baseline[y][x];
    const i=(y*width+x)*4;if(data[i+3]<128)return 0;
    // Equal colors can have different indices in the logo's three palettes.
    let best=baseline?.[y]?.[x]??0,distance=Infinity;
    if(rgb[best])distance=rgb[best].reduce((sum,v,k)=>sum+(v-data[i+k])**2,0);
    rgb.forEach((c,index)=>{if(!c)return;const d=c.reduce((sum,v,k)=>sum+(v-data[i+k])**2,0);if(d<distance){best=index;distance=d;}});
    if(distance>0)changed++;return best;
  }));
  return {matrix,changed};
}
export function imagePalette(data,count=4){
  const histogram=new Map();
  for(let i=0;i<data.length;i+=4){if(data[i+3]<128)continue;const color=[data[i],data[i+1],data[i+2]].map(snap),key=color.join(',');const entry=histogram.get(key);if(entry)entry.weight++;else histogram.set(key,{color,weight:1});}
  const points=[...histogram.values()].sort((a,b)=>b.weight-a.weight);
  if(!points.length)return Array(count).fill('#000000');
  const centers=[points[0].color.slice()];
  while(centers.length<Math.min(count,points.length)){
    const next=points.reduce((best,p)=>{const score=Math.min(...centers.map(c=>distance(c,p.color)))*p.weight;return score>best.score?{score,color:p.color}:best;},{score:-1});centers.push(next.color.slice());
  }
  for(let step=0;step<16;step++){
    const sums=centers.map(()=>({color:[0,0,0],weight:0}));
    for(const p of points){let best=0;centers.forEach((c,i)=>{if(distance(c,p.color)<distance(centers[best],p.color))best=i;});sums[best].weight+=p.weight;p.color.forEach((v,i)=>sums[best].color[i]+=v*p.weight);}
    sums.forEach((s,i)=>{if(s.weight)centers[i]=s.color.map(v=>snap(v/s.weight));});
  }
  while(centers.length<count)centers.push(centers[centers.length-1].slice());
  return centers.map(hex);
}

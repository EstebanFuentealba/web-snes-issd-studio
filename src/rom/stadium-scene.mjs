import {stadiumAssetAddress} from './wc26-stadiums.mjs';
import {decompress,loRom,word,tiles,palette} from './binary.mjs';
import {STADIUM_LAYOUTS} from './stadium-layouts.mjs';
import {stadiumPalettes} from './stadiums.mjs';
const cache=new WeakMap(),viewCache=new WeakMap();
function nativeScene(rom,index){
 let scenes=cache.get(rom);if(!scenes){scenes=new Map();cache.set(rom,scenes);}if(scenes.has(index))return scenes.get(index);
 const layout=STADIUM_LAYOUTS[index],vram=new Uint8Array(32768),sources=Array(1024).fill(null),memory=new Uint8Array(65536);
 for(const [destination,address] of [...layout.uploads,...([4,5].includes(index)?[[0x3ec0,index===4?0x9fba9a:0x9fbb6f]]:[])]){const bytes=decompress(rom,loRom(stadiumAssetAddress(rom,address)));vram.set(bytes,(destination-0x2000)*2);for(let t=0;t<bytes.length/32;t++)sources[(destination-0x2000)/16+t]={address,tile:t};}
 for(const [destination,address] of layout.maps){const bytes=decompress(rom,loRom(stadiumAssetAddress(rom,address))),stride=destination<0xd000?2:1;bytes.forEach((v,i)=>memory[destination+i*stride]=v);}
 // CODE_80B49C expands definitions encoded as mirrored references.
 for(const base of [0x8000,0xa000])for(let i=0;i<256;i++){
  const entry=word(memory,base+i*32);if(entry<0xff00)continue;
  const source=memory.slice(base+(entry&255)*32,base+(entry&255)*32+32);
  for(let y=0;y<4;y++)for(let x=0;x<4;x++){const e=word(source,(y*4+3-x)*2)^0x4000;memory.set([e&255,e>>8],base+i*32+(y*4+x)*2);}
 }
 const stride=word(rom,loRom(0x81ee71)+index*2),width=stride/8*32,height=Math.ceil(decompress(rom,loRom(stadiumAssetAddress(rom,layout.maps[0][1]))).length/stride)*256;
 const strip=tiles(vram,4,1),colors=Array(128).fill('#649733'),palettes=stadiumPalettes(rom,index);
 for(const [label,start] of [['Despejado · campo y gradas',32],['Gradas y carteles',80],['Camarógrafos',16]]){const p=palettes.find(p=>p.label===label);if(p)colors.splice(start,p.colors.length,...p.colors);}
 const entry=(x,y,layer)=>{const mapIndex=(y>>8)*stride+(x>>8)*64+((y&255)>>5)*8+((x&255)>>5),definition=memory[(layer?0xe000:0xd000)+mapIndex];return word(memory,(layer?0xa000:0x8000)+definition*32+(((y&31)>>3)*4+((x&31)>>3))*2);};
 const sample=(x,y,layer)=>{const e=entry(x,y,layer),t=e&1023,xx=e&0x4000?7-x%8:x%8,yy=e&0x8000?7-y%8:y%8;return {value:strip[t*8+yy][xx],base:(e>>10&7)*16,source:sources[t],xx,yy};};
 const camera=loRom(0x81ef21)+index*4;
 const scene={width,height,colors,sample,center:{x:word(rom,camera)+128,y:word(rom,camera+2)+112}};scenes.set(index,scene);return scene;
}
function selectorScene(rom,resource){
 const mini=resource.partOffset!==null,base=mini?0x300/16:0x3c0/16,strip=tiles(mini?resource.sourceBytes.slice(resource.partOffset,resource.partOffset+384):resource.sourceBytes,4,1),map=decompress(rom,loRom(0xa183f6));
 const miniColors=Array(16).fill('#071871');miniColors.splice(8,4,...palette(rom,loRom(0x89dfe2),4));
 return {width:256,height:224,colors:mini?miniColors:palette(rom,loRom(0x89df80),48),sample(x,y,layer){if(layer)return {value:0};const e=word(map,((y>>3)*32+(x>>3))*2),t=(e&1023)-base,xx=e&0x4000?7-x%8:x%8,yy=e&0x8000?7-y%8:y%8;return {value:strip[t*8+yy]?.[xx]||0,base:mini?0:Math.max(0,((e>>10&7)-3)*16),source:t>=0&&t<strip.length/8?{address:resource.address,tile:t}:null,xx,yy};}};
}
export function stadiumViews(rom,index,resource){
 let views=viewCache.get(rom);if(!views){views=new Map();viewCache.set(rom,views);}const key=index+':'+resource.id;if(views.has(key))return views.get(key);
 const visible=views=>views.filter(v=>v.editable.some(row=>row.some(Boolean)));
 let result=visible(buildViews(rom,index,resource));if(!result.length&&resource.shared)for(let other=0;other<8;other++){if(other===index)continue;result=visible(buildViews(rom,other,resource)).map(view=>({...view,reference:true}));if(result.length)break;}views.set(key,result);return result;
}
function buildViews(rom,index,resource){
 const scene=[0xa185ba,0xa18a0a].includes(resource.address)?selectorScene(rom,resource):nativeScene(rom,index);
 const hits=new Set();for(let y=0;y<scene.height;y+=8)for(let x=0;x<scene.width;x+=8)if([0,1].some(layer=>scene.sample(x,y,layer).source?.address===resource.address))hits.add(`${x},${y}`);
 const regions=[];while(hits.size){const first=hits.values().next().value,queue=[first],points=[];hits.delete(first);while(queue.length){const key=queue.pop(),[x,y]=key.split(',').map(Number);points.push([x,y]);for(const [xx,yy] of [[x-8,y],[x+8,y],[x,y-8],[x,y+8]]){const k=`${xx},${yy}`;if(hits.delete(k))queue.push(k);}}
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const region={x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs)+8,h:Math.max(...ys)-Math.min(...ys)+8,count:points.length};
 // A large connected border can surround an empty center. Anchor its crop
 // on an actual visible pixel of the selected resource, not its bounding box.
 const center={x:region.x+region.w/2,y:region.y+region.h/2};let distance=Infinity;
 for(const [x,y] of points){const front=scene.sample(x+4,y+4,0),back=scene.sample(x+4,y+4,1),visible=front.value?front:back;if(resource.address===0x9f8a40&&visible.source?.address===resource.address&&visible.source.tile<8)region.hasAudience=true;if(!visible.value||visible.source?.address!==resource.address)continue;const d=(x+4-center.x)**2+(y+4-center.y)**2;if(d<distance){distance=d;region.anchor={x:x+4,y:y+4};}}
 if([0x9991e0,0x9ab6f2,0xa2b4c5].includes(resource.address)&&(region.w>320||region.h>224)){
  const visibleAt=(x,y)=>{if(x<0||y<0||x>=scene.width||y>=scene.height)return {};const front=scene.sample(x,y,0);return front.value?front:scene.sample(x,y,1);};
  const grassAt=(x,y)=>{const p=visibleAt(x,y);return p.value>0&&p.base>=32&&p.base<64&&p.source?.address===0x9de78f;};
  let best=-Infinity;
  for(const [xx,yy] of points){const x=xx+4,y=yy+4,p=visibleAt(x,y);if(!p.value||p.source?.address!==resource.address||![-24,24].some(d=>grassAt(x+d,y))||![-24,24].some(d=>grassAt(x,y+d)))continue;
   let owned=0,total=0;for(let dy=-112;dy<112;dy+=16)for(let dx=-160;dx<160;dx+=16){const q=visibleAt(x+dx,y+dy);if(q.value&&q.source?.address===resource.address)owned++;total++;}
   const coverage=owned/total,score=1-Math.abs(coverage-.5)-.05*((x-scene.center.x)**2+(y-scene.center.y)**2)/(scene.width**2+scene.height**2);
   if(score>best){best=score;region.anchor={x,y};}
  }
 }
 regions.push(region);}
 regions.sort((a,b)=>(resource.address===0x9f8a40?Number(!!b.hasAudience)-Number(!!a.hasAudience):0)||b.count-a.count);return regions.slice(0,resource.address===0x9de78f?1:24).map(region=>{
 const audience=resource.address===0x9f8a40;
 const w=Math.min(audience?160:320,region.w+32,scene.width),h=Math.min(audience?128:224,audience?Math.max(96,region.h+48):region.h+32,scene.height);
 let left=Math.max(0,Math.min(scene.width-w,resource.address===0x9de78f?scene.center.x-w/2:(region.w>w||region.h>h)&&region.anchor?region.anchor.x-w/2:region.x+(region.w-w)/2));
 // Crowd tiles repeat in 32px groups. Avoid cutting the first/last group
 // and keep the wall underneath visible instead of shrinking a long strip.
 if(audience)left=Math.floor(left/32)*32;
 const top=Math.max(0,Math.min(scene.height-h,audience?region.y-16:resource.address===0x9de78f?scene.center.y-h/2:(region.w>w||region.h>h)&&region.anchor?region.anchor.y-h/2:region.y+(region.h-h)/2));
 const owners=[],bases=[],matrix=[],underlays=[];
 for(let y=0;y<h;y++){owners[y]=[];bases[y]=[];matrix[y]=[];underlays[y]=[];for(let x=0;x<w;x++){
 const back=scene.sample(left+x,top+y,1),front=scene.sample(left+x,top+y,0);
 const visible=front.value?front:back;
 // Prefer the visible layer. Tile zero is also used as empty foreground;
 // it must not obscure an owned grass pixel in the background layer.
 const target=visible.source?.address===resource.address?visible:
  !front.value&&front.source?.address===resource.address&&resource.address!==0x9de78f?front:null;
 const p=target||visible;
 const owner=p.source?.address===resource.address?{x:p.source.tile%resource.columns*8+p.xx,y:Math.floor(p.source.tile/resource.columns)*8+p.yy}:null;
 owners[y][x]=owner;underlays[y][x]=owner&&p===front?(back.base||0)+(back.value||0):null;bases[y][x]=owner?p.base:0;matrix[y][x]=(p.base||0)+(p.value||0);
 }}return {matrix,owners,bases,underlays,colors:scene.colors,editable:owners.map(row=>row.map(Boolean)),region,crop:{x:left,y:top,width:w,height:h}};
 });
}
export function stadiumViewPixels(resource,view,matrix,baseline=view.matrix){
 const raw=resource.matrix.map(row=>row.slice());matrix.forEach((row,y)=>row.forEach((v,x)=>{const owner=view.owners[y][x];if(owner&&v!==baseline[y][x])raw[owner.y][owner.x]=v&15;}));return raw;
}
export function normalizeStadiumView(resource,view,matrix,baseline=view.matrix){
 const prior=stadiumViewPixels(resource,view,baseline);const raw=stadiumViewPixels({...resource,matrix:prior},view,matrix,baseline);return view.matrix.map((row,y)=>row.map((v,x)=>{const o=view.owners[y][x];return o?view.bases[y][x]+raw[o.y][o.x]:v;}));
}

// Keep native color index zero editable, while drawing the layer behind it.
export function stadiumViewColor(view,value,x,y,colors=view.colors){
 const underlay=view.underlays?.[y]?.[x];
 return colors[(value&15)===0&&typeof underlay==='number'?underlay:value];
}

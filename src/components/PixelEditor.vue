<template>
  <section class="pixel-editor">
    <div class="toolbar">
      <label>{{ $t("Herramienta") }} <select v-model="tool"><option v-for="(label,key) in tools" :value="key" :key="key">{{ $t(label) }}</option></select></label>
      <label>{{ $t("Zoom") }} <input type="range" min="1" max="16" v-model.number="zoom" /></label>
      <label><input type="checkbox" v-model="grid" /> {{ $t("Cuadrícula") }}</label>
      <button @click="undo" :disabled="!past.length" :title="$t(&quot;Deshacer dibujo&quot;)">↶</button><button @click="redo" :disabled="!future.length" :title="$t(&quot;Rehacer dibujo&quot;)">↷</button>
      <button @click="flip(false)">{{ $t("Voltear ↔") }}</button><button @click="flip(true)">{{ $t("Voltear ↕") }}</button>
      <button @click="copy" :disabled="!selection">{{ $t("Copiar selección") }}</button><button @click="paste" :disabled="!clipboard">{{ $t("Pegar") }}</button>
      <button @click="restore">{{ $t("Restaurar original") }}</button>
      <button @click="exportPng">{{ $t("Exportar PNG") }}</button><button @click="$refs.imageInput.click()">{{ $t(flag ? 'Subir imagen y convertir a pixel art' : 'Importar imagen') }}</button><input ref="imageInput" class="image-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp" @change="importPng" />
    </div>
    <div class="palette"><button v-for="(color,i) in draftColors" v-show="!paletteIndices||paletteIndices.includes(i)" :key="i" :style="{background:color}" :class="{active:ink===i}" :disabled="i!==0 && color==='transparent'" :title="$t(`Índice ${i}: ${color}`)" :aria-label="$t(`Color ${i}`)" @click="ink=i">{{i}}</button></div>
    <p>{{ $t(width) }} × {{ $t(height) }} {{ $t("px ·") }} {{ colors.length }} {{ $t("índices ·") }} {{ $t(dirty ? 'Dibujo pendiente de aplicar' : 'Sin cambios de dibujo') }}</p>
    <div class="canvas-scroll"><canvas ref="canvas" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="cancel" :aria-label="$t(&quot;Lienzo pixel art&quot;)" /></div>
    <p v-if="selection">{{ $t("Selección:") }} {{$t(selection.w)}} × {{$t(selection.h)}}{{ $t(". Arrastra dentro para moverla; fuera para seleccionar otra región.") }}</p>
    <div class="previews"><figure><RomImage :matrix="original" :colors="originalColors || colors" :pixel-color="originalPixelColor" :label="$t(&quot;Gráfico original&quot;)" /><figcaption>{{ $t("Original") }}</figcaption></figure><figure><RomImage :matrix="pixels" :colors="draftColors" :pixel-color="pixelColor" :label="$t(&quot;Gráfico editado&quot;)" /><figcaption>{{ $t("Edición") }}</figcaption></figure><canvas ref="thumbnail" :aria-label="$t(&quot;Vista a tamaño original&quot;)" /></div>
    <button class="primary" @click="$emit('apply', clone(pixels), flag ? draftColors.slice() : null)" :disabled="!dirty">{{ $t("Aplicar gráfico a la ROM") }}</button>
    <dialog ref="importDialog" v-if="importImage" class="import-dialog" @cancel="closeImport">
      <h3>{{ $t("Convertir imagen a pixel art") }}</h3><p>{{ $t("El recorte se redimensiona a") }} {{$t(width)}} × {{$t(height)}} {{ $t("y se ajusta a los colores compatibles con la ROM. El índice 0 representa transparencia.") }}</p>
      <label v-if="flag"><input type="checkbox" v-model="useImagePalette" @change="convertImport" /> {{ $t("Cambiar la paleta de esta bandera con los colores de la imagen (máximo 4)") }}</label><label v-for="key in ['x','y','w','h']" :key="key">{{key}} <input type="number" v-model.number="crop[key]" min="0" @change="convertImport" /></label>
      <p v-if="importEditable">{{ $t("La importación conserva la silueta original del logo y protege el fondo.") }}</p>
      <RomImage v-if="importPixels" :matrix="importPixels" :colors="importColors" :label="$t(&quot;Resultado de cuantización&quot;)" />
      <div v-if="flag" class="palette"><button v-for="(color,i) in importColors.slice(12,16)" :key="i" :style="{background:color}" :aria-label="$t(`Nuevo color ${i+12}: ${color}`)">{{i+12}}</button></div><p>{{ $t(importInfo) }}</p><button @click="acceptImport" :disabled="!importPixels">{{ $t("Usar resultado") }}</button><button @click="closeImport">{{ $t("Cancelar") }}</button>
    </dialog>
    <p v-if="error || applyError" role="alert">{{$t(error || applyError)}}</p>
  </section>
</template>
<script>
import RomImage from './RomImage.vue';
import {imagePalette,imagePixels} from '../rom/image-import.mjs';
const clone=value=>value.map(row=>row.slice());
export default {
  components:{RomImage},props:{pixelColor:Function,originalPixelColor:Function,paletteIndices:Array,normalizeEdit:Function,colorIndex:Function,initialGrid:{type:Boolean,default:true},normalizeImage:Function,flag:Boolean,applyError:String,matrix:Array,importEditable:Array,editable:Array,highlightEditable:Boolean,original:Array,colors:Array,originalColors:Array},emits:['apply','pending-change'],
  data(){return {pixels:clone(this.matrix),draftColors:this.colors.slice(),importColors:this.colors.slice(),useImagePalette:true,past:[],future:[],tool:'pencil',ink:Math.max(1,this.colors.findIndex((color,i)=>i>0&&color!=='transparent'&&(!this.colorIndex||i%16!==0)&&(!this.paletteIndices||this.paletteIndices.includes(i)))),zoom:Math.min(6,Math.max(1,Math.floor(700/this.matrix[0].length))),grid:this.initialGrid,drag:null,selection:null,clipboard:null,importImage:null,importPixels:null,crop:{x:0,y:0,w:0,h:0},importInfo:'',error:'',tools:{pencil:'Lápiz',eraser:'Borrador',picker:'Cuentagotas',fill:'Relleno',line:'Línea',rect:'Rectángulo',select:'Seleccionar / mover'}};},
  computed:{width(){return this.pixels[0].length;},height(){return this.pixels.length;},dirty(){return JSON.stringify(this.pixels)!==JSON.stringify(this.matrix)||(this.flag&&JSON.stringify(this.draftColors)!==JSON.stringify(this.colors));}},
  watch:{dirty(value){this.$emit('pending-change',value||!!this.importImage);},pixelColor(){this.draw();},importImage(value){this.$emit('pending-change',this.dirty||!!value);if(value)this.$nextTick(()=>this.$refs.importDialog?.showModal());},matrix:{handler(value){this.pixels=clone(value);this.draftColors=this.colors.slice();this.past=[];this.future=[];this.selection=null;this.draw();},deep:true},pixels:{handler(){this.draw();},deep:true},zoom(){this.draw();},grid(){this.draw();},draftColors:{handler(){this.draw();},deep:true},colors:{handler(value){this.draftColors=value.slice();this.draw();},deep:true}},
  mounted(){this.zoom=Math.min(this.zoom,Math.max(1,Math.floor((this.$refs.canvas.parentElement.clientWidth-24)/this.width)));this.draw();},
  methods:{
    clone,draw(){this.$nextTick(()=>{for(const [ref,z] of [['canvas',this.zoom],['thumbnail',1]]){const canvas=this.$refs[ref];if(!canvas)continue;canvas.width=this.width*z;canvas.height=this.height*z;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);this.pixels.forEach((row,y)=>row.forEach((p,x)=>{ctx.fillStyle=(this.pixelColor?this.pixelColor(p,x,y,this.draftColors):this.draftColors[p])||'transparent';ctx.fillRect(x*z,y*z,z,z);}));if(ref==='canvas'&&this.highlightEditable&&this.editable){ctx.fillStyle='#24384b50';this.editable.forEach((row,y)=>row.forEach((editable,x)=>{if(!editable)ctx.fillRect(x*z,y*z,z,z);}));}
if(ref==='canvas'&&this.grid&&z>=4){ctx.strokeStyle='#76899a66';ctx.lineWidth=0.5;ctx.beginPath();for(let x=0;x<=this.width;x++){ctx.moveTo(x*z,0);ctx.lineTo(x*z,canvas.height);}for(let y=0;y<=this.height;y++){ctx.moveTo(0,y*z);ctx.lineTo(canvas.width,y*z);}ctx.stroke();}if(ref==='canvas'&&this.selection){const s=this.selection;ctx.strokeStyle='#ff4040';ctx.lineWidth=1;ctx.strokeRect(s.x*z+.5,s.y*z+.5,s.w*z-1,s.h*z-1);}}});},
    point(event){const r=this.$refs.canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(this.width-1,Math.floor((event.clientX-r.left)*this.width/r.width))),y:Math.max(0,Math.min(this.height-1,Math.floor((event.clientY-r.top)*this.height/r.height)))};},
    checkpoint(){this.past.push({pixels:clone(this.pixels),colors:this.draftColors.slice()});this.past=this.past.slice(-50);this.future=[];},
    canPaint(p){return !this.editable||!!this.editable[p.y]?.[p.x];},
    paint(p,value=this.ink){if(this.canPaint(p)&&p.x>=0&&p.x<this.width&&p.y>=0&&p.y<this.height)this.pixels[p.y][p.x]=this.colorIndex?this.colorIndex(p,value):value;},
    down(event){event.preventDefault();this.$refs.canvas.setPointerCapture(event.pointerId);const p=this.point(event);if(this.tool==='picker'){this.ink=this.pixels[p.y][p.x];return;}this.checkpoint();this.drag={start:p,last:p,base:clone(this.pixels)};
      if(this.tool==='fill'){const old=this.pixels[p.y][p.x],ink=this.colorIndex?this.colorIndex(p,this.ink):this.ink;if(old!==ink){const stack=[p];while(stack.length){const q=stack.pop();if(q.x<0||q.x>=this.width||q.y<0||q.y>=this.height||this.pixels[q.y][q.x]!==old||!this.canPaint(q))continue;this.paint(q);stack.push({x:q.x+1,y:q.y},{x:q.x-1,y:q.y},{x:q.x,y:q.y+1},{x:q.x,y:q.y-1});}}if(this.normalizeEdit)this.pixels=this.normalizeEdit(this.pixels,this.drag.base);this.drag=null;}
      else if(this.tool==='select'){const s=this.selection;if(s&&p.x>=s.x&&p.x<s.x+s.w&&p.y>=s.y&&p.y<s.y+s.h)this.drag.moving={...s};else this.selection={x:p.x,y:p.y,w:1,h:1};this.draw();}
      else this.move(event);
    },
    line(a,b,value){let x=a.x,y=a.y;const dx=Math.abs(b.x-x),dy=-Math.abs(b.y-y),sx=x<b.x?1:-1,sy=y<b.y?1:-1;let e=dx+dy;while(true){this.paint({x,y},value);if(x===b.x&&y===b.y)break;const e2=e*2;if(e2>=dy){e+=dy;x+=sx;}if(e2<=dx){e+=dx;y+=sy;}}},
    move(event){if(!this.drag)return;const p=this.point(event),a=this.drag.start,value=this.tool==='eraser'?0:this.ink;
      if(['line','rect','select'].includes(this.tool))this.pixels=clone(this.drag.base);
      if(['pencil','eraser'].includes(this.tool)){this.line(this.drag.last,p,value);this.drag.last=p;}
      if(this.tool==='line')this.line(a,p,value);
      if(this.tool==='rect'){this.line(a,{x:p.x,y:a.y},value);this.line({x:p.x,y:a.y},p,value);this.line(p,{x:a.x,y:p.y},value);this.line({x:a.x,y:p.y},a,value);}
      if(this.tool==='select'){const s=this.drag.moving;if(s){const x=Math.max(0,Math.min(this.width-s.w,s.x+p.x-a.x)),y=Math.max(0,Math.min(this.height-s.h,s.y+p.y-a.y));for(let j=0;j<s.h;j++)for(let i=0;i<s.w;i++)this.paint({x:s.x+i,y:s.y+j},0);for(let j=0;j<s.h;j++)for(let i=0;i<s.w;i++)this.paint({x:x+i,y:y+j},this.drag.base[s.y+j][s.x+i]);this.selection={...s,x,y};}else this.selection={x:Math.min(a.x,p.x),y:Math.min(a.y,p.y),w:Math.abs(a.x-p.x)+1,h:Math.abs(a.y-p.y)+1};this.draw();}
    },
    up(){if(this.normalizeEdit)this.pixels=this.normalizeEdit(this.pixels,this.drag?.base||this.matrix);this.drag=null;},cancel(){if(this.drag)this.pixels=clone(this.drag.base);this.drag=null;},
    undo(){if(this.past.length){this.future.push({pixels:clone(this.pixels),colors:this.draftColors.slice()});const state=this.past.pop();this.pixels=state.pixels;this.draftColors=state.colors;this.selection=null;}},redo(){if(this.future.length){this.past.push({pixels:clone(this.pixels),colors:this.draftColors.slice()});const state=this.future.pop();this.pixels=state.pixels;this.draftColors=state.colors;}},
    flip(vertical){this.checkpoint();const flipped=vertical?clone(this.pixels).reverse():this.pixels.map(row=>row.slice().reverse());flipped.forEach((row,y)=>row.forEach((v,x)=>this.paint({x,y},v)));if(this.normalizeEdit)this.pixels=this.normalizeEdit(this.pixels);},restore(){this.checkpoint();this.pixels=clone(this.original);this.draftColors=(this.flag?(this.originalColors||this.colors):this.colors).slice();},
    copy(){const s=this.selection;if(s)this.clipboard=this.pixels.slice(s.y,s.y+s.h).map(row=>row.slice(s.x,s.x+s.w));},paste(){if(!this.clipboard)return;this.checkpoint();const s=this.selection||{x:0,y:0};this.clipboard.forEach((row,y)=>row.forEach((v,x)=>this.paint({x:s.x+x,y:s.y+y},v)));if(this.normalizeEdit)this.pixels=this.normalizeEdit(this.pixels);},
    exportPng(){const canvas=this.$refs.thumbnail;canvas.toBlob(blob=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='issd-graphic.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});},
    async importPng(event){const file=event.target.files?.[0];event.target.value='';if(!file)return;this.error='';if(file.size>20*1024*1024){this.error='La imagen supera 20 MB.';return;}const url=URL.createObjectURL(file),image=new Image();image.onload=()=>{URL.revokeObjectURL(url);if(image.width*image.height>16000000){this.error='La imagen supera 16 millones de píxeles.';return;}this.importImage=image;this.crop={x:0,y:0,w:image.width,h:image.height};this.convertImport();};image.onerror=()=>{URL.revokeObjectURL(url);this.error='No se pudo leer la imagen.';};image.src=url;},
    convertImport(){const {x,y,w,h}=this.crop;this.importPixels=null;if(![x,y,w,h].every(Number.isFinite)||w<1||h<1||x<0||y<0||x+w>this.importImage.width||y+h>this.importImage.height){this.importInfo='El recorte debe estar dentro de la imagen.';return;}const canvas=document.createElement('canvas');canvas.width=this.width;canvas.height=this.height;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(this.importImage,x,y,w,h,0,0,this.width,this.height);const data=ctx.getImageData(0,0,this.width,this.height).data;
      this.importColors=this.draftColors.slice();if(this.flag&&this.useImagePalette)this.importColors.splice(12,4,...imagePalette(data));
      const result=imagePixels(data,this.width,this.height,this.importColors,this.pixels,this.importEditable||this.editable);this.importPixels=result.matrix;if(this.normalizeImage)this.importPixels=this.normalizeImage(this.importPixels);this.importInfo=`${result.changed} píxeles ajustados a la paleta. Revisa el resultado antes de aplicar.`;
    },acceptImport(){this.checkpoint();this.draftColors=this.importColors.slice();this.importPixels.forEach((row,y)=>row.forEach((v,x)=>this.paint({x,y},v)));if(this.normalizeEdit)this.pixels=this.normalizeEdit(this.pixels);this.closeImport();},closeImport(){this.importImage=null;this.importPixels=null;},
  }
};
</script>
<style scoped>
.toolbar,.palette,.previews{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.palette button{width:32px;height:32px;color:#fff;text-shadow:0 1px 2px #000;border:2px solid #b8c6d4}.palette .active{outline:3px solid #176be0}.canvas-scroll{overflow:auto;max-height:520px;background:#24384b;padding:12px}canvas{image-rendering:pixelated;touch-action:none;display:block}figure{margin:8px}.image-input{display:none}.import-dialog{position:fixed;inset:10%;z-index:20;overflow:auto;border:1px solid #b8c6d4;box-shadow:0 0 0 100vmax #0008}.import-dialog input{width:80px}.primary{background:#176be0;color:white;padding:10px}
</style>

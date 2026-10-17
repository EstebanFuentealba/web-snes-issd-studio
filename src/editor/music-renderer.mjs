import {SPCPlayer} from '../vendor/spc700-js/index.mjs';

export const MUSIC_SAMPLE_RATE=32000;
export class MusicRenderer {
 constructor(bytes){this.player=new SPCPlayer({sampleRate:MUSIC_SAMPLE_RATE,defaultPlaySeconds:86400,defaultFadeSeconds:0});this.player.load(bytes);}
 setSolo(channel){if(channel!==null&&(!Number.isInteger(channel)||channel<0||channel>7))throw new Error('Valor musical fuera de rango.');this.player.setVoiceMask(channel===null?0:255^(1<<channel));}
 render(count){const pcm=this.player.render(count),left=new Float32Array(count),right=new Float32Array(count);for(let i=0;i<count;i++){left[i]=pcm.left[i]/32768;right[i]=pcm.right[i]/32768;}return {left,right};}
 skip(count){this.player.render(count);}
}

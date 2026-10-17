// Unit-independent coordinates shared by the sample and music editors.
export const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function timelineRatio(time,start,span){return (time-start)/span;}
export function timelineTime(ratio,start,span){return start+clamp(ratio,0,1)*span;}
export function zoomTimeline({start,span,total,minSpan,maxSpan},factor,anchor=.5){
 if(![start,span,total,minSpan,maxSpan,factor,anchor].every(Number.isFinite)||span<=0||factor<=0)return {start,span};
 const time=start+anchor*span,next=clamp(span*factor,minSpan,maxSpan);
 return {start:Math.max(0,Math.min(total-next,time-anchor*next)),span:next};
}
export function snapTick(value,step=1){return Math.max(0,Math.round(value/Math.max(1,step))*Math.max(1,step));}
export function noteName(pitch){return ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][((pitch%12)+12)%12]+(Math.floor(pitch/12)-1);}

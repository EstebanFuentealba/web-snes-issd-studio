// Format signature shared with the ROM reader; no codec/graphics dependencies.
export const LONG_AUDIO_METADATA=0x3e0000;
export const LONG_AUDIO_MAGIC=Object.freeze([73,83,83,65,85,68,1,0]);
export const hasLongAudio=rom=>LONG_AUDIO_MAGIC.every((byte,i)=>rom?.[LONG_AUDIO_METADATA+i]===byte);

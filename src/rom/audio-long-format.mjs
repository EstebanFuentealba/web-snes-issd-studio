// Format signature shared with the ROM reader; no codec/graphics dependencies.
export const LONG_AUDIO_METADATA=0x3e0000;
export const LONG_AUDIO_MAGIC=Object.freeze([73,83,83,65,85,68,1,1]);
export const hasLongAudio=rom=>LONG_AUDIO_MAGIC.slice(0,7).every((byte,i)=>rom?.[LONG_AUDIO_METADATA+i]===byte)&&[0,1].includes(rom?.[LONG_AUDIO_METADATA+7]);
export const hasSafeLongAudio=rom=>hasLongAudio(rom)&&rom[LONG_AUDIO_METADATA+7]===1;

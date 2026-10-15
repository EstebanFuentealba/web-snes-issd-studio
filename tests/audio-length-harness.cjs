const fs=require('node:fs'),{parse}=require('@babel/parser');
// Run the actual editor handler and conversion pipeline without requiring Vue's DOM.
module.exports=async function createAudioLengthHarness({rom,sample,wav,range,long=false,nextTick=()=>Promise.resolve()}){
 const {audioPlaybackState}=await import('../src/rom/audio-preview.mjs'),{audioRegion,pitchRate,renderAudioEdit,replacementAudio}=await import('../src/rom/audio-edit.mjs'),{LONG_AUDIO}=await import('../src/rom/audio-long.mjs');
 const script=fs.readFileSync(__dirname+'/../src/components/StudioEditor.vue','utf8').split('<script>')[1].split('</script>')[0];
 const component=parse(script,{sourceType:'module'}).program.body.find(n=>n.type==='ExportDefaultDeclaration').declaration;
 const extract=(section,names)=>component.properties.find(n=>n.key.name===section).value.properties.filter(n=>names.includes(n.key.name)).map(n=>script.slice(n.start,n.end)).join(',');
 const selected=extract('methods',['act','changeAudioLength','prepareAudioTrim','invalidateAudioTrim','resetAudioPlayback']);
 const getters=extract('computed',['audioRate','audioInfo','audioCapacityBytes','audioCapacitySeconds']);
 const options=new Function('audioPlaybackState','audioRegion','pitchRate','renderAudioEdit','replacementAudio','LONG_AUDIO','markRaw','cancelAnimationFrame','URL',`return {methods:{${selected}},computed:{${getters}}}`)(audioPlaybackState,audioRegion,pitchRate,renderAudioEdit,replacementAudio,LONG_AUDIO,x=>x,()=>{},{revokeObjectURL(){}});
 const editor={rom,audioSamples:[sample],sampleIndex:0,pitch:1300,audioLong:long,audioSource:wav,audioRange:range,audioReplacement:null,audioUrl:'',audioPreviewIsTrim:false,audioFrame:null,$refs:{},$nextTick:nextTick,showAudio(samples,rate){this.audioUrl='blob:test-preview';this.audioPreviewIsTrim=true;this.preview={samples,rate};}};
 for(const [name,method] of Object.entries(options.methods))editor[name]=method.bind(editor);
 for(const [name,get] of Object.entries(options.computed))Object.defineProperty(editor,name,{get:get.bind(editor)});
 return editor;
};

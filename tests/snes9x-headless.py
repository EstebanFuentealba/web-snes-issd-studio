import ctypes as C,sys,struct,hashlib,os,json,zlib
# Standalone libretro verification; no UI automation or third-party Python modules.
lib=C.CDLL(sys.argv[1])
ENV=C.CFUNCTYPE(C.c_bool,C.c_uint,C.c_void_p);VID=C.CFUNCTYPE(None,C.c_void_p,C.c_uint,C.c_uint,C.c_size_t);AUD=C.CFUNCTYPE(None,C.c_int16,C.c_int16);BATCH=C.CFUNCTYPE(C.c_size_t,C.c_void_p,C.c_size_t);POLL=C.CFUNCTYPE(None);INPUT=C.CFUNCTYPE(C.c_int16,C.c_uint,C.c_uint,C.c_uint,C.c_uint)
audio_pcm=bytearray();capture_audio=os.environ.get("ISSD_CAPTURE_AUDIO")=="1"
pixfmt=0;frame=0;pixels=None;width=height=0
events=json.loads(os.environ.get("ISSD_INPUT", "[[400,20,3],[600,20,3],[800,20,3]]"))
@ENV
def env(cmd,p):
 global pixfmt
 if cmd==10:pixfmt=C.cast(p,C.POINTER(C.c_uint))[0];return True
 if cmd==3:C.cast(p,C.POINTER(C.c_bool))[0]=False;return True
 if cmd==16:C.cast(p,C.POINTER(C.c_bool))[0]=False;return True
 if cmd==18:C.cast(p,C.POINTER(C.c_bool))[0]=True;return True
 return False
@VID
def video(p,w,h,pitch):
 global pixels,width,height
 if p and p!=C.c_void_p(-1).value:pixels=b''.join(C.string_at(p+y*pitch,w*(4 if pixfmt==1 else 2)) for y in range(h));width=w;height=h
@AUD
def audio(l,r):
 if capture_audio:audio_pcm.extend(struct.pack("<hh",l,r))
@BATCH
def batch(p,n):
 if capture_audio:audio_pcm.extend(C.string_at(p,n*4))
 return n
@POLL
def poll():pass
@INPUT
def inp(port,device,index,button):
 return int(port==0 and any(button==key and start<=frame<start+duration for start,duration,key in events))
for name,cb in [('environment',env),('video_refresh',video),('audio_sample',audio),('audio_sample_batch',batch),('input_poll',poll),('input_state',inp)]:getattr(lib,'retro_set_'+name)(cb)
lib.retro_init()
class Game(C.Structure):_fields_=[('path',C.c_char_p),('data',C.c_void_p),('size',C.c_size_t),('meta',C.c_char_p)]
data=open(sys.argv[2],'rb').read();buf=C.create_string_buffer(data);game=Game(sys.argv[2].encode(),C.cast(buf,C.c_void_p),len(data),None)
lib.retro_load_game.argtypes=[C.POINTER(Game)];lib.retro_load_game.restype=C.c_bool
assert lib.retro_load_game(C.byref(game))
lib.retro_get_memory_data.argtypes=[C.c_uint];lib.retro_get_memory_data.restype=C.c_void_p
lib.retro_get_memory_size.argtypes=[C.c_uint];lib.retro_get_memory_size.restype=C.c_size_t
# Deterministic native sound-event requests; these writes do not alter ROM code
# or bypass the game's SPC700 loader/streaming protocol.
writes=json.loads(os.environ.get("ISSD_WRAM_WRITES","[]"))
state_frames=set(json.loads(os.environ.get("ISSD_STATE_FRAMES","[]")))
if state_frames:
 lib.retro_serialize_size.restype=C.c_size_t
 lib.retro_serialize.argtypes=[C.c_void_p,C.c_size_t];lib.retro_serialize.restype=C.c_bool
for frame in range(int(os.environ.get("ISSD_FRAMES","1000"))):
 for when,offset,values in writes:
  if frame==when:
   assert 0<=offset and offset+len(values)<=lib.retro_get_memory_size(2)
   C.memmove(lib.retro_get_memory_data(2)+offset,bytes(values),len(values))
 lib.retro_run()
 if frame in state_frames:
  size=lib.retro_serialize_size();state=C.create_string_buffer(size)
  assert lib.retro_serialize(state,size),"Snes9x state capture failed"
  open(sys.argv[3]+f'.{frame}.state','wb').write(state.raw)
if capture_audio:open(sys.argv[3]+'.pcm','wb').write(audio_pcm)
ram=C.string_at(lib.retro_get_memory_data(2),lib.retro_get_memory_size(2));open(sys.argv[3]+'.ram','wb').write(ram)
vram=C.string_at(lib.retro_get_memory_data(3),lib.retro_get_memory_size(3));open(sys.argv[3]+'.vram','wb').write(vram)
rgb=bytearray()
for o in range(0,len(pixels),4 if pixfmt==1 else 2):
 if pixfmt==1:b,g,r,_=pixels[o:o+4]
 else:
  p=int.from_bytes(pixels[o:o+2],'little');r=((p>>(11 if pixfmt==2 else 10))&31)*255//31;g=((p>>5)&(63 if pixfmt==2 else 31))*255//(63 if pixfmt==2 else 31);b=(p&31)*255//31
 rgb.extend((r,g,b))
open(sys.argv[3]+'.ppm','wb').write(f'P6\n{width} {height}\n255\n'.encode()+rgb)
def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
scanlines=b''.join(b'\0'+rgb[y*width*3:(y+1)*width*3] for y in range(height))
png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(scanlines))+chunk(b'IEND',b'')
open(sys.argv[3]+'.png','wb').write(png)
print(json.dumps({'width':width,'height':height,'hash':hashlib.sha256(rgb).hexdigest()}))
lib.retro_unload_game();lib.retro_deinit()

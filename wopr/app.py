#!/usr/bin/env python3
"""Standalone WOPR terminal; stdlib only, Ollama is external."""
import json, os, sqlite3, time, urllib.request, urllib.error, uuid, platform
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

ROOT=Path(__file__).parent; DATA=Path(os.getenv('DATA_DIR','/data')); DATA.mkdir(parents=True,exist_ok=True)
DB=DATA/'history.sqlite3'; OLLAMA=os.getenv('OLLAMA_URL','http://host.docker.internal:11434').rstrip('/')
NEEDLE_URL = os.getenv('NEEDLE_URL', 'http://needle3:8000').rstrip('/')
with sqlite3.connect(DB) as db:
 db.execute('CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, session TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created INTEGER NOT NULL)')
 db.execute('CREATE INDEX IF NOT EXISTS messages_session ON messages(session,created)')

def request_ollama(path,payload=None,timeout=15):
 req=urllib.request.Request(OLLAMA+path, data=json.dumps(payload).encode() if payload is not None else None, headers={'Content-Type':'application/json'})
 return urllib.request.urlopen(req,timeout=timeout)
def request_needle(command, timeout=15):
    """Send a natural-language command to Needle 3."""
    payload = json.dumps({"command": command}).encode("utf-8")

    req = urllib.request.Request(
        NEEDLE_URL + "/command",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.load(response)

def is_needle_command(message):
 return isinstance(message, str) and message.strip().lower().startswith('/needle ')

class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT/'static'),**kwargs)
 def log_message(self,fmt,*args): print('[WOPR]',fmt%args,flush=True)
 def send_json(self,data,status=200):
  raw=json.dumps(data).encode(); self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(raw))); self.send_header('Cache-Control','no-store'); self.end_headers(); self.wfile.write(raw)
 def body(self):
  n=int(self.headers.get('Content-Length','0'))
  if n>1024*1024: raise ValueError('Request too large')
  return json.loads(self.rfile.read(n) or b'{}')
 def do_GET(self):
  p=urlparse(self.path); path=p.path
  if path=='/api/health': return self.send_json({'ok':True,'version':'1.3.1-WIN-RESTORE','ollama_url':OLLAMA})
  if path=='/api/models':
   try:
    with request_ollama('/api/tags') as r: data=json.load(r)
    return self.send_json({'models':[m.get('name','') for m in data.get('models',[])], 'online':True})
   except Exception as e: return self.send_json({'models':[],'online':False,'error':str(e)})
  if path=='/api/system':
   mem={}
   try:
    with open('/proc/meminfo') as f:
     for line in f:
      k,v=line.split(':',1)
      if k in ('MemTotal','MemAvailable'):mem[k]=int(v.strip().split()[0])//1024
   except OSError:pass
   result={'hostname':platform.node(),'architecture':platform.machine(),'cpu':os.cpu_count(),'memory_mb':mem,'time':int(time.time()),'version':'1.3.1-WIN-RESTORE'}
   metrics_file=DATA/'host-metrics.json'
   try:
    if time.time()-metrics_file.stat().st_mtime <= 30:
     with metrics_file.open('r',encoding='utf-8-sig') as f: host_metrics=json.load(f)
     if isinstance(host_metrics,dict):
      result['host_metrics']=host_metrics
   except (OSError,ValueError,UnicodeError,json.JSONDecodeError):
    pass
   return self.send_json(result)
  if path=='/api/sessions':
   with sqlite3.connect(DB) as db:
    db.execute('PRAGMA busy_timeout=5000')
    rows=db.execute("""SELECT session, COUNT(*), MAX(created),
       (SELECT substr(m2.content,1,120) FROM messages m2
        WHERE m2.session=m.session ORDER BY m2.created DESC,m2.id DESC LIMIT 1)
       FROM messages m GROUP BY session ORDER BY MAX(created) DESC LIMIT 200""").fetchall()
   return self.send_json({'sessions':[{'id':sid,'messages':count,'updated':updated,'preview':preview or ''} for sid,count,updated,preview in rows]})
  if path=='/api/history':
   session=parse_qs(p.query).get('session',[''])[0][:100]
   with sqlite3.connect(DB) as db: rows=db.execute('SELECT role,content,created FROM messages WHERE session=? ORDER BY created,id LIMIT 150',(session,)).fetchall()
   return self.send_json({'messages':[{'role':r,'content':c,'created':t} for r,c,t in rows]})
  return super().do_GET()
 def do_POST(self):
  try: body=self.body()
  except Exception as e: return self.send_json({'error':str(e)},400)
  if self.path == '/api/needle/command':
   command = body.get('command', '')
   if not isinstance(command, str) or not command.strip():
    return self.send_json({'error': 'Command required'}, 400)
   try:
    result = request_needle(command[:2000])
    return self.send_json(result)
   except Exception as e:
    return self.send_json({'error': f'Needle unavailable: {e}'}, 502)
  if self.path=='/api/history/clear':
   session=str(body.get('session',''))[:100]
   with sqlite3.connect(DB) as db: db.execute('DELETE FROM messages WHERE session=?',(session,))
   return self.send_json({'ok':True})
  if self.path!='/api/chat': return self.send_json({'error':'Not found'},404)
  prompt=str(body.get('message','')).strip()[:12000]; model=str(body.get('model','')).strip()[:200]; session=str(body.get('session','default'))[:100]
  if not prompt or not model:return self.send_json({'error':'Message and model required'},400)
  with sqlite3.connect(DB) as db:
   history=db.execute('SELECT role,content FROM messages WHERE session=? ORDER BY created DESC,id DESC LIMIT 18',(session,)).fetchall()
   db.execute('INSERT INTO messages VALUES (?,?,?,?,?)',(str(uuid.uuid4()),session,'user',prompt,int(time.time()*1000)))
  messages=[{'role':'system','content':'You are WOPR, a fictional strategic computer inspired by retro 1980s terminals. You are helpful and clear. Treat any war scenarios as fictional simulations; avoid presenting simulations as real events.'}]
  messages += [{'role':r,'content':c} for r,c in reversed(history)]
  messages.append({'role':'user','content':prompt})
  if is_needle_command(prompt):
   command = prompt.strip()[8:].strip()
   result = {}
   try:
    result = request_needle(command)
    reply = "NEEDLE 3 - " + ("COMMAND PROCESSED" if result.get("success") else "COMMAND FAILED") + "\n" + json.dumps(result.get("results", []), ensure_ascii=False, indent=2)
   except Exception as e:
    reply = "NEEDLE 3 - CONNECTION ERROR\n" + str(e)
   self.send_response(200)
   self.send_header("Content-Type", "text/event-stream; charset=utf-8")
   self.send_header("Cache-Control", "no-cache")
   self.end_headers()
   try:
    if result.get("success") and isinstance(result.get("results"), list):
     self.wfile.write(("data: " + json.dumps({"needle_actions": result["results"]}) + "\n\n").encode("utf-8"))
    self.wfile.write(("data: " + json.dumps({"token": reply}) + "\n\n").encode("utf-8"))
    self.wfile.write(("data: " + json.dumps({"done": True, "done_reason": "stop"}) + "\n\n").encode("utf-8"))
    self.wfile.flush()
   except (BrokenPipeError, ConnectionResetError):
    pass
   with sqlite3.connect(DB) as db:
    db.execute("INSERT INTO messages VALUES (?,?,?,?,?)", (str(uuid.uuid4()), session, "assistant", reply, int(time.time()*1000)))
   return
  # Only permit supported Ollama generation parameters and clamp their ranges.
  limits={'temperature':(0.0,2.0),'top_p':(0.01,1.0),'top_k':(1,200),
          'repeat_penalty':(0.5,2.0),'num_ctx':(512,32768),'num_predict':(64,8192)}
  opts={}
  supplied=body.get('options',{})
  if isinstance(supplied,dict):
   for key,(low,high) in limits.items():
    if key not in supplied:continue
    try:
     value=float(supplied[key])
     if not (low<=value<=high):continue
     opts[key]=int(value) if key in ('top_k','num_ctx','num_predict') else value
    except (ValueError,TypeError,OverflowError):pass
  try: upstream=request_ollama('/api/chat',{'model':model,'messages':messages,'stream':True,'options':opts},timeout=180)
  except Exception as e:return self.send_json({'error':f'Ollama unavailable: {e}'},502)
  self.send_response(200); self.send_header('Content-Type','text/event-stream; charset=utf-8'); self.send_header('Cache-Control','no-cache'); self.send_header('X-Accel-Buffering','no'); self.end_headers()
  answer=[]
  done_reason=None
  completed=False
  try:
   with upstream:
    for line in upstream:
     if not line.strip():continue
     try: chunk=json.loads(line); token=chunk.get('message',{}).get('content','')
     except Exception:continue
     if token:
      answer.append(token); self.wfile.write(('data: '+json.dumps({'token':token})+'\n\n').encode()); self.wfile.flush()
     if chunk.get('done'):
      completed=True
      done_reason=chunk.get('done_reason')
      stats={k:chunk.get(k,0) for k in ('prompt_eval_count','eval_count','prompt_eval_duration','eval_duration','total_duration')}
      self.wfile.write(('data: '+json.dumps({'stats':stats,'done_reason':done_reason})+'\n\n').encode());self.wfile.flush()
      break
   if completed:
    self.wfile.write(('data: '+json.dumps({'done':True,'done_reason':done_reason})+'\n\n').encode());self.wfile.flush()
   else:
    self.wfile.write(('data: '+json.dumps({'error':'Ollama stream ended without completion','done_reason':'incomplete'})+'\n\n').encode());self.wfile.flush()
  except (BrokenPipeError,ConnectionResetError):pass
  except Exception as e:
   try:self.wfile.write(('data: '+json.dumps({'error':str(e)})+'\n\n').encode());self.wfile.flush()
   except OSError:pass
  finally:
   if answer:
    with sqlite3.connect(DB) as db:db.execute('INSERT INTO messages VALUES (?,?,?,?,?)',(str(uuid.uuid4()),session,'assistant',''.join(answer),int(time.time()*1000)))

if __name__=='__main__':
 print('WOPR 1.3.1 listening on 0.0.0.0:8000, Ollama='+OLLAMA,flush=True)
 ThreadingHTTPServer(('0.0.0.0',8000),Handler).serve_forever()

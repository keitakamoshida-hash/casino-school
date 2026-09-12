import http from 'node:http';
import {readFile} from 'node:fs/promises';
const files={'/':'index.html','/app.js':'app.js','/engine.js':'engine.js','/style.css':'style.css'};
http.createServer(async(req,res)=>{const f=files[req.url?.split('?')[0]];if(!f){res.writeHead(404);return res.end();}try{const body=await readFile(new URL(f,import.meta.url));res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(body);}catch{res.writeHead(500);res.end();}}).listen(4173,'127.0.0.1',()=>console.log('Casino School: http://localhost:4173'));

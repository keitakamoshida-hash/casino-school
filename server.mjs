import http from 'node:http';
import {readFile} from 'node:fs/promises';
const files={'/':'index.html','/app.js':'app.js','/engine.js':'engine.js','/roulette.js':'roulette.js','/experience.js':'experience.js','/style.css':'style.css','/manifest.webmanifest':'manifest.webmanifest','/sw.js':'sw.js','/icon.svg':'icon.svg'};
const types={'.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{const f=files[req.url?.split('?')[0]];if(!f){res.writeHead(404);return res.end();}try{const body=await readFile(new URL(f,import.meta.url));res.setHeader('Content-Type',types[Object.keys(types).find(ext=>f.endsWith(ext))]||'text/html; charset=utf-8');res.end(body);}catch{res.writeHead(500);res.end();}}).listen(4173,'127.0.0.1',()=>console.log('Casino School: http://localhost:4173'));

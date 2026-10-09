import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { GAMES } from '../src/game/catalog';

const manifest=JSON.parse(readFileSync('assets/prompts/covers-manifest.json','utf8')) as {covers:Array<{id:string;prompt:string;tool:string;source:string;runtime:string;focalPosition:string}>};
const hashes=new Set<string>();
let bytes=0;
for(const game of GAMES){
 const entry=manifest.covers.find(item=>item.id===game.id);
 if(!entry||!entry.prompt||entry.tool!=='image_gen.imagegen')throw new Error(`Missing generation record: ${game.id}`);
 const source=readFileSync(entry.source);
 const runtime=readFileSync(`public${game.cover}`);
 if(!source.equals(runtime))throw new Error(`Runtime differs from preserved original: ${game.id}`);
 if(runtime.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error(`Not a PNG: ${game.id}`);
 const width=runtime.readUInt32BE(16),height=runtime.readUInt32BE(20);
 if(width*3!==height*2||width<512)throw new Error(`Invalid portrait dimensions ${width}x${height}: ${game.id}`);
 const hash=createHash('sha256').update(runtime).digest('hex');
 if(hashes.has(hash))throw new Error(`Duplicate generated cover: ${game.id}`);
 if(game.focalPoint!==entry.focalPosition)throw new Error(`Crop focus mismatch: ${game.id}`);
 hashes.add(hash);bytes+=runtime.length;
}
console.log(`PASS: ${GAMES.length} independent covers, original bytes preserved, valid 2:3 PNG, matching crop focus. Total ${(bytes/1024/1024).toFixed(1)} MiB.`);

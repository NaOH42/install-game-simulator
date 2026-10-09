import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, closeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const url='http://127.0.0.1:5173';
const ready=async()=>{try{const response=await fetch(url,{signal:AbortSignal.timeout(600)});return response.ok&&(await response.text()).includes('装游戏模拟器');}catch{return false;}};
if(!await ready()){
 const entry=path.join(root,'node_modules','vite','bin','vite.js');
 if(!existsSync(entry)){console.error('缺少项目依赖，请先运行 pnpm install。');process.exit(1);}
 mkdirSync(path.join(root,'artifacts'),{recursive:true});
 const log=openSync(path.join(root,'artifacts','preview-server.log'),'a');
 const mode=existsSync(path.join(root,'dist','index.html'))?['preview']:[];
 const child=spawn(process.execPath,[entry,...mode,'--host','127.0.0.1','--port','5173','--strictPort'],{cwd:root,detached:true,windowsHide:true,stdio:['ignore',log,log]});
 child.unref();closeSync(log);
 let available=false;
 for(let attempt=0;attempt<30;attempt++){if(await ready()){available=true;break;}await new Promise(resolve=>setTimeout(resolve,300));}
 if(!available){console.error('未能启动预览，请查看 artifacts/preview-server.log。');process.exit(1);}
}
if(process.platform==='win32'&&!process.argv.includes('--no-open')){
 const opener=spawn('cmd.exe',['/d','/c','start','',url],{windowsHide:true,stdio:'ignore'});opener.unref();
}
console.log(`装游戏模拟器已就绪：${url}`);

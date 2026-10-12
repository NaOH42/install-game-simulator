import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isToyHost, loginToyIdentity, prepareToyIdentity, readToyIdentity, saveToyCardImage, type ToyIdentityResult } from '../../platform/toyIdentity';
import { achievementCaption, type AchievementSnapshot } from './model';
import { renderAchievementCard } from './renderCard';
import './achievement-card.css';

type RenderedCard = Awaited<ReturnType<typeof renderAchievementCard>>;

export default function AchievementCardDialog({ snapshot, onClose, onRefresh }: {
  snapshot: AchievementSnapshot; onClose: () => void; onRefresh: () => void;
}) {
  const [identity, setIdentity] = useState<ToyIdentityResult>({ status:'guest',user:null });
  const [identityLoading, setIdentityLoading] = useState(true);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkPreparing, setSdkPreparing] = useState(true);
  const [includeIdentity, setIncludeIdentity] = useState(true);
  const [card, setCard] = useState<RenderedCard | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const mounted = useRef(true);
  const user = includeIdentity ? identity.user : null;
  const caption = achievementCaption(snapshot,user);
  const nativeSharing = !!navigator.share && !!navigator.canShare;

  useEffect(() => {
    mounted.current = true;
    const previous = document.activeElement as HTMLElement | null;
    const desktop = document.querySelector<HTMLElement>('main.desktop');
    const wasInert = desktop?.inert;
    if (desktop) desktop.inert = true;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if(event.key==='Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeRef.current(); }
      if(event.key!=='Tab') return;
      const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea,a[href]') || [])].filter(element=>element.getClientRects().length);
      if(!focusable.length) return;
      const first=focusable[0],last=focusable.at(-1)!;
      if(event.shiftKey && (document.activeElement===first||!dialog.current?.contains(document.activeElement))) {event.preventDefault();last.focus();}
      else if(!event.shiftKey && (document.activeElement===last||!dialog.current?.contains(document.activeElement))) {event.preventDefault();first.focus();}
    };
    window.addEventListener('keydown',keydown,true);
    return () => {
      mounted.current=false;
      if(desktop) desktop.inert=wasInert||false;
      window.removeEventListener('keydown',keydown,true);
      if(previous?.isConnected) previous.focus();
    };
  },[]);

  useEffect(() => {
    let active=true;
    void prepareToyIdentity().then(ready=>{if(active)setSdkReady(ready);}).catch(()=>{}).finally(()=>{if(active)setSdkPreparing(false);});
    void readToyIdentity().then(result=>{if(active)setIdentity(result);}).catch(()=>{
      if(active)setIdentity({status:'unavailable',user:null,message:'暂时没能读取 B站身份，仍可保存游客成果卡。'});
    }).finally(()=>{if(active)setIdentityLoading(false);});
    return ()=>{active=false;};
  },[]);

  useEffect(() => {
    if(identityLoading)return;
    let active=true;
    setBusy(true);setCard(null);setError('');setMessage('');
    void renderAchievementCard(snapshot,user).then(result=>{if(active)setCard(result);}).catch(()=>{
      if(active)setError('这次冲印没有完成，请重试。你的游戏进度不受影响。');
    }).finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[snapshot,user,identityLoading,retry]);

  async function login() {
    if(!sdkReady){
      setSdkPreparing(true);
      try {const ready=await prepareToyIdentity();if(mounted.current){setSdkReady(ready);setMessage(ready?'B站连接已就绪，请点击授权署名。':'B站连接暂不可用，可以先保存游客成果卡。');}}
      finally {if(mounted.current)setSdkPreparing(false);}
      return;
    }
    setIdentityLoading(true);setMessage('');
    try { const result=await loginToyIdentity(); if(mounted.current){setIdentity(result);setIncludeIdentity(true);} }
    catch {if(mounted.current)setMessage('授权未完成，你仍可以使用游客成果卡。');}
    finally {if(mounted.current)setIdentityLoading(false);}
  }

  async function saveImage() {
    if(!card||busy||identityLoading||saving)return;
    setSaving(true);
    const savedToAlbum = await saveToyCardImage(card.dataUrl);
    if(!mounted.current)return;
    setSaving(false);
    if(savedToAlbum){setMessage('成果卡已保存到相册。');return;}
    const url=URL.createObjectURL(card.blob);
    const link=document.createElement('a');
    link.href=url;link.download=`我的青春电脑-${snapshot.capturedAt.replace(/\D/g,'')}.png`;
    document.body.appendChild(link);link.click();link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),30000);
    setMessage('已请求保存图片；如果没有出现下载，可长按预览图保存。');
  }

  async function shareImage() {
    if(!card||busy||identityLoading)return;
    const file=new File([card.blob],'我的青春电脑.png',{type:'image/png'});
    if(!navigator.canShare?.({files:[file]})){setMessage('当前浏览器不支持直接分享图片，请先保存成果卡。');return;}
    setSharing(true);
    try {await navigator.share({files:[file],title:'我的青春电脑 · 装游戏模拟器',text:caption});}
    catch (cause) {if(mounted.current&&(!(cause instanceof DOMException)||cause.name!=='AbortError'))setMessage('没有完成分享，可以保存图片后手动发送。');}
    finally {if(mounted.current)setSharing(false);}
  }

  async function copyCaption() {
    try {await navigator.clipboard.writeText(caption);if(mounted.current)setMessage('分享文案已复制。');}
    catch {if(mounted.current)setMessage('浏览器没有允许复制，请在下方选中文字复制。');}
  }

  return createPortal(<div className="achievement-card-backdrop" onPointerDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <div className="achievement-card-dialog" role="dialog" aria-modal="true" aria-labelledby="achievement-card-title" ref={dialog}>
      <header className="achievement-card-titlebar"><span aria-hidden="true">▣</span><h2 id="achievement-card-title">我的青春电脑 · 装机成果卡</h2><button type="button" onClick={onClose} aria-label="关闭成果卡">×</button></header>
      <div className="achievement-card-body">
        <div className="achievement-card-preview" aria-busy={busy||identityLoading}>
          {identityLoading||busy ? <div className="achievement-card-loading" role="status"><span aria-hidden="true">▧</span><strong>{identityLoading?'正在准备你的署名…':'正在冲印你的桌面…'}</strong><p>把这些年，装进一张图。</p></div> : card ? <img src={card.dataUrl} width={card.width} height={card.height} alt={`我的青春电脑成果卡：${user?user.name:'游客'}，已收藏 ${snapshot.collected.length} 款游戏，含桌面与当前硬件型号`}/> : <div className="achievement-card-loading" role="alert"><strong>{error}</strong><button className="xp-button" onClick={()=>setRetry(value=>value+1)}>重新生成</button></div>}
        </div>
        <aside className="achievement-card-options">
          <div className="achievement-card-intro"><span>YOUR OLD PC, YOUR STORY</span><h3>这台电脑，装着我的青春。</h3><p>桌面留影、收藏光盘和硬件型号，一起留下来。</p></div>
          <section className="achievement-card-identity"><h4>卡片署名</h4>{identity.user ? <><strong>{identity.user.name}</strong><small>B站玩家 · 已授权署名</small><label><input type="checkbox" checked={includeIdentity} onChange={event=>{setBusy(true);setCard(null);setIncludeIdentity(event.target.checked);}}/>展示 B站头像与昵称</label></> : <><strong>装机爱好者 · 游客</strong><p>{identityLoading?'正在读取已授权的署名…':identity.message || (isToyHost()?'点击授权，把 B站头像和昵称放在卡片上。':'在 B站 TOY 内打开，可使用你的 B站身份署名。')}</p>{isToyHost()&&<button className="xp-button" disabled={identityLoading||sdkPreparing} onClick={()=>void login()}>{sdkPreparing?'正在连接 B站…':sdkReady?'使用我的 B站身份':'重试 B站连接'}</button>}</>}</section>
          <p className="achievement-card-snapshot-note">记录打开卡片这一刻的收藏与配置。{snapshot.desktop.compact?'手机端将桌面图标整理为全景留影。':''}</p>
          <button type="button" className="achievement-card-refresh" disabled={busy||identityLoading} onClick={()=>{setBusy(true);setCard(null);onRefresh();}}>↻ 更新留影</button>
          <label className="achievement-card-caption">一起分享这句话<textarea readOnly value={caption} rows={4}/></label>
          <button type="button" className="xp-button" onClick={()=>void copyCaption()}>复制分享文案</button>
          {card?.warnings.length ? <p className="achievement-card-warning" role="status">{card.warnings.join(' ')}</p>:null}
        </aside>
      </div>
      <footer className="achievement-card-footer"><p role="status">{message||'手机也可以长按预览图保存。'}</p><div>{nativeSharing&&<button type="button" className="xp-button" disabled={!card||busy||identityLoading||sharing||saving} onClick={()=>void shareImage()}>分享图片</button>}<button type="button" className="xp-button primary" disabled={!card||busy||identityLoading||saving} onClick={()=>void saveImage()}>{saving?'正在保存…':'保存成果卡'}</button></div></footer>
    </div>
  </div>,document.body);
}

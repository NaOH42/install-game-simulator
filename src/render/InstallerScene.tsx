import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Genre } from '../game/types';

type Props = { genre: Genre; color: string; progress: number; active: boolean; reducedMotion: boolean };
type View = { canvas: HTMLCanvasElement; scene: THREE.Scene; camera: THREE.PerspectiveCamera; animate:(t:number)=>void; active:()=>boolean; reduced:()=>boolean; dirty:boolean };
const views = new Set<View>();
let renderer: THREE.WebGLRenderer | null = null;
let frame = 0;
let previousFrame = 0;
function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  return renderer;
}
function renderViews(time:number) {
  frame = requestAnimationFrame(renderViews);
  if (document.hidden || time - previousFrame < 32) return;
  previousFrame = time;
  for (const view of views) {
    if (!view.active()) continue;
    const rect = view.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > innerHeight) continue;
    const width = Math.min(1280, Math.round(rect.width * Math.min(devicePixelRatio, 1.5)));
    const height = Math.min(720, Math.round(rect.height * Math.min(devicePixelRatio, 1.5)));
    const resized = view.canvas.width !== width || view.canvas.height !== height;
    if (view.reduced() && !view.dirty && !resized) continue;
    if (resized) { view.canvas.width = width; view.canvas.height = height; }
    const r = getRenderer();
    r.setSize(width, height, false);
    view.camera.aspect = width / height;
    view.camera.updateProjectionMatrix();
    view.animate(view.reduced() ? 0 : time / 1000);
    r.render(view.scene, view.camera);
    const context = view.canvas.getContext('2d');
    context?.clearRect(0, 0, width, height);
    context?.drawImage(r.domElement, 0, 0);
    view.dirty = false;
  }
}
function material(color:THREE.ColorRepresentation, emissive = false) {
  return new THREE.MeshStandardMaterial({ color, roughness: .65, metalness: .25, emissive: emissive ? color : 0, emissiveIntensity: emissive ? .65 : 0 });
}
function mesh(geometry:THREE.BufferGeometry, color:THREE.ColorRepresentation, parent:THREE.Object3D, x=0,y=0,z=0) {
  const result = new THREE.Mesh(geometry, material(color)); result.position.set(x,y,z); parent.add(result); return result;
}
function createScene(genre:Genre, color:string) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 2, .1, 100);
  camera.position.set(7,5,10); camera.lookAt(0,0,0);
  scene.add(new THREE.AmbientLight(0xffffff, 2.2));
  const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(3,8,5); scene.add(light);
  const fill = new THREE.PointLight(color, 25); fill.position.set(-4,2,3); scene.add(fill);
  const group = new THREE.Group(); scene.add(group);
  const animateParts:Array<(t:number)=>void> = [];
  if (genre === 'strategy') {
    const base = mesh(new THREE.CylinderGeometry(3.15,3.4,.22,48), '#203d31',group,0,-1.1,0);
    base.rotation.y = .3;
    const grid = new THREE.GridHelper(6,12,0x6feb97,0x315846); grid.position.y=-.97; group.add(grid);
    for(let i=1;i<=3;i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(i*.8,.014,6,64),new THREE.MeshBasicMaterial({color:0x75f39a,transparent:true,opacity:.5}));
      ring.rotation.x=Math.PI/2;ring.position.y=-.92;group.add(ring);
    }
    const radar = new THREE.Group(); radar.position.y=-.88; group.add(radar);
    const beam = mesh(new THREE.BoxGeometry(3,.035,.045),'#b5ff9b',radar,1.5,0,0);
    beam.material.emissive.set(0xb5ff9b); beam.material.emissiveIntensity=.8;
    animateParts.push(t=>radar.rotation.y=-t*.7);
    for(let i=0;i<6;i++) {
      const tank = new THREE.Group(); tank.position.set(Math.sin(i*2.2)*2,-.7,Math.cos(i*2.2)*2);tank.rotation.y=i;group.add(tank);
      mesh(new THREE.BoxGeometry(.52,.23,.75),'#88a172',tank);
      mesh(new THREE.BoxGeometry(.3,.2,.35),'#bbc795',tank,0,.19,0);
      mesh(new THREE.BoxGeometry(.07,.07,.6),'#d0d8b2',tank,0,.23,.34);
    }
    mesh(new THREE.BoxGeometry(.65,1.3,.65),'#80958b',group,0,-.3,0);
    mesh(new THREE.ConeGeometry(.55,.5,4),'#d4e6be',group,0,.6,0);
  } else if (genre === 'wuxia') {
    camera.position.set(7,4,10); camera.lookAt(0,.2,0);
    for(let i=0;i<5;i++) {
      const island = new THREE.Group(); island.position.set(Math.sin(i*1.7)*2.2,-.7,Math.cos(i*1.7)*1.5);group.add(island);
      const rock = mesh(new THREE.ConeGeometry(.65,1.5,5),'#567c81',island);rock.rotation.z=Math.PI;
      mesh(new THREE.CylinderGeometry(.7,.55,.2,6),'#7ca58d',island,0,.7,0);
      mesh(new THREE.ConeGeometry(.45,1.1,5),'#396c5c',island,.15,1.25,0);
      animateParts.push(t=>island.position.y=-.7+Math.sin(t*.8+i)*.13);
    }
    const sword = new THREE.Group(); sword.rotation.z=-.22; group.add(sword);
    mesh(new THREE.BoxGeometry(.17,2.4,.1),'#e8fff3',sword,0,1,0);
    mesh(new THREE.ConeGeometry(.13,.5,4),'#e8fff3',sword,0,2.45,0);
    mesh(new THREE.BoxGeometry(.7,.12,.18),'#f7d584',sword,0,-.2,0);
    mesh(new THREE.CylinderGeometry(.07,.08,.65,8),'#603e36',sword,0,-.57,0);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.6,.025,8,96), new THREE.MeshBasicMaterial({color:0xf4d89b}));halo.position.y=.65;group.add(halo);
    animateParts.push(t=>{sword.rotation.y=t*.25;halo.rotation.z=t*.12;});
  } else if (genre === 'racing') {
    camera.position.set(6,5.5,8);camera.lookAt(0,-.1,0);
    mesh(new THREE.BoxGeometry(4,.14,11),'#283944',group,0,-.8,0);
    for(const x of [-1.95,1.95]) mesh(new THREE.BoxGeometry(.06,.05,11),'#eeac52',group,x,-.7,0);
    for(let i=0;i<12;i++) {
      const line=mesh(new THREE.BoxGeometry(.05,.03,.48),'#edf0d3',group,0,-.7,i-5.5);
      animateParts.push(t=>line.position.z=((i+t*4)%12)-6);
    }
    const car = new THREE.Group(); car.position.set(.85,-.4,0);group.add(car);
    mesh(new THREE.BoxGeometry(1.05,.34,1.95),'#ec8039',car);
    mesh(new THREE.BoxGeometry(.82,.37,.9),'#202f44',car,0,.34,-.13);
    mesh(new THREE.BoxGeometry(1.18,.07,.18),'#eab376',car,0,.28,-.86);
    for(const x of [-.55,.55]) for(const z of [-.6,.6]) { const wheel=mesh(new THREE.CylinderGeometry(.22,.22,.14,12),'#172533',car,x,-.12,z);wheel.rotation.z=Math.PI/2; }
    for(const x of [-.34,.34]) mesh(new THREE.BoxGeometry(.22,.13,.04),'#fff4bc',car,x,.04,.99);
    animateParts.push(t=>{car.position.x=.8+Math.sin(t*.6)*.12;car.position.y=-.4+Math.sin(t*8)*.015;});
  } else {
    camera.position.set(7,3.5,10);camera.lookAt(0,0,0);
    const planet=mesh(new THREE.IcosahedronGeometry(1.4,2),'#496d9a',group);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.25,.13,8,100),new THREE.MeshStandardMaterial({color:0x91dfec,emissive:0x1b6177,emissiveIntensity:.7}));
    ring.rotation.x=1.12;ring.rotation.y=.35;group.add(ring);
    const orbit=new THREE.Group();group.add(orbit);
    const ship=mesh(new THREE.ConeGeometry(.22,.85,4),'#e5e9d9',orbit,3,0,0);ship.rotation.z=-Math.PI/2;
    mesh(new THREE.BoxGeometry(.55,.08,.8),'#8094b4',ship,0,-.16,0);
    animateParts.push(t=>{planet.rotation.y=t*.13;orbit.rotation.y=t*.3;orbit.rotation.z=.35;});
  }
  const stars = new Float32Array(100*3);
  for(let i=0;i<100;i++){ stars[i*3]=Math.sin(i*127.1)*6;stars[i*3+1]=Math.sin(i*311.7)*3;stars[i*3+2]=Math.cos(i*73.3)*5; }
  const particles = new THREE.BufferGeometry();particles.setAttribute('position',new THREE.BufferAttribute(stars,3));
  const dust = new THREE.Points(particles,new THREE.PointsMaterial({color:genre==='wuxia'?0xffdb9c:0xb9eaff,size:.035,transparent:true,opacity:.7}));scene.add(dust);
  return {scene,camera,animate:(t:number)=>{group.rotation.y=genre==='racing'?-.12:Math.sin(t*.17)*.13;dust.rotation.y=t*.025;animateParts.forEach(fn=>fn(t));}};
}
export default function InstallerScene(props:Props) {
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const propsRef=useRef(props);propsRef.current=props;
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    try {getRenderer();}catch{setFailed(true);return;}
    const built=createScene(props.genre,props.color);
    const view:View={canvas,...built,active:()=>propsRef.current.active,reduced:()=>propsRef.current.reducedMotion,dirty:true};
    views.add(view);if(!frame)frame=requestAnimationFrame(renderViews);
    return ()=>{
      views.delete(view);
      built.scene.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Points||object instanceof THREE.LineSegments){object.geometry.dispose();const mats=Array.isArray(object.material)?object.material:[object.material];mats.forEach(m=>m.dispose());}});
      if(!views.size){cancelAnimationFrame(frame);frame=0;renderer?.dispose();renderer=null;}
    };
  },[props.genre,props.color]);
  return failed ? <div style={{padding:24,color:'#def'}}>3D 动画暂不可用，安装继续进行。</div> : <canvas ref={canvasRef} aria-label={`${props.genre} 主题安装动画`} role="img" style={{display:'block',width:'100%',height:'100%',minHeight:180}}/>;
}

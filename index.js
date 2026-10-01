import { createRuntime } from './runtime.js';
import { createIndexer } from './indexing.js';
import { mountUI } from './ui.js';
import { listen } from './compatibility.js';
import { createWorldManager } from './worlds.js';
const getContext=()=>globalThis.SillyTavern?.getContext?.()??{};
let ui, initialized=false, offs=[];
const update=()=>ui?.render();
const runtime=createRuntime({getContext,onUpdate:update});
const indexer=createIndexer({getContext:()=>runtime.cardContext(),onUpdate:update});
const worlds=createWorldManager({getContext,onUpdate:update});
globalThis.characterJudgmentInterceptor=(...args)=>{
    if(indexer.active){indexer.cancel();}
    if(worlds.active){worlds.cancel();}
    return runtime.intercept(...args.slice(0,4));
};
export const getDiagnostics=()=>runtime.diagnostics();
export function dispose(){indexer.cancel();worlds.cancel();runtime.dispose();for(const off of offs)off();offs=[];initialized=false;}
function init(){
    runtime.init();if(initialized)return;initialized=true;
    for(const name of ['GENERATION_STOPPED','CHAT_CHANGED'])offs.push(listen(getContext(),name,()=>{indexer.cancel();worlds.cancel();update();}));
    offs.push(listen(getContext(),'APP_READY',()=>{runtime.init();update();}));
    ui??=mountUI({getContext,runtime,indexer,worlds});update();
}
if(typeof document!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
}

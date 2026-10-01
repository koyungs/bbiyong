import { digest, identity, stateFor } from './state.js';
import { createTransport } from './transport.js';
import { normalizeSyntax, enumValue } from './syntax.js';
import { worldClassificationPrompt } from './prompts.js';
export const WORLD_KEY='character_judgment_worlds_v1';
export const worldKey=(world,uid)=>JSON.stringify([world,String(uid)]);
export function worldRegistry(c) {
    if(!c.extensionSettings)throw Error('WI registry용 extension settings API가 없습니다.');
    const r=c.extensionSettings[WORLD_KEY]??={schemaVersion:1,nextW:1,entries:{}};
    if(r.schemaVersion!==1)throw Error('지원하지 않는 WI registry schema');
    return r;
}
const save=async c=>{if(typeof c.saveSettingsDebounced!=='function')throw Error('WI registry 저장 API가 없습니다.');await c.saveSettingsDebounced();};
const invalidate=c=>{try{stateFor(c).currentSnapshot=null;}catch{}};
function register(c,world,uid,fingerprint,label='') {
    const r=worldRegistry(c),key=worldKey(world,uid);
    let row=r.entries[key];
    if(!row)row=r.entries[key]={world,uid:String(uid),sourceId:'W'+String(r.nextW++).padStart(2,'0'),fingerprint,currentFingerprint:fingerprint,role:null,classificationMode:'AUTO',status:'unclassified'};
    row.label=label;row.currentFingerprint=fingerprint;
    row.status=row.fingerprint===fingerprint?(row.role?'fresh':'unclassified'):'stale';
    return row;
}
function accept(c,row,fingerprint,role,mode) {
    if(row.fingerprint!==fingerprint)row.sourceId='W'+String(worldRegistry(c).nextW++).padStart(2,'0');
    Object.assign(row,{fingerprint,currentFingerprint:fingerprint,role,classificationMode:mode,status:role?'fresh':'unclassified'});
}
export async function readWorld(c,world,{check=()=>{}}={}) {
    if(typeof c.loadWorldInfo!=='function')throw Error('native WI 읽기 API가 없습니다.');
    const data=await c.loadWorldInfo(world);check();
    if(!data?.entries||typeof data.entries!=='object')throw Error('WI entry 목록을 읽지 못했습니다.');
    const sources=await Promise.all(Object.entries(data.entries).map(async([key,e])=>({world,uid:String(e.uid??key),text:String(e.content??''),label:String(e.comment??''),fingerprint:await digest(String(e.content??''))})));
    check();
    for(const source of sources)source.metadata=register(c,world,source.uid,source.fingerprint,source.label);
    const keys=new Set(sources.map(s=>worldKey(world,s.uid)));
    for(const row of Object.values(worldRegistry(c).entries))if(row.world===world&&!keys.has(worldKey(world,row.uid)))row.status='missing';
    return sources;
}
export async function observeActivated(c,activated,check=()=>{}) {
    const books=new Map();
    for(const e of activated)if(typeof e?.world==='string'&&e.uid!=null&&!books.has(e.world))books.set(e.world,await readWorld(c,e.world,{check}));
    check();const result=[];
    for(const e of activated){
        const source=books.get(e?.world)?.find(x=>x.uid===String(e.uid));
        if(!source||typeof e.content!=='string')continue;
        const row=source.metadata;
        // Native activation entries are read only. Their content can already
        // contain substituted macros; raw fingerprints come from loadWorldInfo.
        result.push({sourceId:row.status==='stale'?null:row.sourceId,sourceType:'W',world:e.world,uid:String(e.uid),
            role:row.status==='fresh'?row.role:'WORLD',classificationMode:row.classificationMode,status:row.status,
            fingerprint:row.fingerprint,currentFingerprint:row.currentFingerprint,text:e.content,
            position:e.position,viewFingerprint:await digest(e.content)});
    }
    check();await save(c);return result;
}
export function worldSignature(c,rows) {
    const registry=worldRegistry(c);
    return JSON.stringify(rows.map(x=>{const r=registry.entries[worldKey(x.world,x.uid)];return r?[r.sourceId,r.fingerprint,r.currentFingerprint,r.role,r.classificationMode,r.status]:null;}));
}
export function parseWorldRoles(raw,sources) {
    const data=JSON.parse(normalizeSyntax(raw));
    if(data?.schemaVersion!==1||!Array.isArray(data.entries)||data.entries.length!==sources.length)throw Error('WI 분류 schema/count 오류');
    return sources.map(s=>{
        const matches=data.entries.filter(x=>x?.sourceId===s.metadata.sourceId);
        if(matches.length!==1||!['CHARACTER','WORLD'].includes(enumValue(matches[0].role)))throw Error('WI 분류 ID/role 오류');
        return enumValue(matches[0].role);
    });
}
export function createWorldManager({getContext,transportFactory=createTransport,onUpdate=()=>{}}) {
    let active=null;
    const cancel=()=>{active?.controller.abort();active=null;};
    async function list(world){const c=getContext(),rows=await readWorld(c,world);await save(c);onUpdate();return rows;}
    async function setRole(world,uid,value){
        const c=getContext(),rows=await readWorld(c,world),s=rows.find(x=>x.uid===String(uid));
        if(!s)throw Error('WI source가 삭제되었습니다.');
        if(!['CHARACTER','WORLD','AUTO'].includes(value))throw Error('WI role 오류');
        accept(c,s.metadata,s.fingerprint,value==='AUTO'?null:value,value==='AUTO'?'AUTO':'MANUAL');
        invalidate(c);await save(c);onUpdate();return s.metadata;
    }
    async function classify(world){
        cancel();const c=getContext(),chat=identity(c),connection=JSON.stringify(c.chatCompletionSettings),op={controller:new AbortController()};active=op;
        const check=()=>{if(active!==op||op.controller.signal.aborted||identity(getContext())!==chat||JSON.stringify(getContext().chatCompletionSettings)!==connection)throw Error('WI Auto 분류 취소/연결 변경');};
        let timer;
        try{
            const rows=await readWorld(c,world,{check});
            const selected=rows.filter(s=>s.metadata.classificationMode==='AUTO'&&s.metadata.status!=='fresh');
            if(!selected.length){await save(c);return{classified:0,calls:0};}
            const frozen=selected.map(s=>({...s,metadata:{...s.metadata}}));
            const cancellation=new Promise((_,reject)=>op.controller.signal.addEventListener('abort',()=>reject(Error('WI Auto 분류 취소/시간 초과')),{once:true}));
            timer=setTimeout(()=>op.controller.abort(),stateFor(c).settings.maintenanceTimeoutSeconds*1000);
            const raw=await Promise.race([transportFactory(c).request(worldClassificationPrompt(frozen),op.controller.signal,check),cancellation]);check();
            const roles=parseWorldRoles(raw,frozen),latest=await readWorld(c,world,{check});check();
            const changes=[];
            for(let i=0;i<frozen.length;i++){
                const old=frozen[i],now=latest.find(x=>x.uid===old.uid);
                if(!now||now.fingerprint!==old.fingerprint)throw Error('WI 분류 중 원문 변경: 결과 폐기');
                if(now.metadata.classificationMode==='MANUAL')continue;
                changes.push({now,role:roles[i]});
            }
            for(const {now,role}of changes)accept(c,now.metadata,now.fingerprint,role,'AUTO');
            if(changes.length)invalidate(c);await save(c);return{classified:changes.length,calls:1};
        }finally{clearTimeout(timer);if(active===op)active=null;onUpdate();}
    }
    return{list,setRole,classify,cancel,get active(){return Boolean(active);}};
}

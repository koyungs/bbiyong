import { stateFor, identity, messageFingerprint, persist, target } from './state.js';
import { synchronizeMessages, synchronizeCard } from './source-index.js';
import { createTransport } from './transport.js';
import { indexingPrompt } from './prompts.js';
import { normalizeSyntax, enumValue } from './syntax.js';

export function validateBindings(raw, sources) {
    const data = typeof raw === 'string' ? JSON.parse(normalizeSyntax(raw)) : raw;
    if (data?.schemaVersion !== 1 || !Array.isArray(data.messages) || data.messages.length !== sources.length) throw Error('Stage 1A M 개수/schemaVersion 오류');
    const used = new Set(), result = [];
    for (const source of sources) {
        const matches = data.messages.filter(m=>m.sourceId === source.sourceId);
        if (matches.length !== 1 || used.has(source.sourceId)) throw Error('Stage 1A M ID 누락/중복');
        used.add(source.sourceId);
        const spans = matches[0].spans;
        if (!Array.isArray(spans) || !spans.length || spans.length > Math.max(1,source.text.length)) throw Error('Stage 1A L span 개수 오류');
        let offset = 0;
        const parsed = spans.map((s,i)=>{
            if (typeof s.text !== 'string' || (!s.text.length && source.text.length) || typeof s.characterSubject !== 'string' || !s.characterSubject.trim()) throw Error('Stage 1A span 구조 오류');
            const subject=enumValue(s.characterSubject)==='NONE'?'NONE':s.characterSubject;
            const previous=i?(enumValue(spans[i-1].characterSubject)==='NONE'?'NONE':spans[i-1].characterSubject):null;
            if (i && previous.trim() === subject.trim()) throw Error('Stage 1A 같은 CHARACTER_SUBJECT의 연속 L 분할');
            const start = offset; offset += s.text.length;
            if (source.text.slice(start,offset) !== s.text) throw Error('Stage 1A 원문 변경/재정렬/M 경계 초과');
            return { sourceId:`L${source.sourceId.slice(1)}-${String(i+1).padStart(2,'0')}`, sourceType:'L', parentId:source.sourceId,
                sourceSpeaker:source.sourceSpeaker, characterSubject:subject, start, end:offset, role:'LOG' };
        });
        if (offset !== source.text.length) throw Error('Stage 1A 원문 누락');
        result.push({ sourceId:source.sourceId, spans:parsed });
    }
    return result;
}
export function createIndexer({ getContext, transportFactory = createTransport, onUpdate = ()=>{} }) {
    let active = null;
    const cancel = () => { active?.controller.abort(); active = null; };
    async function indexMessages({ staleOnly = false } = {}) {
        cancel(); const c = getContext(), chatId = identity(c), card = JSON.stringify(target(c));
        const op = { controller:new AbortController() }; active = op;
        const check = () => {
            if (active !== op || op.controller.signal.aborted || identity(getContext()) !== chatId || JSON.stringify(target(getContext())) !== card) throw Error('인덱싱이 취소되었거나 채팅/카드가 변경되었습니다.');
        };
        let timer;
        try {
            const rows = await synchronizeMessages(c), selected = rows.filter(x=>!staleOnly || ['stale','unindexed'].includes(x.entry.status));
            const sources = selected.map(({message,entry})=>({ sourceId:entry.sourceId, sourceSpeaker:String(message.name ?? ''), text:String(message.mes ?? '') }));
            const hashes = await Promise.all(selected.map(x=>messageFingerprint(x.message)));
            check(); if (!sources.length) return { indexed:0,calls:0 };
            const cards = await synchronizeCard(c);
            check();
            const request = transportFactory(c).request(indexingPrompt(sources,cards.map(x=>({...x.entry,text:x.text}))),op.controller.signal,check);
            const cancellation = new Promise((_,reject)=>op.controller.signal.addEventListener('abort',()=>reject(Error('인덱싱 취소/시간 초과')), {once:true}));
            timer = setTimeout(()=>op.controller.abort(),stateFor(c).settings.maintenanceTimeoutSeconds*1000);
            const raw = await Promise.race([request,cancellation]); check();
            const parsed = validateBindings(raw,sources);
            for(let i=0;i<selected.length;i++) {
                if (!getContext().chat.includes(selected[i].message) || await messageFingerprint(selected[i].message) !== hashes[i]) throw Error('인덱싱 중 원문 변경: 결과 전체를 폐기합니다.');
            }
            check();
            if (selected.some((x,i)=>x.entry.fingerprint!==hashes[i]||JSON.stringify(x.entry.spans)!==JSON.stringify(parsed[i].spans))) stateFor(c).currentSnapshot=null;
            for(let i=0;i<selected.length;i++) Object.assign(selected[i].entry,{spans:parsed[i].spans,indexed:true,status:'fresh',fingerprint:hashes[i],currentFingerprint:hashes[i],sourceSpeaker:sources[i].sourceSpeaker});
            await persist(c,{chat:true}); return { indexed:selected.length,calls:1 };
        } finally { clearTimeout(timer); if(active===op)active=null; onUpdate(); }
    }
    async function indexCard() {
        cancel();const c=getContext(),chatId=identity(c),card=JSON.stringify(target(c));
        const op={controller:new AbortController()};active=op;
        try {
            const rows=await synchronizeCard(c,true,{check:()=>{
                if(active!==op||op.controller.signal.aborted||identity(getContext())!==chatId||JSON.stringify(target(getContext()))!==card)throw Error('카드 인덱싱 중 채팅/카드가 변경되었습니다.');
            }});
            await persist(c);return {indexed:rows.length,calls:0};
        }finally{if(active===op)active=null;onUpdate();}
    }
    return { indexMessages,indexCard,cancel,get active(){return Boolean(active);} };
}

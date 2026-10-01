import { slot } from './prompt-order.js';
const attr=v=>String(v).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function textParts(messages) {
    const out=[];
    for(const message of messages){
        if(typeof message.content==='string')out.push({owner:message,key:'content',message,text:message.content});
        else if(Array.isArray(message.content))for(const part of message.content)if(part?.type==='text'&&typeof part.text==='string')out.push({owner:part,key:'text',message,text:part.text});
    }
    let offset=0;for(const p of out){p.offset=offset;offset+=p.text.length+1;}return out;
}
export function removeAnnotations(messages,tags=[]) {
    if(!tags.length)return;
    for(const p of textParts(messages)){let s=p.text;for(const tag of tags)s=s.split(tag).join('');p.owner[p.key]=s;}
}
export function annotateSources(messages,run,{tokenUsage,serviceSettings}) {
    const parts=textParts(messages),joined=parts.map(p=>p.text).join('\n'),ranges=[],tags=[];
    const point=key=>{const n=joined.indexOf(slot(key));if(n<0)throw Error('annotation wrapper 누락: '+key);return n;};
    const sheet=[point('sheetOpen'),point('sheetClose')],story=[point('storyOpen'),point('storyClose')];
    const owned=[...joined.matchAll(new RegExp(`<!--CJ_OWNED:${run.nonce}-->[\\s\\S]*?<!--/CJ_OWNED:${run.nonce}-->`,'g'))].map(m=>[m.index,m.index+m[0].length]);
    const overlaps=(a,b,c,d)=>a<d&&c<b;
    function locate(text,scope,kind) {
        if(!text)return null;
        const hits=[];
        for(const p of parts){
            let from=0;
            while(from<=p.text.length){
                const at=p.text.indexOf(text,from);if(at<0)break;from=at+Math.max(1,text.length);
                const a=p.offset+at,b=a+text.length;
                if(scope&&(a<scope[0]||b>scope[1]))continue;
                if(owned.some(([c,d])=>overlaps(a,b,c,d)))continue;
                // C paragraphs are matched as complete native paragraph text,
                // not as a letter/word substring in another source.
                if(kind==='C'&&((at>0&&!/[\r\n]/.test(p.text[at-1]))||(at+text.length<p.text.length&&!/[\r\n]/.test(p.text[at+text.length]))))continue;
                hits.push({p,at,a,b});
            }
        }
        if(hits.length>1)throw Error('native source가 중복되어 ID 위치를 확정할 수 없습니다: '+kind);
        if(!hits.length)return null; // Native context budget/disabled source may omit it.
        const hit=hits[0];
        if(ranges.some(r=>overlaps(hit.a,hit.b,r.a,r.b)))throw Error('native source annotation 범위 중첩: '+kind);
        return hit;
    }
    const makeTag=(name,attributes,close=false)=>{
        const tag=close?`</${name}><!--CJ_END:${run.nonce}-->`:`<!--CJ_BEGIN:${run.nonce}--><${name} cj_nonce="${attr(run.nonce)}"${Object.entries(attributes).map(([k,v])=>` ${k}="${attr(v)}"`).join('')}>`;
        tags.push(tag);return tag;
    };
    const wrap=(name,attributes,body)=>makeTag(name,attributes)+body+makeTag(name,{},true);
    const boundMessages=[],boundWorlds=[],visibleIds=new Set();
    for(const source of run.bindings.messages){
        const hit=locate(source.text,story,'M');if(!hit)continue;
        let body=source.text;
        if(!source.bindingRequired&&source.spans.length){
            let end=0;body=source.spans.map(span=>{
                if(span.parentId!==source.sourceId||span.start!==end||span.end<span.start||span.end>source.text.length)throw Error('저장된 L offset 구조 오류');
                end=span.end;visibleIds.add(span.sourceId);
                return wrap('L',{id:span.sourceId,character_subject:span.characterSubject},source.text.slice(span.start,span.end));
            }).join('');
            if(end!==source.text.length)throw Error('저장된 L coverage 오류');
        }
        const attributes={id:source.sourceId,role:'LOG',source_speaker:source.sourceSpeaker??'',view:source.view,binding:run.mode==='swipe'?'frozen':source.bindingRequired?'required':'fresh'};
        ranges.push({...hit,kind:'M',replacement:wrap('M',attributes,body)});boundMessages.push(source);visibleIds.add(source.sourceId);
    }
    for(const source of run.bindings.cards){
        const hit=locate(source.text,sheet,'C');
        if(!hit){
            const marker={description:'charDescription',personality:'charPersonality',scenario:'scenario'}[source.field];
            if(run.order.order.some(x=>x.identifier===marker&&x.enabled))throw Error('native Card 문단의 exact 위치를 확인할 수 없습니다: '+source.sourceId);
            continue;
        }
        ranges.push({...hit,kind:'C',replacement:wrap('C',{id:source.sourceId,role:'CHARACTER',field:source.field},source.text)});visibleIds.add(source.sourceId);
    }
    for(const source of run.bindings.worlds){
        const scope=[0,1].includes(source.position)?sheet:null;
        const hit=locate(source.text,scope,'W');if(!hit){
            const marker=source.position===0?'worldInfoBefore':source.position===1?'worldInfoAfter':null;
            if(source.text&&marker&&run.order.order.some(x=>x.identifier===marker&&x.enabled))throw Error('native WI 원문의 exact 위치를 확인할 수 없습니다: '+source.world+'/'+source.uid);
            continue;
        }
        const attributes={role:source.role,classification:source.status,world:source.world,uid:source.uid};
        if(source.sourceId){attributes.id=source.sourceId;visibleIds.add(source.sourceId);}
        // Stale W text stays native and visible, but never carries its old ID.
        ranges.push({...hit,kind:'W',replacement:wrap('W',attributes,source.text)});boundWorlds.push(source);
    }
    for(const p of parts)if(['user','assistant'].includes(p.message.role)&&p.offset>story[0]&&p.offset+p.text.length<story[1]&&p.text.trim()&&!ranges.some(r=>r.p===p&&(r.kind==='M'||r.kind==='W')))
        throw Error('native Chat History의 source identity를 확인할 수 없습니다.');
    const max=Number(serviceSettings?.openai_max_context)-Number(serviceSettings?.openai_max_tokens);
    // PROMPT_READY is after ST budgeting. Reserve a deliberately conservative
    // UTF-8 byte allowance rather than silently exceeding the native budget.
    const reserve=2*new TextEncoder().encode(tags.join('')).length+64;
    if(!Number.isFinite(max)||!Number.isFinite(tokenUsage)||max<=0||tokenUsage+reserve>max)throw Error('annotation 토큰 여유를 확인할 수 없습니다. 컨텍스트 예산을 늘리세요.');
    const edits=parts.map(p=>{
        let result=p.text;for(const r of ranges.filter(x=>x.p===p).sort((a,b)=>b.at-a.at))result=result.slice(0,r.at)+r.replacement+result.slice(r.at+r.b-r.a);
        return{p,result};
    });
    // All ranges and budget are checked before any prompt copy is changed.
    for(const {p,result}of edits)p.owner[p.key]=result;
    return{tags,messages:boundMessages,worlds:boundWorlds,visibleIds:[...visibleIds],reservedTokens:reserve};
}

import { VERSION, stateFor, persist } from './state.js';
import { sourceCounts } from './source-index.js';
import { validateOrder, readManager, createImport, ENTRY, entries } from './prompt-order.js';
import { worldRegistry } from './worlds.js';
export function mountUI({ getContext, runtime, indexer, worlds }) {
    let panel, busy=false, orderResult='검사 전', message='', worldRows=[], worldBook='',worldChat='';
    async function task(fn) { if(busy)return;busy=true;render();try{message=await fn()??'완료';}catch(e){message=e.message;}finally{busy=false;render();} }
    function render() {
        if(!panel) {
            const host=document.querySelector('#extensions_settings2, #extensions_settings');if(!host)return;
            panel=document.createElement('section');panel.id='cj-extension';
            panel.innerHTML=`<h3>Character Judgment <small>${VERSION}</small></h3>
<label><input id="cj-enabled" type="checkbox"> 이 채팅에서 활성화</label>
<p>구조 검수판 · Chat Completion · Normal 1 completion / Swipe 재선택</p>
<fieldset><legend>Source Index</legend><div class="cj-buttons"><button type="button" id="cj-index-chat">현재 채팅 인덱싱</button><button type="button" id="cj-index-card">캐릭터 카드 인덱싱</button><button type="button" id="cj-reindex">stale 재인덱싱</button><button type="button" id="cj-cancel">인덱싱 취소</button></div><p>M/L은 현재 채팅, C는 같은 캐릭터 카드의 모든 채팅에서 공유합니다. 카드 원문 수정 후에는 재인덱싱하세요.</p><p id="cj-counts"></p></fieldset>
<fieldset><legend>Prompt Order</legend><div class="cj-buttons"><button type="button" id="cj-order-check">검사</button><button type="button" id="cj-entries">7개 CJ entry 가져오기</button></div><p>가져오기는 기존 Engine 본문을 보존합니다. CJ · Engine은 Prompt Manager에서 직접 편집하세요.</p><button type="button" id="cj-engine-default">Engine 기본값으로 교체 (현재 본문 덮어쓰기)</button><pre id="cj-order-result"></pre></fieldset>
<fieldset><legend>Snapshot</legend><pre id="cj-snapshot"></pre></fieldset><p id="cj-status" role="status"></p>
<fieldset><legend>WI / Lorebook source role</legend><label>책 <select id="cj-world-book" aria-label="WI 책"></select></label><div class="cj-buttons"><button type="button" id="cj-world-load">목록 새로고침</button><button type="button" id="cj-world-auto">미분류 / stale Auto 분류</button></div><p>캐릭터 정보 / 세계관 정보 선택은 즉시 수동 저장합니다. 자동은 Auto 대상으로 전환하며, 분류 버튼을 눌렀을 때만 모델을 호출합니다. Manual은 Auto가 덮어쓰지 않습니다. Stale 원문은 다시 확인하세요.</p><div id="cj-world-rows"></div></fieldset>
<details><summary>구조 debug</summary><pre id="cj-debug"></pre></details>`;
            host.append(panel);
            panel.querySelector('#cj-enabled').addEventListener('change',event=>{const enabled=event.target.checked;return task(async()=>{const c=getContext();stateFor(c).settings.enabled=enabled;if(!enabled){runtime.cancel('disabled');indexer.cancel();}await persist(c);return '설정 저장';});});
            panel.querySelector('#cj-index-chat').addEventListener('click',()=>task(async()=>{runtime.cancel('manual-indexing');const r=await indexer.indexMessages();return `M/L ${r.indexed}개 저장 · 모델 요청 ${r.calls}회`;}));
            panel.querySelector('#cj-index-card').addEventListener('click',()=>task(async()=>{const r=await indexer.indexCard();return `C ${r.indexed}개 저장 · 모델 요청 0회`;}));
            panel.querySelector('#cj-reindex').addEventListener('click',()=>task(async()=>{runtime.cancel('manual-indexing');const r=await indexer.indexMessages({staleOnly:true});await indexer.indexCard();return `M ${r.indexed}개 재인덱싱`; }));
            panel.querySelector('#cj-cancel').addEventListener('click',()=>{indexer.cancel();worlds.cancel();message='maintenance 취소';render();});
            panel.querySelector('#cj-order-check').addEventListener('click',()=>task(async()=>{const r=validateOrder(readManager(await runtime.getManager()));orderResult=r.ok?'✓ 정상':r.errors.map(x=>'[ERROR] '+x.text).join('\n\n');return '순서 검사 완료';}));
            panel.querySelector('#cj-entries').addEventListener('click',()=>task(async()=>{const manager=await runtime.getManager();if(typeof manager?.import!=='function')throw Error('Prompt Manager import API를 확인할 수 없습니다.');manager.import(createImport(readManager(manager)));const r=validateOrder(readManager(manager));orderResult=r.ok?'✓ 정상':r.errors.map(x=>x.text).join('\n');return 'CJ entry 등록';}));
            panel.querySelector('#cj-engine-default').addEventListener('click',()=>task(async()=>{runtime.cancel('engine-default-replacement');const manager=await runtime.getManager();const data=createImport(readManager(manager));data.data.prompts=data.data.prompts.map(p=>p.identifier===ENTRY.run?entries().find(x=>x.identifier===ENTRY.run):p);manager.import(data);stateFor(getContext()).currentSnapshot=null;await persist(getContext());return 'Engine을 rc.4 이행 기본값으로 교체했습니다. 최종 의미 프롬프트는 사용자가 확정합니다.';}));
            const loadWorld=async()=>{worldBook=panel.querySelector('#cj-world-book').value;if(!worldBook)throw Error('WI 책을 선택하세요.');worldRows=await worlds.list(worldBook);};
            panel.querySelector('#cj-world-load').addEventListener('click',()=>task(async()=>{await loadWorld();return `WI ${worldRows.length}개 · native source 읽기`; }));
            panel.querySelector('#cj-world-book').addEventListener('change',()=>{worldRows=[];worldBook='';render();});
            panel.querySelector('#cj-world-auto').addEventListener('click',()=>task(async()=>{runtime.cancel('manual-world-classification');await loadWorld();const r=await worlds.classify(worldBook);await loadWorld();return `Auto ${r.classified}개 · 모델 요청 ${r.calls}회`; }));
        }
        let state;try{state=stateFor(getContext());}catch(e){panel.querySelector('#cj-status').textContent=e.message;return;}
        panel.querySelector('#cj-enabled').checked=state.settings.enabled;
        for(const id of ['cj-index-chat','cj-index-card','cj-reindex','cj-order-check','cj-entries','cj-engine-default','cj-enabled','cj-world-load','cj-world-auto','cj-world-book'])panel.querySelector('#'+id).disabled=busy;
        const c=getContext(),chat=String(c.chatId??c.getCurrentChatId?.());if(worldChat!==chat){worldChat=chat;worldRows=[];worldBook='';}
        const select=panel.querySelector('#cj-world-book'),names=c.getWorldInfoNames?.()??[];
        if(JSON.stringify([...select.options].map(x=>x.value))!==JSON.stringify(names)){
            const chosen=select.value;select.replaceChildren(...names.map(name=>{const o=document.createElement('option');o.value=name;o.textContent=name;return o;}));if(names.includes(chosen))select.value=chosen;
        }
        const rows=panel.querySelector('#cj-world-rows');rows.replaceChildren();
        for(const source of worldRows){
            const row=document.createElement('div');row.className='cj-world-row';const title=document.createElement('span');
            const e=source.metadata;title.textContent=`${e.sourceId} · ${source.uid} · ${source.label||'이름 없음'} · ${e.classificationMode} / ${e.status}`;
            const choice=document.createElement('select');choice.setAttribute('aria-label',`${worldBook} / ${source.uid} 분류`);
            for(const [value,label]of [['CHARACTER','캐릭터 정보'],['WORLD','세계관 정보'],['AUTO','자동']]){const o=document.createElement('option');o.value=value;o.textContent=label;choice.append(o);}
            choice.value=e.classificationMode==='MANUAL'?e.role:'AUTO';choice.disabled=busy;
            const book=worldBook,uid=source.uid;choice.addEventListener('change',()=>{const value=choice.value;return task(async()=>{runtime.cancel('manual-world-role');await worlds.setRole(book,uid,value);worldRows=await worlds.list(book);return 'WI role 저장 · 모델 요청 0회';});});
            const confirm=document.createElement('button');confirm.type='button';confirm.textContent='현재 원문 재확인';confirm.disabled=busy||e.classificationMode!=='MANUAL';
            confirm.addEventListener('click',()=>task(async()=>{runtime.cancel('manual-world-confirm');await worlds.setRole(book,uid,e.role);worldRows=await worlds.list(book);return '새 원문 binding 확인 · 모델 요청 0회';}));
            row.append(title,choice,confirm);rows.append(row);
        }
        let cardView=c;try{cardView=runtime.cardContext();}catch{}
        const counts=sourceCounts(state,cardView);const worldEntries=Object.values(worldRegistry(c).entries);counts.W=worldEntries.filter(x=>x.status!=='missing').length;counts.stale+=worldEntries.filter(x=>x.status==='stale').length;panel.querySelector('#cj-counts').textContent=`M: ${counts.M} · L: ${counts.L} · C: ${counts.C} · W: ${counts.W} · Stale: ${counts.stale}`;
        panel.querySelector('#cj-order-result').textContent=orderResult;
        const s=state.currentSnapshot;
        panel.querySelector('#cj-snapshot').textContent=s?`현재 Snapshot: 있음\nSubjects: ${s.subjects.length}\nSelected: ${s.selectedSubjectId} / ${s.selectedActionId}`:'현재 Snapshot: 없음';
        const diagnostic=runtime.diagnostics();panel.querySelector('#cj-status').textContent=[busy?'작업 중':message,diagnostic.status,diagnostic.error].filter(Boolean).join('\n');
        panel.querySelector('#cj-debug').textContent=JSON.stringify({schemaVersion:state.schemaVersion,sourceCounts:counts,runtime:diagnostic,snapshot:s?{chatId:s.chatId,sourceTurnAnchor:s.sourceTurnAnchor,createdAt:s.createdAt,sourceFingerprint:s.sourceFingerprint}:null},null,2);
    }
    return {render};
}

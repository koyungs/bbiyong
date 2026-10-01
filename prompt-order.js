import { DEFAULT_ENGINE } from './default-engine.js';
export const ENTRY = Object.freeze({
    core: '62c2b749-87be-4d27-a801-000000000001', sheetOpen: '62c2b749-87be-4d27-a801-000000000002',
    sheetClose: '62c2b749-87be-4d27-a801-000000000003', storyOpen: '62c2b749-87be-4d27-a801-000000000004',
    storyClose: '62c2b749-87be-4d27-a801-000000000005', run: '62c2b749-87be-4d27-a801-000000000006',
    handoff: '62c2b749-87be-4d27-a801-000000000007',
});
export const LABELS = { core:'CJ · Core', sheetOpen:'CJ · Sheet Open', sheetClose:'CJ · Sheet Close', storyOpen:'CJ · Story Open', storyClose:'CJ · Story Close', run:'CJ · Engine', handoff:'CJ · Final Handoff' };
export const SHEET = ['worldInfoBefore','personaDescription','charDescription','charPersonality','scenario','worldInfoAfter','dialogueExamples'];
export const slot = key => `[[CJ_SLOT:${ENTRY[key]}]]`;
export const macroName = key => `cj_v1_${key.toLowerCase()}`;
export const INFRA_KEYS = Object.keys(ENTRY).filter(key=>key!=='run');
export const legacyEngineSlot = () => slot('run')+'\n{{'+macroName('run')+'}}';
export const entryContent = key => key==='run'?DEFAULT_ENGINE:slot(key)+'\n{{'+macroName(key)+'}}';
export const entries = () => Object.entries(ENTRY).map(([key, identifier]) => ({ identifier, name: LABELS[key], role:'system',
    content:entryContent(key), system_prompt:false, marker:false, injection_position:0, injection_depth:4, injection_order:100,
    forbid_overrides:true, injection_trigger:['normal','regenerate','swipe'] }));
export function validateOrder({ prompts, order }, type = 'normal') {
    const errors = [], position = id => order.findIndex(x => x.identifier === id);
    const name = id => LABELS[Object.keys(ENTRY).find(k => ENTRY[k] === id)] ?? prompts.find(p => p.identifier === id)?.name ?? id;
    const add = (code, id, message, move) => errors.push({ code, identifier:id, position:position(id) < 0 ? null : position(id) + 1,
        message, move, text:`${message} 현재 위치: ${position(id) < 0 ? '없음' : position(id) + 1}. ${move}` });
    for (const [key,id] of Object.entries(ENTRY)) {
        const definitions = prompts.filter(p => p.identifier === id), rows = order.filter(p => p.identifier === id);
        if (definitions.length !== 1 || rows.length !== 1) { add('missing-or-duplicate',id,`${LABELS[key]} entry/순서 참조가 ${definitions.length}/${rows.length}개입니다.`, '필요한 CJ entry를 한 번만 등록하세요.'); continue; }
        const p = definitions[0];
        if(key==='run'&&p.content===legacyEngineSlot())add('legacy-engine',id,'구형 Run macro가 남아 있습니다. 본문은 보존했습니다.','CJ · Engine에 본인 프롬프트를 넣거나 Engine 기본값으로 교체를 명시적으로 실행하세요.');
        if(key==='run'&&(typeof p.content!=='string'||!p.content.trim()))add('empty-engine',id,'CJ · Engine 본문이 없습니다.','Engine 본문을 입력하세요.');
        if (rows[0].enabled !== true) add('disabled',id,`${name(id)}가 꺼져 있습니다.`, '이 entry를 활성화하세요.');
        if (p.role !== 'system' || p.marker || Number(p.injection_position ?? 0) !== 0) add('injection-position',id,`${name(id)}가 system/relative entry가 아닙니다.`, '역할 system, 위치 Relative로 설정하세요.');
        if (Array.isArray(p.injection_trigger) && p.injection_trigger.length && !p.injection_trigger.includes(type)) add('trigger',id,`${name(id)}의 ${type} 실행이 꺼져 있습니다.`, '이 generation type의 trigger를 활성화하세요.');
        if (key!=='run' && p.content !== entryContent(key)) add('slot-changed',id,`${name(id)}의 runtime slot이 바뀌었습니다.`, '표시 이름은 자유롭게 바꿀 수 있습니다. entry 원문 slot을 복원하세요.');
    }
    const before = (a,b) => {
        if (position(a) >= 0 && position(b) >= 0 && position(a) >= position(b)) add('order',a,`${name(a)}가 ${name(b)}보다 뒤에 있습니다.`, `${name(a)}를 ${name(b)} 앞(현재 ${position(b)+1}번)으로 이동하세요.`);
    };
    const keys = Object.values(ENTRY); for(let i=0;i<keys.length-1;i++) before(keys[i],keys[i+1]);
    before('main',ENTRY.core);
    for (const id of SHEET) {
        const row = order.find(x => x.identifier === id);
        if (!row?.enabled) continue;
        const p = prompts.find(x => x.identifier === id);
        if (!p || Number(p.injection_position ?? 0) !== 0) add('sheet-position',id,`${name(id)}의 위치를 wrapper로 보장할 수 없습니다.`, 'ST source marker를 Relative로 복원하세요.');
        before(ENTRY.sheetOpen,id); before(id,ENTRY.sheetClose);
    }
    const history = order.filter(x => x.identifier === 'chatHistory');
    if (history.length !== 1 || history[0].enabled !== true || !prompts.some(p=>p.identifier==='chatHistory' && p.marker && Number(p.injection_position ?? 0)===0)) add('chat-history','chatHistory','Chat History marker가 없거나 중복/비활성/Absolute 상태입니다.','ST Chat History marker를 한 번 활성화해 Story Open과 Story Close 사이에 놓으세요.');
    before(ENTRY.storyOpen,'chatHistory'); before('chatHistory',ENTRY.storyClose);
    before(ENTRY.sheetClose,ENTRY.run); before(ENTRY.storyClose,ENTRY.run);
    for(const row of order) {
        if(row.enabled!==true)continue;
        const p=prompts.find(x=>x.identifier===row.identifier);
        if(!p)continue;
        const applies=!Array.isArray(p.injection_trigger)||!p.injection_trigger.length||p.injection_trigger.includes(type);
        if(!applies)continue;
        if(row.identifier==='jailbreak') {
            if(Number(p.injection_position??0)!==0)add('phi-position',row.identifier,'Post-History Instructions가 Absolute여서 Engine 앞 배치를 보장할 수 없습니다.','Relative로 설정하고 CJ · Engine 앞으로 이동하세요.');
            else before('jailbreak',ENTRY.run);
        }
        if(Number(p.injection_position??0)===0&&position(ENTRY.handoff)>=0&&position(row.identifier)>position(ENTRY.handoff))
            add('after-handoff',row.identifier,`${name(row.identifier)}가 Final Handoff 뒤에서 활성화되어 있습니다.`,`${name(row.identifier)}를 CJ · Engine 앞(현재 ${position(ENTRY.run)+1}번)으로 이동하세요.`);
    }
    return { ok:errors.length===0, errors, identifiers:ENTRY };
}
export function readManager(manager) {
    if (!manager?.activeCharacter || typeof manager.getPromptOrderForCharacter !== 'function' || !Array.isArray(manager.serviceSettings?.prompts)) throw Error('Prompt Manager의 현재 활성 순서를 확인할 수 없습니다. Chat Completion 연결/프리셋을 확인하세요.');
    return { prompts:structuredClone(manager.serviceSettings.prompts), order:structuredClone(manager.getPromptOrderForCharacter(manager.activeCharacter)) };
}
export function createImport(current) {
    if(current.prompts.filter(p=>p.identifier===ENTRY.run).length>1)throw Error('중복 Engine 본문을 자동으로 선택하거나 덮어쓰지 않습니다. Prompt Manager에서 중복을 먼저 해소하세요.');
    const ids = new Set(Object.values(ENTRY));
    const order = current.order.filter(x => !ids.has(x.identifier)).map(x=>({...x}));
    const insert = (key,index) => order.splice(index,0,{identifier:ENTRY[key],enabled:true});
    const main=order.findIndex(x=>x.identifier==='main');
    insert('core',main<0?0:main+1);
    let first = order.findIndex(x=>SHEET.includes(x.identifier)); insert('sheetOpen',first<0?1:first);
    let last = order.reduce((n,x,i)=>SHEET.includes(x.identifier)?i:n,-1); insert('sheetClose',last<0?2:last+1);
    const chat = order.findIndex(x=>x.identifier==='chatHistory');
    if (chat >= 0) { insert('storyOpen',chat); insert('storyClose',chat+2); }
    else { insert('storyOpen',order.length); insert('storyClose',order.length); }
    insert('run',order.length); insert('handoff',order.length);
    return { version:1,type:'character',data:{prompts:entries().map(p=>p.identifier===ENTRY.run?(structuredClone(current.prompts.find(old=>old.identifier===ENTRY.run))??p):p),prompt_order:order} };
}
export function validateRendered(messages) {
    const text = messages.filter(m=>m.role==='system').map(m=>typeof m.content==='string'?m.content:'').join('\n');
    let previous = -1;
    for (const key of Object.keys(ENTRY)) {
        const value = slot(key), count = text.split(value).length-1, index = text.indexOf(value);
        if (count !== 1 || index <= previous) throw Error(`CJ XML 실행 순서 오류: ${LABELS[key]} slot 수=${count}, 위치=${index}. Prompt Order를 검사하세요.`);
        previous = index;
    }
    return true;
}

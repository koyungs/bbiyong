import { cardSignature } from './cards.js';
import { digest, identity, messageFingerprint, target, ANCHOR_KEY } from './state.js';
import { normalizeSyntax, enumValue, jsonObjectEnd } from './syntax.js';
const fail = text => { throw Error('CJ 구조 오류: ' + text); };
const text = x => typeof x === 'string' && x.trim().length > 0;
function refs(value) {
    if(value.sourceRefs===undefined)return {};
    if(!Array.isArray(value.sourceRefs)||value.sourceRefs.some(x=>typeof x!=='string')||new Set(value.sourceRefs).size!==value.sourceRefs.length)fail('sourceRefs 형식/중복');
    return{sourceRefs:[...value.sourceRefs]};
}
export function validateSourceRefs(space,ids) {
    const allowed=new Set(ids);
    for(const s of space.subjects)for(const value of [s,...s.actions])for(const id of value.sourceRefs??[])if(!allowed.has(id))fail('존재하지 않는 source ref: '+id);
}
export function parseSpace(value) {
    if (!value || value.schemaVersion !== 1 || !Array.isArray(value.subjects) || !value.subjects.length || value.subjects.length > 256) fail('subjects/schemaVersion');
    const ids = new Set(), subjects = [];
    for (const s of value.subjects) {
        if (!s || !/^S[1-9]\d*$/.test(s.id) || ids.has(s.id) || !['YES','NONE'].includes(enumValue(s.priority)) || !text(s.text)) fail('subject ID/priority/text');
        ids.add(s.id);
        if (!Array.isArray(s.actions) || s.actions.length !== 4) fail(s.id + ' action slot은 정확히 4개여야 합니다.');
        const actionIds = new Set();
        const actions = s.actions.map(a => {
            if (!a || ![1,2,3,4].some(n => a.id === `${s.id}-A${n}`) || actionIds.has(a.id) || !text(a.text)) fail(s.id + ' action ID/text');
            actionIds.add(a.id); return { id: a.id, text: a.text, ...refs(a) };
        });
        subjects.push({ id: s.id, text: s.text, priority: enumValue(s.priority), actions, ...refs(s) });
    }
    const subject = subjects.find(s => s.id === value.selectedSubjectId);
    if (!subject?.actions.some(a => a.id === value.selectedActionId)) fail('selection이 존재하는 S/A를 가리키지 않습니다.');
    // No semantic reclassification, deduplication by prose or priority inference.
    return { subjects, selectedSubjectId: value.selectedSubjectId, selectedActionId: value.selectedActionId };
}
export function uniformIndex(size, draw = () => crypto.getRandomValues(new Uint32Array(1))[0]) {
    if (!Number.isInteger(size) || size < 1) fail('empty selection pool');
    const limit = Math.floor(0x100000000 / size) * size;
    for (let attempt = 0; attempt < 1024; attempt++) {
        const value = draw();
        if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) fail('RNG uint32');
        if (value < limit) return value % size;
    }
    fail('RNG rejection limit');
}
export function reselect(snapshot, draw) {
    const parsed = parseSpace({ schemaVersion: 1, ...snapshot });
    const yes = parsed.subjects.filter(s => s.priority === 'YES');
    const pool = yes.length ? yes : parsed.subjects.filter(s => s.priority === 'NONE');
    const subject = pool[uniformIndex(pool.length, draw)];
    // Preserve two uniform draws: subject first, then action. If the current
    // subject wins, exclude its current action; another action always exists.
    const alternatives = subject.actions.filter(a=>subject.id!==snapshot.selectedSubjectId || a.id!==snapshot.selectedActionId);
    const actions = alternatives.length ? alternatives : subject.actions;
    const action = actions[uniformIndex(actions.length, draw)];
    return { selectedSubjectId: subject.id, selectedActionId: action.id, subject: subject.text, action: action.text };
}
export async function inputFingerprint(context, messages) {
    return digest({ chat: identity(context), target: target(context), user: context.name1 ?? '',
        messages: await Promise.all(messages.map(async m => [m.extra?.[ANCHOR_KEY], await messageFingerprint(m)])) });
}
export async function snapshotValid(context, snapshot) {
    if (!snapshot || snapshot.cardBindingSignature !== cardSignature(context)) return false;
    const last = context.chat.at(-1);
    if (!snapshot || !last || last.is_user || last.is_system || snapshot.chatId !== identity(context) || last.extra?.[ANCHOR_KEY] !== snapshot.sourceTurnAnchor) return false;
    if (await inputFingerprint(context, context.chat.slice(0,-1)) !== snapshot.sourceFingerprint) return false;
    // The current result must still match. Selecting a stored variant is
    // separately invalidated by MESSAGE_SWIPED; no history is restored.
    return snapshot.outputFingerprint === await messageFingerprint(last);
}
export function parseCompletion(raw, requestNonce, mode) {
    let body=normalizeSyntax(raw);
    const open=name=>`<${name} nonce="${requestNonce}">`;
    if(body.startsWith('<cj_internal')) {
        if(!body.startsWith(open('cj_internal')))fail('internal nonce');
        const end=body.indexOf('</cj_internal>');
        if(end<0||/<\/?cj_internal\b/.test(body.slice(open('cj_internal').length,end)))fail('internal envelope');
        // Delimit and discard only. Do not interpret, return, log or store its body.
        body=body.slice(end+'</cj_internal>'.length).trimStart();
    }
    let value=null;
    if(mode!=='swipe') {
        if(!body.startsWith(open('cj_result')))fail('현재 요청 nonce / result envelope');
        body=body.slice(open('cj_result').length).trimStart();
        const fence=body.match(/^```(?:json)?[\t ]*\r?\n/i);
        if(fence)body=body.slice(fence[0].length).trimStart();
        const end=jsonObjectEnd(body);if(end<0)fail('result JSON boundary');
        value=JSON.parse(body.slice(0,end));body=body.slice(end).trimStart();
        if(fence){if(!body.startsWith('```'))fail('result JSON fence');body=body.slice(3).trimStart();}
        if(!body.startsWith('</cj_result>'))fail('result closing envelope');
        body=body.slice('</cj_result>'.length).trimStart();
    }
    if(!body.startsWith(open('cj_final'))||!body.endsWith('</cj_final>'))fail('현재 요청 nonce / final envelope');
    const prose=body.slice(open('cj_final').length,-'</cj_final>'.length);
    if(!prose.trim()||/<\/?cj_(?:result|final|internal)\b/i.test(prose))fail('중복 envelope / 빈 Final');
    return {space:value?parseSpace(value):null,sourceBindings:value?.sourceBindings,prose:prose.trim()};
}

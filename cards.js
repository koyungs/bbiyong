import { digest, target, stateFor, persist } from './state.js';

// ST exposes avatar filenames as account-local card identities, including group
// member references. characterId is only an array offset; names are not keys.
export const CARD_KEY = 'character_judgment_cards_v1';
export function cardKey(avatar) {
    if (typeof avatar !== 'string' || !avatar.trim()) throw Error('native Character Card avatar 식별자가 없습니다.');
    return JSON.stringify(['avatar', avatar]);
}
export function cardRegistry(c) {
    if (!c.extensionSettings) throw Error('Card registry용 extension settings API가 없습니다.');
    const r = c.extensionSettings[CARD_KEY] ??= { schemaVersion:1, nextC:1, cards:{} };
    if (r.schemaVersion !== 1 || !Number.isSafeInteger(r.nextC) || r.nextC < 1 || !r.cards || typeof r.cards !== 'object') throw Error('지원하지 않는 Card registry schema');
    return r;
}
export function cardRecord(c) {
    const avatar = c.characters?.[c.characterId]?.avatar;
    return typeof avatar === 'string' && avatar ? cardRegistry(c).cards[cardKey(avatar)] : undefined;
}
export const cardEntries = c => cardRecord(c)?.entries ?? {};
export function cardSignature(c) {
    const card = target(c), r = cardRecord(c);
    return JSON.stringify([cardKey(card.avatar), r?.revision ?? null, r?.currentRevision ?? null, r?.status ?? 'unindexed',
        Object.values(r?.entries ?? {}).map(e => [e.sourceId,e.field,e.ordinal,e.start,e.end,e.fingerprint,e.currentFingerprint,e.status,e.role])]);
}
export function paragraphs(text) {
    const parts = [], separator = /\r?\n[\t ]*\r?\n(?:[\t ]*\r?\n)*/g;
    let start = 0;
    for (const match of String(text).matchAll(separator)) {
        if (text.slice(start, match.index).trim()) parts.push({ start, end:match.index, text:text.slice(start, match.index) });
        start = match.index + match[0].length;
    }
    if (text.slice(start).trim()) parts.push({ start, end:text.length, text:text.slice(start) });
    return parts;
}
const save = async c => { await c.saveSettingsDebounced(); };
const newId = r => 'C' + String(r.nextC++).padStart(2, '0');
const number = id => /^C[0-9]+$/.test(id) && Number.isSafeInteger(Number(id.slice(1))) ? Number(id.slice(1)) : 0;
const sourceShape = card => JSON.stringify([card.avatar,card.name,card.fields]);

// Lazy migration: first shared binding wins. A later chat never replaces it.
// Only metadata is transferred; no source paragraph text is stored here.
function migrate(c, registry) {
    const state = stateFor(c), index = state.sourceIndex;
    if (!['cards','cardRevisions','nextC'].some(k => Object.hasOwn(index,k))) return false;
    const floor = registry.nextC, used = new Set(Object.values(registry.cards).flatMap(r => Object.values(r.entries).map(e => number(e.sourceId))));
    // Reserve the old high-water mark before any collision is remapped: even
    // IDs retired in that chat must not be recycled for a different paragraph.
    if (Number.isSafeInteger(index.nextC)) registry.nextC = Math.max(registry.nextC,index.nextC);
    for (const e of Object.values(index.cards ?? {})) registry.nextC = Math.max(registry.nextC,number(e.sourceId)+1);
    const groups = new Map();
    for (const entry of Object.values(index.cards ?? {})) {
        if (typeof entry.avatar !== 'string' || !entry.avatar) continue;
        if (!groups.has(entry.avatar)) groups.set(entry.avatar,[]);
        groups.get(entry.avatar).push(entry);
    }
    for (const [avatar, entries] of groups) {
        const key = cardKey(avatar);
        if (registry.cards[key] || registry.legacyRetiredKeys?.includes(key)) continue;
        const revision = index.cardRevisions?.[avatar] ?? null;
        const row = registry.cards[key] = { cardKey:key, avatar, revision, currentRevision:revision,
            status:revision ? 'fresh' : 'stale', entries:{}, migratedFrom:'chat-v1', indexedAt:null };
        for (const old of entries.sort((a,b) => number(a.sourceId)-number(b.sourceId))) {
            const wanted = number(old.sourceId);
            const sourceId = wanted >= floor && !used.has(wanted) ? old.sourceId : newId(registry);
            used.add(number(sourceId));
            const e = { sourceId, sourceType:'C', avatar, cardRevision:old.cardRevision, field:old.field, ordinal:old.ordinal,
                role:'CHARACTER', fingerprint:old.fingerprint, currentFingerprint:old.currentFingerprint,
                start:old.start, end:old.end, status:old.status };
            row.entries[sourceId] = e;
        }
    }
    delete index.cards; delete index.cardRevisions; delete index.nextC;
    state.currentSnapshot = null;
    return true;
}

export async function synchronizeCard(c, accept = false, { check = () => {} } = {}) {
    const card = target(c), captured = sourceShape(card);
    if (c.characters[c.characterId].shallow) throw Error('Card 원문이 아직 로드되지 않았습니다. 캐릭터를 연 뒤 다시 인덱싱하세요.');
    if (typeof c.saveSettingsDebounced !== 'function') throw Error('Card registry 저장 API가 없습니다.');
    const revision = await digest([card.name,card.fields]);
    const parts = [];
    for (const [field,text] of Object.entries(card.fields)) for (const [ordinal,part] of paragraphs(text).entries()) {
        if (part.text.trim() === card.name) continue;
        parts.push({ field, ordinal, ...part, fingerprint:await digest(part.text) });
    }
    // No shared mutation during hashing. Concurrent indexing of other cards
    // cannot be overwritten by committing a cloned registry.
    check();
    if (sourceShape(target(c)) !== captured || c.characters[c.characterId].shallow) throw Error('카드 인덱싱 중 원문/카드가 변경되었습니다.');
    const registry = cardRegistry(c), state = stateFor(c), before = JSON.stringify(registry);
    const migrated = migrate(c,registry), key = cardKey(card.avatar);
    const row = registry.cards[key] ??= { cardKey:key, avatar:card.avatar, revision:null, currentRevision:revision, status:'unindexed', entries:{}, indexedAt:null };
    const entries = Object.values(row.entries);
    const exact = row.revision === revision && row.status === 'fresh' && entries.length === parts.length && parts.every(p => {
        const found = entries.filter(e => e.field === p.field && e.ordinal === p.ordinal);
        return found.length === 1 && found[0].fingerprint === p.fingerprint && found[0].cardRevision === revision &&
            found[0].start === p.start && found[0].end === p.end && found[0].status === 'fresh' && found[0].role === 'CHARACTER';
    });
    row.currentRevision = revision;
    if (!exact) {
        row.status = row.revision || entries.length ? 'stale' : 'unindexed';
        for (const e of entries) {
            e.status = 'stale';
            e.currentFingerprint = parts.find(p => p.field === e.field && p.ordinal === e.ordinal)?.fingerprint ?? null;
        }
        if (accept) {
            const fresh = {};
            for (const p of parts) {
                const sourceId = newId(registry);
                fresh[sourceId] = { sourceId, sourceType:'C', avatar:card.avatar, cardRevision:revision,
                    field:p.field, ordinal:p.ordinal, role:'CHARACTER', fingerprint:p.fingerprint, currentFingerprint:p.fingerprint,
                    start:p.start, end:p.end, status:'fresh' };
            }
            row.entries = fresh; row.revision = revision; row.status = 'fresh'; row.indexedAt = new Date().toISOString();
        }
    }
    const invalidated = state.currentSnapshot && state.currentSnapshot.cardBindingSignature !== cardSignature(c);
    if (invalidated) state.currentSnapshot = null;
    const result = row.status === 'fresh' ? parts.map(p => ({ entry:Object.values(row.entries).find(e => e.field === p.field && e.ordinal === p.ordinal), text:p.text })) : [];
    if (JSON.stringify(registry) !== before) await save(c);
    if (migrated || invalidated) await persist(c);
    return result;
}

// Only the explicit native rename event proves old/new card identity continuity.
export async function renameCard(c, oldAvatar, newAvatar) {
    const oldKey = cardKey(oldAvatar), newKey = cardKey(newAvatar), r = cardRegistry(c);
    if (typeof c.saveSettingsDebounced !== 'function') throw Error('Card registry 저장 API가 없습니다.');
    if (migrate(c,r)) { await save(c); await persist(c); }
    if (oldKey === newKey || !r.cards[oldKey]) return;
    if (r.cards[newKey]) {
        for (const key of [oldKey,newKey]) { r.cards[key].status='stale'; for (const e of Object.values(r.cards[key].entries)) e.status='stale'; }
        stateFor(c).currentSnapshot=null; await save(c); await persist(c);
        throw Error('Card rename registry 충돌: 기존 C binding을 병합하지 않습니다. 새 카드를 확인하고 재인덱싱하세요.');
    }
    const row = r.cards[oldKey]; delete r.cards[oldKey]; r.cards[newKey] = row;
    r.legacyRetiredKeys ??= [];
    if (!r.legacyRetiredKeys.includes(oldKey)) r.legacyRetiredKeys.push(oldKey);
    row.cardKey = newKey; row.avatar = newAvatar;
    for (const e of Object.values(row.entries)) e.avatar = newAvatar;
    stateFor(c).currentSnapshot = null;
    await save(c); await persist(c);
}

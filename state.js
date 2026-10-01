export const VERSION = '0.6.0-rc.7';
export const STORAGE_KEY = 'character_judgment_v2';
export const ANCHOR_KEY = 'cj_source_anchor_v1';
export const SCHEMA_VERSION = 1;
export function stateFor(context) {
    if (!context.chatMetadata || !Array.isArray(context.chat)) throw Error('현재 채팅 metadata를 사용할 수 없습니다.');
    let value = context.chatMetadata[STORAGE_KEY];
    if (value && value.schemaVersion !== SCHEMA_VERSION) throw Error('지원하지 않는 CJ schemaVersion입니다. 기존 데이터를 변경하지 않습니다.');
    if (!value) {
        value = { schemaVersion: SCHEMA_VERSION, settings: { enabled: false, maintenanceTimeoutSeconds: 120 },
            sourceIndex: { nextM: 1, messages: {} }, currentSnapshot: null };
        context.chatMetadata[STORAGE_KEY] = value;
    }
    return value;
}
export async function digest(value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), x => x.toString(16).padStart(2, '0')).join('');
}
export const nonce = () => crypto.randomUUID();
export const messageFingerprint = message => digest([String(message.mes ?? ''), Boolean(message.is_user), Boolean(message.is_system), String(message.name ?? '')]);
export function identity(context) {
    const chat = context.chatId ?? context.getCurrentChatId?.();
    const owner = context.groupId ?? context.characters?.[context.characterId]?.avatar;
    if (chat == null || chat === '' || owner == null) throw Error('현재 채팅을 식별할 수 없습니다.');
    return JSON.stringify([context.groupId != null ? 'group' : 'single', owner, chat]);
}
export function target(context) {
    const c = context.characters?.[context.characterId];
    if (!c?.avatar || !c?.name) throw Error('현재 캐릭터를 확인할 수 없습니다.');
    return { id: context.characterId, avatar: c.avatar, name: c.name, fields: Object.fromEntries(['description','personality','scenario'].map(k => [k, String(c[k] ?? c.data?.[k] ?? '')])) };
}
export async function persist(context, { chat = false } = {}) {
    // saveChat also saves message.extra anchors and the chat metadata together.
    if (chat && typeof context.saveChat === 'function') await context.saveChat();
    else if (typeof context.saveMetadata === 'function') await context.saveMetadata();
    else if (typeof context.saveMetadataDebounced === 'function') context.saveMetadataDebounced();
    else throw Error('SillyTavern metadata 저장 API를 사용할 수 없습니다.');
}

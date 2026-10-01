import { JudgmentError } from './errors.js';
export const auxiliaryType = type => ['quiet', 'impersonate', 'continue'].includes(type);
export const foregroundType = type => type == null || ['normal', 'regenerate', 'swipe'].includes(type);
export function getEvents(context) { return context.eventTypes ?? context.event_types ?? {}; }
export function checkCapabilities(context, abort) {
    const events = getEvents(context), bus = context.eventSource;
    if (typeof abort !== 'function' || typeof bus?.on !== 'function' || typeof bus?.removeListener !== 'function' ||
        !events.GENERATION_STOPPED || !events.GENERATE_AFTER_DATA || !events.GENERATION_STARTED ||
        typeof context.getTokenCountAsync !== 'function' ||
        typeof globalThis.crypto?.getRandomValues !== 'function' || typeof WeakRef !== 'function') {
        throw new JudgmentError('unsupported-api', '필요한 SillyTavern 공식 generation hook을 사용할 수 없어 이번 판단을 건너뜁니다.');
    }
    if (!['openai', 'textgenerationwebui', 'kobold', 'koboldhorde', 'novel'].includes(context.mainApi)) {
        throw new JudgmentError('unsupported-api', '현재 연결의 공식 생성 API를 사용할 수 없어 이번 판단을 건너뜁니다.');
    }
}
export function listen(context, name, handler, first = false) {
    const bus = context.eventSource, event = getEvents(context)[name];
    if (!event || typeof bus?.on !== 'function') return () => {};
    bus.on(event, handler);
    if (first) bus.makeFirst?.(event, handler);
    return () => bus.removeListener?.(event, handler);
}
export function token(prefix, id) {
    const bytes = new Uint32Array(4); globalThis.crypto.getRandomValues(bytes);
    return `CJ_${prefix}_${id}_${Array.from(bytes, x => x.toString(16).padStart(8, '0')).join('')}_END`;
}

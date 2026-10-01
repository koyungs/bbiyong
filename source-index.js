import { cardEntries } from './cards.js';
import { ANCHOR_KEY, stateFor, nonce, digest, messageFingerprint } from './state.js';

// Stable addresses and original-source hashes only. No copy of chat history.
export async function synchronizeMessages(context, { create = true, messages = context.chat } = {}) {
    const index = stateFor(context).sourceIndex, seen = new Set(), result = [];
    for (const message of messages) {
        message.extra ??= {};
        let anchor = message.extra[ANCHOR_KEY];
        if (typeof anchor !== 'string' || seen.has(anchor)) {
            if (!create) continue;
            anchor = message.extra[ANCHOR_KEY] = nonce();
        }
        seen.add(anchor);
        let entry = Object.values(index.messages).find(x => x.anchor === anchor);
        const currentFingerprint = await messageFingerprint(message);
        if (!entry) {
            if (!create) continue;
            const sourceId = 'M' + String(index.nextM++).padStart(4, '0');
            entry = index.messages[sourceId] = { sourceId, sourceType: 'M', anchor, role: 'LOG', fingerprint: currentFingerprint,
                currentFingerprint, status: 'unindexed', sourceSpeaker: String(message.name ?? ''), spans: [] };
        }
        entry.currentFingerprint = currentFingerprint;
        entry.status = entry.fingerprint !== currentFingerprint ? 'stale' : entry.indexed ? 'fresh' : 'unindexed';
        result.push({ message, entry });
        // ST copies swipe_info.extra back onto the SAME message. Keep the M
        // anchor invariant across all variants, without storing any snapshot there.
        for (const info of message.swipe_info ?? []) {
            if (info && typeof info === 'object') { info.extra ??= {}; info.extra[ANCHOR_KEY] = anchor; }
        }
    }
    const present = new Set(context.chat.map(m=>m.extra?.[ANCHOR_KEY]));
    for (const entry of Object.values(index.messages)) if (!present.has(entry.anchor)) entry.status = 'missing';
    return result;
}
export { paragraphs, synchronizeCard } from './cards.js';
export { observeActivated as bindActivatedWorld } from './worlds.js';
export function sourceCounts(state, context) {
    const m = Object.values(state.sourceIndex.messages), c = Object.values(cardEntries(context)), w = Object.values(state.sourceIndex.worlds ?? {});
    return { M: m.filter(x => x.status !== 'missing').length, L: m.filter(x => x.status === 'fresh').reduce((n, x) => n + x.spans.length, 0),
        C: c.filter(x => x.status !== 'missing').length, W: w.length, stale: [...m,...c,...w].filter(x => x.status === 'stale').length };
}

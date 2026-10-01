import { stateFor, identity, STORAGE_KEY } from './state.js';

// Bounded, memory-only structural evidence. Weak keys never retain an old
// Snapshot, chat, or metadata object. No source prose or candidate space here.
const traces = new WeakMap(), references = new WeakMap(), commits = new WeakMap();
let nextReference = 1;
const reference = object => {
    if (!object || typeof object !== 'object') return null;
    if (!references.has(object)) references.set(object, `ref-${nextReference++}`);
    return references.get(object);
};
const chatIdentity = context => { try { return identity(context); } catch { return null; } };
// CHARACTER_EDITED supplies a detail object containing the entire Card.
// It is not a message ID and must never be copied into structural evidence.
const messageIdentity = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const traceFor = state => {
    if (!traces.has(state)) traces.set(state, { lastCommit:null, lastInvalidation:null, lastCheckpoint:null });
    return traces.get(state);
};
function current(trace, context) {
    const metadata = context.chatMetadata, state = metadata?.[STORAGE_KEY], snapshot = state?.currentSnapshot;
    const commit = trace?.lastCommit, chatId = chatIdentity(context);
    const metadataRef = reference(metadata), stateRef = reference(state);
    const sameChat = Boolean(commit && chatId === commit.chatId);
    const sameMetadata = Boolean(commit && metadataRef === commit.metadataRef);
    const sameState = Boolean(commit && stateRef === commit.stateRef);
    return { chatId, metadataRef, stateRef, sameChat, sameMetadata, sameState,
        snapshotPresent:Boolean(snapshot),
        matchesLastCommit:Boolean(commit && sameChat && sameState && snapshot && commits.get(snapshot) === commit.id) };
}
export function commitSnapshot(context, snapshot, { id, mode, messageId, checks } = {}) {
    const state = stateFor(context), trace = traceFor(state);
    state.currentSnapshot = snapshot;
    commits.set(snapshot, id);
    trace.lastCommit = { id, mode, messageId:messageIdentity(messageId), chatId:chatIdentity(context),
        metadataRef:reference(context.chatMetadata), stateRef:reference(state), phase:'assigned', checks };
    trace.lastCheckpoint = { phase:'assigned', ...current(trace, context) };
    return trace;
}
export function invalidateSnapshot(context, { reason, event = null, messageId = null, checks = null, expected } = {}) {
    const state = stateFor(context), snapshot = state.currentSnapshot;
    if (!snapshot || (expected !== undefined && snapshot !== expected)) return false;
    const trace = traceFor(state);
    state.currentSnapshot = null;
    trace.lastInvalidation = { commitId:commits.get(snapshot) ?? null, reason:reason ?? 'unspecified', event, messageId:messageIdentity(messageId),
        chatId:chatIdentity(context), metadataRef:reference(context.chatMetadata), stateRef:reference(state), checks };
    return true;
}
export function checkpointSnapshot(trace, context, phase, { commitId, event = null, messageId = null, checks = null, receipt = false } = {}) {
    if (!trace || (commitId !== undefined && trace.lastCommit?.id !== commitId)) return;
    const now = current(trace, context), commit = trace.lastCommit;
    trace.lastCheckpoint = { phase, ...now, ...(checks ? { checks } : {}) };
    if (receipt && commit) commit.phase = phase;
    if (commit && !now.matchesLastCommit) {
        commit.lostAt ??= phase;
        if (trace.lastInvalidation?.commitId !== commit.id) {
            const reason = !now.sameChat ? 'chat-identity-changed' : !now.sameState ? 'chat-metadata-state-changed' :
                now.snapshotPresent ? 'snapshot-replaced-outside-traced-path' : 'snapshot-cleared-outside-traced-path';
            trace.lastInvalidation = { commitId:commit.id, reason, event, messageId:messageIdentity(messageId), phase,
                chatId:now.chatId, metadataRef:now.metadataRef, stateRef:now.stateRef, checks };
        } else trace.lastInvalidation.phase ??= phase;
    }
}
export function readSnapshotTrace(trace, context) {
    trace ??= traces.get(context.chatMetadata?.[STORAGE_KEY]);
    return structuredClone({ lastCommit:trace?.lastCommit ?? null,
        lastInvalidation:trace?.lastInvalidation ?? null, lastCheckpoint:trace?.lastCheckpoint ?? null,
        current:current(trace, context) });
}

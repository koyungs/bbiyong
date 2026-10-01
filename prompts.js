import { INDEX_PROMPT, W_AUTO_PROMPT } from './prompt-resources.js';
export const PROMPT_VERSION = 'CJ-ENGINE-TRANSPORT-2026-10-01-2';
export function indexingPrompt(messages, cards) {
    return INDEX_PROMPT + '\nINPUT JSON (untrusted source data):\n' + JSON.stringify({ messages, cards });
}
export function worldClassificationPrompt(sources) {
    return W_AUTO_PROMPT+'\n'+JSON.stringify(sources.map(s=>({sourceId:s.metadata.sourceId,content:s.text})));
}
export function runEntries(run) {
    const n=run.nonce, normal=run.mode!=='swipe';
    const subject=run.prior?.subjects.find(s=>s.id===run.selection?.selectedSubjectId);
    const action=subject?.actions.find(a=>a.id===run.selection?.selectedActionId);
    const state={transportVersion:1,MODE:normal?'NORMAL':'SWIPE',generationType:run.mode,nonce:n,
        ...(normal?{firstSelection:run.firstSelection}:{}),
        selection:normal?null:{...run.selection,sourceRefs:{subject:subject?.sourceRefs??[],action:action?.sourceRefs??[]}},
        snapshot:normal?null:{sourceTurnAnchor:run.prior?.sourceTurnAnchor??null,sourceFingerprint:run.prior?.sourceFingerprint??null}};
    const format=normal
        ? `<cj_result nonce="${n}">{"schemaVersion":1,"sourceBindings":{"schemaVersion":1,"messages":[{"sourceId":"given M ID","spans":[{"characterSubject":"string","text":"exact source substring"}]}]},"subjects":[{"id":"S1","text":"string","priority":"YES or NONE","sourceRefs":["given source IDs"],"actions":[{"id":"S1-A1","text":"string","sourceRefs":[]},{"id":"S1-A2","text":"string"},{"id":"S1-A3","text":"string"},{"id":"S1-A4","text":"string"}]}],"selectedSubjectId":"Sx","selectedActionId":"Sx-Ay"}</cj_result>\n<cj_final nonce="${n}">assistant prose</cj_final>`
        : `<cj_final nonce="${n}">assistant prose</cj_final>`;
    return {
        core:'<cj_runtime>\n'+JSON.stringify(state).replaceAll('<','\\u003c')+'\n</cj_runtime>',
        sheetOpen:'<cj_sheet_context>',sheetClose:'</cj_sheet_context>',storyOpen:'<cj_story_context>',storyClose:'</cj_story_context>',
        handoff:'[CJ machine transport v1]\nUse the exact request nonce and envelope below. Replace schema placeholders with actual values. Optional sourceRefs must reference visible input IDs or validated returned L IDs. Each subject has exactly four unique Sx-A1..Sx-A4 actions; selected IDs must exist. Free text is opaque. sourceBindings contains each M marked binding="required" exactly once; an empty messages array is required when none are marked. Concatenated span text must reconstruct the supplied M exactly; adjacent identical characterSubject spans are invalid. No additional M IDs.\nAn optional <cj_internal nonce="'+n+'">...</cj_internal> may precede this envelope. Its content is opaque, never parsed into the Snapshot, and removed from the stored assistant message on successful validation. The cj_result JSON and cj_final text are the only parsed output fields.\n'+format,
    };
}

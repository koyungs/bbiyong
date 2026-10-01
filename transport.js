import { normalizeSyntax } from './syntax.js';
import { JudgmentError } from './errors.js';
import { getEvents, listen, token } from './compatibility.js';

// Relative to public/scripts/extensions/third-party/ST-Character-Judgment/.
// Lazy import makes unsupported ST versions fail open inside the interceptor.
const loadSTHelpers = () => import('../../../openai.js');

function textParts(value) {
    if (typeof value === 'string') return value;
    if (!Array.isArray(value)) return '';
    return value.filter(p => p && !p.thought && (!p.type || p.type === 'text' || p.type === 'output_text'))
        .map(p => typeof p.text === 'string' ? p.text : '').join('\n\n');
}

export function completionText(data) {
    // ST normalizes native Gemini into choices[0].message.content, filtering
    // thought parts on the server. Never use responseContent or reasoning fields.
    const text = typeof data === 'string' ? data : textParts(data?.choices?.[0]?.message?.content ??
        data?.choices?.[0]?.text ?? data?.content ?? data?.text ?? data?.message?.content);
    return normalizeSyntax(text);
}

export function createTransport(context, loadHelpers = loadSTHelpers) {
    const settings = context.chatCompletionSettings ? structuredClone(context.chatCompletionSettings) : null;
    const info = { source: settings?.chat_completion_source ?? context.mainApi, model: null,
        maxTokens: settings?.openai_max_tokens, type: 'quiet', streaming: false, adapter: 'preparing' };
    let helpers;
    return { info, async request(prompt, signal, guard, onResponse = () => {}) {
        const check = () => { guard(); if (signal.aborted) throw signal.reason; };
        check();
        if (context.mainApi === 'openai' && settings && typeof context.ChatCompletionService?.sendRequest === 'function') {
            helpers ??= await loadHelpers().catch(() => ({})); check();
            const { getChatCompletionModel, createGenerationParameters } = helpers;
            if (typeof getChatCompletionModel === 'function' && typeof createGenerationParameters === 'function') {
                const model = getChatCompletionModel(settings); info.model = model; info.adapter = 'abortable-public-request';
                const { generate_data } = await createGenerationParameters(settings, model, 'quiet', [{ role: 'user', content: prompt }]);
                check();
                if (!generate_data || generate_data.stream || (generate_data.n && generate_data.n !== 1)) throw new JudgmentError('unsupported-api', 'quiet 요청 형식이 예상과 다릅니다.');
                const response = await context.ChatCompletionService.sendRequest(generate_data, false, signal); check();
                onResponse({ finishReason: response?.choices?.[0]?.finish_reason ?? null });
                return completionText(response);
            }
        }
        info.adapter = 'official-generateRaw';
        return rawRequest(context, prompt, signal, check, onResponse);
    } };
}

let rawSequence = 0;
async function rawRequest(context, prompt, signal, check, onResponse) {
    const rawData = context.generateRawData, raw = context.generateRaw;
    if (typeof rawData !== 'function' && typeof raw !== 'function') throw new JudgmentError('unsupported-api', '공식 generateRaw API를 사용할 수 없습니다.');
    if (!['openai', 'textgenerationwebui'].includes(context.mainApi) && typeof rawData !== 'function') {
        throw new JudgmentError('unsupported-api', '이 연결의 독립 입력 hook을 확인할 수 없어 판단을 건너뜁니다.');
    }
    const events = getEvents(context), cc = context.mainApi === 'openai';
    const names = cc ? ['CHAT_COMPLETION_PROMPT_READY', 'CHAT_COMPLETION_SETTINGS_READY'] : ['GENERATE_AFTER_COMBINE_PROMPTS', 'TEXT_COMPLETION_SETTINGS_READY'];
    if (!names.some(name => events[name])) throw new JudgmentError('unsupported-api', '독립 Stage 요청 hook을 사용할 수 없습니다.');
    const marker = token('STAGE', ++rawSequence); let applied = false;
    // Raw helpers substitute macros and may format user text. Correlate using a
    // fresh marker, then restore the exact authoring input in this request only.
    const hook = payload => {
        if (applied) return;
        const list = payload?.chat ?? payload?.messages;
        if (Array.isArray(list)) {
            if (list.length !== 1 || typeof list[0]?.content !== 'string' || !list[0].content.includes(marker)) return;
            try { check(); } catch { list[0].content = ''; return; }
            list[0].content = prompt; applied = true;
        } else if (typeof payload?.prompt === 'string' && payload.prompt.includes(marker)) {
            try { check(); } catch { payload.prompt = ''; return; }
            payload.prompt = prompt; applied = true;
        }
    };
    const offs = names.map(name => listen(context, name, hook));
    const detach = () => { for (const off of offs) off(); };
    signal.addEventListener('abort', detach, { once: true });
    try {
        check();
        const args = { prompt: marker, api: context.mainApi, instructOverride: true, trimNames: false };
        const response = typeof rawData === 'function' ? await rawData(args) :
            raw.length >= 2 ? await raw(marker, context.mainApi, true, false, '', null, false) : await raw(args);
        check();
        if (!applied) throw new JudgmentError('unsupported-api', '독립 Stage 입력을 확인하지 못해 결과를 폐기합니다.');
        onResponse({ finishReason: typeof response === 'object' ? response?.choices?.[0]?.finish_reason ?? null : null });
        const data = context.mainApi === 'novel' ? response?.output ?? response : response?.results?.[0]?.text ?? response;
        return completionText(data);
    } finally { signal.removeEventListener('abort', detach); detach(); }
}

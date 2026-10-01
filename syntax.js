// Surface transport only. Never scan/rewrite free text inside the JSON/XML body.
const noiseOpen = /^<(think|thinking|reasoning|reflection)>/i;
function peelNoise(value) {
    let text=value.trimStart(),count=0;
    while(noiseOpen.test(text)) {
        const tag=text.match(noiseOpen)[1],close='</'+tag.toLowerCase()+'>',end=text.toLowerCase().indexOf(close);
        if(end<0)throw Error('CJ unclosed external noise block');
        const inside=text.slice(tag.length+2,end);
        if(/<\/?(?:think|thinking|reasoning|reflection)>/i.test(inside))throw Error('CJ nested/mismatched external noise block');
        text=text.slice(end+close.length).trimStart();count++;
    }
    return {text,count};
}
// Locate a JSON object boundary while treating quoted source text as opaque.
// JSON.parse still validates syntax/types; this function does not repair them.
export function jsonObjectEnd(text) {
    if(text[0]!=='{')return -1;
    let depth=0,quoted=false,escaped=false;
    for(let i=0;i<text.length;i++) {
        const c=text[i];
        if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
        if(c==='"')quoted=true;else if(c==='{'||c==='[')depth++;else if(c==='}'||c===']'){if(--depth===0)return i+1;}
    }
    return -1;
}
export function normalizeSyntax(raw,{allowNoise=true}={}) {
    if(typeof raw!=='string')throw Error('CJ text response required');
    let text=raw.trim(),removed=0;
    const peel=()=>{if(allowNoise){const p=peelNoise(text);text=p.text;removed+=p.count;}};
    const suffix=value=>{const rest=value.trim();if(rest&&(!allowNoise||peelNoise(rest).text.trim()))throw Error('CJ unexpected external output');};
    peel();
    if(text.startsWith('```')) {
        const fence=text.match(/^```(?:json|xml|text)?[\t ]*\r?\n([\s\S]*?)\r?\n```(?=\s|$)/i);
        if(fence&&!/^```/m.test(fence[1])) {suffix(text.slice(fence[0].length));text=fence[1].trim();peel();}
    }
    let end=jsonObjectEnd(text);
    if(text.startsWith('<cj_')){const at=text.lastIndexOf('</cj_final>');end=at<0?-1:at+'</cj_final>'.length;}
    if(end>=0){suffix(text.slice(end));return text.slice(0,end).trim();}
    if(removed)throw Error('CJ external noise requires a complete structured body');
    return text.trim();
}
export const enumValue = value => typeof value === 'string' ? value.trim().toUpperCase() : value;

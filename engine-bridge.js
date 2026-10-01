import { ENTRY, slot } from './prompt-order.js';
// Only native prepared request copies are wrapped. Persistent user definitions
// are read-only. Suppress the Engine BEFORE ST macro expansion when bypassed.
export function createEngineBridge(getRun, isLive) {
    const installed=new Map();
    function install(manager) {
        if(installed.has(manager))return manager;
        if(typeof manager?.getPromptCollection!=='function'||typeof manager.preparePrompt!=='function')throw Error('CJ Engine용 native Prompt Manager 준비 API를 확인할 수 없습니다.');
        const original=manager.getPromptCollection;let attached=true;
        function wrapped(type,...args) {
            if(!attached)return original.call(this,type,...args);
            const run=getRun(),mode=String(type||'normal').toLowerCase().trim();
            let use=false;try{use=!!run&&!run.sent&&run.mode===mode&&isLive(run);}catch{}
            const prepare=this.preparePrompt;
            function requestPrepare(prompt,...rest) {
                if(prompt?.identifier!==ENTRY.run)return prepare.call(this,prompt,...rest);
                const copy=prepare.call(this,use?prompt:{...prompt,content:''},...rest);
                if(use)copy.content=slot('run')+`\n<!--CJ_OWNED:${run.nonce}-->`+copy.content+`<!--/CJ_OWNED:${run.nonce}-->`;
                return copy;
            }
            this.preparePrompt=requestPrepare;
            try{return original.call(this,type,...args);}
            finally{if(this.preparePrompt===requestPrepare)this.preparePrompt=prepare;}
        }
        manager.getPromptCollection=wrapped;
        installed.set(manager,()=>{attached=false;if(manager.getPromptCollection===wrapped)manager.getPromptCollection=original;});
        return manager;
    }
    return {install,dispose(){for(const off of installed.values())off();installed.clear();}};
}

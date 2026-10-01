import { createEngineBridge } from './engine-bridge.js';
import { captureGroupTarget, groupTargetContext } from './group-target.js';
import { cardSignature, synchronizeCard, renameCard } from './cards.js';
import { stateFor, identity, target, nonce, persist, digest, messageFingerprint, ANCHOR_KEY, VERSION } from './state.js';
import { synchronizeMessages } from './source-index.js';
import { inputFingerprint, snapshotValid, parseCompletion, reselect, uniformIndex, validateSourceRefs } from './snapshot.js';
import { validateOrder, validateRendered, readManager, slot, macroName, ENTRY, INFRA_KEYS } from './prompt-order.js';
import { runEntries, PROMPT_VERSION } from './prompts.js';
import { listen, getEvents } from './compatibility.js';
import { validateBindings } from './indexing.js';
import { annotateSources, removeAnnotations } from './annotations.js';
import { observeActivated, worldSignature, readWorld } from './worlds.js';
const supported = type => ['normal','regenerate','swipe'].includes(type ?? 'normal');
const resolveManager = async () => (await import('../../../openai.js')).promptManager;
const content = m => typeof m?.content === 'string' ? m.content : '';

export function createRuntime({ getContext, getManager = resolveManager, onUpdate = ()=>{}, draw }) {
    let active = null, epoch = 0, ambiguity = false, status = '대기', error = '', subscriptions = new Map(), macroContext;
    let groupDraft=null, displayedGroupTarget=null;
    const update = () => { try { onUpdate(); } catch {} };
    const setError = e => { error = e instanceof Error ? e.message : String(e); status = 'CJ 생략 · 원래 생성 계속'; update(); };
    const ownedPattern = n => new RegExp(`<!--CJ_OWNED:${n}-->[\\s\\S]*?<!--/CJ_OWNED:${n}-->`,'g');
    const remove = (list,n) => { for(const m of list??[]) if(typeof m.content==='string')m.content=m.content.replace(ownedPattern(n),''); };
    function cancel(reason='cancelled') {
        const run = active; active = null; epoch++;
        if(!['generation-start','준비'].includes(reason))groupDraft=null;
        if(run)for(const ref of run.payloads){const list=ref.deref();if(list){removeAnnotations(list,run.annotationTags);remove(list,run.nonce);}}
        status = reason; update();
    }
    function runContext(run) {
        const c=getContext();
        if(run.groupTarget&&c.characterId!=null&&c.characters?.[c.characterId]?.avatar!==run.groupTarget.avatar)
            throw Error('그룹 native 생성 대상 변경');
        return groupTargetContext(c,run.groupTarget);
    }
    function cardContext() {
        const c=getContext();if(c.groupId==null)return c;
        if(active?.groupTarget)return groupTargetContext(c,active.groupTarget);
        if(c.characters?.[c.characterId]?.avatar)return c;
        const snapshot=stateFor(c).currentSnapshot;
        if(snapshot?.targetAvatar&&snapshot.chatId===identity(c)&&c.chat.at(-1)?.original_avatar===snapshot.targetAvatar)
            return groupTargetContext(c,{avatar:snapshot.targetAvatar,chatId:snapshot.chatId});
        if(displayedGroupTarget?.chatId===identity(c))return groupTargetContext(c,displayedGroupTarget);
        return c;
    }
    const live = run => {try{const c=runContext(run);return active === run && JSON.stringify(readManager(run.manager))===JSON.stringify(run.order) && cardSignature(c) === run.cardBindingSignature && identity(c) === run.chatId && stateFor(c).settings.enabled && JSON.stringify(target(c)) === run.card && (c.name1??'') === run.user && JSON.stringify(c.chatCompletionSettings)===run.connection;}catch{return false;}};
    const bridge=createEngineBridge(()=>active,run=>live(run));let bridgeEpoch=0;
    async function managedManager(){const token=bridgeEpoch,manager=await getManager();if(token!==bridgeEpoch)throw Error('CJ 종료 중 Prompt Manager 준비 취소');return bridge.install(manager);}
    const preparationSignature=c=>JSON.stringify([identity(c),target(c),c.name1??'',c.mainApi,c.chatCompletionSettings,
        c.chat.map(m=>[m.name,m.is_user,m.is_system,m.mes])]);
    async function intercept(coreChat,_contextSize,_abort,type='normal') {
        let turnEpoch;
        type ??= 'normal';
        try {
            const native = getContext();
            if(!supported(type)||!stateFor(native).settings.enabled){if(native.mainApi==='openai')await managedManager();return;}
            const groupTarget=native.groupId==null?null:
                (groupDraft?.chatId===identity(native)?groupDraft:captureGroupTarget(native));
            const currentContext=()=>runContext({groupTarget});
            const c=currentContext();
            cancel('준비'); turnEpoch = epoch; const initialSignature=preparationSignature(c);
            if(c.mainApi!=='openai')throw Error('이번 Prompt Manager 구조는 Chat Completion에서만 확인했습니다. 다른 API는 CJ 없이 진행합니다.');
            if(!macroContext)throw Error('공식 ST macro 등록 API를 확인할 수 없습니다.');
            if(Number(c.chatCompletionSettings?.n??1)>1)throw Error('CJ 단일 completion 계약에는 생성 후보 수 n=1이 필요합니다.');
            const manager=await managedManager();if(turnEpoch!==epoch)return;
            const order = validateOrder(readManager(manager),type);if(!order.ok)throw Error(order.errors.map(x=>x.text).join('\n'));
            const rows = await synchronizeMessages(c,{create:type!=='swipe',messages:type==='swipe'?c.chat.slice(0,-1):c.chat}), cards = await synchronizeCard(c);
            if(turnEpoch!==epoch||identity(getContext())!==identity(c))return;
            const state = stateFor(c), prior = state.currentSnapshot, cardBindingSignature=cardSignature(c);
            let selection = null;
            if(type==='swipe') {
                if(prior?.promptVersion!==PROMPT_VERSION||prior?.version!==VERSION||!await snapshotValid(c,prior))throw Error('현재 마지막 턴에 유효한 Snapshot이 없습니다. Swipe는 재판단하지 않습니다. 새 Normal 생성이 필요합니다.');
                selection = reselect(prior,draw);
            }
            const messages = type==='swipe'?c.chat.slice(0,-1):c.chat.slice();
            const sourceFingerprint = await inputFingerprint(c,messages);
            if(turnEpoch!==epoch)return;
            if(preparationSignature(currentContext())!==initialSignature)throw Error('준비 중 원문/대상/연결 변경: CJ 결과를 폐기합니다.');
            const bindings = { messages:[], cards:cards.map(x=>({...x.entry,text:x.text})), worlds:[],worldStatus:'unavailable' };
            // Bind native interceptor text to real ST message anchors. A regex/file
            // transformed prompt view is identified separately from indexed raw Ls.
            for(const view of coreChat) {
                const candidates = rows.filter(x=> view.extra?.[ANCHOR_KEY] ? x.entry.anchor===view.extra[ANCHOR_KEY] :
                    x.message.send_date===view.send_date && x.message.name===view.name && x.message.mes===view.mes);
                if(candidates.length!==1)continue;
                const {entry,message}=candidates[0], same=String(view.mes??'')===String(message.mes??'');
                bindings.messages.push({sourceId:entry.sourceId,sourceSpeaker:message.name,role:entry.role,text:String(view.mes??''),
                    fingerprint:entry.currentFingerprint,viewFingerprint:await digest(String(view.mes??'')),
                    bindingRequired:!same||entry.status!=='fresh'||!entry.spans.length,
                    indexStatus:entry.status,view:same?'original':'native-transformed',spans:same&&entry.status==='fresh'?entry.spans:[]});
            }
            const nativeSourceFingerprint=await digest(bindings.messages.map(x=>[x.sourceId,x.viewFingerprint]));
            const managerView=readManager(manager),promptManagerFingerprint=await digest(managerView);
            if(turnEpoch!==epoch)return;
            if(preparationSignature(currentContext())!==initialSignature)throw Error('source binding 중 원문/대상/연결 변경: CJ 결과를 폐기합니다.');
            if(type==='swipe'&&(prior.nativeSourceFingerprint!==nativeSourceFingerprint||prior.promptManagerFingerprint!==promptManagerFingerprint))throw Error('실제 source view 또는 Prompt Manager가 Snapshot 생성 때와 달라 Swipe 재사용을 건너뜁니다.');
            if(cardSignature(c)!==cardBindingSignature)throw Error('준비 중 Card registry 변경');
            const firstSelection=type==='swipe'?null:Object.freeze({subjectSlot:'S1',actionSlot:`A${uniformIndex(4,draw)+1}`});
            const run = { manager, groupTarget, cardBindingSignature, nonce:nonce(), mode:type, chatId:identity(c), card:JSON.stringify(target(c)),user:c.name1??'',connection:JSON.stringify(c.chatCompletionSettings),
                sourceFingerprint,inputLength:messages.length,sourceTurnAnchor:prior?.sourceTurnAnchor,selection,firstSelection,prior,
                nativeSourceFingerprint,promptManagerFingerprint,bindings, payloads:[], annotationTags:[], sent:false, consumed:false, order:managerView, ambiguous:ambiguity };
            active=run;if(groupTarget)displayedGroupTarget=groupTarget; error='';status=type==='swipe'?'Swipe · 재선택 완료, Final 대기':'Normal · 단일 completion 대기';
            await persist(c,{chat:true}); if(active===run&&!live(run))cancel('source-changed'); update();
        } catch(e) { if(turnEpoch!==undefined&&turnEpoch!==epoch)return;cancel('fail-open'); setError(e); }
    }
    async function promptReady(data) {
        const list=data?.chat; if(!Array.isArray(list))return;
        const run=active;
        const stripSlots=()=>{for(const m of list)if(typeof m.content==='string')for(const key of Object.keys(ENTRY))m.content=m.content.split(slot(key)).join('').split('{{'+macroName(key)+'}}').join('');};
        if(data.dryRun||!run||!live(run)){stripSlots();if(run)remove(list,run.nonce);if(run&&!data.dryRun)cancel('source-changed');return;}
        try {
            if(run.sent){stripSlots();return;}
            const manager=await managedManager();const view=readManager(manager),check=validateOrder(view,run.mode);
            if(!live(run)||!check.ok||JSON.stringify(view)!==JSON.stringify(run.order))throw Error('실행 중 Prompt Manager 설정이 변경되었습니다. 다시 검사하세요.');
            validateRendered(list);
            const rendered=list.filter(m=>m.role==='system').map(content).join('\n');
            if(rendered.split(`<!--CJ_OWNED:${run.nonce}-->`).length-1!==7)throw Error('CJ macro가 토큰 계산 전에 모두 펼쳐지지 않았습니다.');
            const annotation=annotateSources(list,run,manager);
            run.annotationTags=annotation.tags;run.visibleIds=annotation.visibleIds;
            run.bindingSources=annotation.messages.filter(x=>x.bindingRequired);
            run.visibleWorlds=annotation.worlds;
            run.worldSignature=worldSignature(getContext(),annotation.worlds);
            run.worldBindings=annotation.worlds.map(x=>[x.world,x.uid,x.sourceId,x.currentFingerprint,x.viewFingerprint,x.role,x.status]);
            run.payloads.push(new WeakRef(list));
            if(run.mode==='swipe'&&JSON.stringify(run.worldBindings)!==JSON.stringify(run.prior.worldBindings??[]))throw Error('활성 WI source가 Snapshot 생성 때와 달라 Swipe 재사용을 건너뜁니다.');
            stripSlots();
            run.sent=true; run.payloads.push(new WeakRef(list));update();
        } catch(e){stripSlots();removeAnnotations(list,run.annotationTags);remove(list,run.nonce);if(active===run){cancel('prompt-error');setError(e);}}
    }
    function observeSettings(data) {
        const list=data?.messages; if(!Array.isArray(list))return;
        const run=active;if(!run)return;
        if(!list.some(m=>content(m).includes(`<!--CJ_OWNED:${run.nonce}-->`)))return;
        if(!live(run)||(data.type!=null&&data.type!==run.mode)){removeAnnotations(list,run.annotationTags);remove(list,run.nonce);if(!live(run))cancel('source-changed');return;}
        run.payloads.push(new WeakRef(list));
    }
    async function received(id,type) {
        type ??= 'normal';
        const native=getContext(),message=native.chat?.[id],run=active;
        if(type==='continue'||type==='append'||type==='appendFinal') {
            stateFor(native).currentSnapshot=null;await synchronizeMessages(native,{create:false});await persist(native,{chat:true});update();return;
        }
        const matchingType=run&&(type===run.mode||(run.mode==='regenerate'&&type==='normal'));
        if(!run?.sent||run.consumed||!message||message.is_user||id!==native.chat.length-1||!matchingType)return;
        const raw=String(message.mes??'');
        // Nonce is the response ownership proof; an ID-less late native event is not.
        if(!raw.includes(`nonce="${run.nonce}"`))return;
        try {
            const c=runContext(run);
            if(!live(run))throw Error('응답 도착 전 source/connection 변경');
            if(run.groupTarget&&message.original_avatar!==run.groupTarget.avatar)throw Error('그룹 응답 original_avatar TARGET 불일치');
            if(id!==run.inputLength || await inputFingerprint(c,c.chat.slice(0,id))!==run.sourceFingerprint)throw Error('응답의 source turn binding 불일치');
            if(run.mode==='swipe'&&message.extra?.[ANCHOR_KEY]!==run.sourceTurnAnchor)throw Error('Swipe 턴 anchor 변경');
            const parsed=parseCompletion(raw,run.nonce,run.mode);
            if(run.mode!=='swipe'&&(parsed.space.selectedSubjectId!==run.firstSelection.subjectSlot||
                parsed.space.selectedActionId!==`${run.firstSelection.subjectSlot}-${run.firstSelection.actionSlot}`))
                throw Error('CJ 구조 오류: firstSelection과 응답 selection 불일치');
            const bindingSources=run.mode==='swipe'?[]:run.bindingSources;
            const generated=run.mode==='swipe'?[]:validateBindings(parsed.sourceBindings,bindingSources);
            if(parsed.space)validateSourceRefs(parsed.space,[...run.visibleIds,...generated.flatMap(x=>x.spans.map(s=>s.sourceId))]);
            const updates=generated.flatMap((item,i)=>{
                const source=bindingSources[i];
                // A transformed view has its own exact spans for THIS request.
                // Its offsets never become offsets into the persisted raw M.
                if(source.view!=='original')return [];
                const entry=stateFor(c).sourceIndex.messages[item.sourceId];
                if(!entry||entry.currentFingerprint!==source.fingerprint)throw Error('Normal L source fingerprint 변경');
                return [{entry,spans:item.spans,fingerprint:source.fingerprint,sourceSpeaker:source.sourceSpeaker}];
            });
            const outputFingerprint=await messageFingerprint({...message,mes:parsed.prose});
            if(await inputFingerprint(c,c.chat.slice(0,id))!==run.sourceFingerprint)throw Error('L commit 전 source 변경');
            if(worldSignature(c,run.visibleWorlds)!==run.worldSignature)throw Error('응답 전 WI source/role 변경');
            if(run.groupTarget&&message.original_avatar!==run.groupTarget.avatar)throw Error('그룹 commit 전 original_avatar TARGET 변경');
            if(!live(run)||message.mes!==raw||c.chat[id]!==message)return;
            run.consumed=true;
            message.mes=parsed.prose;message.extra??={};message.extra[ANCHOR_KEY]??=nonce();
            if(Array.isArray(message.swipes)&&Number.isInteger(message.swipe_id))message.swipes[message.swipe_id]=parsed.prose;
            // Only one Snapshot is persisted. No inference, raw Stage output,
            // old Snapshot, or snapshot copy in message.extra/swipe_info.
            const snapshot=run.mode==='swipe'?{...run.prior,selectedSubjectId:run.selection.selectedSubjectId,selectedActionId:run.selection.selectedActionId}:
                {...parsed.space,chatId:run.chatId,sourceTurnAnchor:message.extra[ANCHOR_KEY],sourceFingerprint:run.sourceFingerprint,
                    cardBindingSignature:run.cardBindingSignature,nativeSourceFingerprint:run.nativeSourceFingerprint,promptManagerFingerprint:run.promptManagerFingerprint,
                    createdAt:new Date().toISOString(),version:VERSION,schemaVersion:1,promptVersion:PROMPT_VERSION,
                    ...(run.groupTarget?{targetAvatar:run.groupTarget.avatar}:{}),
                    worldBindings:run.worldBindings,worldStatus:run.bindings.worldStatus};
            snapshot.outputFingerprint=outputFingerprint;
            // Validate the complete result before committing either L bindings
            // or Snapshot. No model I/O and no await inside this commit block.
            for(const {entry,spans,fingerprint,sourceSpeaker} of updates)
                Object.assign(entry,{spans,fingerprint,currentFingerprint:fingerprint,sourceSpeaker,indexed:true,status:'fresh'});
            stateFor(c).currentSnapshot=snapshot;
            await synchronizeMessages(c,{create:false}); c.updateMessageBlock?.(id,message); await persist(c,{chat:true});
            active=null;status=run.mode==='swipe'?'Swipe 완료 · 재판단 0회':'Snapshot 확정 · 원래 completion 1회';update();
        }catch(e){if(active===run){cancel('invalid-output');setError(e);}}
    }
    async function reconcile(event,id) {
        const native=getContext(),chatId=identity(native),state=stateFor(native),old=state.currentSnapshot;
        let c;
        try{c=old?.targetAvatar&&native.groupId!=null?groupTargetContext(native,{avatar:old.targetAvatar,chatId:old.chatId}):cardContext();}
        catch(e){
            if(native.groupId==null)throw e;
            // Retire a disappeared group target before card resolution can
            // prevent the normal message/metadata cleanup from running.
            state.currentSnapshot=null;
            if(active?.groupTarget&&active.chatId===chatId&&!live(active))cancel('group-target-unavailable');
            await synchronizeMessages(native,{create:false});await persist(native,{chat:true});update();return;
        }
        await synchronizeMessages(c,{create:false});
        if(c.groupId==null||c.characters?.[c.characterId]?.avatar)await synchronizeCard(c);
        if(identity(getContext())!==chatId)return;
        if(old) {
            const last=c.chat.at(-1);
            if(!c.chat.some(m=>m.extra?.[ANCHOR_KEY]===old.sourceTurnAnchor)||event==='MESSAGE_EDITED'||event==='MESSAGE_UPDATED'||event==='CHARACTER_EDITED')state.currentSnapshot=null;
            else if(event==='MESSAGE_SWIPED'&&id===c.chat.length-1&&typeof last.swipes?.[last.swipe_id]==='string') {
                // Existing variant selection has no stored S/A provenance.
                // A not-yet-created swipe (index === swipes.length) is instead
                // handled by the pending CJ generation and received().
                state.currentSnapshot=null;
                if(active?.mode==='swipe')cancel('existing-swipe-selected');
            }
            else if(last?.extra?.[ANCHOR_KEY]===old.sourceTurnAnchor&&!await snapshotValid(c,old))state.currentSnapshot=null;
        }
        await persist(c,{chat:true});update();
    }
    function init() {
        const c=getContext();
        if(c.mainApi==='openai')void managedManager().catch(()=>{});
        if(!macroContext&&typeof c.registerMacro==='function'&&typeof c.unregisterMacro==='function'){
            for(const key of INFRA_KEYS)c.registerMacro(macroName(key),()=>{
                const run=active;if(!run||run.sent||!live(run))return '';
                return `<!--CJ_OWNED:${run.nonce}-->${runEntries(run)[key]}<!--/CJ_OWNED:${run.nonce}-->`;
            },'Character Judgment request-local content; expanded before native token budgeting');
            macroContext=c;
        }
        const on=(name,fn,first=false)=>{
            if(subscriptions.has(name)||!getEvents(c)[name]||typeof c.eventSource?.on!=='function')return;
            const safe=(...args)=>Promise.resolve(fn(...args)).catch(setError);
            subscriptions.set(name,listen(c,name,safe,first));
        };
        on('GENERATION_STARTED',(type,_options,dryRun)=>{if(dryRun)return;if(active)ambiguity=true;cancel(type==='impersonate'?'Impersonate · 인덱싱 없음':'generation-start');},true);
        on('GENERATION_STOPPED',()=>cancel('Stop'),true);
        on('CHAT_CHANGED',async()=>{cancel('chat-changed');groupDraft=null;displayedGroupTarget=null;ambiguity=false;const c=getContext();if(c.characters?.[c.characterId]?.avatar)await synchronizeCard(c);update();},true);
        on('CHARACTER_RENAMED',async(oldAvatar,newAvatar)=>{cancel('card-renamed');await renameCard(getContext(),oldAvatar,newAvatar);update();},true);
        on('GROUP_MEMBER_DRAFTED',memberId=>{
            if(active)cancel('target-changed');groupDraft=null;
            const c=getContext();if(c.groupId!=null){groupDraft=captureGroupTarget(c,memberId);displayedGroupTarget=groupDraft;}update();
        },true);
        on('GROUP_WRAPPER_FINISHED',data=>{
            const c=getContext();
            if(c.groupId==null||data?.selected_group==null||String(data.selected_group)!==String(c.groupId))return;
            const chatId=identity(c);
            if(groupDraft?.chatId===chatId)groupDraft=null;
            if(active?.groupTarget?.chatId===chatId)cancel('group-wrapper-finished-without-valid-snapshot');
            update();
        },true);
        on('CHAT_COMPLETION_PROMPT_READY',promptReady);
        on('CHAT_COMPLETION_SETTINGS_READY',observeSettings);
        on('WORLD_INFO_ACTIVATED',async list=>{
            const run=active;if(!run||run.sent||!live(run)||!Array.isArray(list))return;
            try{
                const bound=await observeActivated(getContext(),list,()=>{if(active!==run||!live(run))throw Error('WI 관찰 중 요청 변경');});
                if(active===run){run.bindings.worlds=bound;run.bindings.worldStatus='native-activation-observed';}
            }catch(e){if(active===run){cancel('world-binding-error');setError(e);}}
        });
        on('WORLDINFO_UPDATED',async world=>{
            const c=getContext();
            const state=stateFor(c);
            if(state.currentSnapshot?.worldBindings?.some(x=>x[0]===world))state.currentSnapshot=null;
            if(active?.bindings.worlds.some(x=>x.world===world))cancel('world-edited');
            // Retire dependent state before asynchronous catalog access: even a
            // deleted/unreadable book must not leave the old run committable.
            await readWorld(c,world);
            await c.saveSettingsDebounced?.();
            await persist(c);update();
        });
        on('MESSAGE_RECEIVED',received);
        for(const name of ['MESSAGE_SENT','MESSAGE_EDITED','MESSAGE_UPDATED','MESSAGE_DELETED','MESSAGE_SWIPED','MESSAGE_SWIPE_DELETED','CHARACTER_EDITED'])on(name,id=>reconcile(name,id));
        on('GENERATION_ENDED',()=>{if(active&&!active.ambiguous&&!(active.groupTarget&&active.sent))cancel('generation-ended-without-valid-snapshot');});
    }
    return {init,intercept,cancel,promptReady,received,reconcile,observeSettings,cardContext,getManager:managedManager,
        diagnostics:()=>({status,error,pending:Boolean(active),mode:active?.mode??null,nonce:active?.nonce??null,internalNormalCalls:0}),
        dispose(){bridgeEpoch++;bridge.dispose();cancel('dispose');groupDraft=null;displayedGroupTarget=null;for(const off of subscriptions.values())off();subscriptions.clear();if(macroContext)for(const key of INFRA_KEYS)macroContext.unregisterMacro(macroName(key));macroContext=null;}};
}

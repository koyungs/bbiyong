import { identity } from './state.js';

// GROUP_MEMBER_DRAFTED supplies a native characters-array lookup, not a
// persistent ID or group.members ordinal. Keep only its exact avatar identity.
export function captureGroupTarget(context, memberId=context.characterId) {
    if(context.groupId==null)return null;
    if(!['number','string'].includes(typeof memberId)||(typeof memberId==='string'&&!/^\d+$/.test(memberId))||!Number.isInteger(Number(memberId)))throw Error('그룹 생성 TARGET CHARACTER를 확인할 수 없습니다.');
    const avatar=context.characters?.[Number(memberId)]?.avatar;
    if(typeof avatar!=='string'||!avatar)throw Error('그룹 생성 TARGET CHARACTER avatar가 없습니다.');
    const binding=Object.freeze({avatar,chatId:identity(context)});
    groupTargetContext(context,binding);
    return binding;
}

export function groupTargetContext(context, binding) {
    if(!binding)return context;
    if(context.groupId==null||identity(context)!==binding.chatId)throw Error('그룹 TARGET CHARACTER 채팅 binding 변경');
    const matches=(context.characters??[]).filter(c=>c?.avatar===binding.avatar);
    if(matches.length!==1)throw Error('그룹 TARGET CHARACTER 카드가 없거나 avatar가 중복됩니다.');
    if(Array.isArray(context.groups)) {
        const group=context.groups.find(g=>String(g.id)===String(context.groupId));
        if(!group?.members?.includes(binding.avatar))throw Error('그룹 TARGET CHARACTER 멤버 binding 변경');
    }
    // A request-local one-card view lets existing card/fingerprint helpers use
    // the captured avatar. Slot 0 is only this projection's lookup, never identity.
    // Re-resolve the actual native card on each validation; edits are not hidden.
    return new Proxy(context,{get(object,key,receiver){
        if(key==='characters')return [matches[0]];
        if(key==='characterId')return 0;
        return Reflect.get(object,key,receiver);
    }});
}

import { registerAppRenderer, closeWindow } from '../core.js';
import { state } from '../state.js';

// 邮箱验证窗口配置：部署者可修改 baseURL 和路径，不需要改 UI 逻辑。
const EMAIL_VERIFY_CONFIG = {
    baseURL: 'https://mxosapi.neocn.top',
    sendPath: '/api/send-code',
    verifyPath: '/api/verify-code',
    sendMethod: 'POST',
    verifyMethod: 'POST',
    fields: { email: 'email', code: 'code' },
    response: { success: 'success', message: 'message', expiresIn: 'data.expiresIn' }
};

const DISPOSABLE_DOMAINS = new Set(['10minutemail.com','guerrillamail.com','mailinator.com','tempmail.com','temp-mail.org','yopmail.com','throwawaymail.com','getnada.com','trashmail.com','sharklasers.com','dispostable.com','maildrop.cc']);

function apiUrl(path) { return EMAIL_VERIFY_CONFIG.baseURL.replace(/\/+$/, '') + path; }
function emailError(email) {
    const v = String(email || '').trim().toLowerCase();
    if (!v) return '请输入邮箱';
    if (!/^[^\s@]+@[^\s@]+\.(com|cn|org|net)$/i.test(v)) return '仅支持 .com/.cn/.org/.net 邮箱';
    const domain = v.split('@')[1] || '';
    if (DISPOSABLE_DOMAINS.has(domain)) return '不支持一次性邮箱';
    return '';
}
function notifyToast(message, type = 'info') {
    if (window.MXOS && typeof window.MXOS.notify === 'function') {
        try { window.MXOS.notify({ title: type === 'error' ? '邮箱验证' : '提示', body: message, type, duration: 3000 }); return; } catch {}
    }
    let box = document.getElementById('mxosEmailVerifyToasts');
    if (!box) { box = document.createElement('div'); box.id = 'mxosEmailVerifyToasts'; document.body.appendChild(box); }
    const item = document.createElement('div'); item.className = 'mxos-ev-toast ' + type; item.textContent = message; box.appendChild(item);
    setTimeout(() => item.remove(), 3000);
}
async function requestJson(path, method, payload) {
    const res = await fetch(apiUrl(path), { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.success === false) throw new Error((json && (json.message || (json.error && json.error.message))) || '请求失败');
    return json;
}
function closeThisWindow(windowEl) { const w = state.windows.find(x => x.element === windowEl); if (w) closeWindow(w); }

function injectStyles() {
    if (document.getElementById('mxos-email-verify-style')) return;
    const style = document.createElement('style');
    style.id = 'mxos-email-verify-style';
    style.textContent = `
    .mxos-ev{height:100%;padding:24px;color:var(--text-primary,#fff);background:linear-gradient(135deg,rgba(30,41,59,.72),rgba(15,23,42,.55));backdrop-filter:blur(22px);box-sizing:border-box;overflow:auto}
    .mxos-ev-card{max-width:520px;margin:0 auto;padding:22px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.08);box-shadow:0 20px 70px rgba(0,0,0,.28)}
    .mxos-ev-title{font-size:22px;font-weight:700;margin-bottom:6px}.mxos-ev-sub{font-size:13px;color:var(--text-secondary,#94a3b8);margin-bottom:20px}.mxos-ev-row{margin-bottom:16px}.mxos-ev-label{font-size:12px;color:var(--text-secondary,#94a3b8);margin-bottom:7px;display:block}.mxos-ev-input-wrap{position:relative}.mxos-ev-input{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(0,0,0,.18);color:inherit;padding:12px 42px 12px 12px;outline:none}.mxos-ev-input:focus{border-color:#60a5fa;box-shadow:0 0 0 3px rgba(96,165,250,.16)}
    .mxos-ev-mark{position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:18px}.mxos-ev-mark.ok{color:#22c55e}.mxos-ev-mark.bad{color:#ef4444}.mxos-ev-hint{min-height:17px;margin-top:6px;font-size:12px;color:#ef4444}.mxos-ev-slider{height:42px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.13);position:relative;overflow:hidden;user-select:none}.mxos-ev-slider-fill{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,#3b82f6,#22c55e);opacity:.45}.mxos-ev-slider-text{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:13px;color:var(--text-secondary,#cbd5e1)}.mxos-ev-slider-knob{position:absolute;left:3px;top:3px;width:36px;height:36px;border-radius:50%;background:#fff;color:#1f2937;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(0,0,0,.25);cursor:grab}.mxos-ev-slider.done .mxos-ev-slider-text{color:#86efac}.mxos-ev-btns{display:flex;gap:10px;flex-wrap:wrap}.mxos-ev-btn{border:0;border-radius:12px;padding:10px 16px;background:#3b82f6;color:#fff;font-weight:600;cursor:pointer}.mxos-ev-btn.secondary{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.14)}.mxos-ev-btn:disabled{opacity:.45;cursor:not-allowed}.mxos-ev-code{letter-spacing:6px;font-size:18px;text-align:center}.mxos-ev-toast{padding:10px 14px;border-radius:10px;background:rgba(15,23,42,.92);color:#fff;margin-top:8px;border-left:3px solid #60a5fa;box-shadow:0 12px 32px rgba(0,0,0,.35)}.mxos-ev-toast.error{border-left-color:#ef4444}.mxos-ev-toast.success{border-left-color:#22c55e}#mxosEmailVerifyToasts{position:fixed;right:22px;bottom:22px;z-index:200000}`;
    document.head.appendChild(style);
}

registerAppRenderer('email-verification', (contentEl, windowEl) => {
    injectStyles();
    let sliderOk = false, sending = false, countdown = 0, timer = null, errorCount = 0;
    contentEl.innerHTML = `<div class="mxos-ev"><div class="mxos-ev-card"><div class="mxos-ev-title">邮箱验证</div><div class="mxos-ev-sub">输入邮箱并通过滑块验证后获取 6 位验证码</div><div class="mxos-ev-row"><label class="mxos-ev-label">邮箱</label><div class="mxos-ev-input-wrap"><input id="evEmail" class="mxos-ev-input" type="email" placeholder="name@example.com"><span id="evMark" class="mxos-ev-mark"></span></div><div id="evEmailHint" class="mxos-ev-hint"></div></div><div class="mxos-ev-row"><label class="mxos-ev-label">人机验证</label><div id="evSlider" class="mxos-ev-slider"><div id="evFill" class="mxos-ev-slider-fill"></div><div id="evText" class="mxos-ev-slider-text">拖动滑块到最右侧</div><div id="evKnob" class="mxos-ev-slider-knob">→</div></div></div><div class="mxos-ev-row mxos-ev-btns"><button id="evSend" class="mxos-ev-btn" disabled>发送验证码</button><button id="evReset" class="mxos-ev-btn secondary">重置滑块</button></div><div class="mxos-ev-row"><label class="mxos-ev-label">验证码</label><input id="evCode" class="mxos-ev-input mxos-ev-code" inputmode="numeric" maxlength="6" placeholder="000000"></div><div class="mxos-ev-btns"><button id="evVerify" class="mxos-ev-btn">验证</button></div></div></div>`;
    const emailEl = contentEl.querySelector('#evEmail'), markEl = contentEl.querySelector('#evMark'), hintEl = contentEl.querySelector('#evEmailHint'), sendBtn = contentEl.querySelector('#evSend'), codeEl = contentEl.querySelector('#evCode'), verifyBtn = contentEl.querySelector('#evVerify'), resetBtn = contentEl.querySelector('#evReset'), slider = contentEl.querySelector('#evSlider'), knob = contentEl.querySelector('#evKnob'), fill = contentEl.querySelector('#evFill'), text = contentEl.querySelector('#evText');
    function validEmail(){ const err=emailError(emailEl.value); markEl.textContent=emailEl.value?(err?'✕':'✓'):''; markEl.className='mxos-ev-mark '+(emailEl.value?(err?'bad':'ok'):''); hintEl.textContent=err&&emailEl.value?err:''; sendBtn.disabled=!!err||!sliderOk||sending||countdown>0; return !err; }
    function resetSlider(){ sliderOk=false; slider.classList.remove('done'); knob.style.left='3px'; fill.style.width='0'; text.textContent='拖动滑块到最右侧'; validEmail(); }
    function startCountdown(sec){ countdown=sec; clearInterval(timer); const tick=()=>{ if(countdown<=0){ clearInterval(timer); sending=false; sendBtn.textContent='发送验证码'; validEmail(); return;} sendBtn.textContent=countdown+' 秒后重发'; sendBtn.disabled=true; countdown--; }; tick(); timer=setInterval(tick,1000); }
    emailEl.addEventListener('input', validEmail); codeEl.addEventListener('paste',()=>setTimeout(()=>{ codeEl.value=codeEl.value.replace(/\D/g,'').slice(0,6); },0)); codeEl.addEventListener('input',()=>{ codeEl.value=codeEl.value.replace(/\D/g,'').slice(0,6); }); resetBtn.onclick=resetSlider;
    let dragging=false,startX=0,startLeft=0; knob.addEventListener('pointerdown',e=>{ if(sliderOk) return; dragging=true; startX=e.clientX; startLeft=parseFloat(knob.style.left)||3; knob.setPointerCapture(e.pointerId); }); knob.addEventListener('pointermove',e=>{ if(!dragging) return; const max=slider.clientWidth-knob.clientWidth-3; const left=Math.max(3,Math.min(max,startLeft+e.clientX-startX)); knob.style.left=left+'px'; fill.style.width=(left+knob.clientWidth/2)+'px'; if(left>=max-2){ sliderOk=true; dragging=false; slider.classList.add('done'); text.textContent='验证已通过'; validEmail(); }}); knob.addEventListener('pointerup',()=>{ if(!sliderOk){ dragging=false; resetSlider(); }});
    sendBtn.onclick=async()=>{ if(!validEmail()) return notifyToast('请先输入正确邮箱','error'); sending=true; sendBtn.disabled=true; try{ const payload={}; payload[EMAIL_VERIFY_CONFIG.fields.email]=emailEl.value.trim(); const json=await requestJson(EMAIL_VERIFY_CONFIG.sendPath,EMAIL_VERIFY_CONFIG.sendMethod,payload); notifyToast(json.message||'验证码已发送','success'); codeEl.focus(); startCountdown(60); }catch(e){ sending=false; notifyToast(e.message||'发送失败','error'); validEmail(); }};
    verifyBtn.onclick=async()=>{ if(!validEmail()) return notifyToast('邮箱格式无效','error'); const code=codeEl.value.trim(); if(!/^\d{6}$/.test(code)) return notifyToast('请输入 6 位验证码','error'); try{ const payload={}; payload[EMAIL_VERIFY_CONFIG.fields.email]=emailEl.value.trim(); payload[EMAIL_VERIFY_CONFIG.fields.code]=code; const json=await requestJson(EMAIL_VERIFY_CONFIG.verifyPath,EMAIL_VERIFY_CONFIG.verifyMethod,payload); notifyToast(json.message||'验证通过','success'); if(window.MXOS&&window.MXOS.notify) window.MXOS.notify({title:'验证成功',body:'邮箱验证已通过',type:'success',duration:3000}); closeThisWindow(windowEl); }catch(e){ errorCount++; notifyToast(e.message||'验证码错误','error'); if(errorCount>=3){ errorCount=0; resetSlider(); notifyToast('错误次数过多，请重新完成滑块验证','error'); } }};
    validEmail();
});

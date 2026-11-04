export function createRecoveryUI({$,api,esc}){
  const token=()=>new URLSearchParams(location.hash.split('?')[1]||'').get('token')||'';
  function forgot(){return `<section class="login-layout"><h2>Нууц үгээ мартсан уу?</h2><p>Бүртгэлтэй имэйлдээ 20 минутын хугацаатай сэргээх холбоос авна.</p><form id="forgotForm"><label class="field"><span>Имэйл хаяг</span><input type="email" name="email" autocomplete="email" maxlength="254" required></label><p class="error" role="alert"></p><p class="recovery-message" role="status"></p><button class="button">Сэргээх холбоос авах</button></form><p><a href="#login">Нэвтрэх хуудас →</a></p><small>Google дансаар бүртгүүлсэн бол Google товчоор нэвтэрнэ үү.</small></section>`;}
  function reset(){return `<section class="login-layout"><h2>Шинэ нууц үг</h2><form id="resetForm"><label class="field"><span>Шинэ нууц үг — 12+ тэмдэгт</span><input type="password" name="password" minlength="12" maxlength="256" autocomplete="new-password" required></label><label class="field"><span>Нууц үг давтах</span><input type="password" name="confirmPassword" minlength="12" maxlength="256" autocomplete="new-password" required></label><p class="error" role="alert"></p><p class="recovery-message" role="status"></p><button class="button">Нууц үг шинэчлэх</button></form><p><a href="#forgot">Шинэ холбоос авах</a> · <a href="#login">Нэвтрэх</a></p></section>`;}
  document.addEventListener('submit',async event=>{
    const form=event.target;if(!['forgotForm','resetForm'].includes(form.id))return;event.preventDefault();
    const button=form.querySelector('button');if(button.disabled)return;button.disabled=true;const label=button.textContent;button.textContent='Хүлээнэ үү…';form.querySelector('.error').textContent='';
    try{
      const body=Object.fromEntries(new FormData(form)),resetting=form.id==='resetForm';if(resetting)body.token=token();
      const result=await api(resetting?'auth/password/reset':'auth/password/forgot',body);
      if(!form.isConnected)return;
      form.querySelector('.recovery-message').textContent=result.message;
      if(resetting){form.reset();for(const input of form.querySelectorAll('input'))input.disabled=true;button.hidden=true;history.replaceState(null,'',location.pathname+location.search+'#reset');}
    }catch(error){if(form.isConnected)form.querySelector('.error').textContent=error.message;}
    finally{button.disabled=false;button.textContent=label;}
  });
  return {forgot,reset};
}

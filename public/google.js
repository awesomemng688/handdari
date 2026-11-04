export function createGoogleUI(ctx) {
  const {$,api,toast,openForm,field,getUser}=ctx;
  let config={enabled:false},library=null;
  async function load(){try{config=(await api('auth/config')).google;}catch{config={enabled:false};}}
  function loadLibrary(){
    if(window.google?.accounts?.id)return Promise.resolve();
    if(!library)library=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=resolve;script.onerror=()=>reject(new Error('Google-тэй холбогдож чадсангүй. Имэйл, нууц үгээр нэвтэрч болно.'));document.head.append(script);});
    return library;
  }
  function slot(text){const root=document.createElement('div');root.className='google-auth-slot';root.innerHTML=`<div class="google-button-host"></div><p class="google-auth-status" role="status"></p><div class="auth-separator"><span>${text}</span></div>`;return root;}
  async function button(root,intent,onCredential){
    const host=root.querySelector('.google-button-host'),status=root.querySelector('.google-auth-status');
    if(!config.enabled){const disabled=document.createElement('button');disabled.className='button google-disabled';disabled.disabled=true;disabled.textContent='Google-ээр нэвтрэх';host.append(disabled);status.textContent='Google нэвтрэлт хараахан идэвхжээгүй байна.';return;}
    try{
      await loadLibrary();if(!root.isConnected)return;
      const {nonce}=await api('auth/google/nonce?intent='+intent);if(!root.isConnected)return;
      window.google.accounts.id.initialize({client_id:config.clientId,nonce,auto_select:false,callback:async response=>{
        if(!root.isConnected)return;status.textContent='Google бүртгэлийг шалгаж байна…';host.inert=true;
        try{await onCredential(response.credential);}
        catch(error){if(root.isConnected){status.textContent=error.message;host.inert=false;const retry=document.createElement('button');retry.type='button';retry.className='button secondary small';retry.textContent='Дахин оролдох';retry.onclick=()=>{host.replaceChildren();status.textContent='';button(root,intent,onCredential)};host.replaceChildren(retry);}}
      }});
      window.google.accounts.id.renderButton(host,{type:'standard',theme:'outline',size:'large',shape:'rectangular',text:'continue_with',width:Math.min(360,Math.max(220,root.clientWidth)),locale:'mn'});
    }catch(error){if(root.isConnected)status.textContent=error.message;}
  }
  async function signin(credential,root){
    const requestedRole=$('#registerForm')?.elements.requestedRole.value||'customer';
    const result=await api('auth/google',{credential,requestedRole});
    if(result.pending){root.querySelector('.google-auth-status').textContent=result.message;toast(result.message);return;}
    ctx.onUser(result.user);await ctx.refresh();ctx.render();
  }
  function mount(page){
    if(!getUser()&&['login','register'].includes(page)){
      const form=page==='login'?$('#loginForm'):$('#registerForm');if(!form)return;
      const root=slot('эсвэл имэйл, нууц үгээр');form.before(root);button(root,'signin',credential=>signin(credential,root));
    }
    const user=getUser();if(!user)return;
    if(user.passwordEnabled===0){for(const node of document.querySelectorAll('[data-action=password]'))node.hidden=true;}
    if(page==='settings'&&!user.mustChangePassword){
      const section=document.createElement('section');section.className='panel section-space';section.innerHTML='<div class="panel-heading"><h2>Google дансны холболт</h2></div><div class="panel-body copy"><p class="google-provider-state">Холболт шалгаж байна…</p><button class="button secondary" data-action="googleLink" hidden>Google данс холбох</button></div>';$('#content').append(section);
      api('auth/providers').then(result=>{if(!section.isConnected||getUser()?.id!==user.id)return;section.querySelector('p').textContent=result.linked?'Google данс холбогдсон. Google товчоор нэвтэрч болно.':result.google.enabled?'Ижил имэйлтэй Google дансаа холбож, дараа нь Google товчоор нэвтэрч болно.':'Google нэвтрэлтийг админ хараахан идэвхжүүлээгүй байна.';section.querySelector('button').hidden=result.linked||!result.google.enabled||!result.passwordEnabled;if(!result.passwordEnabled)section.querySelector('p').textContent+=' Та Google дансаар нэвтэрдэг. Имэйл/нууц үг нэмэх бол админтай холбогдоно уу.';}).catch(error=>{if(section.isConnected)section.querySelector('p').textContent=error.message;});
    }
  }
  async function link(){
    const user=getUser();if(!user||!user.passwordEnabled)return;
    let credential=null;
    openForm('Google данс холбох',[field('currentPassword','Одоогийн HANDARI нууц үг','password','',null,true,true)],async body=>{if(!credential)throw new Error('Эхлээд ижил имэйлтэй Google дансаа сонгоно уу.');await api('auth/google/link',{credential,currentPassword:body.currentPassword});$('#modal').close();toast('Google данс холбогдлоо.');await ctx.refresh();},'Google дансны имэйл таны бүртгэлийн имэйлтэй адил байна. Имэйл таарлаа гээд дансуудыг автоматаар нэгтгэхгүй.');
    const root=slot('HANDARI нууц үгээрээ батална');root.classList.add('wide');$('#fields').prepend(root);
    await button(root,'link',async value=>{credential=value;root.querySelector('.google-auth-status').textContent='Google данс сонгогдлоо. HANDARI нууц үгээ оруулаад Хадгалах дарна уу.';});
  }
  return {load,mount,link};
}

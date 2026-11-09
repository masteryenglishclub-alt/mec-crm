/* New view only. All dynamic content uses DOM text nodes; no credentials or path input. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory;
 else {const M=root.MEC;M.privateFeedback=factory(M,{document:root.document,URL:root.URL,setTimeout:root.setTimeout.bind(root),clearTimeout:root.clearTimeout.bind(root)});}
})(typeof window!=='undefined'?window:globalThis,function createPrivateFeedbackView(M,env){
 'use strict';
 const doc=env.document,service=()=>M.api&&M.api.feedbackDocuments;
 const STATUS={draft:'Borrador · carga pendiente',uploaded:'Carga verificada · pendiente de publicar',published:'Publicado',withdrawn:'Retirado'};
 let sequence=0;const activeViews=new Set();
 function destroyIn(container){if(!container||typeof container.contains!=='function')return;for(const entry of Array.from(activeViews))if(entry.root.isConnected===false||container.contains(entry.root))entry.destroy();}
 function el(tag,cls,text){const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;}
 function append(parent,...children){children.forEach(c=>parent.appendChild(c));return parent;}
 function field(label,input,id){input.id=id;const l=el('label','mfp-field');const caption=el('span','',label);l.htmlFor=id;append(l,caption,input);return l;}
 function size(bytes){return (Number(bytes)/1048576).toFixed(2)+' MiB';}
 function date(value){const d=new Date(value);return Number.isNaN(d.getTime())?'Fecha sin registrar':new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeZone:'America/Bogota'}).format(d);}
 async function mount(container,options,admin){
  destroyIn(container);
  const instance=++sequence,root=el('section','mfp'),header=el('header','mfp-heading');
  root.setAttribute('aria-label',admin?'Feedback privado del estudiante':'Mis documentos privados');
  const eyebrow=el('p','mfp-eyebrow','Mastery English Club');
  append(header,eyebrow,el('h2','',admin?'Archivos privados del estudiante':'Mis documentos privados'));
  const status=el('p','mfp-status','Comprobando acceso…');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const content=el('div','mfp-content');append(root,header,status,content);container.replaceChildren(root);
  let destroyed=false,invalidated=false,busy=false,student=null,sessionActor=null,listBox=null,form=null,titleInput=null,fileInput=null,confirmInput=null,uploadButton=null,stopAuth=null;
  const urls=new Set(),urlTimers=new Map();
  const live=()=>!destroyed&&!invalidated&&root.isConnected!==false&&container.contains(root);
  function releaseResources(){
    if(stopAuth){const stop=stopAuth;stopAuth=null;stop();}
    for(const timer of urlTimers.values())env.clearTimeout(timer);urlTimers.clear();
    urls.forEach(url=>env.URL.revokeObjectURL(url));urls.clear();
  }
  function destroy(){destroyed=true;releaseResources();if(container.contains(root))root.remove();activeViews.delete(entry);}
  const controller={refresh,destroy},entry={root,destroy};activeViews.add(entry);
  function invalidate(){
    if(destroyed||invalidated)return;invalidated=true;releaseResources();
    if(form)form.reset();content.replaceChildren();form=null;fileInput=null;titleInput=null;confirmInput=null;listBox=null;student=null;sessionActor=null;
    root.setAttribute('aria-busy','false');status.textContent='Tu sesión cambió o terminó. Inicia sesión de nuevo para ver tus documentos.';status.classList.toggle('mfp-error',true);activeViews.delete(entry);
  }
  function announce(message,error=false){if(!live())return;status.textContent=message;status.classList.toggle('mfp-error',error);}
  function setBusy(value){busy=value;root.setAttribute('aria-busy',String(value));if(form)Array.from(form.elements||[]).forEach(x=>{x.disabled=value;});if(listBox)listBox.querySelectorAll('button').forEach(x=>{x.disabled=value;});}
  function card(item){
   const article=el('article','mfp-document');const text=el('div','mfp-document-text');
   append(text,el('h3','',item.title||'Feedback'),el('p','mfp-meta',date(item.created_at)+' · PDF · '+size(item.size_bytes)));
   if(admin)append(text,el('p','mfp-badge',STATUS[item.status]||'Estado desconocido'));
   const actions=el('div','mfp-actions');
   function button(label,action){const b=el('button','mfp-button'+(action==='publish'?' mfp-button-gold':''),label);b.type='button';b.dataset.mfpAction=action;b.dataset.documentId=item.id;append(actions,b);}
   if(item.status==='uploaded'||item.status==='published')button(admin?'Descargar PDF':'Descargar mi PDF','download');
   if(admin&&item.status==='draft')button('Verificar carga pendiente','confirm');
   if(admin&&item.status==='uploaded'&&item.uploaded_at)button('Publicar para este estudiante','publish');
   append(article,text,actions);return article;
  }
  async function refresh(){
   if(!live())return;
   const rows=await service().list(admin?student.id:undefined);if(!live())return; const items=rows.filter(x=>admin?x.student_id===student.id:x.status==='published'&&sessionActor&&x.student_id===sessionActor.actor_id);
   listBox.replaceChildren();
   if(items.length)items.forEach(x=>listBox.appendChild(card(x)));
   else append(listBox,el('p','mfp-empty',admin?'Este perfil todavía no tiene documentos privados.':'Todavía no tienes documentos publicados en esta sección.'));
  }
  function buildAdminForm(){
   form=el('form','mfp-upload');form.noValidate=true;
   titleInput=el('input');titleInput.type='text';titleInput.required=true;titleInput.maxLength=160;titleInput.autocomplete='off';
   fileInput=el('input');fileInput.type='file';fileInput.accept='.pdf,application/pdf';fileInput.required=true;
   const grid=el('div','mfp-form-grid');append(grid,field('Título del documento',titleInput,'mfp-title-'+instance),field('Archivo PDF',fileInput,'mfp-file-'+instance));
   const help=el('p','mfp-help','PDF de hasta 10 MiB. La carga queda privada y sin publicar hasta que la verifiques y pulses Publicar.');help.id='mfp-help-'+instance;fileInput.setAttribute('aria-describedby',help.id);
   confirmInput=el('input');confirmInput.type='checkbox';confirmInput.required=true;
   const confirmation=el('label','mfp-confirm');append(confirmation,confirmInput,el('span','','Confirmo que este PDF corresponde a '+student.full_name+'.'));
   uploadButton=el('button','mfp-button mfp-button-gold','Cargar como borrador privado');uploadButton.type='submit';
   append(form,grid,help,confirmation,uploadButton);
   form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!live())return;
    if(!confirmInput.checked){announce('Confirma el destinatario antes de cargar el PDF.',true);confirmInput.focus();return;}
    const file=fileInput.files&&fileInput.files[0];if(!file){announce('Selecciona un PDF.',true);fileInput.focus();return;}
    setBusy(true);announce('Verificando el PDF y cargándolo de forma privada…');
    try{await service().uploadDraft({studentId:student.id,title:titleInput.value,file});if(!live())return;form.reset();await refresh();announce('Carga verificada. El archivo sigue privado y pendiente de publicar.');}
    catch(error){announce(error.message||'No se completó la carga. No se publicó el documento.',true);try{await refresh();}catch(_){} }
    finally{if(live())setBusy(false);}
   });
   return form;
  }
  root.addEventListener('click',async event=>{
   const button=event.target.closest&&event.target.closest('[data-mfp-action]');if(!button||!root.contains(button)||busy||!live())return;
   setBusy(true);const id=button.dataset.documentId,action=button.dataset.mfpAction;
   try{
    if(action==='download'){
     announce('Preparando tu descarga privada…');const result=await service().downloadFile(id);if(!live())return;
     const local=env.URL.createObjectURL(result.blob);urls.add(local);
     const a=el('a');a.href=local;a.download=result.fileName;a.rel='noopener';a.hidden=true;root.appendChild(a);
     const timer=env.setTimeout(()=>{env.URL.revokeObjectURL(local);urls.delete(local);urlTimers.delete(local);},30000);urlTimers.set(local,timer);
     try{a.click();}finally{a.remove();}
     announce('Descarga preparada. El archivo no tiene un enlace público.');
    }else if(action==='confirm'&&admin){await service().confirmUpload(id);await refresh();announce('Carga verificada. Revisa el documento antes de publicarlo.');}
    else if(action==='publish'&&admin){await service().publish(id);await refresh();announce('Documento publicado únicamente en el perfil autorizado. No se envió ningún mensaje.');}
   }catch(error){announce(error.message||'No se pudo completar la operación.',true);}
   finally{if(live())setBusy(false);}
  });
  try{
   if(!service())throw Error('El módulo de documentos privados todavía no está instalado.');
   const p=await service().preflight();sessionActor=p;
   stopAuth=await service().watchIdentity(invalidate);
   if(!live()){releaseResources();return controller;}
   let code=null;
   if(admin){if(p.actor_role!=='admin'||p.can_write!==true)throw Error('Solo administración puede gestionar estos archivos.');student=await service().studentContext(options&&options.studentId);code=student.student_code;}
   else {if(p.actor_role!=='student')throw Error('Esta sección corresponde al portal del estudiante.');const assigned=await service().studentCode();code=assigned?assigned.student_code:null;}
   if(!live()){releaseResources();return controller;}
   if(admin){
    const recipient=el('div','mfp-recipient');append(recipient,el('h3','',student.full_name),el('p','mfp-student-id','ID del estudiante: '+(code||'Por asignar')),el('p','mfp-meta','Identificador técnico del perfil (UUID): '+student.id),el('p','mfp-help','El UUID confirma el destinatario ante nombres iguales. El ID del estudiante no es una contraseña ni un permiso de acceso.'));append(content,recipient,buildAdminForm());
   }else append(content,el('p','mfp-student-id','ID del estudiante: '+(code||'Por asignar')),el('p','mfp-help','Aquí aparecen los PDF publicados para tu sesión. Descárgalos desde este portal.'));
   listBox=el('div','mfp-document-list');listBox.setAttribute('aria-label','Documentos del perfil');append(content,listBox);await refresh();announce('');
  }catch(error){announce(error.message||'No se pudo comprobar el acceso privado.',true);}
  finally{if(!live())releaseResources();if(root.isConnected===false)destroy();}
  return controller;
 }
 return Object.freeze({destroyIn,attachAdminProfile:(profileRoot,student)=>{destroyIn(profileRoot);const host=el('div','mfp-profile-host');profileRoot.appendChild(host);return mount(host,{studentId:student&&student.id},true);},mountAdmin:(container,options)=>mount(container,options,true),mountStudent:container=>mount(container,{},false)});
});

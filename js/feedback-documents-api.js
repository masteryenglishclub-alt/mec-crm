/* Private feedback overlay. Existing authenticated client only; no config/keys/public URLs. */
(function(root,factory){
  if(typeof module==='object'&&module.exports) module.exports=factory;
  else { const M=root.MEC; if(!M||!M.api) throw Error('Load MEC api.js before private feedback.'); M.api.feedbackDocuments=factory(M.api,root.crypto); }
})(typeof window!=='undefined'?window:globalThis,function createFeedbackDocuments(api,cryptoApi){
  'use strict';
  const BUCKET='feedback-private',MAX_BYTES=10*1024*1024;
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const SELECT='id,student_id,title,storage_bucket,storage_path,size_bytes,mime_type,sha256,status,created_by,created_at,uploaded_at,published_at';
  const ROLES=new Set(['admin','student','teacher']),STATES=new Set(['draft','uploaded','published','withdrawn']);
  const inflight=new Set();
  const fail=(message,code='feedback_unavailable')=>Object.assign(new Error(message),{code,mecFeedbackError:true});
  function uuid(value){if(typeof value!=='string'||!UUID.test(value))throw fail('Selecciona un perfil válido del CRM.','invalid_id');return value.toLowerCase();}
  function title(value){const t=String(value||'').trim();if(!t||t.length>160||/[\u0000-\u001f\u007f]/.test(t))throw fail('Escribe un título de 1 a 160 caracteres.','invalid_title');return t;}
  function one(data){const row=Array.isArray(data)?(data.length===1?data[0]:null):data;if(!row||typeof row!=='object')throw fail('El servidor no devolvió un documento válido.');return row;}
  async function rpc(c,name,params){const r=await c.rpc(name,params);if(!r||r.error)throw fail('No se pudo completar la operación privada. Actualiza la sesión e inténtalo de nuevo.');return r.data;}
  async function session(){
    const me=await api.currentUser();
    if(!me||!ROLES.has(me.role)||me.active===false)throw fail('Inicia sesión con un perfil activo autorizado.','not_authorized');
    const actorId=uuid(me.id);
    if(api.mode!=='supabase'||typeof api._client!=='function')throw fail('Los documentos privados no están disponibles en demostración.','demo_disabled');
    const c=await api._client();let p;
    try{p=one(await rpc(c,'mec_feedback_preflight',{}));}catch(_){throw fail('El módulo privado todavía no está habilitado o tu sesión no tiene acceso.','preflight_failed');}
    if(p.schema_version!==1||p.bucket!==BUCKET||Number(p.max_bytes)!==MAX_BYTES||p.actor_active!==true||uuid(p.actor_id)!==actorId||p.actor_role!==me.role)throw fail('La sesión o el módulo privado no coincide con el contrato esperado.','preflight_failed');
    return {me,c,preflight:p};
  }
  function requireAdmin(ctx){if(ctx.me.role!=='admin'||ctx.preflight.can_write!==true)throw fail('Solo administración puede cargar o publicar documentos.','not_authorized');}
  function studentId(ctx,id){const sid=uuid(id||ctx.me.id);if(ctx.me.role==='student'&&sid!==uuid(ctx.me.id))throw fail('Este documento no está disponible para tu sesión.','not_authorized');if(ctx.me.role!=='student'&&!id)throw fail('Selecciona un estudiante antes de continuar.','student_required');return sid;}
  function record(row,expectedId,expectedStudent){
    const r=one(row),id=uuid(r.id),sid=uuid(r.student_id);
    if((expectedId&&id!==uuid(expectedId))||(expectedStudent&&sid!==uuid(expectedStudent))||r.storage_bucket!==BUCKET||r.storage_path!==sid+'/'+id+'.pdf'||!Number.isSafeInteger(Number(r.size_bytes))||Number(r.size_bytes)<1||Number(r.size_bytes)>MAX_BYTES||r.mime_type!=='application/pdf'||!/^[0-9a-f]{64}$/.test(r.sha256||'')||!STATES.has(r.status))throw fail('El documento no tiene una referencia privada válida.','invalid_document');
    return Object.assign({},r,{id,student_id:sid,size_bytes:Number(r.size_bytes)});
  }
  function visible(ctx,r){return ctx.me.role==='admin'||(r.status==='published'&&(ctx.me.role!=='student'||r.student_id===uuid(ctx.me.id)));}
  async function read(ctx,id){
    const documentId=uuid(id);const r=await ctx.c.from('feedback_documents').select(SELECT).eq('id',documentId);
    if(!r||r.error||!Array.isArray(r.data)||r.data.length!==1)throw fail('Este documento no está disponible para tu sesión.','not_authorized');
    const d=record(r.data[0],documentId);if(!visible(ctx,d))throw fail('Este documento no está disponible para tu sesión.','not_authorized');return d;
  }
  async function inspectPdf(file){
    if(!file||typeof file.arrayBuffer!=='function'||typeof file.name!=='string'||!Number.isSafeInteger(file.size)||file.size<5||file.size>MAX_BYTES)throw fail('Selecciona un PDF de hasta 10 MiB.','invalid_file');
    if(!/\.pdf$/i.test(file.name)||/[\\/\u0000-\u001f\u007f]/.test(file.name)||(file.type&&file.type!=='application/pdf'))throw fail('El archivo debe ser un PDF válido.','invalid_file');
    if(!cryptoApi||!cryptoApi.subtle)throw fail('Se requiere una conexión segura para verificar el archivo.','crypto_unavailable');
    const buffer=await file.arrayBuffer(),bytes=new Uint8Array(buffer);
    if(bytes.byteLength!==file.size||String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')throw fail('El archivo no tiene una cabecera PDF válida.','invalid_file');
    const digest=await cryptoApi.subtle.digest('SHA-256',buffer);
    return {size_bytes:bytes.byteLength,sha256:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')};
  }
  async function studentContextWith(ctx,sid){
    requireAdmin(ctx);const [pr,st]=await Promise.all([
      ctx.c.from('profiles').select('id,full_name,role,active').eq('id',sid),
      ctx.c.from('students').select('id').eq('id',sid)
    ]);
    if(pr.error||st.error||!Array.isArray(pr.data)||pr.data.length!==1||!Array.isArray(st.data)||st.data.length!==1||uuid(pr.data[0].id)!==sid||uuid(st.data[0].id)!==sid||pr.data[0].role!=='student'||pr.data[0].active!==true)throw fail('El perfil seleccionado no corresponde a un estudiante activo válido.','invalid_student');
    const code=await codeWith(ctx,sid);return {id:sid,full_name:String(pr.data[0].full_name||'Estudiante'),active:true,student_code:code?code.student_code:null};
  }
  async function codeWith(ctx,sid){
    if(!['admin','student'].includes(ctx.me.role))throw fail('Este código no está disponible para tu sesión.','not_authorized');
    const r=await ctx.c.from('student_codes').select('student_id,student_code,assigned_at').eq('student_id',sid);
    if(!r||r.error||!Array.isArray(r.data)||r.data.length>1)throw fail('No se pudo comprobar el ID del estudiante.');
    if(!r.data.length)return null;
    const row=r.data[0];if(uuid(row.student_id)!==sid||!/^MEC-[0-9]{5}-[0-9]{5}$/.test(row.student_code||''))throw fail('El ID del estudiante no coincide con su perfil.','invalid_student_code');
    return {student_id:sid,student_code:row.student_code,assigned_at:typeof row.assigned_at==='string'?row.assigned_at:null};
  }
  async function watchIdentity(onInvalidated){
    if(typeof onInvalidated!=='function')throw fail('No se pudo vigilar la sesión privada.');
    const ctx=await session(),expected=uuid(ctx.me.id);
    if(!ctx.c.auth||typeof ctx.c.auth.onAuthStateChange!=='function')throw fail('No se pudo vigilar la sesión privada.');
    let active=true,invalidated=false;
    const result=ctx.c.auth.onAuthStateChange((event,authSession)=>{
      // Synchronous callback: no SDK calls, promises, JWT fields or credential reads.
      if(!active||invalidated)return;
      const id=authSession&&authSession.user&&typeof authSession.user.id==='string'?authSession.user.id.toLowerCase():null;
      if(event==='SIGNED_OUT'||id!==expected){invalidated=true;onInvalidated();}
    });
    const subscription=result&&result.data&&result.data.subscription;
    if(!subscription||typeof subscription.unsubscribe!=='function'){active=false;throw fail('No se pudo vigilar la sesión privada.');}
    return ()=>{if(active){active=false;subscription.unsubscribe();}};
  }
  async function list(id){
    const ctx=await session(),sid=studentId(ctx,id);
    let q=ctx.c.from('feedback_documents').select(SELECT).eq('student_id',sid);
    if(ctx.me.role!=='admin')q=q.eq('status','published');
    const r=await q.order('created_at',{ascending:false});
    if(!r||r.error||!Array.isArray(r.data))throw fail('No se pudieron cargar tus documentos privados.');
    return r.data.map(x=>record(x,null,sid)).filter(x=>visible(ctx,x));
  }
  async function uploadDraft({studentId:inputId,title:inputTitle,file}={}){
    const ctx=await session();requireAdmin(ctx);const sid=studentId(ctx,inputId),safeTitle=title(inputTitle);
    await studentContextWith(ctx,sid);const pdf=await inspectPdf(file),key=sid+':'+pdf.sha256;
    if(inflight.has(key))throw fail('Este archivo ya se está cargando. Espera a que termine.','upload_in_progress');
    inflight.add(key);let draft,stage='draft';
    try{
      draft=record(await rpc(ctx.c,'mec_feedback_create_draft',{p_student_id:sid,p_title:safeTitle,p_size_bytes:pdf.size_bytes,p_sha256:pdf.sha256}),null,sid);
      if(draft.status!=='draft'||draft.size_bytes!==pdf.size_bytes||draft.sha256!==pdf.sha256)throw fail('El borrador no coincide con el archivo seleccionado.','invalid_document');
      stage='upload';const uploaded=await ctx.c.storage.from(BUCKET).upload(draft.storage_path,file,{contentType:'application/pdf',upsert:false,cacheControl:'0'});
      if(!uploaded||uploaded.error)throw fail('La carga no se completó. El documento no se publicó.','upload_failed');
      stage='confirm';const ready=record(await rpc(ctx.c,'mec_feedback_confirm_upload',{p_document_id:draft.id}),draft.id,sid);
      if(ready.status!=='uploaded'||!ready.uploaded_at||ready.sha256!==pdf.sha256||ready.size_bytes!==pdf.size_bytes)throw fail('No se confirmó la carga. El documento sigue sin publicarse.','confirmation_failed');
      return ready;
    }catch(e){const error=fail(stage==='upload'?'La carga no se completó. El documento no se publicó.':stage==='confirm'?'El archivo se cargó, pero falta verificarlo. No se publicó.':'No se pudo preparar el documento privado.',e.code||'upload_failed');if(draft){error.documentId=draft.id;error.stage=stage;}throw error;}
    finally{inflight.delete(key);}
  }
  async function confirmUpload(id){
    const ctx=await session();requireAdmin(ctx);const d=await read(ctx,id);
    if(d.status==='uploaded')return d;
    if(d.status!=='draft')throw fail('Solo se verifica una carga pendiente.');
    const ready=record(await rpc(ctx.c,'mec_feedback_confirm_upload',{p_document_id:d.id}),d.id,d.student_id);
    if(ready.status!=='uploaded'||!ready.uploaded_at)throw fail('La carga todavía no está confirmada.');return ready;
  }
  async function publish(id){
    const ctx=await session();requireAdmin(ctx);const d=await read(ctx,id);
    if(d.status!=='uploaded'||!d.uploaded_at)throw fail('Verifica la carga completa antes de publicar.','upload_not_confirmed');
    const published=record(await rpc(ctx.c,'mec_feedback_publish',{p_document_id:d.id}),d.id,d.student_id);
    if(published.status!=='published'||!published.uploaded_at||!published.published_at)throw fail('El servidor no confirmó la publicación.');return published;
  }
  async function downloadFile(id){
    const ctx=await session(),d=await read(ctx,id);
    if(!['uploaded','published'].includes(d.status)||!d.uploaded_at)throw fail('Este archivo todavía no está disponible.');
    // Storage sends the existing authenticated session; no remote bearer URL is created.
    const r=await ctx.c.storage.from(BUCKET).download(d.storage_path);
    if(!r||r.error||!r.data||typeof r.data.arrayBuffer!=='function'||r.data.size!==d.size_bytes)throw fail('No se pudo descargar el archivo privado. Vuelve a intentarlo.');
    const checked=await inspectPdf({name:'feedback.pdf',size:r.data.size,type:r.data.type,arrayBuffer:()=>r.data.arrayBuffer()});
    if(checked.sha256!==d.sha256)throw fail('El archivo descargado no coincide con la huella registrada.','integrity_mismatch');
    return {blob:r.data,fileName:'feedback-'+d.id+'.pdf',documentId:d.id,title:String(d.title||'Feedback')};
  }
  const guarded=fn=>async(...args)=>{try{return await fn(...args);}catch(e){if(e&&e.mecFeedbackError)throw e;throw fail('No se pudo completar la operación privada. Inténtalo de nuevo.');}};
  const methods={preflight:async()=>{const c=await session();return Object.assign({},c.preflight);},studentContext:async id=>{const c=await session();return studentContextWith(c,studentId(c,id));},studentCode:async id=>{const c=await session();return codeWith(c,studentId(c,id));},watchIdentity,list,uploadDraft,confirmUpload,publish,downloadFile};
  for(const key of Object.keys(methods))methods[key]=guarded(methods[key]);
  methods.limits=Object.freeze({maxBytes:MAX_BYTES});
  return Object.freeze(methods);
});

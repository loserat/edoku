document.addEventListener('DOMContentLoaded',()=>{
  const config=document.getElementById('multi-system-config');if(!config)return;
  const areas=JSON.parse(config.textContent).leistungsbereiche||[];
  document.addEventListener('click',event=>{
    const add=event.target.closest('[data-add-system]');
    if(add){const template=document.getElementById(add.dataset.addSystem),rows=add.closest('[data-system-area]').querySelector('[data-system-rows]');rows.append(template.content.cloneNode(true));rows.lastElementChild.querySelector('select')?.focus();}
    const discard=event.target.closest('[data-discard-system]');if(discard)discard.closest('[data-system-row]').remove();
  });
  document.addEventListener('change',event=>{
    if(!event.target.matches('[data-multi-manufacturer]'))return;
    const form=event.target.form,area=areas.find(row=>row.name===form.dataset.leistungsbereich),manufacturer=area?.hersteller.find(row=>row.name===event.target.value);
    if(!manufacturer)return;
    for(const [name,key] of [['systemart','systemarten'],['herstellerSystem','systeme']]){
      const select=form.elements[name];select.replaceChildren(new Option('Keine Auswahl',''));
      for(const value of manufacturer[key]||[])select.append(new Option(value,value));
    }
    const docs=form.querySelector('[data-multi-documents]');docs.replaceChildren();
    for(const value of manufacturer.dokumentarten||[]){const label=document.createElement('label');label.className='checkbox-card compact';const input=document.createElement('input');input.type='checkbox';input.name='dokumentarten';input.value=value;input.checked=true;const span=document.createElement('span');span.textContent=value;label.append(input,span);docs.append(label);}
  });
});

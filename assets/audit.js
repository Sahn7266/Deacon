(function(){
  const AUDIT_KEY = 'audit_log_v1';
  const NOTES_PREFIX = 'manual_export_notes_';
  const FIELD_LABELS = {
    companyName: 'Campaign Name',
    campaignChannel: 'Channel',
    campaignKPI: 'KPI',
    campaignKPITarget: 'KPI Target',
    campaignPacing: 'Pacing',
    campaignFlight: 'Flight',
    campaignAdvertiser: 'Advertiser',
    campaignObjective: 'Objective',
    campaignStartDate: 'Start Date',
    campaignEndDate: 'End Date',
    campaignTotalBudget: 'Total Budget',
    campaignDailyBudget: 'Daily Budget',
    targetAudience: 'Target Audience',
    geoTargeting: 'Geo Targeting',
    deviceTargeting: 'Device Targeting',

    // Ad Group
    adGroupNameInput: 'Ad Group Name',
    campaignName: 'Campaign',
    budgetAllocation: 'Budget Allocation',
    bidStrategy: 'Bid Strategy',
    creativeFormat: 'Creative Format',
    targetingRefinements: 'Targeting Refinements',
    placementSettings: 'Placement Settings'
  };

  function loadRaw(){
    try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]'); } catch { return []; }
  }
  function saveRaw(arr){
    localStorage.setItem(AUDIT_KEY, JSON.stringify(arr));
  }
  function uuid(){
    return crypto.randomUUID ? crypto.randomUUID() :
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
        const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);
      });
  }
  function clean(v){
    if (v == null) return '';
    return String(v).trim();
  }

  function recordCreate({campaignId, entityType, entityId, data, user='localUser'}){
    const log = loadRaw();
    const ts = new Date().toISOString();
    Object.entries(data||{}).forEach(([field,val])=>{
      const value = clean(val);
      if (!value) return;
      log.push({
        id: uuid(),
        ts,
        campaignId,
        entityType,
        entityId,
        action: 'create',
        field,
        newValue: value,
        user
      });
    });
    saveRaw(log);
  }

  function recordEdit({campaignId, entityType, entityId, before, after, user='localUser'}){
    const log = loadRaw();
    const ts = new Date().toISOString();
    const keys = new Set([...(Object.keys(before||{})), ...(Object.keys(after||{}))]);
    keys.forEach(field=>{
      const oldValue = clean(before?.[field] ?? '');
      const newValue = clean(after?.[field] ?? '');
      if (oldValue === newValue) return;
      // If both empty ignore
      if (!oldValue && !newValue) return;
      log.push({
        id: uuid(),
        ts,
        campaignId,
        entityType,
        entityId,
        action: 'edit',
        field,
        oldValue: oldValue || undefined,
        newValue,
        user
      });
    });
    if (keys.size) saveRaw(log);
  }

  function getCampaignAudit(campaignId){
    return loadRaw()
      .filter(e=>e.campaignId === campaignId)
      .sort((a,b)=> new Date(a.ts)-new Date(b.ts));
  }

  function clearCampaignAudit(campaignId){
    const rest = loadRaw().filter(e=> e.campaignId !== campaignId);
    saveRaw(rest);
    localStorage.removeItem(NOTES_PREFIX + campaignId);
  }

  function getFieldLabel(field){
    return FIELD_LABELS[field] || field;
  }

  function loadNotes(campaignId){
    return localStorage.getItem(NOTES_PREFIX + campaignId) || '';
  }
  function saveNotes(campaignId, text){
    localStorage.setItem(NOTES_PREFIX + campaignId, text || '');
  }

  function formatTimestamp(ts){
    try {
      const d = new Date(ts);
      return d.toLocaleString();
    } catch { return ts; }
  }

function renderDrawer({ campaignId, advertiserName, advertiserAccount }) {
  const drawer = document.getElementById('auditDrawer');
  if (!drawer) return;

  const list = drawer.querySelector('[data-audit-list]');
  const notes = drawer.querySelector('[data-audit-notes]');
  const ctx = drawer.querySelector('[data-audit-context]');

  if (ctx) {
    ctx.textContent = `${advertiserName || 'Advertiser'} (${advertiserAccount || 'Account N/A'})`;
  }

  const entries = getCampaignAudit(campaignId);
  if (notes) notes.value = loadNotes(campaignId);
  if (!list) return;

  list.innerHTML = '';

  if (!entries.length) {
    list.innerHTML = '<p class="text-sm text-gray-500 py-2 italic">No logged actions yet.</p>';
    return;
  }

  // Group logs by entity (campaign/adgroup)
  const grouped = {};
  entries.forEach(e => {
    const key = `${e.entityType}-${e.entityId}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  });

  Object.entries(grouped).forEach(([groupKey, groupItems]) => {
    const [entityType, entityId] = groupKey.split('-');

    const section = document.createElement('div');
    section.className = 'mb-2 border border-gray-300 rounded-md overflow-hidden';

    const header = document.createElement('button');
    header.className = 'w-full text-left px-4 py-2 bg-gray-100 font-semibold text-sm uppercase hover:bg-gray-200 flex justify-between items-center';
    header.innerHTML = `
      ${entityType.toUpperCase()} (${entityId})
      <span class="accordion-icon transform transition-transform">&#9662;</span>
    `;

    const body = document.createElement('div');
    body.className = 'px-4 py-2 hidden bg-white';

    const ul = document.createElement('ul');
    ul.className = 'space-y-1 text-sm text-gray-800';

    groupItems.forEach(e => {
      const li = document.createElement('li');
      li.className = 'border border-gray-200 rounded px-3 py-2 bg-white';

      const label = getFieldLabel(e.field);
      const ts = formatTimestamp(e.ts);
      let content = `
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium ${e.action === 'create' ? 'text-green-600' : 'text-blue-600'}">${e.action.toUpperCase()}</span>
          <span class="text-[10px] text-gray-400">${ts}</span>
        </div>
        <div class="mt-1 text-xs text-gray-700">
          <span class="font-semibold">${label}:</span> `;

      if (e.action === 'edit' && e.oldValue !== undefined) {
        content += `<span class="text-gray-500 line-through mr-1">${e.oldValue || '—'}</span>
                    <span class="text-gray-900">→ ${e.newValue || '—'}</span>`;
      } else {
        content += `<span class="text-gray-900">${e.newValue || '—'}</span>`;
      }
      content += `</div>`;

      li.innerHTML = content;
      ul.appendChild(li);
    });

    body.appendChild(ul);
    section.appendChild(header);
    section.appendChild(body);
    list.appendChild(section);

    header.addEventListener('click', () => {
      const isHidden = body.classList.contains('hidden');
      body.classList.toggle('hidden', !isHidden);
      header.querySelector('.accordion-icon').style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    });
  });
}

  function openDrawer(opts){
    const drawer = document.getElementById('auditDrawer');
    if (!drawer) return;
    drawer.classList.remove('translate-x-full');
    drawer.dataset.campaignId = opts.campaignId;
    renderDrawer(opts);
  }
  function closeDrawer(){
    const drawer = document.getElementById('auditDrawer');
    if (!drawer) return;
    drawer.classList.add('translate-x-full');
  }

  function initDrawerEvents(){
    const drawer = document.getElementById('auditDrawer');
    if (!drawer) return;
    const closeBtn = drawer.querySelector('[data-close-drawer]');
    const clearBtn = drawer.querySelector('[data-clear]');
    const notes = drawer.querySelector('[data-audit-notes]');
    closeBtn?.addEventListener('click', closeDrawer);
    drawer.addEventListener('click', e=>{
      if (e.target === drawer) closeDrawer();
    });
    clearBtn?.addEventListener('click', ()=>{
      const cid = drawer.dataset.campaignId;
      if (!cid) return;
      if (!confirm('Clear audit log for this campaign?')) return;
      clearCampaignAudit(cid);
      renderDrawer({
        campaignId: cid,
        advertiserName: drawer.dataset.advName,
        advertiserAccount: drawer.dataset.advAccount
      });
    });
    notes?.addEventListener('input', ()=>{
      const cid = drawer.dataset.campaignId;
      if (!cid) return;
      saveNotes(cid, notes.value);
    });
  }

  window.audit = {
    recordCreate,
    recordEdit,
    getCampaignAudit,
    clearCampaignAudit,
    loadNotes,
    saveNotes,
    openDrawer,
    closeDrawer,
    renderDrawer,
    initDrawerEvents
  };

  document.addEventListener('DOMContentLoaded', initDrawerEvents);
})();
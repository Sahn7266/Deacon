(function(){
  const AUDIT_KEY = 'audit_log_v1';
  const NOTES_PREFIX = 'manual_export_notes_';
  const FIELD_LABELS = {
    campaignName: 'Campaign Name',
    companyName: 'Campaign Name', // Keep both for backward compatibility
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

  // Drawer rendering (expect container existing on Campaigns list page)
  function renderDrawer({campaignId, advertiserName, advertiserAccount}){
    console.log('📂 Opening drawer for campaign:', campaignId);
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

    if (!entries.length){
      list.innerHTML = '<p class="text-sm text-gray-500 py-2">No logged actions yet.</p>';
      return;
    }

    // Add select all/deselect all toggle at the top
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'mb-3 flex justify-end items-center gap-2';
    toggleContainer.innerHTML = `
      <span id="toggleLabel" class="text-xs text-gray-600">Deselect All</span>
      <button id="selectAllToggle" class="w-4 h-4 border-2 border-gray-400 rounded bg-blue-600 flex items-center justify-center hover:border-gray-500 transition-colors" title="Toggle all checkboxes">
        <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
        </svg>
      </button>
    `;
    list.appendChild(toggleContainer);

    // Group by entityId and then by field
    const grouped = {};
    entries.forEach(e=>{
      const entityKey = e.entityType + '|' + e.entityId;
      if (!grouped[entityKey]) grouped[entityKey] = { meta: e, fields: {} };
      
      const fieldKey = e.field;
      if (!grouped[entityKey].fields[fieldKey]) grouped[entityKey].fields[fieldKey] = [];
      grouped[entityKey].fields[fieldKey].push(e);
    });

    Object.values(grouped).forEach(group=>{
      const entityHeading = document.createElement('div');
      const title = group.meta.entityType === 'campaign' ? 'Campaign' : 'Ad Group';
      entityHeading.className = 'mt-4 mb-1 text-xs font-semibold text-gray-600 uppercase';
      entityHeading.textContent = `${title} (${group.meta.entityId})`;
      list.appendChild(entityHeading);

      const ul = document.createElement('ul');
      ul.className = 'space-y-1';
      
      // Process each field
      Object.keys(group.fields).forEach(fieldName => {
        const fieldEntries = group.fields[fieldName];
        const label = getFieldLabel(fieldName);
        
        // Find the original create entry and any edit entries
        const createEntry = fieldEntries.find(e => e.action === 'create');
        const editEntries = fieldEntries.filter(e => e.action === 'edit').sort((a,b) => new Date(a.ts) - new Date(b.ts));
        
        if (createEntry) {
          const li = document.createElement('li');
          // Add red border if the field has been edited
          const hasEdits = editEntries.length > 0;
          li.className = hasEdits ? 
            'border border-red-400 rounded-md p-2 bg-white' : 
            'border border-gray-200 rounded-md p-2 bg-white';
          
          // Get the latest timestamp for the checkbox area
          const latestEntry = editEntries.length > 0 ? editEntries[editEntries.length - 1] : createEntry;
          
          // Determine current value and previous value
          const currentValue = editEntries.length > 0 ? 
            editEntries[editEntries.length - 1].newValue : 
            createEntry.newValue;
          
          let line = `<div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-gray-800">${label}:</span>
            <div class="flex items-center gap-2">
              <span class="text-[10px] text-gray-400">${formatTimestamp(latestEntry.ts)}</span>
              <input type="checkbox" checked class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2" />
            </div>
          </div>
          <div class="mt-1 text-xs text-gray-700">
            <span class="text-gray-900">${currentValue || '—'}</span>
          </div>`;
          
          // Add previous value line if there are edits
          if (editEntries.length > 0) {
            // Find what the previous value was before the latest edit
            const latestEdit = editEntries[editEntries.length - 1];
            const previousValue = latestEdit.oldValue !== undefined ? latestEdit.oldValue : 
              (editEntries.length > 1 ? editEntries[editEntries.length - 2].newValue : createEntry.newValue);
            
            line += `<div class="mt-1 text-xs text-gray-700">
              <span class="font-semibold">Previous:</span> <span class="text-gray-900">${previousValue || '—'}</span>
            </div>`;
          }
          
          li.innerHTML = line;
          ul.appendChild(li);
        }
      });
      
      list.appendChild(ul);
    });

    // Add toggle functionality
    const toggleBtn = document.getElementById('selectAllToggle');
    const toggleLabel = document.getElementById('toggleLabel');
    if (toggleBtn && toggleLabel) {
      toggleBtn.addEventListener('click', function() {
        const checkboxes = list.querySelectorAll('input[type="checkbox"]:not(#selectAllToggle)');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        
        // Toggle all checkboxes to opposite state
        checkboxes.forEach(cb => cb.checked = !allChecked);
        
        // Update toggle button appearance and label text
        if (allChecked) {
          // Going to unchecked state
          this.classList.remove('bg-blue-600');
          this.classList.add('bg-white');
          this.querySelector('svg').classList.add('hidden');
          toggleLabel.textContent = 'Select All';
        } else {
          // Going to checked state
          this.classList.remove('bg-white');
          this.classList.add('bg-blue-600');
          this.querySelector('svg').classList.remove('hidden');
          toggleLabel.textContent = 'Deselect All';
        }
      });
    }
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
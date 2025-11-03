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
adGroupName: 'Ad Group Name', // Alias for backward compatibility
adGroupCampaign: 'Campaign',
campaignName: 'Campaign', // For ad group campaign field
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

function getCampaignAudit(campaignId) {
  // Return both campaign and ad group entries for this campaignId
  return loadRaw()
    .filter(e => e.campaignId === campaignId && (e.entityType === 'campaign' || e.entityType === 'adgroup'))
    .sort((a,b) => new Date(a.ts) - new Date(b.ts));
}

function clearCampaignAudit(campaignId){
    const rest = loadRaw().filter(e=> e.campaignId !== campaignId);
    saveRaw(rest);
    localStorage.removeItem(NOTES_PREFIX + campaignId);
  }

function clearAdGroupAudit(campaignId, adGroupId){
    const allEntries = loadRaw();
    const filtered = allEntries.filter(e => {
      // Remove entries that match this specific ad group
      if (e.campaignId === campaignId && e.entityType === 'adgroup' && e.entityId === adGroupId) {
        return false; // Remove this entry
      }
      return true; // Keep everything else
    });
    saveRaw(filtered);
    console.log(`🗑️ Cleared audit entries for Ad Group ${adGroupId} in Campaign ${campaignId}`);
  }

function clearCampaignEdits(campaignId){
  // Get current campaign data to use latest values
  const groups = JSON.parse(localStorage.getItem('campaign_tree_groups') || '[]');
  let currentCampaign = null;
  
  for (const group of groups) {
    const campaign = group.campaigns.find(c => c.id === campaignId);
    if (campaign) {
      currentCampaign = campaign;
      break;
    }
  }
  
  // Get current ad groups for this campaign
  const allAdGroups = JSON.parse(localStorage.getItem('adgroups_data_v1') || '[]');
  const currentAdGroups = allAdGroups.filter(ag => 
    ag.campaign === campaignId || ag.campaignId === campaignId
  );
  
  if (!currentCampaign && currentAdGroups.length === 0) {
    // If no campaign or ad groups found, just remove edit entries
    const allEntries = loadRaw();
    const filtered = allEntries.filter(e => {
      if (e.campaignId !== campaignId) return true;
      return e.action === 'create';
    });
    saveRaw(filtered);
    return;
  }
  
  // Get all audit entries
  const allEntries = loadRaw();
  
  // Get original timestamps for campaign
  const originalCampaignEntries = allEntries.filter(e => 
    e.campaignId === campaignId && 
    e.entityType === 'campaign' && 
    e.action === 'create'
  );
  
  // Use the earliest campaign create timestamp, or current time if none found
  const originalCampaignTimestamp = originalCampaignEntries.length > 0 
    ? originalCampaignEntries.sort((a, b) => new Date(a.ts) - new Date(b.ts))[0].ts
    : new Date().toISOString();
  
  // Remove BOTH campaign AND ad group entries for this campaign
  const nonRelatedEntries = allEntries.filter(e => {
    // Keep entries for other campaigns
    if (e.campaignId !== campaignId) return true;
    // Remove both campaign and ad group entries for this campaign
    return false;
  });
  
  const newCreateEntries = [];
  
  // === RECREATE CAMPAIGN CREATE ENTRIES ===
  if (currentCampaign) {
    const currentCampaignData = {
      campaignName: currentCampaign.name,
      campaignChannel: currentCampaign.channel,
      campaignKPI: currentCampaign.kpi,
      campaignKPITarget: currentCampaign.kpiTarget,
      campaignPacing: currentCampaign.pacing,
      campaignAdvertiser: currentCampaign.advertiser,
      campaignObjective: currentCampaign.objective,
      campaignStartDate: currentCampaign.startDate,
      campaignEndDate: currentCampaign.endDate,
      campaignTotalBudget: currentCampaign.totalBudget,
      campaignDailyBudget: currentCampaign.dailyBudget,
      targetAudience: currentCampaign.targetAudience,
      geoTargeting: currentCampaign.geoTargeting,
      deviceTargeting: currentCampaign.deviceTargeting
    };
    
    // Create new campaign audit entries with current values
    Object.entries(currentCampaignData).forEach(([field, value]) => {
      if (value != null && String(value).trim() !== '') {
        newCreateEntries.push({
          id: uuid(),
          ts: originalCampaignTimestamp,
          campaignId,
          entityType: 'campaign',
          entityId: campaignId,
          action: 'create',
          field,
          newValue: String(value).trim(),
          user: 'localUser'
        });
      }
    });
  }
  
  // === RECREATE AD GROUP CREATE ENTRIES ===
  currentAdGroups.forEach(adGroup => {
    // Get original timestamp for this ad group
    const originalAdGroupEntries = allEntries.filter(e => 
      e.campaignId === campaignId && 
      e.entityType === 'adgroup' && 
      e.entityId === adGroup.id &&
      e.action === 'create'
    );
    
    // Use the earliest ad group create timestamp, or current time if none found
    const originalAdGroupTimestamp = originalAdGroupEntries.length > 0 
      ? originalAdGroupEntries.sort((a, b) => new Date(a.ts) - new Date(b.ts))[0].ts
      : new Date().toISOString();
    
    const currentAdGroupData = {
      adGroupNameInput: adGroup.name,
      campaignName: adGroup.campaign,
      budgetAllocation: adGroup.budget,
      bidStrategy: adGroup.bidStrategy,
      creativeFormat: adGroup.creativeFormat,
      targetingRefinements: adGroup.targetingRefinements,
      placementSettings: adGroup.placementSettings
    };
    
    // Create new ad group audit entries with current values
    Object.entries(currentAdGroupData).forEach(([field, value]) => {
      if (value != null && String(value).trim() !== '') {
        newCreateEntries.push({
          id: uuid(),
          ts: originalAdGroupTimestamp,
          campaignId,
          entityType: 'adgroup',
          entityId: adGroup.id,
          action: 'create',
          field,
          newValue: String(value).trim(),
          user: 'localUser'
        });
      }
    });
  });
  
  // Combine non-related entries with new create entries
  const updatedEntries = [...nonRelatedEntries, ...newCreateEntries];
  saveRaw(updatedEntries);
  
  console.log(`✔️ Cleared edits for campaign ${campaignId} and ${currentAdGroups.length} ad groups`);
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
      ctx.textContent = `Change Form: ${advertiserName || 'Advertiser'} (${advertiserAccount || 'Account N/A'})`;
    }

    const entries = getCampaignAudit(campaignId);
    if (notes) notes.value = loadNotes(campaignId);

    if (!list) return;
    list.innerHTML = '';

    if (!entries.length){
      list.innerHTML = '<p class="text-sm text-gray-500 py-2">No logged actions yet.</p>';
      return;
    }

    // Group by both entityType and entityId, always render both campaign and ad group sections
    const grouped = {};
    entries.forEach(e => {
      const entityKey = e.entityType + '|' + e.entityId;
      if (!grouped[entityKey]) grouped[entityKey] = { meta: e, fields: {}, entityType: e.entityType, entityId: e.entityId };
      const fieldKey = e.field;
      if (!grouped[entityKey].fields[fieldKey]) grouped[entityKey].fields[fieldKey] = [];
      grouped[entityKey].fields[fieldKey].push(e);
    });

    // Always render campaign section first, then ad group sections
    const sortedGroups = Object.values(grouped).sort((a, b) => {
      if (a.entityType === b.entityType) return 0;
      if (a.entityType === 'campaign') return -1;
      return 1;
    });

    sortedGroups.forEach((group, groupIndex) => {
      const entityType = group.entityType;
      const entityId = group.entityId;
      const title = entityType === 'campaign' ? 'Campaign' : 'Ad Group';
      const sectionId = `${entityType}_${entityId}`;
      const entityHeading = document.createElement('div');
      entityHeading.className = 'mt-4 mb-2 -mx-2 px-4 py-1 text-xs font-semibold text-gray-600 uppercase rounded-md flex justify-between items-center cursor-pointer hover:opacity-80 transition-opacity';
      entityHeading.style.backgroundColor = '#d1d5db';
      entityHeading.innerHTML = `
        <span>${title} (${entityId})</span>
        <div class="flex items-center gap-2">
          <span id="toggleLabel_${groupIndex}" class="text-xs text-gray-600">Deselect All</span>
          <button id="selectAllToggle_${groupIndex}" data-section-id="${sectionId}" class="w-4 h-4 border-2 border-gray-400 rounded bg-blue-600 flex items-center justify-center hover:border-gray-500 transition-colors" title="Toggle section checkboxes">
            <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
      `;
      list.appendChild(entityHeading);

      const ul = document.createElement('ul');
      ul.className = 'space-y-0.5';

      // Process each field for this entity
      Object.keys(group.fields).forEach(fieldName => {
        const fieldEntries = group.fields[fieldName];
        const label = getFieldLabel(fieldName);
        // Find the original create entry and any edit entries
        const createEntry = fieldEntries.find(e => e.action === 'create');
        const editEntries = fieldEntries.filter(e => e.action === 'edit').sort((a, b) => new Date(a.ts) - new Date(b.ts));
        if (createEntry) {
          const li = document.createElement('li');
// Determine if this field has edits
const hasEdits = editEntries.length > 0;
// Sanitize fieldName for use in ID (remove special chars)
const safeFieldName = fieldName.replace(/[^a-zA-Z0-9]/g, '_');
const expandableId = `expand_${sectionId}_${safeFieldName}`;

// Add red border if the field has been edited
li.className = hasEdits ?
  'border border-red-400 rounded-md px-3 py-1 bg-white' :
  'border border-gray-200 rounded-md px-3 py-1 bg-white';
// Get the latest timestamp for the checkbox area
const latestEntry = editEntries.length > 0 ? editEntries[editEntries.length - 1] : createEntry;
// Determine current value and previous value
const currentValue = editEntries.length > 0 ?
  editEntries[editEntries.length - 1].newValue :
  createEntry.newValue;

// Build the main row
let line = `<div class="flex items-center justify-between gap-2 ${hasEdits ? 'cursor-pointer hover:bg-gray-50' : ''}" ${hasEdits ? `onclick="window.togglePreviousValue('${expandableId}')"` : ''}>
  <div class="flex items-stretch text-xs flex-grow min-w-0" style="gap: 0;">
   <span class="font-semibold text-gray-800 whitespace-nowrap flex items-center" style="min-width: 140px; background-color: #ffffff; padding: 4px 8px; margin: -4px 0 -4px -12px; padding-right: 8px; border-top-left-radius: 0.375rem; border-bottom-left-radius: 0.375rem;">${label}:</span>
    <div style="width: 1px; background-color: #d1d5db; flex-shrink: 0; margin: -4px 0;"></div>
    <div class="flex items-center gap-1 flex-grow min-w-0 pl-2">
      <span class="text-gray-900 truncate">${currentValue || '—'}</span>
    </div>
  </div>
  <div class="flex items-center gap-2 whitespace-nowrap">
    <span class="text-[10px] text-gray-400">${formatTimestamp(latestEntry.ts)}</span>
    <input type="checkbox" checked data-section-id="${sectionId}" class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2" onclick="event.stopPropagation()" />
  </div>
</div>`;

// Add expandable previous value section if there are edits
if (hasEdits) {
  const latestEdit = editEntries[editEntries.length - 1];
  const previousValue = latestEdit.oldValue !== undefined ? latestEdit.oldValue :
    (editEntries.length > 1 ? editEntries[editEntries.length - 2].newValue : createEntry.newValue);
  
  line += `<div id="${expandableId}" class="hidden mt-1 ml-4 pl-4 border-l-2 border-gray-300 text-xs text-gray-600">
    <span class="font-semibold">Previous:</span> <span>${previousValue || '—'}</span>
  </div>`;
}

li.innerHTML = line;
          ul.appendChild(li);
        }
      });
      list.appendChild(ul);
      
      // Add accordion click handler to the heading
      entityHeading.addEventListener('click', function(e) {
        // Don't collapse if clicking on the toggle button or its children
        if (e.target.closest('button')) return;
        
        // Toggle the visibility of the fields list
        if (ul.style.display === 'none') {
          ul.style.display = '';
        } else {
          ul.style.display = 'none';
        }
      });
    });

   // Add section-specific toggle functionality
    sortedGroups.forEach((group, groupIndex) => {
      const toggleBtn = document.getElementById(`selectAllToggle_${groupIndex}`);
      const toggleLabel = document.getElementById(`toggleLabel_${groupIndex}`);
      const sectionId = `${group.entityType}_${group.entityId}`;
      if (toggleBtn && toggleLabel) {
        toggleBtn.addEventListener('click', function (e) {
          e.stopPropagation(); // Prevent accordion collapse when clicking toggle button
          const sectionCheckboxes = list.querySelectorAll(`input[type="checkbox"][data-section-id="${sectionId}"]`);
          const allChecked = Array.from(sectionCheckboxes).every(cb => cb.checked);
          // Toggle all checkboxes in this section to opposite state
          sectionCheckboxes.forEach(cb => cb.checked = !allChecked);
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
    });
  }

  function openDrawer(opts){
    const drawer = document.getElementById('auditDrawer');
    if (!drawer) return;
    drawer.classList.remove('translate-x-full');
    drawer.dataset.campaignId = opts.campaignId;
    drawer.dataset.advName = opts.advertiserName || '';
    drawer.dataset.advAccount = opts.advertiserAccount || '';
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
      if (!confirm('Clear edit history for this campaign? This will reset the view to show only current values.')) return;
      clearCampaignEdits(cid);
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


  // Toggle function for expanding/collapsing previous values
window.togglePreviousValue = function(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.classList.toggle('hidden');
  }
};


window.audit = {
    recordCreate,
    recordEdit,
    getCampaignAudit,
    clearCampaignAudit,
    clearAdGroupAudit,
    clearCampaignEdits,
    loadNotes,
    saveNotes,
    openDrawer,
    closeDrawer,
    renderDrawer,
    initDrawerEvents
  };

  document.addEventListener('DOMContentLoaded', initDrawerEvents);
})();
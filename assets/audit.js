(function(){
  const AUDIT_KEY = 'audit_log_v1';
  const NOTES_PREFIX = 'manual_export_notes_';
  const FIELD_LABELS = {
    // Common Data / Beacon Fields
    commonCampaignName: 'Campaign Name',
    beaconCampaignName: 'Campaign Name',
    mediaType: 'Media Type',
    beaconMediaType: 'Media Type', 
    domainUrl: 'Domain URL',
    beaconDomainUrl: 'Domain URL',
    
    // DSP Fields - New 11 Field Structure
    seed: 'Seed',
    organization: 'Campaign Organization',
    pacing: 'Pacing',
    timezone: 'Timezone',
    startDate: 'Start Date (UTC)',
    endDate: 'End Date (UTC)',
    channel: 'Campaign Channel',
    campaignName: 'Campaign Name',
    budget: 'Campaign Budget',
    kpi: 'Campaign KPI',
    kpiTarget: 'KPI Target',
    
    // Legacy DSP Fields (for backward compatibility)
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
    
    // Ad Server fields (clean names without prefix)
    adServerCampaignName: 'Campaign Name',
    adServerSchedule: 'Schedule',
    adServerLandingPageName: 'Landing Page Name',
    adServerLandingPageURL: 'Landing Page URL',
    // Legacy Ad Server field for backward compatibility
    adServerCampaignVertical: 'Campaign Vertical',

    // Ad Group DSP fields
    adGroupNameInput: 'Ad Group Name',
    adGroupName: 'Ad Group Name', // Alias for backward compatibility
    adGroupCampaign: 'Campaign',
    budgetAllocation: 'Budget Allocation',
    bidStrategy: 'Bid Strategy',
    creativeFormat: 'Creative Format',
    targetingRefinements: 'Targeting Refinements',
    placementSettings: 'Placement Settings',
    
    // Ad Group Ad Server fields
    adServerAdGroupName: 'Ad Group Name',
    adServerPlacement: 'Placement'    
  };

  // Define field categorization for hierarchical display
  const FIELD_CATEGORIES = {
    dsp: [
      // New 11 Field Structure
      'seed', 'organization', 'pacing', 'timezone', 'startDate', 'endDate', 
      'channel', 'campaignName', 'budget', 'kpi', 'kpiTarget',
      // Legacy fields for backward compatibility
      'campaignChannel', 'campaignKPI', 'campaignKPITarget', 'campaignPacing', 
      'campaignAdvertiser', 'campaignObjective', 'campaignStartDate', 'campaignEndDate', 
      'campaignTotalBudget', 'campaignDailyBudget', 'targetAudience', 'geoTargeting', 
      'deviceTargeting'
    ],
    adServer: [
      'adServerCampaignName', 'adServerSchedule', 'adServerLandingPageName', 
      'adServerLandingPageURL', 'adServerCampaignVertical'
    ],
    adGroupDsp: [
      'adGroupNameInput', 'adGroupName', 'adGroupCampaign', 
      'budgetAllocation', 'bidStrategy', 'creativeFormat', 'targetingRefinements', 
      'placementSettings'
    ],
    adGroupAdServer: [
      'adServerAdGroupName', 'adServerPlacement'
    ]
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

  // Field mapping for Common Data fields to their Beacon equivalents
  const FIELD_MAPPING = {
    commonCampaignName: 'beaconCampaignName',
    mediaType: 'beaconMediaType', 
    domainUrl: 'beaconDomainUrl'
  };

  function recordCreate({campaignId, entityType, entityId, data, user='localUser'}){
    const log = loadRaw();
    const ts = new Date().toISOString();
    Object.entries(data||{}).forEach(([field,val])=>{
      // Skip the connectors field from audit logs
      if (field === 'connectors') return;
      
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
      // Skip the connectors field from audit logs
      if (field === 'connectors') return;
      
      // Map Common Data field names to their Beacon equivalents for consistency
      const auditField = FIELD_MAPPING[field] || field;
      
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
        field: auditField, // Use the mapped field name
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
  
  console.log('🔍 Found ad groups for campaign:', campaignId, currentAdGroups.length);
  currentAdGroups.forEach(ag => {
    console.log('🔍 Ad Group:', ag.id, 'adServerAdGroupName:', ag.adServerAdGroupName, 'adServerPlacement:', ag.adServerPlacement);
  });
  
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
    // Create new campaign audit entries with current values
    const currentCampaignData = {
      // DSP Fields - New 11 Field Structure
      seed: currentCampaign.seed,
      organization: currentCampaign.organization,
      pacing: currentCampaign.pacing,
      timezone: currentCampaign.timezone,
      startDate: currentCampaign.startDate,
      endDate: currentCampaign.endDate,
      channel: currentCampaign.channel,
      campaignName: currentCampaign.name,
      budget: currentCampaign.budget,
      kpi: currentCampaign.kpi,
      kpiTarget: currentCampaign.kpiTarget,
      // Include Ad Server fields
      adServerCampaignName: currentCampaign.adServerCampaignName,
      adServerSchedule: currentCampaign.adServerSchedule,
      adServerLandingPageName: currentCampaign.adServerLandingPageName,
      adServerLandingPageURL: currentCampaign.adServerLandingPageURL
    };
    
    // Create new campaign audit entries with current values
    Object.entries(currentCampaignData).forEach(([field, value]) => {
      // Always include Ad Server fields, even if empty, to preserve them in audit
      const isAdServerField = field.startsWith('adServer');
      const shouldInclude = isAdServerField || (value != null && String(value).trim() !== '');
      
      if (shouldInclude) {
        newCreateEntries.push({
          id: uuid(),
          ts: originalCampaignTimestamp,
          campaignId,
          entityType: 'campaign',
          entityId: campaignId,
          action: 'create',
          field,
          newValue: value != null ? String(value).trim() : '',
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
      placementSettings: adGroup.placementSettings,
      // Include Ad Server fields for ad groups - handle missing fields gracefully
      adServerAdGroupName: adGroup.adServerAdGroupName || '',
      adServerPlacement: adGroup.adServerPlacement || ''
    };
    
    console.log('🔍 Ad Group data being recreated:', adGroup.id, currentAdGroupData);
    
    // Create new ad group audit entries with current values
    Object.entries(currentAdGroupData).forEach(([field, value]) => {
      // Always include Ad Server fields for ad groups, even if empty, to preserve them in audit
      const isAdServerField = field.startsWith('adServer');
      const shouldInclude = isAdServerField || (value != null && String(value).trim() !== '');
      
      console.log(`🔍 Field: ${field}, Value: "${value}", isAdServer: ${isAdServerField}, shouldInclude: ${shouldInclude}`);
      
      if (shouldInclude) {
        newCreateEntries.push({
          id: uuid(),
          ts: originalAdGroupTimestamp,
          campaignId,
          entityType: 'adgroup',
          entityId: adGroup.id,
          action: 'create',
          field,
          newValue: value != null ? String(value).trim() : '',
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

  // Drawer rendering with hierarchical structure
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

    // Group by entityType and entityId
    const grouped = {};
    entries.forEach(e => {
      const entityKey = e.entityType + '|' + e.entityId;
      if (!grouped[entityKey]) grouped[entityKey] = { 
        meta: e, 
        fields: {}, 
        entityType: e.entityType, 
        entityId: e.entityId 
      };
      const fieldKey = e.field;
      if (!grouped[entityKey].fields[fieldKey]) grouped[entityKey].fields[fieldKey] = [];
      grouped[entityKey].fields[fieldKey].push(e);
    });

    // Sort groups: campaigns first, then ad groups
    const sortedGroups = Object.values(grouped).sort((a, b) => {
      if (a.entityType === b.entityType) return 0;
      if (a.entityType === 'campaign') return -1;
      return 1;
    });

    sortedGroups.forEach((group, groupIndex) => {
      const entityType = group.entityType;
      const entityId = group.entityId;
      
      if (entityType === 'campaign') {
        // Campaign section with hierarchical DSP/Ad Server structure
        renderCampaignSection(list, group, groupIndex);
      } else {
        // Ad Group section (keep existing structure)
        renderAdGroupSection(list, group, groupIndex);
      }
    });
  }

  function renderCampaignSection(list, group, groupIndex) {
    const entityId = group.entityId;
    
    // Main Campaign header with enhanced styling
    const campaignHeader = document.createElement('div');
    campaignHeader.className = 'mt-4 mb-3 -mx-2 px-4 py-2 text-sm font-bold text-white uppercase rounded-md shadow-sm';
    campaignHeader.style.backgroundColor = '#1f2937'; // Dark gray
    campaignHeader.innerHTML = `
      <div class="flex items-center">
        <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>Campaign (${entityId})</span>
      </div>`;
    list.appendChild(campaignHeader);

    // Create container for campaign subsections
    const campaignContainer = document.createElement('div');
    campaignContainer.className = 'ml-2 border-l-2 border-gray-300 pl-2'; // Reduced margins
    list.appendChild(campaignContainer);

    // Separate fields into categories (excluding common data)
    const dspFields = {};
    const adServerFields = {};
    const uncategorizedFields = {};

    Object.keys(group.fields).forEach(fieldName => {
      if (FIELD_CATEGORIES.dsp.includes(fieldName)) {
        dspFields[fieldName] = group.fields[fieldName];
      } else if (FIELD_CATEGORIES.adServer.includes(fieldName)) {
        adServerFields[fieldName] = group.fields[fieldName];
      } else {
        // Skip common data fields completely
        const isCommonDataField = ['commonCampaignName', 'beaconCampaignName', 'mediaType', 'beaconMediaType', 'domainUrl', 'beaconDomainUrl'].includes(fieldName);
        if (!isCommonDataField) {
          uncategorizedFields[fieldName] = group.fields[fieldName];
        }
      }
    });

    // Render DSP section with enhanced styling
    if (Object.keys(dspFields).length > 0) {
      renderConnectorSection(campaignContainer, 'DSP: The Trade Desk', dspFields, `dsp_${entityId}`, groupIndex * 2, 'blue');
    }

    // Render Ad Server section with enhanced styling
    if (Object.keys(adServerFields).length > 0) {
      renderConnectorSection(campaignContainer, 'Ad Server: Google Campaign Manager', adServerFields, `adserver_${entityId}`, groupIndex * 2 + 1, 'green');
    }

    // Render uncategorized fields if any
    if (Object.keys(uncategorizedFields).length > 0) {
      renderConnectorSection(campaignContainer, 'Other Fields', uncategorizedFields, `other_${entityId}`, groupIndex * 2 + 2, 'gray');
    }
  }

  function renderConnectorSection(list, connectorTitle, fields, sectionId, toggleIndex, colorTheme = 'gray') {
    // Color theme mapping
    const themes = {
      blue: { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
      green: { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
      gray: { bg: '#f3f4f6', text: '#374151', border: '#6b7280' },
      purple: { bg: '#ede9fe', text: '#6b21a8', border: '#8b5cf6' }
    };
    
    const theme = themes[colorTheme] || themes.gray;
    
    // Connector sub-header with enhanced styling
    const connectorHeader = document.createElement('div');
    connectorHeader.className = 'mt-3 mb-2 ml-3 -mr-2 px-4 py-2 text-xs font-semibold uppercase rounded-md flex justify-between items-center cursor-pointer hover:opacity-90 transition-all duration-200 border-l-4';
    connectorHeader.style.backgroundColor = theme.bg;
    connectorHeader.style.color = theme.text;
    connectorHeader.style.borderLeftColor = theme.border;
    connectorHeader.innerHTML = `
      <div class="flex items-center">
        <svg class="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
        </svg>
        <span>${connectorTitle}</span>
      </div>
      <div class="flex items-center gap-2">
        <span id="toggleLabel_${toggleIndex}" class="text-xs opacity-75">Deselect All</span>
        <button id="selectAllToggle_${toggleIndex}" data-section-id="${sectionId}" class="w-4 h-4 border-2 rounded flex items-center justify-center hover:opacity-80 transition-all duration-200" style="border-color: ${theme.border}; background-color: ${theme.border};" title="Toggle section checkboxes">
          <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>
    `;
    list.appendChild(connectorHeader);

    const ul = document.createElement('ul');
    ul.className = 'space-y-0.5 ml-2 pl-2'; // Reduced indentation for more field width

    // Process each field for this connector
    Object.keys(fields).forEach(fieldName => {
      const fieldEntries = fields[fieldName];
      const label = getFieldLabel(fieldName);
      
      // Find the original create entry and any edit entries
      const createEntry = fieldEntries.find(e => e.action === 'create');
      const editEntries = fieldEntries.filter(e => e.action === 'edit').sort((a, b) => new Date(a.ts) - new Date(b.ts));
      
      if (createEntry) {
        renderFieldEntry(ul, fieldName, label, createEntry, editEntries, sectionId);
      }
    });

    list.appendChild(ul);

    // Add accordion functionality
    connectorHeader.addEventListener('click', function(e) {
      if (e.target.closest('button')) return;
      const isCollapsed = ul.style.display === 'none';
      ul.style.display = isCollapsed ? '' : 'none';
      
      // Update header styling when collapsed/expanded
      if (isCollapsed) {
        connectorHeader.style.opacity = '1';
      } else {
        connectorHeader.style.opacity = '0.7';
      }
    });

    // Add toggle functionality with enhanced styling
    const toggleBtn = document.getElementById(`selectAllToggle_${toggleIndex}`);
    const toggleLabel = document.getElementById(`toggleLabel_${toggleIndex}`);
    if (toggleBtn && toggleLabel) {
      toggleBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        const sectionCheckboxes = list.querySelectorAll(`input[type="checkbox"][data-section-id="${sectionId}"]`);
        const allChecked = Array.from(sectionCheckboxes).every(cb => cb.checked);
        
        sectionCheckboxes.forEach(cb => cb.checked = !allChecked);
        
        if (allChecked) {
          this.style.backgroundColor = 'white';
          this.style.borderColor = theme.border;
          this.querySelector('svg').style.color = theme.border;
          toggleLabel.textContent = 'Select All';
        } else {
          this.style.backgroundColor = theme.border;
          this.style.borderColor = theme.border;
          this.querySelector('svg').style.color = 'white';
          toggleLabel.textContent = 'Deselect All';
        }
      });
    }
  }

  function renderAdGroupSection(list, group, groupIndex) {
    const entityId = group.entityId;
    
    // Main Ad Group header with enhanced styling
    const adGroupHeader = document.createElement('div');
    adGroupHeader.className = 'mt-4 mb-3 -mx-2 px-4 py-2 text-sm font-bold text-white uppercase rounded-md shadow-sm';
    adGroupHeader.style.backgroundColor = '#7c3aed'; // Purple for Ad Groups
    adGroupHeader.innerHTML = `
      <div class="flex items-center">
        <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>Ad Group (${entityId})</span>
      </div>`;
    list.appendChild(adGroupHeader);

    // Create container for ad group subsections
    const adGroupContainer = document.createElement('div');
    adGroupContainer.className = 'ml-2 border-l-2 border-purple-300 pl-2'; // Reduced margins
    list.appendChild(adGroupContainer);

    // Separate fields into DSP and Ad Server categories for ad groups
    const dspFields = {};
    const adServerFields = {};
    const uncategorizedFields = {};

    Object.keys(group.fields).forEach(fieldName => {
      if (FIELD_CATEGORIES.adGroupDsp.includes(fieldName)) {
        dspFields[fieldName] = group.fields[fieldName];
      } else if (FIELD_CATEGORIES.adGroupAdServer.includes(fieldName)) {
        adServerFields[fieldName] = group.fields[fieldName];
      } else {
        uncategorizedFields[fieldName] = group.fields[fieldName];
      }
    });

    // Render DSP section for ad groups with distinct styling
    if (Object.keys(dspFields).length > 0) {
      renderConnectorSection(adGroupContainer, 'DSP: The Trade Desk', dspFields, `adgroup_dsp_${entityId}`, (groupIndex + 100) * 2, 'blue');
    }

    // Render Ad Server section for ad groups with distinct styling
    if (Object.keys(adServerFields).length > 0) {
      renderConnectorSection(adGroupContainer, 'Ad Server: Google Campaign Manager', adServerFields, `adgroup_adserver_${entityId}`, (groupIndex + 100) * 2 + 1, 'green');
    }

    // Render uncategorized fields if any
    if (Object.keys(uncategorizedFields).length > 0) {
      renderConnectorSection(adGroupContainer, 'Other Fields', uncategorizedFields, `adgroup_other_${entityId}`, (groupIndex + 100) * 2 + 2, 'purple');
    }
  }

  function renderFieldEntry(ul, fieldName, label, createEntry, editEntries, sectionId) {
    const li = document.createElement('li');
    const hasEdits = editEntries.length > 0;
    const safeFieldName = fieldName.replace(/[^a-zA-Z0-9]/g, '_');
    const expandableId = `expand_${sectionId}_${safeFieldName}`;

    li.className = hasEdits ?
      'border border-red-400 rounded-md px-3 py-1 bg-white' :
      'border border-gray-200 rounded-md px-3 py-1 bg-white';

    const latestEntry = editEntries.length > 0 ? editEntries[editEntries.length - 1] : createEntry;
    const currentValue = editEntries.length > 0 ?
      editEntries[editEntries.length - 1].newValue :
      createEntry.newValue;

    let line = `<div class="flex items-center justify-between gap-2 ${hasEdits ? 'cursor-pointer hover:bg-gray-50' : ''}" ${hasEdits ? `onclick="window.togglePreviousValue('${expandableId}')"` : ''}>
      <div class="flex items-stretch text-xs flex-grow min-w-0" style="gap: 0;">
       <span class="font-semibold text-gray-800 whitespace-nowrap flex items-center" style="min-width: 120px; background-color: #ffffff; padding: 4px 8px; margin: -4px 0 -4px -12px; padding-right: 8px; border-top-left-radius: 0.375rem; border-bottom-left-radius: 0.375rem;">${label}:</span>
        <div style="width: 1px; background-color: #d1d5db; flex-shrink: 0; margin: -4px 0;"></div>
        <div class="flex items-center gap-1 flex-grow min-w-0 pl-2" style="max-width: calc(100% - 200px);">
          <span class="text-gray-900 truncate" title="${currentValue || '—'}">${currentValue || '—'}</span>
        </div>
      </div>
      <div class="flex items-center gap-2 whitespace-nowrap" style="min-width: 120px;">
        <span class="text-[10px] text-gray-400">${formatTimestamp(latestEntry.ts)}</span>
        <input type="checkbox" checked data-section-id="${sectionId}" class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2" onclick="event.stopPropagation()" />
      </div>
    </div>`;

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
// Core Registry Variable State Storage Architecture
const productsList = ['pregel', 'grof', 'htf'];
const prettyLabels = {
    'l1_gross_hrs': 'L1 Gross Hours', 'l1_ooe': 'L1 OOE (%)', 'l1_au': 'L1 Asset Util (%)',
    'l2_gross_hrs': 'L2 Gross Hours', 'l2_ooe': 'L2 OOE (%)', 'l2_au': 'L2 Asset Util (%)',
    'line1_total_out': 'L1 Total Tonnage', 'line2_total_out': 'L2 Total Tonnage',
    'combined_active_tonnage': 'Plant Total Output',
    'l1_pregel_speed': 'L1 Pregel Rate', 'l1_pregel_time': 'L1 Pregel % Time', 'l1_pregel_output': 'L1 Pregel % Output', 'l1_pregel_mass': 'L1 Pregel Mass', 'l1_pregel_delta': 'L1 Pregel Vol Delta',
    'l1_grof_speed': 'L1 Grof Rate', 'l1_grof_time': 'L1 Grof % Time', 'l1_grof_output': 'L1 Grof % Output', 'l1_grof_mass': 'L1 Grof Mass', 'l1_grof_delta': 'L1 Grof Vol Delta',
    'l1_htf_speed': 'L1 HTF Rate', 'l1_htf_time': 'L1 HTF % Time', 'l1_htf_output': 'L1 HTF % Output', 'l1_htf_mass': 'L1 HTF Mass', 'l1_htf_delta': 'L1 HTF Vol Delta',
    'l2_pregel_speed': 'L2 Pregel Rate', 'l2_pregel_time': 'L2 Pregel % Time', 'l2_pregel_output': 'L2 Pregel % Output', 'l2_pregel_mass': 'L2 Pregel Mass', 'l2_pregel_delta': 'L2 Pregel Vol Delta',
    'l2_grof_speed': 'L2 Grof Rate', 'l2_grof_time': 'L2 Grof % Time', 'l2_grof_output': 'L2 Grof % Output', 'l2_grof_mass': 'L2 Grof Mass', 'l2_grof_delta': 'L2 Grof Vol Delta',
    'l2_htf_speed': 'L2 HTF Rate', 'l2_htf_time': 'L2 HTF % Time', 'l2_htf_output': 'L2 HTF % Output', 'l2_htf_mass': 'L2 HTF Mass', 'l2_htf_delta': 'L2 HTF Vol Delta'
};

let currentEngineMode = 'A'; // Mode A: Cap & Curtail, Mode B: Required Extra Hours
let systemHasConflict = false;

// Baseline Definitions Mapping structure matching Section 3 Scorecard Registry
// Default Gross Hours modified to 112, AU set to 100%
let scorecardDefaults = {
    l1: { gross: 112.0, ooe: 80.9, au: 100.0, rates: { pregel: 0.5, grof: 1.8, htf: 1.8 }, demand: { pregel: 19.2, grof: 56.3, htf: 36.7 } },
    l2: { gross: 112.0, ooe: 80.9, au: 100.0, rates: { pregel: 0.5, grof: 1.8, htf: 1.8 }, demand: { pregel: 0.0, grof: 0.0, htf: 157.7 } }
};

// Active State calculations output storage architecture
let activeRealities = { l1: {}, l2: {}, plant: {} };

// Analytical Docks tracking state mapping keys
let assignedXAxis = null; 
let assignedYAxis = null; 
let assignedZSliders = []; 

let simulationChartInstance = null;

// Bootstrapping Engine Initialization Hooks
window.addEventListener('DOMContentLoaded', () => {
    // Force browser cache clearance for interactive UI elements to enforce clean default state
    document.querySelectorAll('input[type="number"]').forEach(input => {
        if (input.id.startsWith('override_')) {
            input.value = '';
        }
    });
    const sharedOperatorCheckbox = document.getElementById('shared_operator_toggle');
    if (sharedOperatorCheckbox) {
        sharedOperatorCheckbox.checked = false;
    }

    // Build architecture blocks natively
    renderDynamicProductRows('l1');
    renderDynamicProductRows('l2');
    syncScorecardUIDisplays();
    initChartArchitecture();
    
    // Wipe any cached bindings forcefully
    clearAllChartAxes(); 
    resetAllOverrides();
});

// Toggle Accordion Panel Logic
function toggleAccordion(id) {
    const el = document.getElementById(id);
    const icon = document.getElementById(id + '_toggle_icon');
    if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        icon.style.transform = 'rotate(90deg)';
    } else {
        el.classList.add('hidden');
        icon.style.transform = 'rotate(0deg)';
    }
}

// Toggle visual engine switches
function toggleEngineMode() {
    currentEngineMode = (currentEngineMode === 'A') ? 'B' : 'A';
    const labelA = document.getElementById('modeA_label');
    const labelB = document.getElementById('modeB_label');
    if (currentEngineMode === 'A') {
        labelA.className = "text-xs font-bold px-3 py-1.5 rounded-full transition-all duration-200 text-white bg-orange-600";
        labelB.className = "text-xs font-bold px-3 py-1.5 rounded-full transition-all duration-200 text-slate-400";
    } else {
        labelA.className = "text-xs font-bold px-3 py-1.5 rounded-full transition-all duration-200 text-slate-400";
        labelB.className = "text-xs font-bold px-3 py-1.5 rounded-full transition-all duration-200 text-white bg-blue-600";
    }
    runSolverPipeline();
}

// Programmatic execution pipeline to sync corporate baselines inputs back to calculations tracker
function updateScorecardBaselines() {
    // Line 1 Readings
    scorecardDefaults.l1.gross = parseFloat(document.getElementById('sc_l1_gross').value) || 0;
    scorecardDefaults.l1.ooe = parseFloat(document.getElementById('sc_l1_ooe').value) || 0;
    scorecardDefaults.l1.au = parseFloat(document.getElementById('sc_l1_au').value) || 0;
    scorecardDefaults.l1.rates.pregel = parseFloat(document.getElementById('sc_l1_rate_pregel').value) || 0;
    scorecardDefaults.l1.rates.grof = parseFloat(document.getElementById('sc_l1_rate_grof').value) || 0;
    scorecardDefaults.l1.rates.htf = parseFloat(document.getElementById('sc_l1_rate_htf').value) || 0;
    scorecardDefaults.l1.demand.pregel = parseFloat(document.getElementById('sc_l1_demand_pregel').value) || 0;
    scorecardDefaults.l1.demand.grof = parseFloat(document.getElementById('sc_l1_demand_grof').value) || 0;
    scorecardDefaults.l1.demand.htf = parseFloat(document.getElementById('sc_l1_demand_htf').value) || 0;

    // Line 2 Readings
    scorecardDefaults.l2.gross = parseFloat(document.getElementById('sc_l2_gross').value) || 0;
    scorecardDefaults.l2.ooe = parseFloat(document.getElementById('sc_l2_ooe').value) || 0;
    scorecardDefaults.l2.au = parseFloat(document.getElementById('sc_l2_au').value) || 0;
    scorecardDefaults.l2.rates.pregel = parseFloat(document.getElementById('sc_l2_rate_pregel').value) || 0;
    scorecardDefaults.l2.rates.grof = parseFloat(document.getElementById('sc_l2_rate_grof').value) || 0;
    scorecardDefaults.l2.rates.htf = parseFloat(document.getElementById('sc_l2_rate_htf').value) || 0;
    scorecardDefaults.l2.demand.pregel = parseFloat(document.getElementById('sc_l2_demand_pregel').value) || 0;
    scorecardDefaults.l2.demand.grof = parseFloat(document.getElementById('sc_l2_demand_grof').value) || 0;
    scorecardDefaults.l2.demand.htf = parseFloat(document.getElementById('sc_l2_demand_htf').value) || 0;

    syncScorecardUIDisplays();
    runSolverPipeline();
}

function syncScorecardUIDisplays() {
    // Pull structures into individual elements inside layout
    const lines = ['l1', 'l2'];
    lines.forEach(l => {
        const data = scorecardDefaults[l];
        document.getElementById(`baseline_${l}_gross_hrs`).value = data.gross.toFixed(2);
        document.getElementById(`baseline_${l}_ooe`).value = data.ooe.toFixed(1) + '%';
        document.getElementById(`baseline_${l}_au`).value = data.au.toFixed(1) + '%';

        productsList.forEach(p => {
            document.getElementById(`baseline_${l}_${p}_speed`).value = data.rates[p].toFixed(2);
            
            // Standard structural baseline assignments mapping
            let totDemand = data.demand.pregel + data.demand.grof + data.demand.htf;
            let pTime = (data.rates[p] > 0) ? (data.demand[p] / data.rates[p]) : 0;
            let netHrs = data.gross * (data.ooe / 100) * (data.au / 100);
            
            let baselineTimePct = (netHrs > 0) ? (pTime / netHrs) * 100 : 0;
            let baselineOutputPct = (totDemand > 0) ? (data.demand[p] / totDemand) * 100 : 0;

            // Inject correctly generated proportional fallback calculations for UI fields 
            document.getElementById(`baseline_${l}_${p}_time`).value = baselineTimePct.toFixed(2) + '%';
            document.getElementById(`baseline_${l}_${p}_output`).value = baselineOutputPct.toFixed(2) + '%';
            document.getElementById(`baseline_${l}_${p}_mass`).value = data.demand[p].toFixed(2);
        });
    });
}

// Dynamical injection loop mapping standard product panels to page view structures
function renderDynamicProductRows(lineId) {
    const container = document.getElementById(`${lineId}_products_container`);
    container.innerHTML = ''; // Reset container frame completely

    productsList.forEach((prod) => {
        let defaultRank = (prod === 'pregel') ? 1 : (prod === 'grof' ? 2 : 3);
        
        const card = document.createElement('div');
        card.className = "bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-2 relative";
        card.id = `panel_${lineId}_${prod}`;
        
        card.innerHTML = `
            <div class="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span class="text-[11px] font-black tracking-wider text-slate-200 capitalize">${prod} Product Architecture</span>
                <div class="flex items-center gap-1.5">
                    <span class="text-[9px] font-bold text-slate-500 uppercase">Rank:</span>
                    <select id="rank_${lineId}_${prod}" onchange="runSolverPipeline()" class="bg-slate-950 text-orange-400 border border-slate-800 rounded px-1 py-0.5 text-[10px] font-bold focus:outline-none focus:border-orange-500">
                        <option value="1" ${defaultRank === 1 ? 'selected' : ''}>1</option>
                        <option value="2" ${defaultRank === 2 ? 'selected' : ''}>2</option>
                        <option value="3" ${defaultRank === 3 ? 'selected' : ''}>3</option>
                    </select>
                </div>
            </div>

            <div class="mt-2 mb-2">
                <span class="block text-[9px] text-slate-500 uppercase tracking-widest font-black mb-1.5">⚙️ Global Machine Profile</span>
                <div id="row_wrapper_${lineId}_${prod}_speed" class="flex items-center gap-1.5 text-xs pb-2 border-b border-slate-800/50">
                    <div draggable="true" ondragstart="handleDragStart(event, '${lineId}_${prod}_speed')" class="w-5 h-6 flex items-center justify-center bg-slate-800 hover:bg-orange-600 rounded cursor-grab text-slate-500 hover:text-white font-mono text-[9px]">⋮⋮</div>
                    <div class="w-24 text-[10px] font-medium text-slate-400 truncate">Speed (t/h)</div>
                    <input type="number" step="0.1" id="override_${lineId}_${prod}_speed" oninput="handleOverrideInput(this)" autocomplete="off" class="w-0 min-w-0 flex-1 bg-slate-950 text-slate-100 border border-slate-800 rounded px-1 py-0.5 text-center font-mono text-[11px]" placeholder="--">
                    <input type="text" id="baseline_${lineId}_${prod}_speed" disabled readonly class="w-0 min-w-0 flex-1 bg-slate-800 text-slate-500 border border-slate-700/40 rounded px-1 py-0.5 text-center font-mono text-[11px]">
                    <input type="text" id="reality_${lineId}_${prod}_speed" disabled readonly class="w-0 min-w-0 flex-1 rounded px-1 py-0.5 text-center font-mono text-[11px] font-bold">
                </div>
            </div>

            <div class="space-y-1.5 pt-1">
                <span class="block text-[9px] text-slate-500 uppercase tracking-widest font-black mb-1.5">🔒 Scenario Restrictors</span>
                
                <div id="row_wrapper_${lineId}_${prod}_time" class="flex items-center gap-1.5 text-xs transition-all duration-200 border-l-4 border-transparent pl-1">
                    <div draggable="true" ondragstart="handleDragStart(event, '${lineId}_${prod}_time')" class="w-5 h-6 flex items-center justify-center bg-slate-800 hover:bg-orange-600 rounded cursor-grab text-slate-500 hover:text-white font-mono text-[9px]">⋮⋮</div>
                    <div class="w-24 flex flex-col justify-center">
                        <span class="text-[10px] font-medium text-slate-400 truncate">% Weekly Time</span>
                        <span id="tag_${lineId}_${prod}_time" class="text-[8px] font-bold text-orange-500 leading-none hidden">[🔶 Active Restrictor]</span>
                    </div>
                    <input type="number" step="0.1" id="override_${lineId}_${prod}_time" oninput="handleOverrideInput(this)" autocomplete="off" class="w-0 min-w-0 flex-1 bg-slate-950 text-slate-100 border border-slate-800 rounded px-1 py-0.5 text-center font-mono text-[11px] placeholder:text-[8px] placeholder:italic placeholder:font-sans placeholder:text-slate-500" placeholder="proportional fallback...">
                    <input type="text" id="baseline_${lineId}_${prod}_time" disabled readonly class="w-0 min-w-0 flex-1 bg-slate-800 text-slate-500 border border-slate-700/40 rounded px-1 py-0.5 text-center font-mono text-[11px]">
                    <input type="text" id="reality_${lineId}_${prod}_time" disabled readonly class="w-0 min-w-0 flex-1 rounded px-1 py-0.5 text-center font-mono text-[11px] font-bold">
                </div>

                <div id="row_wrapper_${lineId}_${prod}_output" class="flex items-center gap-1.5 text-xs transition-all duration-200 border-l-4 border-transparent pl-1">
                    <div draggable="true" ondragstart="handleDragStart(event, '${lineId}_${prod}_output')" class="w-5 h-6 flex items-center justify-center bg-slate-800 hover:bg-orange-600 rounded cursor-grab text-slate-500 hover:text-white font-mono text-[9px]">⋮⋮</div>
                    <div class="w-24 flex flex-col justify-center">
                        <span class="text-[10px] font-medium text-slate-400 truncate">% Tot Output</span>
                        <span id="tag_${lineId}_${prod}_output" class="text-[8px] font-bold text-orange-500 leading-none hidden">[🔶 Active Restrictor]</span>
                    </div>
                    <input type="number" step="0.1" id="override_${lineId}_${prod}_output" oninput="handleOverrideInput(this)" autocomplete="off" class="w-0 min-w-0 flex-1 bg-slate-950 text-slate-100 border border-slate-800 rounded px-1 py-0.5 text-center font-mono text-[11px] placeholder:text-[8px] placeholder:italic placeholder:font-sans placeholder:text-slate-500" placeholder="derived from mass...">
                    <input type="text" id="baseline_${lineId}_${prod}_output" disabled readonly class="w-0 min-w-0 flex-1 bg-slate-800 text-slate-500 border border-slate-700/40 rounded px-1 py-0.5 text-center font-mono text-[11px]">
                    <input type="text" id="reality_${lineId}_${prod}_output" disabled readonly class="w-0 min-w-0 flex-1 rounded px-1 py-0.5 text-center font-mono text-[11px] font-bold">
                </div>

                <div id="row_wrapper_${lineId}_${prod}_mass" class="flex items-center gap-1.5 text-xs transition-all duration-200 border-l-4 border-orange-500 pl-1">
                    <div draggable="true" ondragstart="handleDragStart(event, '${lineId}_${prod}_mass')" class="w-5 h-6 flex items-center justify-center bg-slate-800 hover:bg-orange-600 rounded cursor-grab text-slate-400 hover:text-white font-mono text-[9px]">⋮⋮</div>
                    <div class="w-24 flex flex-col justify-center">
                        <span class="text-[10px] font-extrabold text-slate-300 truncate">Max Amount (t)</span>
                        <span id="tag_${lineId}_${prod}_mass" class="text-[8px] font-bold text-orange-500 leading-none">[🎯 Leading Target]</span>
                    </div>
                    <input type="number" step="0.1" id="override_${lineId}_${prod}_mass" oninput="handleOverrideInput(this)" autocomplete="off" class="w-0 min-w-0 flex-1 bg-slate-950 text-slate-100 border border-slate-800 rounded px-1 py-0.5 text-center font-mono text-[11px] placeholder:text-[8px] placeholder:italic placeholder:font-sans placeholder:text-slate-500" placeholder="Default Master Target">
                    <input type="text" id="baseline_${lineId}_${prod}_mass" disabled readonly class="w-0 min-w-0 flex-1 bg-slate-800 text-slate-500 border border-slate-700/40 rounded px-1 py-0.5 text-center font-mono text-[11px]">
                    <input type="text" id="reality_${lineId}_${prod}_mass" disabled readonly class="w-0 min-w-0 flex-1 rounded px-1 py-0.5 text-center font-mono text-[11px] font-bold">
                    
                    <div id="badge_${lineId}_${prod}_delta" draggable="true" ondragstart="handleDragStart(event, '${lineId}_${prod}_delta')" class="cursor-grab select-none">0.00</div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Track user forced overrides styling inputs and cascade calculations trigger execution path
function handleOverrideInput(inputElement) {
    const activeClasses = ['bg-gray-100', 'text-slate-900', 'border-orange-500', 'font-bold'];
    const emptyClasses = ['bg-slate-950', 'text-slate-100', 'border-slate-800'];
    
    if (inputElement.value !== '') {
        inputElement.classList.remove(...emptyClasses);
        inputElement.classList.add(...activeClasses);
    } else {
        inputElement.classList.remove(...activeClasses);
        inputElement.classList.add(...emptyClasses);
    }
    
    // Sync up slider components values if this parameter is wired up inside Z Docks
    const matchingSlider = document.getElementById(`slider_control_${inputElement.id.replace('override_', '')}`);
    if (matchingSlider) {
        matchingSlider.value = parseFloat(inputElement.value) || 0;
    }

    runSolverPipeline();
}

// Global master reset cleaner layout function
function resetAllOverrides() {
    const inputBoxes = document.querySelectorAll('input[id^="override_"]');
    const activeClasses = ['bg-gray-100', 'text-slate-900', 'border-orange-500', 'font-bold'];
    const emptyClasses = ['bg-slate-950', 'text-slate-100', 'border-slate-800'];

    inputBoxes.forEach(box => {
        box.value = '';
        box.classList.remove(...activeClasses);
        box.classList.add(...emptyClasses);
    });
    
    // Re-sync slider values inside tracker frames
    assignedZSliders.forEach(z => {
        const slider = document.getElementById(`slider_control_${z.key}`);
        if (slider) slider.value = 0;
    });

    document.getElementById('global_alert_banner').classList.add('hidden');
    systemHasConflict = false;
    runSolverPipeline();
}

// Helper calculation accuracy precision tools avoiding floating point micro errors
function precisionRound(numericValue) {
    return Math.round((numericValue + Number.EPSILON) * 10000) / 10000;
}

// Multi-variable conflict verification logic gate tracking Section 5-C constraints
function verifyProductAntiConflictConstraints(line, prod, stateSource) {
    let activeOverridesCount = 0;
    if (stateSource(`override_${line}_${prod}_time`) !== null) activeOverridesCount++;
    if (stateSource(`override_${line}_${prod}_output`) !== null) activeOverridesCount++;
    if (stateSource(`override_${line}_${prod}_mass`) !== null) activeOverridesCount++;
    return activeOverridesCount > 1;
}

// THE CORE MATHEMATICAL INTERACTIVE SOLVER CASCADE (Supports Virtual Testing Sweep Runs)
function executeCapacitySolverLogic(virtualOverrideMap = null) {
    let conflictDetected = false;

    // Direct mapping tracking source redirecting requests cleanly during background range sweep sweeps
    const fetchVal = (elementId) => {
        if (virtualOverrideMap && virtualOverrideMap.hasOwnProperty(elementId)) {
            return virtualOverrideMap[elementId];
        }
        const el = document.getElementById(elementId);
        if (!el) return null;
        if (el.value === '') return null;
        return parseFloat(el.value);
    };

    let localOutputs = { l1: {}, l2: {}, plant: {} };
    const lines = ['l1', 'l2'];

    // Loop parameters calculations matrix for both processing channels
    for (let l of lines) {
        let sc = scorecardDefaults[l];
        
        // Read capacities variables with fallbacks matching specifications
        let gross = fetchVal(`override_${l}_gross_hrs`) !== null ? fetchVal(`override_${l}_gross_hrs`) : sc.gross;
        let ooe = fetchVal(`override_${l}_ooe`) !== null ? fetchVal(`override_${l}_ooe`) : sc.ooe;
        let auBase = fetchVal(`override_${l}_au`) !== null ? fetchVal(`override_${l}_au`) : sc.au;

        localOutputs[l].gross = gross;
        localOutputs[l].ooe = ooe;
        localOutputs[l].au_baseline = auBase;
        localOutputs[l].products = {};

        // Product blocks structure iteration mapping parameters completely
        for (let p of productsList) {
            if (verifyProductAntiConflictConstraints(l, p, fetchVal)) {
                conflictDetected = true;
            }
            let rate = fetchVal(`override_${l}_${p}_speed`) !== null ? fetchVal(`override_${l}_${p}_speed`) : sc.rates[p];
            localOutputs[l].products[p] = {
                speed: rate,
                demand: sc.demand[p],
                rank: parseInt(document.getElementById(`rank_${l}_${p}`)?.value || '1'),
                overrideTime: fetchVal(`override_${l}_${p}_time`),
                overrideOutput: fetchVal(`override_${l}_${p}_output`),
                overrideMass: fetchVal(`override_${l}_${p}_mass`),
                calculatedMass: 0,
                calculatedTimePct: 0,
                calculatedOutputPct: 0,
                status: 'green'
            };
        }

        // Diverge loop calculations routing logic according to selected operations switch
        if (currentEngineMode === 'A') {
            // MODE A CAP & CURTAIL LOGIC ENGINE RUNTIME CASCADE
            let netHoursPool = precisionRound(gross * (ooe / 100) * (auBase / 100));
            let originalNetHoursPool = netHoursPool;
            let consumedHours = 0;

            // Rank ordering sorting algorithm iteration tracking priorities layers
            let sortedProds = Object.keys(localOutputs[l].products).map(k => ({key: k, ...localOutputs[l].products[k]}));
            sortedProds.sort((a, b) => a.rank - b.rank);

            // Step 1: Execute fixed specified user overrides constraints anchors directly
            sortedProds.forEach(pObj => {
                let p = pObj.key;
                let item = localOutputs[l].products[p];
                
                if (item.overrideMass !== null) {
                    let reqHrs = item.speed > 0 ? (item.overrideMass / item.speed) : 0;
                    let activeHrs = Math.max(0, Math.min(netHoursPool, reqHrs));
                    item.calculatedMass = precisionRound(activeHrs * item.speed);
                    item.calculatedTimePct = originalNetHoursPool > 0 ? precisionRound((activeHrs / originalNetHoursPool) * 100) : 0;
                    netHoursPool = precisionRound(netHoursPool - activeHrs);
                    consumedHours += activeHrs;
                    if (activeHrs < reqHrs) item.status = 'amber';
                } else if (item.overrideTime !== null) {
                    let activeHrs = Math.max(0, Math.min(netHoursPool, originalNetHoursPool * (item.overrideTime / 100)));
                    item.calculatedMass = precisionRound(activeHrs * item.speed);
                    item.calculatedTimePct = originalNetHoursPool > 0 ? precisionRound((activeHrs / originalNetHoursPool) * 100) : 0;
                    netHoursPool = precisionRound(netHoursPool - activeHrs);
                    consumedHours += activeHrs;
                }
            });

            // Step 2: Proportional allocations tracking for components lacking forced constraints anchors
            let remainingUnassignedProds = sortedProds.filter(p => p.overrideMass === null && p.overrideTime === null);
            
            // Sum demands requirements to calibrate fallback balance accurately
            let totalFallbackDemandWeight = 0;
            remainingUnassignedProds.forEach(p => { totalFallbackDemandWeight += p.demand; });

            // Section 9-B Target Saturation Evaluation Gate
            let hoursNeededForRemaining = 0;
            remainingUnassignedProds.forEach(p => {
                hoursNeededForRemaining += p.speed > 0 ? (p.demand / p.speed) : 0;
            });

            remainingUnassignedProds.forEach(pObj => {
                let p = pObj.key;
                let item = localOutputs[l].products[p];
                
                if (netHoursPool <= 0) {
                    item.calculatedMass = 0;
                    item.calculatedTimePct = 0;
                    item.status = 'amber';
                } else if (precisionRound(netHoursPool) >= precisionRound(hoursNeededForRemaining)) {
                    // Target Saturation Rule: Satisfy demand cleanly without division truncation loss
                    item.calculatedMass = item.demand;
                    let reqHrs = item.speed > 0 ? (item.demand / item.speed) : 0;
                    item.calculatedTimePct = originalNetHoursPool > 0 ? precisionRound((reqHrs / originalNetHoursPool) * 100) : 0;
                    consumedHours += reqHrs;
                } else {
                    // Distribute remaining unallocated net hours proportionally by baseline demands
                    let ratio = totalFallbackDemandWeight > 0 ? (item.demand / totalFallbackDemandWeight) : 0;
                    let allocatedHrs = Math.max(0, Math.min(netHoursPool, netHoursPool * ratio));
                    item.calculatedMass = precisionRound(allocatedHrs * item.speed);
                    item.calculatedTimePct = originalNetHoursPool > 0 ? precisionRound((allocatedHrs / originalNetHoursPool) * 100) : 0;
                    consumedHours += allocatedHrs;
                    if (item.calculatedMass < item.demand) item.status = 'amber';
                }
            });

            // Asset Utilization Drop & Idle capacity reduction tracking computation loop
            let totalCapacityHoursPossible = precisionRound(gross * (ooe / 100));
            let recalculateAU = totalCapacityHoursPossible > 0 ? precisionRound((consumedHours / totalCapacityHoursPossible) * 100) : 0;
            
            // Update active asset tracking values reactive states bounds check
            if (recalculateAU < auBase && fetchVal(`override_${l}_au`) === null) {
                localOutputs[l].au_active = recalculateAU;
            } else {
                localOutputs[l].au_active = auBase;
            }

            // Perform overall mass summation balance execution mapping percentages
            let lineTotalTons = 0;
            productsList.forEach(p => { lineTotalTons += localOutputs[l].products[p].calculatedMass; });
            localOutputs[l].total_tonnage = precisionRound(lineTotalTons);

            productsList.forEach(p => {
                let item = localOutputs[l].products[p];
                item.calculatedOutputPct = lineTotalTons > 0 ? precisionRound((item.calculatedMass / lineTotalTons) * 100) : 0;
            });

        } else {
            // MODE B REQUIRED EXTRA HOURS SCHEDULING CALCULATION CASCADE
            let totalRequiredNetHours = 0;

            // Compile and analyze mandatory production demands rules framework
            productsList.forEach(p => {
                let item = localOutputs[l].products[p];
                let targetMass = item.overrideMass !== null ? item.overrideMass : item.demand;
                
                if (item.overrideTime !== null) {
                    // Meltdown Loop Protection Rule implementation block
                    let baseNetAvailable = sc.gross * (sc.ooe / 100) * (sc.au / 100);
                    let frozenHrs = baseNetAvailable * (item.overrideTime / 100);
                    item.calculatedTimePct = item.overrideTime;
                    item.calculatedMass = precisionRound(frozenHrs * item.speed);
                    totalRequiredNetHours += frozenHrs;
                } else {
                    item.calculatedMass = targetMass;
                    let neededHrs = item.speed > 0 ? (targetMass / item.speed) : 0;
                    totalRequiredNetHours += neededHrs;
                }
            });

            // Scale network parameters up to extract structural gross staffed hours
            let reqGross = (ooe > 0 && auBase > 0) ? (totalRequiredNetHours / ((ooe / 100) * (auBase / 100))) : 0;
            localOutputs[l].gross_required = precisionRound(reqGross);
            localOutputs[l].au_active = auBase;

            let lineTotalTons = 0;
            productsList.forEach(p => { lineTotalTons += localOutputs[l].products[p].calculatedMass; });
            localOutputs[l].total_tonnage = precisionRound(lineTotalTons);

            // Map percentages relative frames safely across arrays
            productsList.forEach(p => {
                let item = localOutputs[l].products[p];
                let activeHrs = item.speed > 0 ? (item.calculatedMass / item.speed) : 0;
                let netPool = reqGross * (ooe / 100) * (auBase / 100);
                
                if (item.overrideTime === null) {
                    item.calculatedTimePct = netPool > 0 ? precisionRound((activeHrs / netPool) * 100) : 0;
                }
                item.calculatedOutputPct = lineTotalTons > 0 ? precisionRound((item.calculatedMass / lineTotalTons) * 100) : 0;
            });
        }
    }

    // Consolidate global macro summaries variables data architecture
    let plantBaselineTotal = scorecardDefaults.l1.demand.pregel + scorecardDefaults.l1.demand.grof + scorecardDefaults.l1.demand.htf +
                                scorecardDefaults.l2.demand.pregel + scorecardDefaults.l2.demand.grof + scorecardDefaults.l2.demand.htf;
    let plantActiveTotal = localOutputs.l1.total_tonnage + localOutputs.l2.total_tonnage;

    localOutputs.plant.baseline_total = precisionRound(plantBaselineTotal);
    localOutputs.plant.active_total = precisionRound(plantActiveTotal);
    localOutputs.plant.delta = precisionRound(plantActiveTotal - plantBaselineTotal);
    localOutputs.conflict = conflictDetected;

    return localOutputs;
}

// Execution pipeline executing mathematics engine updates and UI cell states refreshes
function runSolverPipeline() {
    // Process core math logic execution
    const outputs = executeCapacitySolverLogic();
    activeRealities = outputs; 
    systemHasConflict = outputs.conflict;

    // Handle UI Alert messaging triggers mapping
    const alertBanner = document.getElementById('global_alert_banner');
    if (systemHasConflict) {
        alertBanner.classList.remove('hidden');
    } else {
        alertBanner.classList.add('hidden');
    }

    // Sync structural realities fields layout changes across display nodes
    const lines = ['l1', 'l2'];
    lines.forEach(l => {
        // Update line headers blocks capacity inputs values text fields
        updateFieldUI(`reality_${l}_gross_hrs`, activeRealities[l].gross, 'green');
        updateFieldUI(`reality_${l}_ooe`, activeRealities[l].ooe, 'green', '%');
        updateFieldUI(`reality_${l}_au`, activeRealities[l].au_active, 'green', '%');

        let sc = scorecardDefaults[l];
        let lineBaselineTotal = sc.demand.pregel + sc.demand.grof + sc.demand.htf;
        document.getElementById(`summary_${l}_baseline`).innerText = lineBaselineTotal.toFixed(2);
        document.getElementById(`summary_${l}_active`).innerText = activeRealities[l].total_tonnage.toFixed(2);
        
        let lineDelta = activeRealities[l].total_tonnage - lineBaselineTotal;
        let deltaBox = document.getElementById(`summary_${l}_delta_box`);
        let deltaText = document.getElementById(`summary_${l}_delta`);
        deltaText.innerText = (lineDelta >= 0 ? '+' : '') + lineDelta.toFixed(2);
        if (lineDelta < 0) {
            deltaBox.className = "p-1.5 rounded border border-amber-800 bg-amber-950 text-amber-400";
        } else {
            deltaBox.className = "p-1.5 rounded border border-green-800 bg-green-950 text-green-400";
        }

        // Inner products records update loops
        productsList.forEach(p => {
            let item = activeRealities[l].products[p];
            let statusColor = systemHasConflict ? 'red' : item.status;

            updateFieldUI(`reality_${l}_${p}_speed`, item.speed, statusColor);
            updateFieldUI(`reality_${l}_${p}_time`, item.calculatedTimePct, statusColor, '%');
            updateFieldUI(`reality_${l}_${p}_output`, item.calculatedOutputPct, statusColor, '%');
            updateFieldUI(`reality_${l}_${p}_mass`, item.calculatedMass, statusColor);

            // Synchronize dynamic badge structures labels calculations
            let vBadge = document.getElementById(`badge_${l}_${p}_delta`);
            let variance = item.calculatedMass - item.demand;
            vBadge.innerText = (variance >= 0 ? '+' : '') + variance.toFixed(2);
            if (variance < 0) {
                vBadge.className = "text-amber-400 bg-amber-950 px-1.5 rounded text-xs font-bold font-mono border border-amber-800 cursor-grab ml-1 shrink-0";
            } else {
                vBadge.className = "text-green-400 bg-green-950 px-1.5 rounded text-xs font-bold font-mono border border-green-800 cursor-grab ml-1 shrink-0";
            }
        });
    });

    // Trigger structural dynamic highlights updates for scenario restrictors anchor rows
    updateProductUIAnchors();

    // Refresh macro totals banners sections layout blocks text parameters
    document.getElementById('global_summary_baseline').innerText = activeRealities.plant.baseline_total.toFixed(2) + ' tons';
    document.getElementById('global_summary_active').innerText = activeRealities.plant.active_total.toFixed(2) + ' tons';
    
    let gDeltaBox = document.getElementById('global_summary_delta_box');
    let gDeltaText = document.getElementById('global_summary_delta');
    gDeltaText.innerText = (activeRealities.plant.delta >= 0 ? '+' : '') + activeRealities.plant.delta.toFixed(2) + ' tons';
    if (activeRealities.plant.delta < 0) {
        gDeltaBox.className = "p-3 rounded-lg border border-amber-800 bg-amber-950 text-amber-400 text-center flex flex-col justify-center";
    } else {
        gDeltaBox.className = "p-3 rounded-lg border border-green-800 bg-green-950 text-green-400 text-center flex flex-col justify-center";
    }

    // Trigger Master Feedback HUD Refresh Operations Routine
    refreshMasterHUDCard();
    
    // Loop updates across the predictive graph chart matrix structure canvas 
    refreshChartVisualizationData();

    // Refresh Monthly & Yearly Volume Projections Box
    refreshProjections();
}

// Applies dynamic accent highlights and updates contextual placeholders based on active input states
function updateProductUIAnchors() {
    const lines = ['l1', 'l2'];
    lines.forEach(l => {
        productsList.forEach(p => {
            const timeOverride = document.getElementById(`override_${l}_${p}_time`)?.value;
            const outputOverride = document.getElementById(`override_${l}_${p}_output`)?.value;
            const massOverrideInput = document.getElementById(`override_${l}_${p}_mass`);

            const timeWrapper = document.getElementById(`row_wrapper_${l}_${p}_time`);
            const outputWrapper = document.getElementById(`row_wrapper_${l}_${p}_output`);
            const massWrapper = document.getElementById(`row_wrapper_${l}_${p}_mass`);

            const timeTag = document.getElementById(`tag_${l}_${p}_time`);
            const outputTag = document.getElementById(`tag_${l}_${p}_output`);
            const massTag = document.getElementById(`tag_${l}_${p}_mass`);

            if (!timeWrapper) return; // Structural check to avoid initialization errors

            // Clean previous accent classes mapping
            timeWrapper.classList.remove('border-orange-500');
            timeWrapper.classList.add('border-transparent');
            outputWrapper.classList.remove('border-orange-500');
            outputWrapper.classList.add('border-transparent');
            massWrapper.classList.remove('border-orange-500');
            massWrapper.classList.add('border-transparent');
            
            timeTag.classList.add('hidden');
            outputTag.classList.add('hidden');
            massTag.classList.add('hidden');

            if (timeOverride !== '' && timeOverride !== undefined) {
                timeWrapper.classList.remove('border-transparent');
                timeWrapper.classList.add('border-orange-500');
                timeTag.classList.remove('hidden');
                massOverrideInput.placeholder = "calculated outcome...";
            } else if (outputOverride !== '' && outputOverride !== undefined) {
                outputWrapper.classList.remove('border-transparent');
                outputWrapper.classList.add('border-orange-500');
                outputTag.classList.remove('hidden');
                massOverrideInput.placeholder = "calculated outcome...";
            } else {
                massWrapper.classList.remove('border-transparent');
                massWrapper.classList.add('border-orange-500');
                massTag.classList.remove('hidden');
                massOverrideInput.placeholder = "Default Master Target";
            }
        });
    });
}

// Generates the Long-Term Volumetric Extrapolations based on active weekly reality
function refreshProjections() {
    const weeksInYear = 52;
    const weeksInMonth = 52 / 12;

    const getCombinedMass = (prod) => {
        return (activeRealities.l1.products[prod]?.calculatedMass || 0) + 
                (activeRealities.l2.products[prod]?.calculatedMass || 0);
    };

    const pregelWk = getCombinedMass('pregel');
    const grofWk = getCombinedMass('grof');
    const htfWk = getCombinedMass('htf');
    const totalWk = activeRealities.plant.active_total || 0;

    document.getElementById('proj_mo_pregel').innerText = (pregelWk * weeksInMonth).toFixed(2);
    document.getElementById('proj_yr_pregel').innerText = (pregelWk * weeksInYear).toFixed(2);

    document.getElementById('proj_mo_grof').innerText = (grofWk * weeksInMonth).toFixed(2);
    document.getElementById('proj_yr_grof').innerText = (grofWk * weeksInYear).toFixed(2);

    document.getElementById('proj_mo_htf').innerText = (htfWk * weeksInMonth).toFixed(2);
    document.getElementById('proj_yr_htf').innerText = (htfWk * weeksInYear).toFixed(2);

    document.getElementById('proj_mo_total').innerText = (totalWk * weeksInMonth).toFixed(2);
    document.getElementById('proj_yr_total').innerText = (totalWk * weeksInYear).toFixed(2);
}

// Centralized utility mapping theme design properties on outputs input text structures
function updateFieldUI(id, val, colorStatus, suffix = '') {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = val.toFixed(2) + suffix;

    if (colorStatus === 'red') {
        el.className = "w-0 min-w-0 flex-1 bg-red-900 text-red-100 border-red-600 rounded px-1 py-0.5 text-center font-mono text-[11px] font-bold";
    } else if (colorStatus === 'amber') {
        el.className = "w-0 min-w-0 flex-1 bg-amber-900 text-amber-100 border-amber-600 rounded px-1 py-0.5 text-center font-mono text-[11px] font-bold";
    } else {
        el.className = "w-0 min-w-0 flex-1 bg-green-900 text-green-100 border-green-600 rounded px-1 py-0.5 text-center font-mono text-[11px] font-bold";
    }
}

// Pinned Master Feedback Card Layout Engine Logic Implementation Block
function refreshMasterHUDCard() {
    const card = document.getElementById('master_feedback_card');
    const title = document.getElementById('feedback_title');
    const metric = document.getElementById('feedback_metric');
    const desc = document.getElementById('feedback_desc');

    const sharedOperatorActive = document.getElementById('shared_operator_toggle').checked;

    // Handle Global structural staffing constraints check
    if (currentEngineMode === 'B') {
        let l1_gross = activeRealities.l1.gross_required || 0;
        let l2_gross = activeRealities.l2.gross_required || 0;
        let combinedGrossRequired = l1_gross + l2_gross;

        if (sharedOperatorActive && combinedGrossRequired > 168) {
            card.className = "p-4 rounded-xl transition-all duration-300 text-center bg-red-950 border-red-500 text-red-100 font-extrabold shadow-lg animate-pulse";
            title.innerText = "CRITICAL RESOURCE FAULT DETECTED";
            metric.innerText = combinedGrossRequired.toFixed(2) + " HR DEMAND";
            desc.innerText = "CRITICAL: 1-OPERATOR POOL EXCEEDS 168-HR PHYSICAL CEILING";
            return;
        } else if (!sharedOperatorActive && (l1_gross > 168 || l2_gross > 168)) {
            let offendingLine = l1_gross > 168 ? "LINE 1" : "LINE 2";
            card.className = "p-4 rounded-xl transition-all duration-300 text-center bg-red-950 border-red-500 text-red-100 font-extrabold shadow-lg animate-pulse";
            title.innerText = "CRITICAL WORK WEEK FAULT";
            metric.innerText = Math.max(l1_gross, l2_gross).toFixed(2) + " HRS MAX";
            desc.innerText = `CRITICAL: ${offendingLine} EXCEEDS 168-HR PHYSICAL LIMIT`;
            return;
        }
    }

    // Normal Operations routing feedback mapping paths
    if (currentEngineMode === 'A') {
        title.innerText = "OPERATIONAL VARIANCE (TONS)";
        let deltaVal = activeRealities.plant.delta;
        metric.innerText = (deltaVal >= 0 ? '+' : '') + deltaVal.toFixed(2) + " TONS";
        
        if (deltaVal < 0) {
            card.className = "p-4 rounded-xl text-center bg-amber-950 border-amber-600 text-amber-200 font-bold shadow";
            desc.innerText = "Production volume curtailed below baseline commercial target requirements due to capacity limits.";
        } else {
            card.className = "p-4 rounded-xl text-center bg-green-950 border-green-600 text-green-200 font-bold shadow";
            desc.innerText = "Capacity surplus satisfied. Plant operating within standard targeted specifications threshold.";
        }
    } else {
        title.innerText = "STAFFING EXTRA SCHEDULE CAPACITY GAP";
        let activeL1Gross = fetchUserOverrideRawVal('l1_gross_hrs') !== null ? fetchUserOverrideRawVal('l1_gross_hrs') : scorecardDefaults.l1.gross;
        let activeL2Gross = fetchUserOverrideRawVal('l2_gross_hrs') !== null ? fetchUserOverrideRawVal('l2_gross_hrs') : scorecardDefaults.l2.gross;
        
        let grossStaffedAvailableSum = activeL1Gross + activeL2Gross;
        let grossStaffedRequiredSum = activeRealities.l1.gross_required + activeRealities.l2.gross_required;
        let gap = grossStaffedRequiredSum - grossStaffedAvailableSum;

        if (gap > 0) {
            card.className = "p-4 rounded-xl text-center bg-amber-950 border-amber-600 text-amber-200 font-bold shadow";
            metric.innerText = "+" + gap.toFixed(2) + " COMBINED GROSS HOURS REQUIRED";
            desc.innerText = "Staffing deficits detected. Increase scheduled staffed hours setup parameters to achieve volume quotas.";
        } else {
            card.className = "p-4 rounded-xl text-center bg-green-950 border-green-600 text-green-200 font-bold shadow";
            metric.innerText = "0.00 HOURS EXTRA CAPACITY NEEDED";
            desc.innerText = "Available staffed scheduled hours window completely satisfies baseline targets demand.";
        }
    }
}

// Helper extractor safely querying active inputs numbers
function fetchUserOverrideRawVal(metricKey) {
    const element = document.getElementById(`override_${metricKey}`);
    if (!element || element.value === '') return null;
    return parseFloat(element.value);
}

function extractActiveRealityDisplayVal(metricKey) {
    // Process macro properties routing directly
    if (metricKey === 'combined_active_tonnage') return activeRealities.plant.active_total;
    if (metricKey === 'line1_total_out') return activeRealities.l1.total_tonnage;
    if (metricKey === 'line2_total_out') return activeRealities.l2.total_tonnage;

    // Deconstruct parts targeting standard inner structures elements patterns
    let parts = metricKey.split('_');
    if (parts.length === 2) {
        // E.g. l1_gross_hrs, l1_ooe, l1_au
        let line = parts[0];
        let prop = parts[1];
        if (prop === 'gross') return activeRealities[line].gross;
        if (prop === 'ooe') return activeRealities[line].ooe;
        if (prop === 'au') return activeRealities[line].au_active;
    } else if (parts.length === 3) {
        // E.g. l1_pregel_speed, l1_pregel_time, l1_pregel_mass
        let line = parts[0];
        let prod = parts[1];
        let type = parts[2];
        let prodItem = activeRealities[line].products[prod];
        if (!prodItem) return 0;
        if (type === 'speed') return prodItem.speed;
        if (type === 'time') return prodItem.calculatedTimePct;
        if (type === 'output') return prodItem.calculatedOutputPct;
        if (type === 'mass') return prodItem.calculatedMass;
        if (type === 'delta') return prodItem.calculatedMass - prodItem.demand;
    }
    return 0;
}

// DRAG AND DROP ARCHITECTURE ENGINEERING INTERFACES IMPLEMENTATION
function handleDragStart(event, metricKey) {
    event.dataTransfer.setData("text/plain", metricKey);
    event.dataTransfer.effectAllowed = "move";
}

function allowDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
}

// Clean up visual highlight bounds on leave events
document.querySelectorAll('[id^="bay_"]').forEach(bay => {
    bay.addEventListener('dragleave', (e) => { e.currentTarget.classList.remove('drag-over'); });
});

function handleDrop(event, targetBayIndicator) {
    event.preventDefault();
    const bayElement = event.currentTarget;
    bayElement.classList.remove('drag-over');

    const draggedKey = event.dataTransfer.getData("text/plain");
    if (!prettyLabels.hasOwnProperty(draggedKey)) return; // Security boundary guardrail

    // Strict exclusivity checking implementation routing rules
    if (targetBayIndicator === 'X') {
        if (draggedKey === assignedYAxis) assignedYAxis = null;
        assignedXAxis = draggedKey;
    } else if (targetBayIndicator === 'Y') {
        if (draggedKey === assignedXAxis) assignedXAxis = null;
        assignedYAxis = draggedKey;
    } else if (targetBayIndicator === 'Z') {
        // Prevent duplicate assignment parameters inside slider array configuration
        if (assignedZSliders.some(z => z.key === draggedKey)) return;
        if (assignedZSliders.length >= 3) {
            // Remove first structural index position to maintain 3 slots cap ceiling parameter rule
            assignedZSliders.shift();
        }
        assignedZSliders.push({ key: draggedKey });
    }

    syncAnalyticalBaysLayout();
    runSolverPipeline();
}

function syncAnalyticalBaysLayout() {
    // Update Horizontal X-Axis configurations
    const dockedX = document.getElementById('docked_x');
    const phX = document.getElementById('placeholder_x');
    if (assignedXAxis) {
        dockedX.innerText = prettyLabels[assignedXAxis];
        dockedX.classList.remove('hidden');
        phX.classList.add('hidden');
    } else {
        dockedX.classList.add('hidden');
        phX.classList.remove('hidden');
    }

    // Update Vertical Y-Axis metrics configurations
    const dockedY = document.getElementById('docked_y');
    const phY = document.getElementById('placeholder_y');
    if (assignedYAxis) {
        dockedY.innerText = prettyLabels[assignedYAxis];
        dockedY.classList.remove('hidden');
        phY.classList.add('hidden');
    } else {
        dockedY.classList.add('hidden');
        phY.classList.remove('hidden');
    }

    // Repopulate sliding shifters components lists container frames
    const dockedZList = document.getElementById('docked_z_list');
    const phZ = document.getElementById('placeholder_z');
    const slidersWrapper = document.getElementById('z_sliders_wrapper');
    const slidersStack = document.getElementById('z_sliders_stack');

    slidersStack.innerHTML = ''; // Reset controls layouts tree context cleanly

    if (assignedZSliders.length > 0) {
        phZ.classList.add('hidden');
        dockedZList.classList.remove('hidden');
        dockedZList.innerHTML = '';

        slidersWrapper.classList.remove('hidden');

        assignedZSliders.forEach((zObj, idx) => {
            // Inject minor metadata configurations chip badges tags inside the bay wrapper box
            const chip = document.createElement('span');
            chip.className = "text-[9px] font-bold text-blue-300 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 truncate max-w-full inline-block relative pr-4";
            chip.innerText = prettyLabels[zObj.key];
            
            const delBtn = document.createElement('button');
            delBtn.innerText = '×';
            delBtn.className = "absolute right-0.5 top-0 text-red-400 hover:text-red-200 font-bold px-0.5 text-[10px]";
            delBtn.onclick = (e) => {
                e.stopPropagation();
                assignedZSliders.splice(idx, 1);
                syncAnalyticalBaysLayout();
                runSolverPipeline();
            };
            chip.appendChild(delBtn);
            dockedZList.appendChild(chip);

            // Build standard multi-slot slider slider physical track module matching requirements
            let currentLiveVal = extractActiveRealityDisplayVal(zObj.key);
            
            // Determine scaling bounds context boundaries criteria rule properties
            let isPercentage = zObj.key.includes('ooe') || zObj.key.includes('au') || zObj.key.includes('time') || zObj.key.includes('output');
            let minRange = 0;
            let maxRange = isPercentage ? 100 : (currentLiveVal > 0 ? precisionRound(currentLiveVal * 2) : 200);
            let stepInc = 0.1; // Hardcoded strictly to 0.1 as requested per user prompt rules

            const sliderContainer = document.createElement('div');
            sliderContainer.className = "bg-slate-950 p-2 rounded border border-slate-800 space-y-1";
            sliderContainer.innerHTML = `
                <div class="flex justify-between items-center text-[10px]">
                    <span class="font-extrabold text-slate-300 truncate max-w-[70%]">${prettyLabels[zObj.key]}</span>
                    <span id="slider_val_lbl_${zObj.key}" class="font-mono text-orange-400 font-bold bg-slate-900 px-1 rounded border border-slate-800">0.00</span>
                </div>
                <input type="range" id="slider_control_${zObj.key}" min="${minRange}" max="${maxRange}" step="${stepInc}" value="${currentLiveVal}" 
                    oninput="handleZSliderMovement('${zObj.key}', this.value)" class="w-full accent-orange-500 h-1 bg-slate-800 rounded-lg cursor-pointer">
            `;
            slidersStack.appendChild(sliderContainer);
            document.getElementById(`slider_val_lbl_${zObj.key}`).innerText = currentLiveVal.toFixed(2) + (isPercentage ? '%' : '');
        });
    } else {
        dockedZList.classList.add('hidden');
        phZ.classList.remove('hidden');
        slidersWrapper.classList.add('hidden');
    }
}

function handleZSliderMovement(metricKey, positionValue) {
    let numVal = parseFloat(positionValue) || 0;
    let isPercentage = metricKey.includes('ooe') || metricKey.includes('au') || metricKey.includes('time') || metricKey.includes('output');
    
    document.getElementById(`slider_val_lbl_${metricKey}`).innerText = numVal.toFixed(2) + (isPercentage ? '%' : '');

    // Access underlying matrix target node row reference to force text updates dynamically
    let parts = metricKey.split('_');
    let targetInputElementId = "";
    if (parts.length === 2) targetInputElementId = `override_${parts[0]}_${parts[1]}`;
    else if (parts.length === 3) targetInputElementId = `override_${parts[0]}_${parts[1]}_${parts[2]}`;

    const inputNode = document.getElementById(targetInputElementId);
    if (inputNode) {
        inputNode.value = numVal.toFixed(2);
        
        const activeClasses = ['bg-gray-100', 'text-slate-900', 'border-orange-500', 'font-bold'];
        const emptyClasses = ['bg-slate-950', 'text-slate-100', 'border-slate-800'];
        
        inputNode.classList.remove(...emptyClasses);
        inputNode.classList.add(...activeClasses);
    }

    runSolverPipeline();
}

function clearAllChartAxes() {
    assignedXAxis = null;
    assignedYAxis = null;
    assignedZSliders = [];
    syncAnalyticalBaysLayout();
    runSolverPipeline();
}

// 10-DOT PREDICTIVE SWEEP SIMULATION ENGINE & CHART.JS RECONSTRUCTION ARCHITECTURE
function initChartArchitecture() {
    const contextCanvasElement = document.getElementById('predictiveSimulationChart').getContext('2d');
    
    simulationChartInstance = new Chart(contextCanvasElement, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Predictive Sweep Trend Curve',
                    data: [],
                    borderColor: '#3b82f6',
                    borderWidth: 2,
                    backgroundColor: 'rgba(59, 130, 246, 0.05)',
                    fill: true,
                    tension: 0.1,
                    pointRadius: 4,
                    pointBackgroundColor: '#2563eb',
                    pointBorderColor: '#0f172a',
                    id: 'trend_dataset'
                },
                {
                    label: 'Active "You Are Here" Tracker Locator Dot',
                    data: [],
                    pointRadius: 8,
                    pointHoverRadius: 10,
                    pointBackgroundColor: '#f97316',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 3,
                    showLine: false,
                    id: 'locator_dataset'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `X: ${context.parsed.x.toFixed(2)}, Y: ${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    grid: { color: '#334155/30', borderColor: '#475569' },
                    ticks: { color: '#94a3b8', font: { family: 'monospace', size: 10 } },
                    title: { display: true, text: 'X Axis Variable', color: '#cbd5e1', font: { size: 11, weight: 'bold' } }
                },
                y: {
                    type: 'linear',
                    grid: { color: '#334155/30', borderColor: '#475569' },
                    ticks: { color: '#94a3b8', font: { family: 'monospace', size: 10 } },
                    title: { display: true, text: 'Y Axis Metric', color: '#cbd5e1', font: { size: 11, weight: 'bold' } },
                    min: 0 // Defensive standard boundary clamping mapping rule default state
                }
            }
        }
    });
}

function refreshChartVisualizationData() {
    if (!simulationChartInstance) return;

    // Block updates logic routing cascade sequence frames if axes mappings are unassigned
    if (!assignedXAxis || !assignedYAxis) {
        simulationChartInstance.data.datasets[0].data = [];
        simulationChartInstance.data.datasets[1].data = [];
        simulationChartInstance.options.scales.x.title.text = "X Axis (No Parameter Dropped)";
        simulationChartInstance.options.scales.y.title.text = "Y Axis (No Parameter Dropped)";
        simulationChartInstance.update();
        return;
    }

    // Extract baseline / runtime attributes anchors data states bounds properties 
    let activeXAnchorVal = extractActiveRealityDisplayVal(assignedXAxis);
    let activeYAnchorVal = extractActiveRealityDisplayVal(assignedYAxis);

    // Calibrate operational sweep windows boundaries constraints range matching instructions rule
    let checkPercentage = assignedXAxis.includes('ooe') || assignedXAxis.includes('au') || assignedXAxis.includes('time') || assignedXAxis.includes('output');
    let sweepPointsArray = [];
    
    let minSweepBound = checkPercentage ? 0 : activeXAnchorVal * 0.8;
    let maxSweepBound = checkPercentage ? 100 : activeXAnchorVal * 1.2;

    // Handle edge configurations structures boundary setups
    if (!checkPercentage && activeXAnchorVal === 0) {
        minSweepBound = 0;
        maxSweepBound = 100; // Create artificial numerical window sweep span
    }

    let allocationIncrementStep = (maxSweepBound - minSweepBound) / 9; // Generate 10 evenly divided plot coordinates entries

    // Identify internal programmatic ID mapping parameters keys representing input rows targets
    let xParts = assignedXAxis.split('_');
    let mappedInputElementTargetID = "";
    if (xParts.length === 2) mappedInputElementTargetID = `override_${xParts[0]}_${xParts[1]}`;
    else if (xParts.length === 3) mappedInputElementTargetID = `override_${xParts[0]}_${xParts[1]}_${xParts[2]}`;

    let structuredCurvePointsDataset = [];

    // Execute background sweeping simulation processing sequence cycles loop
    for (let i = 0; i < 10; i++) {
        let temporaryStepVal = minSweepBound + (allocationIncrementStep * i);
        
        // Build execution map capturing current system states parameters snapshots overrides values 
        let virtualStateOverrideTracker = {};
        
        // Extract active structural elements list and capture their live fields parameters weights
        const inputBoxes = document.querySelectorAll('input[id^="override_"]');
        inputBoxes.forEach(box => {
            if (box.value !== '') virtualStateOverrideTracker[box.id] = parseFloat(box.value);
        });

        // Force step evaluation criteria value inside targeted parameter slot position anchor override
        virtualStateOverrideTracker[mappedInputElementTargetID] = temporaryStepVal;

        // Run mathematical engine calculations routines sequence using cloned state
        let stepCalculatedRealitiesOutputsMap = executeCapacitySolverLogic(virtualStateOverrideTracker);

        // Helper local values queries parsing routine extracting output parameters from background sweep snapshots
        let computedStepYValue = queryVirtualOutputsMetricsRealityValue(assignedYAxis, stepCalculatedRealitiesOutputsMap);
        structuredCurvePointsDataset.push({ x: temporaryStepVal, y: computedStepYValue });
    }

    // Adjust vertical scales axis clamping limitations based on delta requirements profiles rules properties
    let permitsNegativeValues = assignedYAxis.includes('delta') || assignedYAxis.includes('variance');
    if (permitsNegativeValues) {
        delete simulationChartInstance.options.scales.y.min;
    } else {
        simulationChartInstance.options.scales.y.min = 0;
    }

    // Push processed points collections maps into active canvas dataset configurations frameworks
    simulationChartInstance.data.datasets[0].data = structuredCurvePointsDataset;
    
    // Map standalone "You Are Here" locator coordinate point array cleanly on layout tracking line
    simulationChartInstance.data.datasets[1].data = [{ x: activeXAnchorVal, y: activeYAnchorVal }];

    // Push text strings labels definitions properties inside layout matrix configurations
    simulationChartInstance.options.scales.x.title.text = prettyLabels[assignedXAxis].toUpperCase();
    simulationChartInstance.options.scales.y.title.text = prettyLabels[assignedYAxis].toUpperCase();

    simulationChartInstance.update('none'); // Update structures canvas mapping layout parameters smoothly
}

// Deep reader parsing specific properties parameters records objects out of simulated records output maps
function queryVirtualOutputsMetricsRealityValue(metricKey, virtualOutputsSnapshotRecord) {
    if (metricKey === 'combined_active_tonnage') return virtualOutputsSnapshotRecord.plant.active_total;
    if (metricKey === 'line1_total_out') return virtualOutputsSnapshotRecord.l1.total_tonnage;
    if (metricKey === 'line2_total_out') return virtualOutputsSnapshotRecord.l2.total_tonnage;

    let parts = metricKey.split('_');
    if (parts.length === 2) {
        let line = parts[0];
        let prop = parts[1];
        if (prop === 'gross') return virtualOutputsSnapshotRecord[line].gross;
        if (prop === 'ooe') return virtualOutputsSnapshotRecord[line].ooe;
        if (prop === 'au') return virtualOutputsSnapshotRecord[line].au_active;
    } else if (parts.length === 3) {
        let line = parts[0];
        let prod = parts[1];
        let type = parts[2];
        let prodItem = virtualOutputsSnapshotRecord[line].products[prod];
        if (!prodItem) return 0;
        if (type === 'speed') return prodItem.speed;
        if (type === 'time') return prodItem.calculatedTimePct;
        if (type === 'output') return prodItem.calculatedOutputPct;
        if (type === 'mass') return prodItem.calculatedMass;
        if (type === 'delta') return prodItem.calculatedMass - prodItem.demand;
    }
    return 0;
}
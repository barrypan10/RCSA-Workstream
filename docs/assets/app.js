// Cyber RCSA — simulation engine and renderer (v2).
// Reads workflow definition from window.__RCSA__ (workflow.js).

(function () {
  const { LANES, STAGES, STEPS, EDGES, PREREQ_CONTEXT, PEER_SUBMISSIONS } = window.__RCSA__;

  // ---------- Geometry ----------
  const COL_W = 232;
  const LANE_H = 144;
  const NODE_W = 196;
  const NODE_H = 102;
  const NODE_X_PAD = (COL_W - NODE_W) / 2;
  const NODE_Y_PAD = (LANE_H - NODE_H) / 2;
  const LABEL_W = 180;
  const STAGE_BAND_H = 24;

  // Loop-back channel routing: each backward edge gets its own dedicated y so
  // labels never overlap.
  const LOOP_FIRST_OFFSET = 28;   // gap below last lane before first channel
  const LOOP_Y_STEP = 24;         // vertical gap between channels
  const LOOP_BAND_PAD = 28;       // space below last channel for label clearance

  const stepById = Object.fromEntries(STEPS.map(s => [s.id, s]));
  const laneIndex = Object.fromEntries(LANES.map((l, i) => [l.id, i]));
  const maxCol = Math.max(...STEPS.map(s => s.col));
  const trackWidth = (maxCol + 1) * COL_W;
  const totalLaneHeight = LANES.length * LANE_H;

  // Pre-compute loop-back index per backward edge.
  const loopbackIdxByEdge = {};
  let _lbCounter = 0;
  EDGES.forEach(e => {
    const aCol = stepById[e.from].col;
    const bCol = stepById[e.to].col;
    if (bCol < aCol) loopbackIdxByEdge[`${e.from}__${e.to}`] = _lbCounter++;
  });
  const numLoopbacks = _lbCounter;
  const loopBandHeight = LOOP_FIRST_OFFSET + Math.max(0, numLoopbacks - 1) * LOOP_Y_STEP + LOOP_BAND_PAD;
  const overlayHeight = totalLaneHeight + loopBandHeight;

  function nodePos(step) {
    const li = laneIndex[step.lane];
    const x = step.col * COL_W + NODE_X_PAD;
    const y = li * LANE_H + NODE_Y_PAD;
    return {
      x, y,
      left: x, right: x + NODE_W,
      top: y, bottom: y + NODE_H,
      cx: x + NODE_W / 2, cy: y + NODE_H / 2
    };
  }

  // ---------- State ----------
  function freshState() {
    return {
      currentStepId: 'trigger',
      selectedStepId: 'trigger',     // step shown on Tab 2
      activeTab: 'map',              // 'map' | 'detail' | 'report'
      history: [],
      visited: new Set(['trigger']),
      traversedEdges: new Set(),
      decisions: [],                 // { stepId, label, actor, ts }
      userComments: {},              // stepId -> [{author, role, ts, text}]
      terminated: false,
      approved: false,               // becomes true once Step 11 approved
      aiResults: {},                 // stepId -> 'idle' | 'thinking' | 'done' | 'error'
      aiSources: {},                 // stepId -> 'static' | 'live' (drives attribution line)
      // For multi-review steps (currently step10): per-review status and source.
      aiReviewResults: {},           // stepId -> { reviewId: 'idle'|'thinking'|'done'|'error' }
      aiReviewSources: {},           // stepId -> { reviewId: 'static'|'live' }
      prereq: { loaded: false, filename: null, ts: null, context: null, source: null },
      autoPilot: { running: false, startedAt: null, completedSteps: 0 }
    };
  }
  let state = freshState();

  const SAMPLE_PACK_HREF = 'samples/RCSA-Prerequisites-Pack-PAYMENTS-CORE-2026Q2.xlsx';
  const SAMPLE_PACK_NAME = 'RCSA-Prerequisites-Pack-PAYMENTS-CORE-2026Q2.xlsx';

  // ---------- Build swimlane (one-time) ----------
  function buildSwimlanes() {
    const root = document.getElementById('swimlanes');
    root.innerHTML = '';
    root.classList.add('with-stages');
    root.style.width = (LABEL_W + trackWidth) + 'px';
    root.style.height = (STAGE_BAND_H + overlayHeight + 8) + 'px';
    root.style.position = 'relative';

    // Stage-band row (absolute, top:0 over first 24px)
    const stageRow = document.createElement('div');
    stageRow.className = 'stage-band-row';
    stageRow.style.left = LABEL_W + 'px';
    stageRow.style.width = trackWidth + 'px';
    STAGES.forEach(s => {
      const span = (s.cols[1] - s.cols[0] + 1);
      const w = span * COL_W;
      const band = document.createElement('div');
      band.className = 'stage-band';
      band.style.width = w + 'px';
      band.textContent = s.label;
      stageRow.appendChild(band);
    });
    root.appendChild(stageRow);

    // Stage spacer (normal flow, pushes lanes down by STAGE_BAND_H)
    const spacer = document.createElement('div');
    spacer.style.height = STAGE_BAND_H + 'px';
    spacer.style.width = '100%';
    root.appendChild(spacer);

    // Lanes
    LANES.forEach(lane => {
      const laneEl = document.createElement('div');
      laneEl.className = 'lane';
      laneEl.dataset.laneId = lane.id;
      const label = document.createElement('div');
      label.className = 'lane-label';
      label.innerHTML = `<span class="name">${escapeHtml(lane.label)}</span><span class="sub">${escapeHtml(lane.sublabel)}</span>`;
      laneEl.appendChild(label);
      root.appendChild(laneEl);
    });

    // Overlay (absolute, starts at top = STAGE_BAND_H)
    const overlay = document.createElement('div');
    overlay.id = 'overlay';
    overlay.style.cssText = `position:absolute; left:${LABEL_W}px; top:${STAGE_BAND_H}px; width:${trackWidth}px; height:${overlayHeight}px; pointer-events:none;`;

    // SVG edges
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', trackWidth);
    svg.setAttribute('height', overlayHeight);
    svg.style.cssText = 'position:absolute; left:0; top:0; pointer-events:none; overflow:visible;';
    svg.id = 'edges-svg';

    const defs = document.createElementNS(svgNS, 'defs');
    defs.innerHTML = `
      <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#b8c1d1"/>
      </marker>
      <marker id="arrow-traversed" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#1f8a4f"/>
      </marker>
      <marker id="arrow-loop" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#c47a05"/>
      </marker>
    `;
    svg.appendChild(defs);
    overlay.appendChild(svg);

    EDGES.forEach((edge, i) => renderEdge(svg, edge, i));

    const nodesLayer = document.createElement('div');
    nodesLayer.id = 'nodes-layer';
    nodesLayer.style.cssText = 'position:absolute; left:0; top:0; width:100%; height:100%;';
    overlay.appendChild(nodesLayer);

    STEPS.forEach(step => renderNode(nodesLayer, step));

    root.appendChild(overlay);
  }

  function renderEdge(svg, edge, idx) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const a = stepById[edge.from], b = stepById[edge.to];
    const pa = nodePos(a), pb = nodePos(b);
    const isLoop = edge.type === 'loopback';
    const colDelta = b.col - a.col;
    const sameLane = a.lane === b.lane;
    const goesBackward = colDelta < 0;

    let d, labelX, labelY;
    if (goesBackward) {
      const lbIdx = loopbackIdxByEdge[`${edge.from}__${edge.to}`] ?? 0;
      const channel = totalLaneHeight + LOOP_FIRST_OFFSET + lbIdx * LOOP_Y_STEP;
      const startX = pa.cx, startY = pa.bottom, endX = pb.cx, endY = pb.bottom;
      d = `M ${startX} ${startY} V ${channel} H ${endX} V ${endY}`;
      labelX = (startX + endX) / 2;
      labelY = channel - 7;
    } else if (sameLane && colDelta === 1) {
      const startX = pa.right, startY = pa.cy, endX = pb.left, endY = pb.cy;
      d = `M ${startX} ${startY} H ${endX}`;
      labelX = (startX + endX) / 2;
      labelY = startY - 8;
    } else if (sameLane && colDelta > 1) {
      const startX = pa.cx, startY = pa.top;
      const endX = pb.cx, endY = pb.top;
      const peak = Math.max(8, startY - 22);
      d = `M ${startX} ${startY} V ${peak} H ${endX} V ${endY}`;
      labelX = (startX + endX) / 2;
      labelY = peak - 6;
    } else {
      const startX = pa.right, startY = pa.cy, endX = pb.left, endY = pb.cy;
      const midX = startX + (endX - startX) / 2;
      d = `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`;
      labelX = midX;
      labelY = (startY + endY) / 2 - 8;
    }

    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'edge-path' + (isLoop ? ' is-loopback' : ''));
    path.setAttribute('marker-end', isLoop ? 'url(#arrow-loop)' : 'url(#arrow)');
    path.dataset.edgeId = `${edge.from}__${edge.to}`;
    svg.appendChild(path);

    if (edge.label) {
      const text = document.createElementNS(svgNS, 'text');
      text.setAttribute('x', labelX);
      text.setAttribute('y', labelY);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('class', 'edge-label' + (isLoop ? ' is-loopback' : ''));
      text.setAttribute('paint-order', 'stroke');
      text.setAttribute('stroke', '#fff');
      text.setAttribute('stroke-width', '3');
      text.textContent = edge.label;
      svg.appendChild(text);
    }
  }

  function renderNode(layer, step) {
    const p = nodePos(step);
    const el = document.createElement('div');
    el.className = 'node';
    el.dataset.stepId = step.id;
    el.style.cssText = `left:${p.x}px; top:${p.y}px; pointer-events:auto;`;
    if (step.type === 'decision') el.classList.add('is-decision');

    const isAi = step.type === 'ai-assisted'
      || (step.aiActions && step.aiActions.length > 0)
      || (step.aiReviews && step.aiReviews.length > 0);
    const badges = [];
    if (isAi) badges.push('<span class="node-badge ai">AI</span>');
    badges.push('<span class="node-badge human">Human</span>');
    if (step.type === 'decision') badges.push('<span class="node-badge decision">Decision</span>');

    const stepNum = stepNumber(step);
    const role = step.humanCheckpoint && step.humanCheckpoint.actor
      ? truncate(step.humanCheckpoint.actor, 32) : '';

    el.innerHTML = `
      <div class="node-head">
        <span class="node-step-num">${escapeHtml(stepNum)}</span>
        <span style="font-size:11px;color:var(--c-text-mute);">${escapeHtml(laneShortLabel(step.lane))}</span>
      </div>
      <div class="node-title">${escapeHtml(step.short || step.label)}</div>
      <div class="node-role" title="${escapeHtml(step.humanCheckpoint ? step.humanCheckpoint.actor : '')}">${escapeHtml(role)}</div>
      <div class="node-badges">${badges.join('')}</div>
    `;

    el.addEventListener('click', () => {
      state.selectedStepId = step.id;
      updateNodeStates();
      // Update Tab 2 sublabel hint
      updateDetailTabSub();
      // If the user is already on detail tab, refresh
      if (state.activeTab === 'detail') renderStepDetail();
      // If the clicked step is the current step, also refresh action panel
      if (state.activeTab === 'map' && step.id === state.currentStepId) renderActionPanel();
    });

    layer.appendChild(el);
  }

  function stepNumber(step) {
    if (step.id === 'trigger') return 'T';
    return step.id.replace('step', 'S');
  }

  function laneShortLabel(laneId) {
    return ({ SYSTEM: 'System / Data', '1LOD': '1LOD', '2LOD': '2LOD', MONITORING: 'Monitoring' })[laneId] || laneId;
  }

  function laneFullLabel(laneId) {
    const lane = LANES.find(l => l.id === laneId);
    return lane ? lane.label : laneId;
  }

  // ---------- Master render dispatch ----------
  function renderAll() {
    updateNodeStates();
    updateEdgeStates();
    if (state.terminated) {
      renderTerminatePanel();
    } else {
      renderActionPanel();
    }
    renderStepDetail();
    renderAudit();
    renderStatePill();
    updateReportTabVisibility();
    updateDetailTabSub();
  }

  function updateNodeStates() {
    const layer = document.getElementById('nodes-layer');
    if (!layer) return;
    layer.querySelectorAll('.node').forEach(n => {
      const id = n.dataset.stepId;
      n.classList.remove('is-active', 'is-completed', 'is-pending', 'is-selected');
      if (state.terminated) { n.classList.add('is-pending'); return; }
      if (id === state.currentStepId) n.classList.add('is-active');
      else if (state.visited.has(id)) n.classList.add('is-completed');
      else n.classList.add('is-pending');
      if (id === state.selectedStepId && id !== state.currentStepId) n.classList.add('is-selected');
    });
  }

  function updateEdgeStates() {
    document.querySelectorAll('#edges-svg .edge-path').forEach(p => {
      const id = p.dataset.edgeId;
      if (state.traversedEdges.has(id)) {
        p.classList.add('is-traversed');
        const isLoop = p.classList.contains('is-loopback');
        p.setAttribute('marker-end', isLoop ? 'url(#arrow-loop)' : 'url(#arrow-traversed)');
      } else {
        p.classList.remove('is-traversed');
      }
    });
  }

  function renderStatePill() {
    const pill = document.getElementById('state-pill-text');
    if (state.terminated) { pill.textContent = 'Cycle terminated · monitoring'; return; }
    const s = stepById[state.currentStepId];
    pill.textContent = `In progress · ${s.label}`;
  }

  function updateDetailTabSub() {
    const sub = document.getElementById('tab-detail-sub');
    if (!sub) return;
    const id = state.selectedStepId;
    if (!id) { sub.textContent = 'GRC view of selected step'; return; }
    const step = stepById[id];
    sub.textContent = `Viewing: ${step.label}`;
  }

  function updateReportTabVisibility() {
    const tab = document.querySelector('.tab-report');
    if (!tab) return;
    if (state.approved) tab.classList.remove('is-hidden');
    else tab.classList.add('is-hidden');
  }

  // ---------- Tab 1 action panel ----------
  function renderActionPanel() {
    const stepId = state.currentStepId;
    const step = stepById[stepId];
    const panel = document.getElementById('panel');
    const isAi = step.type === 'ai-assisted'
      || (step.aiActions && step.aiActions.length > 0)
      || (step.aiReviews && step.aiReviews.length > 0);

    panel.innerHTML = `
      <div class="panel-head">
        <div class="crumb">${escapeHtml(laneFullLabel(step.lane))} · ${escapeHtml(stageLabel(step.stage))}</div>
        <h1>${escapeHtml(step.label)}</h1>
        <div class="owner">${escapeHtml(step.summary)}</div>
      </div>
      <div class="panel-body">
        ${isAi ? renderAiCard(step) : ''}
        ${step.humanCheckpoint ? renderHumanCard(step) : ''}
        <div style="font-size:11.5px;color:var(--c-text-mute);text-align:center;border-top:1px dashed var(--c-border);padding-top:10px;margin-top:4px;">
          For full step details (controls, evidence, comments) open <strong>Step Detail</strong> (Tab 2)
        </div>
      </div>
    `;

    if (isAi) runAi(step);
  }

  function stageLabel(stageId) {
    const s = STAGES.find(x => x.id === stageId);
    return s ? s.label : '';
  }

  function renderAiCard(step) {
    // Multi-review steps (currently step10): render N stacked cards.
    if (step.aiReviews && step.aiReviews.length) {
      return step.aiReviews.map((review, idx) => {
        const actions = (review.actions || []).map(a => `<li>${escapeHtml(a)}</li>`).join('');
        const badge = `<span class="ai-review-num">${idx + 1} / ${step.aiReviews.length}</span>`;
        const subtitle = review.subtitle ? `<div class="ai-review-subtitle">${escapeHtml(review.subtitle)}</div>` : '';
        return `
          <section class="card ai" data-review-id="${escapeHtml(review.id)}">
            <div class="card-head"><span class="tag">AI</span> ${escapeHtml(review.title)} ${badge}</div>
            ${subtitle}
            ${actions ? `<ul class="ai-actions">${actions}</ul>` : ''}
            <div id="ai-output-slot--${escapeHtml(review.id)}"></div>
          </section>
        `;
      }).join('');
    }
    // Single-review legacy path.
    const actions = (step.aiActions || []).map(a => `<li>${escapeHtml(a)}</li>`).join('');
    return `
      <section class="card ai" id="ai-card">
        <div class="card-head"><span class="tag">AI</span> AI Activity</div>
        ${actions ? `<ul class="ai-actions">${actions}</ul>` : ''}
        <div id="ai-output-slot"></div>
      </section>
    `;
  }

  function renderHumanCard(step) {
    const cp = step.humanCheckpoint;
    const actions = cp.actions.map((a, i) =>
      `<button class="btn btn-${a.tone}" data-action-idx="${i}">${escapeHtml(a.label)}</button>`
    ).join('');
    return `
      <section class="card human">
        <div class="card-head"><span class="tag">HUMAN</span> Human Checkpoint</div>
        <div class="checkpoint-actor">Actioned by: ${escapeHtml(cp.actor)}</div>
        <div class="checkpoint-prompt">${escapeHtml(cp.prompt)}</div>
        <div class="checkpoint-actions">${actions}</div>
      </section>
    `;
  }

  // Single delegated handler for action buttons (action panel + detail view)
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action-idx]');
    if (!btn) return;
    const stepId = btn.dataset.stepId || state.currentStepId;
    const step = stepById[stepId];
    if (!step || !step.humanCheckpoint) return;
    if (stepId !== state.currentStepId) return; // only current step's actions advance
    const idx = parseInt(btn.dataset.actionIdx, 10);
    const action = step.humanCheckpoint.actions[idx];
    if (!action) return;
    handleHumanAction(step, action);
  });

  function handleHumanAction(step, action, source) {
    // If a real user click lands while Auto-Pilot is running, stop the pilot
    // so the user's choice takes effect instead of fighting the loop.
    if (state.autoPilot.running && source !== 'autopilot') {
      stopAutoPilot('user override');
    }

    const ts = nowTs();
    const isAuto = source === 'autopilot';
    const actorLine = isAuto
      ? `[Auto-Pilot · ${step.humanCheckpoint.actor}] → ${action.label} (auto-decided · at ${step.label})`
      : `[${step.humanCheckpoint.actor}] → ${action.label} (at ${step.label})`;
    state.decisions.push({
      stepId: step.id,
      stepLabel: step.label,
      label: action.label,
      actor: isAuto ? `Auto-Pilot · ${step.humanCheckpoint.actor}` : step.humanCheckpoint.actor,
      ts
    });
    logAudit('human', actorLine);

    if (action.target === 'terminate') {
      state.terminated = true;
      logAudit('system', 'RCSA cycle terminated. Continuing in monitoring posture.');
      renderAll();
      return;
    }

    // Special: Step 11 approval makes the Findings Report available
    if (step.id === 'step11') state.approved = true;

    advanceTo(action.target);
  }

  function advanceTo(targetId) {
    const fromId = state.currentStepId;
    const edgeKey = `${fromId}__${targetId}`;
    state.traversedEdges.add(edgeKey);
    state.currentStepId = targetId;
    state.selectedStepId = targetId;
    state.visited.add(targetId);
    delete state.aiResults[targetId];
    delete state.aiReviewResults[targetId];
    delete state.aiReviewSources[targetId];
    if (targetId === 'trigger') {
      logAudit('system', 'New RCSA cycle initiated.');
    } else {
      logAudit('system', `Entered ${stepById[targetId].label}.`);
    }
    renderAll();
  }

  // ---------- AI orchestration ----------
  // Strategy: if the LLM gateway is configured (URL + key) AND the step is one
  // of the two live AI checkpoints (step2, step10), call the gateway.
  // Otherwise (or on any failure) fall back to the static aiOutput hand-
  // authored in workflow.js.

  // Cache of static aiOutput per step so a live call can later be reverted.
  const STATIC_AI_OUTPUT = {};
  STEPS.forEach(s => { if (s.aiOutput) STATIC_AI_OUTPUT[s.id] = JSON.parse(JSON.stringify(s.aiOutput)); });

  // Per-review cache of static review.output for multi-review steps (step10).
  const STATIC_AI_REVIEW_OUTPUT = {};
  STEPS.forEach(s => {
    if (s.aiReviews) {
      STATIC_AI_REVIEW_OUTPUT[s.id] = {};
      s.aiReviews.forEach(r => {
        if (r.output) STATIC_AI_REVIEW_OUTPUT[s.id][r.id] = JSON.parse(JSON.stringify(r.output));
      });
    }
  });

  function liveCapableStep(stepId) {
    return stepId === 'step2' || stepId === 'step10';
  }

  function runAi(step) {
    // Multi-review dispatch (currently step10).
    if (step.aiReviews && step.aiReviews.length) {
      runAiReviews(step);
      return;
    }
    const slot = document.getElementById('ai-output-slot');
    if (!slot) return;
    const memoKey = step.id;
    if (state.aiResults[memoKey] === 'done') { showAiOutputImmediate(step); return; }
    state.aiResults[memoKey] = 'thinking';

    const live = window.AIClient && window.AIClient.isLive && window.AIClient.isLive() && liveCapableStep(step.id);
    const label = live ? 'Calling LLM gateway' : 'AI is analyzing inputs';
    slot.innerHTML = `<div class="ai-thinking"><div class="spinner"></div> ${escapeHtml(label)}…</div>`;
    logAudit('ai', live
      ? `Calling LLM gateway — ${step.label}…`
      : `Analyzing inputs at ${step.label}…`);

    if (live) {
      runLiveAi(step).then(result => {
        if (state.currentStepId !== step.id) return;
        step.aiOutput = result;
        state.aiSources[step.id] = 'live';
        state.aiResults[memoKey] = 'done';
        slot.innerHTML = renderAiOutputBody(step);
        attachRegenHandler(slot, step);
        logAudit('ai', `${result.title || 'AI'}: ${stripTags(result.lead || '')}`);
      }).catch(err => {
        if (state.currentStepId !== step.id) return;
        // Restore static and fall through to render
        if (STATIC_AI_OUTPUT[step.id]) step.aiOutput = JSON.parse(JSON.stringify(STATIC_AI_OUTPUT[step.id]));
        state.aiSources[step.id] = 'static';
        state.aiResults[memoKey] = 'done';
        slot.innerHTML = renderAiOutputBody(step);
        attachRegenHandler(slot, step);
        const reason = err && err.message ? err.message : 'unknown error';
        logAudit('system', `Live AI call failed (${err && err.type ? err.type : 'error'}) — falling back to static memo. ${reason}`);
        showToast(`Live AI failed: ${reason} — using static fallback.`, true);
      });
    } else {
      // Static path — small simulated latency for visual continuity.
      state.aiSources[step.id] = 'static';
      const delay = 900 + Math.random() * 700;
      setTimeout(() => {
        if (state.currentStepId !== step.id) return;
        state.aiResults[memoKey] = 'done';
        slot.innerHTML = renderAiOutputBody(step);
        attachRegenHandler(slot, step);
        if (step.aiOutput) logAudit('ai', `${step.aiOutput.title}: ${stripTags(step.aiOutput.lead)}`);
      }, delay);
    }
  }

  function attachRegenHandler(slot, step) {
    const regen = slot.querySelector('.ai-regen');
    if (regen) regen.addEventListener('click', () => {
      state.aiResults[step.id] = 'idle';
      runAi(step);
    });
  }

  function showAiOutputImmediate(step) {
    const slot = document.getElementById('ai-output-slot');
    if (!slot) return;
    state.aiResults[step.id] = 'done';
    slot.innerHTML = renderAiOutputBody(step);
    attachRegenHandler(slot, step);
  }

  function renderAiOutputBody(step) {
    if (!step.aiOutput) return `<div class="ai-thinking" style="color:var(--c-text-mute)">No structured output for this step.</div>`;
    const o = step.aiOutput;
    const bullets = (o.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join('');
    const live = state.aiSources[step.id] === 'live';
    const modelLabel = (live && o._model) ? o._model : 'org LLM gateway';
    const attribution = live
      ? `<div class="ai-attribution live">Powered by ${escapeHtml(modelLabel)} · generated ${escapeHtml(nowDateTs())}</div>`
      : '';
    return `
      <div class="ai-output">
        <div class="verdict">${escapeHtml(o.verdict || 'AI Output')}</div>
        <p class="lead">${o.lead}</p>
        ${bullets ? `<ul>${bullets}</ul>` : ''}
        ${attribution}
        <button class="ai-regen" type="button">↻ Regenerate</button>
      </div>
    `;
  }

  // ---------- Live AI runners ----------
  // System prompts below are sent to whatever the LLM gateway exposes. The
  // legacy `cacheSystem: true` flag below is still passed for back-compat but
  // is ignored by the OpenAI-compatible client (Anthropic-style prompt caching
  // wasn't portable across gateways).

  const STEP2_SYSTEM = `You are an AI assistant supporting a Cyber RCSA Lead in a financial services firm's first line of defense.
Your role: mine the firm's RCSA Prerequisites Pack — risks, assets, prior cycles, policies, and evidence — to surface candidate cyber risks for the application in scope.
Surface risks the team may have missed, especially patterns visible across prior RCSAs, audit findings, or incidents that aren't yet in the active risk register.
Ground each risk in a specific section of the pack. Be specific (cite control IDs, audit IDs, IR IDs where relevant). Do not invent facts beyond the pack.
Output strict JSON only — no preamble, no markdown.`;

  const STEP10_ISOLATION_SYSTEM = `You are an AI assistant supporting a Cyber Risk Officer in the second line of defense at a financial services firm.
Your role: review a 1LOD RCSA submission *in isolation*. Do NOT compare against other teams or peer applications — that is a separate review pass.
Focus on internal consistency: unexplained rating changes within this submission, weak justifications, missing evidence, contradictions between Step 5 (control test), Step 7 (remediation), Step 8 (residual), and Step 9 (validation).
Each challenge question must cite a specific item in this submission and be answerable by a control owner with documented evidence.
Output strict JSON only — no preamble, no markdown.`;

  const STEP10_PEER_SYSTEM = `You are an AI assistant supporting a Cyber Risk Officer in the second line of defense at a financial services firm.
Your role: compare a 1LOD RCSA submission against a corpus of peer team submissions and surface cross-team inconsistencies. Do NOT re-run an internal challenge — that is a separate review pass.
Focus on: (a) controls peers found INEFFECTIVE that this submission marked EFFECTIVE (or vice versa), (b) risks identified by peers but missed in this submission's baseline, (c) residual ratings that diverge from peer median.
Each finding must name the specific peer app(s) involved and quote the divergence. Do not generate findings unsupported by the peer corpus.
Output strict JSON only — no preamble, no markdown.`;

  const PREREQ_GEN_SYSTEM = `You are an AI assistant generating a realistic Cyber RCSA Prerequisites Pack for a financial services demo.
The pack must contain 5 sections: riskInventory, assets, priorIssues, policies, evidence.
Use realistic enterprise role titles (Cyber RCSA Lead, IAM Lead, Application Owner, etc.). Reference real standards (NIST CSF, NYDFS 500, SOX, PCI-DSS).
Do not invent acronyms. Output strict JSON only — no preamble, no markdown.`;

  // Schema shape for Step 2 / Step 10 output — matches the existing aiOutput contract.
  const AI_OUTPUT_SCHEMA = {
    type: 'object',
    properties: {
      title:   { type: 'string' },
      lead:    { type: 'string' },
      verdict: { type: 'string' },
      bullets: { type: 'array', items: { type: 'string' } }
    },
    required: ['title', 'lead', 'verdict', 'bullets'],
    additionalProperties: false
  };

  function buildSubmissionSnapshot() {
    // Compact snapshot of decisions made so far — fed to Step 10's prompt.
    return {
      cycleId: state.prereq.context && state.prereq.context.cycleId,
      decisions: state.decisions.map(d => ({ step: d.stepLabel, actor: d.actor, choice: d.label, ts: d.ts })),
      visitedSteps: Array.from(state.visited),
      step2Output: (stepById['step2'] && stepById['step2'].aiOutput) || null,
      step5Result: stepById['step5'] && stepById['step5'].workItems,
      step6Gaps:   stepById['step6'] && stepById['step6'].workItems,
      step7Plan:   stepById['step7'] && stepById['step7'].workItems,
      step8Residual: stepById['step8'] && stepById['step8'].workItems,
      step9Validation: stepById['step9'] && stepById['step9'].workItems
    };
  }

  async function runLiveAi(step) {
    const ctx = state.prereq.context || PREREQ_CONTEXT;
    if (step.id === 'step2') {
      const userMsg = `Application in scope: ${ctx.inScopeApp || 'PAYMENTS-CORE'}\n\nPrerequisites Pack:\n${JSON.stringify(ctx)}\n\nGenerate an AI risk-suggestion memo. Surface 5–6 candidate risks. Highlight any risks that are visible in the pack but not yet in the firm's active risk inventory ("previously missed"). Format the response as JSON matching this shape: { title: "AI Risk Suggestions", lead: "<one-sentence summary of what you reviewed>", verdict: "<one-line verdict, e.g. '6 candidate risks · 2 flagged as previously missed'>", bullets: ["<risk 1>", "<risk 2>", ...] }.`;
      const result = await window.AIClient.callClaude({
        system: STEP2_SYSTEM,
        messages: [{ role: 'user', content: userMsg }],
        maxTokens: 1024,
        cacheSystem: true,
        jsonSchema: AI_OUTPUT_SCHEMA
      });
      // Tag the parsed output with the model the gateway actually used so the
      // attribution line in renderAiOutputBody can cite it honestly.
      if (result.parsed) result.parsed._model = result.model;
      return result.parsed;
    }
    // step10 is now multi-review — its live calls go through runLiveAiReview.
    throw new Error(`runLiveAi: no single-output prompt template for step ${step.id}`);
  }

  // Per-review live AI call — used for multi-review steps (currently step10).
  async function runLiveAiReview(step, review) {
    const ctx = state.prereq.context || PREREQ_CONTEXT;
    if (step.id === 'step10' && review.id === 'isolation') {
      const submission = buildSubmissionSnapshot();
      const userMsg = `Cycle: ${ctx.cycleId || 'unknown'}\n\nPrerequisites Pack (grounding context):\n${JSON.stringify(ctx)}\n\n1LOD submission so far:\n${JSON.stringify(submission)}\n\nThis is REVIEW 1 — INTERNAL CHALLENGE. Challenge the submission *in isolation*. Surface unexplained rating changes within this submission, weak justifications, missing evidence, and contradictions between steps. Produce exactly 3 challenge questions, each referencing a specific item in this submission. Do NOT use peer-team comparisons. Format JSON: { title: "AI Internal Challenge Brief", lead: "<one-sentence summary of what you reviewed>", verdict: "<one-line, e.g. 'Internal review: reviewer attention recommended'>", bullets: ["I-Q1 — ...", "I-Q2 — ...", "I-Q3 — ..."] }.`;
      const result = await window.AIClient.callClaude({
        system: STEP10_ISOLATION_SYSTEM,
        messages: [{ role: 'user', content: userMsg }],
        maxTokens: 1024,
        cacheSystem: true,
        jsonSchema: AI_OUTPUT_SCHEMA
      });
      if (result.parsed) result.parsed._model = result.model;
      return result.parsed;
    }
    if (step.id === 'step10' && review.id === 'peer') {
      const submission = buildSubmissionSnapshot();
      const peers = (window.__RCSA__ && window.__RCSA__.PEER_SUBMISSIONS) || [];
      const userMsg = `Cycle: ${ctx.cycleId || 'unknown'}\n\nPrerequisites Pack (grounding context):\n${JSON.stringify(ctx)}\n\n1LOD submission so far:\n${JSON.stringify(submission)}\n\nPeer team RCSAs (corpus of ${peers.length} apps):\n${JSON.stringify(peers)}\n\nThis is REVIEW 2 — PEER COMPARISON. Compare the submission against the peer corpus. Surface (a) controls peers found INEFFECTIVE that this submission marked EFFECTIVE, (b) risks identified by peers but missed here, (c) residual ratings that diverge from peer median. Produce exactly 3 specific findings. Each finding must name peer app(s). Do NOT re-run internal challenges. Format JSON: { title: "AI Peer Comparison Brief", lead: "<one-sentence summary citing the peer apps reviewed>", verdict: "<one-line, e.g. '3 cross-team inconsistencies detected'>", bullets: ["P-Q1 — ...", "P-Q2 — ...", "P-Q3 — ..."] }.`;
      const result = await window.AIClient.callClaude({
        system: STEP10_PEER_SYSTEM,
        messages: [{ role: 'user', content: userMsg }],
        maxTokens: 1024,
        cacheSystem: true,
        jsonSchema: AI_OUTPUT_SCHEMA
      });
      if (result.parsed) result.parsed._model = result.model;
      return result.parsed;
    }
    throw new Error(`runLiveAiReview: no prompt template for step ${step.id} review ${review.id}`);
  }

  // Multi-review runner — runs each review sequentially so live calls can hit
  // the cached system block from the previous call (Step 10 Review 2 reuses
  // Review 1's PREREQ_CONTEXT cache within ~5 minutes).
  async function runAiReviews(step) {
    state.aiReviewResults[step.id] = state.aiReviewResults[step.id] || {};
    state.aiReviewSources[step.id] = state.aiReviewSources[step.id] || {};
    for (const review of step.aiReviews) {
      if (state.currentStepId !== step.id) return; // navigated away
      if (state.aiReviewResults[step.id][review.id] === 'done') {
        // Re-render existing output without re-running.
        const slot = document.getElementById(`ai-output-slot--${review.id}`);
        if (slot) {
          slot.innerHTML = renderAiReviewBody(step, review);
          attachReviewRegenHandler(slot, step, review);
        }
        continue;
      }
      await runAiSingleReview(step, review);
    }
  }

  async function runAiSingleReview(step, review) {
    const slot = document.getElementById(`ai-output-slot--${review.id}`);
    if (!slot) return;
    state.aiReviewResults[step.id] = state.aiReviewResults[step.id] || {};
    state.aiReviewSources[step.id] = state.aiReviewSources[step.id] || {};
    state.aiReviewResults[step.id][review.id] = 'thinking';

    const live = window.AIClient && window.AIClient.isLive && window.AIClient.isLive() && liveCapableStep(step.id);
    const label = live ? 'Calling LLM gateway' : 'AI is analyzing inputs';
    slot.innerHTML = `<div class="ai-thinking"><div class="spinner"></div> ${escapeHtml(label)} — ${escapeHtml(review.title)}…</div>`;
    logAudit('ai', live
      ? `Calling LLM gateway — ${step.label} · ${review.title}…`
      : `Analyzing inputs at ${step.label} · ${review.title}…`);

    if (live) {
      try {
        const result = await runLiveAiReview(step, review);
        if (state.currentStepId !== step.id) return;
        review.output = result;
        state.aiReviewSources[step.id][review.id] = 'live';
        state.aiReviewResults[step.id][review.id] = 'done';
        slot.innerHTML = renderAiReviewBody(step, review);
        attachReviewRegenHandler(slot, step, review);
        logAudit('ai', `[${review.title}] ${result.title || ''}: ${stripTags(result.lead || '')}`);
      } catch (err) {
        if (state.currentStepId !== step.id) return;
        // Fall back to static for this review.
        const stat = STATIC_AI_REVIEW_OUTPUT[step.id] && STATIC_AI_REVIEW_OUTPUT[step.id][review.id];
        if (stat) review.output = JSON.parse(JSON.stringify(stat));
        state.aiReviewSources[step.id][review.id] = 'static';
        state.aiReviewResults[step.id][review.id] = 'done';
        slot.innerHTML = renderAiReviewBody(step, review);
        attachReviewRegenHandler(slot, step, review);
        const reason = err && err.message ? err.message : 'unknown error';
        logAudit('system', `Live AI call failed at ${review.title} (${err && err.type ? err.type : 'error'}) — falling back to static memo. ${reason}`);
        showToast(`Live AI failed: ${reason} — using static fallback.`, true);
      }
    } else {
      // Static path with simulated latency.
      await delay(900 + Math.random() * 700);
      if (state.currentStepId !== step.id) return;
      state.aiReviewSources[step.id][review.id] = 'static';
      state.aiReviewResults[step.id][review.id] = 'done';
      slot.innerHTML = renderAiReviewBody(step, review);
      attachReviewRegenHandler(slot, step, review);
      if (review.output) logAudit('ai', `[${review.title}] ${review.output.title}: ${stripTags(review.output.lead)}`);
    }
  }

  function attachReviewRegenHandler(slot, step, review) {
    const regen = slot.querySelector('.ai-regen');
    if (regen) regen.addEventListener('click', () => {
      state.aiReviewResults[step.id] = state.aiReviewResults[step.id] || {};
      state.aiReviewResults[step.id][review.id] = 'idle';
      runAiSingleReview(step, review);
    });
  }

  function renderAiReviewBody(step, review) {
    if (!review.output) return `<div class="ai-thinking" style="color:var(--c-text-mute)">No structured output for this review.</div>`;
    const o = review.output;
    const bullets = (o.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join('');
    const live = state.aiReviewSources[step.id] && state.aiReviewSources[step.id][review.id] === 'live';
    const modelLabel = (live && o._model) ? o._model : 'org LLM gateway';
    const attribution = live
      ? `<div class="ai-attribution live">Powered by ${escapeHtml(modelLabel)} · generated ${escapeHtml(nowDateTs())}</div>`
      : '';
    return `
      <div class="ai-output">
        <div class="verdict">${escapeHtml(o.verdict || 'AI Output')}</div>
        <p class="lead">${o.lead}</p>
        ${bullets ? `<ul>${bullets}</ul>` : ''}
        ${attribution}
        <button class="ai-regen" type="button">↻ Regenerate this review</button>
      </div>
    `;
  }

  // (Note: a function-scoped `delay(ms)` helper is defined further down for
  // Demo Mode; declarations are hoisted so it's visible above as well.)

  // ---------- Auto-Pilot ----------
  // One-click end-to-end run that walks the canonical happy path. Reuses
  // runAi / runAiReviews / advanceTo / handleHumanAction; adds an async loop
  // on top that picks deterministic defaults at every human checkpoint and
  // waits for AI completion at AI steps before moving on.

  // Default action selector keyed by step. Returns the action object the
  // pilot should take, or null to STOP the loop.
  function pickAutoAction(step) {
    const cp = step.humanCheckpoint;
    if (!cp || !cp.actions || !cp.actions.length) return null;
    const find = (predicate) => cp.actions.find(predicate) || null;

    if (step.id === 'trigger') return find(a => a.target === 'step1');
    if (step.id === 'step5') {
      // First visit: NO (gaps). Revisit (after Step 6/7 retest): YES (effective).
      const postRemediation = state.visited.has('step6') && state.visited.has('step7');
      return postRemediation
        ? find(a => a.target === 'step8')
        : find(a => a.target === 'step6');
    }
    if (step.id === 'step7')  return find(a => a.target === 'step5'); // YES retest
    if (step.id === 'step8')  return find(a => a.target === 'step9'); // YES acceptable
    if (step.id === 'step10') return find(a => a.target === 'step11'); // NO issues, approve
    if (step.id === 'step12') return null;                              // STOP (no auto-retrigger)
    // Linear steps with a single option: take it.
    return cp.actions[0];
  }

  // Wait for AI work at a step to finish before advancing. Polls state every
  // 200 ms; bails when auto-pilot is stopped or after a 30s timeout. The
  // existing AI runners already have their own static / live fallbacks, so
  // a timeout here just means we move on with whatever's rendered.
  async function waitForAiCompletion(step) {
    const TIMEOUT_MS = 30000;
    const POLL_MS = 200;
    const t0 = Date.now();
    const isMulti = step.aiReviews && step.aiReviews.length > 0;
    const isSingleAi = !isMulti && (step.type === 'ai-assisted' || (step.aiActions && step.aiActions.length > 0));
    if (!isMulti && !isSingleAi) return;

    while (true) {
      if (!state.autoPilot.running) return;
      if (Date.now() - t0 > TIMEOUT_MS) {
        logAudit('system', `Auto-Pilot: AI did not finish at ${step.label} within 30s — moving on.`);
        return;
      }
      let done = true;
      if (isMulti) {
        const results = state.aiReviewResults[step.id] || {};
        done = step.aiReviews.every(r => results[r.id] === 'done');
      } else {
        done = state.aiResults[step.id] === 'done';
      }
      if (done) return;
      await delay(POLL_MS);
    }
  }

  function showAutoBanner() {
    const el = document.getElementById('auto-banner');
    if (el) el.classList.remove('is-hidden');
    document.body.classList.add('is-autopilot-running');
    updateAutoBannerProgress();
  }
  function hideAutoBanner() {
    const el = document.getElementById('auto-banner');
    if (el) el.classList.add('is-hidden');
    document.body.classList.remove('is-autopilot-running');
    clearAutoSpotlight();
  }
  function updateAutoBannerProgress() {
    const slot = document.getElementById('auto-banner-progress');
    if (!slot) return;
    const step = stepById[state.currentStepId];
    const total = STEPS.length; // 13
    const n = Math.min(state.autoPilot.completedSteps + 1, total);
    slot.textContent = `step ${n} of ${total} · ${step ? step.label : ''}`;
  }
  function applyAutoSpotlight(stepId) {
    clearAutoSpotlight();
    const node = document.querySelector(`.node[data-step-id="${stepId}"]`);
    if (node) node.classList.add('is-auto-pilot-active');
  }
  function clearAutoSpotlight() {
    document.querySelectorAll('.node.is-auto-pilot-active')
      .forEach(n => n.classList.remove('is-auto-pilot-active'));
  }

  async function runAutoPilot() {
    if (state.autoPilot.running) return;
    // Don't run while Demo Mode is also running — they'd fight over state.
    if (demo && demo.running) {
      showToast('Stop Demo Mode before starting Auto-Pilot.', true);
      return;
    }
    // Fresh state so the cycle is clean. Auto-Pilot always starts at trigger.
    state = freshState();
    state.autoPilot.running = true;
    state.autoPilot.startedAt = nowDateTs();
    state.autoPilot.completedSteps = 0;
    logAudit('system', 'Auto-Pilot started — running full RCSA cycle hands-free.');
    switchTab('map');
    renderAll();
    showAutoBanner();

    // Auto-ingest the sample Prerequisites Pack so the run is truly hands-free.
    // Make the modal visible first so the 5-section ✓ animation is on screen,
    // then commit to dismiss the modal and unlock the shell.
    try {
      showPrereqModal({ summary: false });
      await ingestPack(SAMPLE_PACK_NAME, { source: 'sample' });
      if (state.autoPilot.running) commitPrereqAndDismiss();
    } catch (e) {
      logAudit('system', `Auto-Pilot prereq ingestion failed: ${e && e.message ? e.message : e}`);
    }
    if (!state.autoPilot.running) { finishAutoPilot(); return; }

    const MAX_ITERATIONS = 24; // hard safety cap (12 nominal + retest loop + slack)
    let iter = 0;

    while (state.autoPilot.running && !state.terminated && iter < MAX_ITERATIONS) {
      iter++;
      const step = stepById[state.currentStepId];
      if (!step) break;

      applyAutoSpotlight(step.id);
      updateAutoBannerProgress();

      // Wait for any AI work to finish (already kicked off by renderActionPanel).
      await waitForAiCompletion(step);
      if (!state.autoPilot.running) break;

      // Visual breathing room so a viewer can read what just happened.
      await delay(1200);
      if (!state.autoPilot.running) break;

      const action = pickAutoAction(step);
      if (!action) {
        // STOP signal (e.g. step12 — don't auto-retrigger another full cycle).
        logAudit('system', `Auto-Pilot reached ${step.label} — cycle complete, stopping.`);
        break;
      }

      handleHumanAction(step, action, 'autopilot');
      state.autoPilot.completedSteps++;
      // After advance, give the new step's render a tick to land before we loop.
      await delay(50);
    }

    if (iter >= MAX_ITERATIONS) {
      logAudit('system', `Auto-Pilot hit safety cap (${MAX_ITERATIONS} iterations) — stopping.`);
    }

    finishAutoPilot();
  }

  function finishAutoPilot() {
    const wasApproved = state.approved;
    state.autoPilot.running = false;
    hideAutoBanner();
    if (wasApproved) {
      // Land on the Findings Report so the run's outcome is visible immediately.
      switchTab('report');
      const stamp = document.querySelector('.report-stamp');
      if (stamp) {
        stamp.classList.add('is-demo-spotlight');
        setTimeout(() => stamp.classList.remove('is-demo-spotlight'), 2400);
      }
    }
  }

  function stopAutoPilot(reason) {
    if (!state.autoPilot.running) return;
    state.autoPilot.running = false;
    hideAutoBanner();
    logAudit('system', `Auto-Pilot stopped${reason ? ` (${reason})` : ''}.`);
  }

  // ---------- Toast (transient feedback) ----------
  let toastTimer = null;
  function showToast(msg, isError) {
    let t = document.getElementById('ai-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'ai-toast';
      t.className = 'ai-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.toggle('is-error', !!isError);
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { if (t && t.parentNode) t.parentNode.removeChild(t); }, 5000);
  }

  // ---------- Tab 2: Step Detail (GRC view) ----------
  function renderStepDetail() {
    const view = document.getElementById('tab-detail');
    if (!view) return;
    const id = state.selectedStepId;
    if (!id) {
      view.innerHTML = `<div class="detail-empty">Select a step on the Workflow Map to see details here.</div>`;
      return;
    }
    const step = stepById[id];
    const status = stepStatus(id);
    const stage = stageLabel(step.stage);
    const due = step.dueDays != null ? `Due T+${step.dueDays} days` : 'Continuous';
    const actor = step.humanCheckpoint ? step.humanCheckpoint.actor : '—';

    view.innerHTML = `
      <div class="detail-header">
        <div class="detail-breadcrumb">${escapeHtml(stage)} · ${escapeHtml(laneFullLabel(step.lane))}</div>
        <h1 class="detail-title">${escapeHtml(step.label)}</h1>
        <div class="detail-meta">
          <span class="meta-pill stage">${escapeHtml(stage)}</span>
          <span class="meta-pill status-${status.kind}">${escapeHtml(status.label)}</span>
          <span class="meta-pill due">${escapeHtml(due)}</span>
          <span class="meta-pill role">Owner: ${escapeHtml(actor)}</span>
        </div>
      </div>

      <div class="detail-main">
        ${detailDescriptionCard(step)}
        ${detailWorkItemsCard(step)}
        ${detailPeerComparisonCard(step)}
        ${detailNextStepsCard(step, status)}
      </div>

      <div class="detail-side">
        ${detailAttachmentsCard(step)}
        ${detailCommentsCard(step)}
      </div>
    `;

    wireDetailActions(step);
    wireCommentForm(step);
  }

  function stepStatus(id) {
    if (state.terminated) return { kind: 'pending', label: 'Cycle terminated' };
    if (id === state.currentStepId) return { kind: 'active',    label: 'Active · in progress' };
    if (state.visited.has(id))      return { kind: 'completed', label: 'Completed' };
    return { kind: 'pending', label: 'Upcoming' };
  }

  function detailDescriptionCard(step) {
    const desc = step.description || step.summary;
    return `
      <section class="detail-card">
        <div class="detail-card-head">Overview</div>
        <div class="detail-card-body">
          <p>${escapeHtml(desc)}</p>
        </div>
      </section>
    `;
  }

  function detailWorkItemsCard(step) {
    const w = step.workItems;
    if (!w) return '';
    let body = '';
    if (w.type === 'kv') {
      body = `<div class="kv-list">${w.rows.map(r => `<div class="k">${escapeHtml(r.k)}</div><div class="v">${escapeHtml(r.v)}</div>`).join('')}</div>`;
    } else if (w.type === 'list') {
      body = `<div class="kv-list">${w.rows.map(r => `<div class="k">${escapeHtml(r.k)}</div><div class="v">${escapeHtml(r.v)}</div>`).join('')}</div>`;
    } else if (w.type === 'table') {
      const head = `<tr>${w.cols.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr>`;
      const rows = w.rows.map(r => `<tr>${r.map(c => `<td>${decorateCell(c)}</td>`).join('')}</tr>`).join('');
      body = `<table class="work-table"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
    }
    return `
      <section class="detail-card">
        <div class="detail-card-head">${escapeHtml(w.heading)}</div>
        <div class="detail-card-body">${body}</div>
      </section>
    `;
  }

  function decorateCell(c) {
    const s = String(c == null ? '' : c);
    const upper = s.toUpperCase();
    const escaped = escapeHtml(s);
    if (/(^|\b)(FAILED|INEFFECTIVE|INCOMPLETE|MISSING|WEAK|HIGH · RECURRING)\b/.test(upper)) {
      return `<span class="status-fail">${escaped}</span>`;
    }
    if (/(^|\b)(EFFECTIVE|DONE|APPROVED|WITHIN TOLERANCE)\b/.test(upper)) {
      return `<span class="status-ok">${escaped}</span>`;
    }
    if (/(^|\b)(PENDING|IN PROGRESS|DRAFTED|REVIEW|ACTION RECOMMENDED|MODERATE)\b/.test(upper)) {
      return `<span class="status-warn">${escaped}</span>`;
    }
    return escaped;
  }

  // Peer-team comparison corpus — visible only on Step 10 detail.
  // Surfaces the static peer dataset that AI Review 2 compares against,
  // so demo viewers can see what the AI is reasoning over.
  function detailPeerComparisonCard(step) {
    if (step.id !== 'step10') return '';
    const peers = (window.__RCSA__ && window.__RCSA__.PEER_SUBMISSIONS) || [];
    if (!peers.length) return '';
    const head = `<tr><th>Peer App</th><th>Cycle</th><th>Completed</th><th>Risks</th><th>Notable</th></tr>`;
    const rows = peers.map(p => {
      const notable = (p.notable || []).map(n => `<li>${escapeHtml(n)}</li>`).join('');
      return `
        <tr>
          <td><strong>${escapeHtml(p.app)}</strong><br><span style="font-size:11px;color:var(--c-text-mute);">${escapeHtml(p.summary || '')}</span></td>
          <td style="white-space:nowrap;">${escapeHtml(p.cycleId)}</td>
          <td style="white-space:nowrap;">${escapeHtml(p.completedDate || '')}</td>
          <td>${(p.risks || []).length}</td>
          <td><ul style="margin:0;padding-left:16px;">${notable}</ul></td>
        </tr>
      `;
    }).join('');
    return `
      <section class="detail-card">
        <div class="detail-card-head">Peer comparison corpus (${peers.length})</div>
        <div class="detail-card-body" style="font-size:12.5px;">
          <p style="margin:0 0 10px 0;color:var(--c-text-soft);">AI Review 2 compares this submission against the peer cycles below. Look for diverging control verdicts, missing baseline risks, and residual rating outliers.</p>
          <table class="work-table">
            <thead>${head}</thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  function detailNextStepsCard(step, status) {
    const cp = step.humanCheckpoint;
    if (!cp) return '';
    const items = cp.actions.map(a => {
      let cls = '';
      if (a.tone === 'yes') cls = 'yes';
      if (a.tone === 'no')  cls = 'no';
      const target = a.target === 'terminate' ? 'Terminate cycle' :
                     a.target === step.id     ? `Stay at ${step.label}` :
                     stepById[a.target]       ? stepById[a.target].label : a.target;
      const arrowTxt = a.tone === 'yes' ? 'YES →' : a.tone === 'no' ? 'NO →' : '→';
      return `<li class="${cls}"><span class="arrow">${arrowTxt}</span><span><strong>${escapeHtml(a.label)}</strong> &nbsp;<span style="color:var(--c-text-mute);">routes to</span> ${escapeHtml(target)}</span></li>`;
    }).join('');

    const isCurrent = step.id === state.currentStepId;
    const actionsBtns = isCurrent
      ? cp.actions.map((a, i) => `<button class="btn btn-${a.tone}" data-step-id="${step.id}" data-action-idx="${i}">${escapeHtml(a.label)}</button>`).join('')
      : `<div style="color:var(--c-text-mute);font-size:12.5px;font-style:italic;padding:6px 0;">${status.kind === 'completed' ? 'This step has been completed. Decisions are recorded in the audit trail.' : 'This step is not yet active.'}</div>`;

    return `
      <section class="detail-card">
        <div class="detail-card-head">Next steps · routing</div>
        <div class="detail-card-body">
          <div style="font-size:12.5px;color:var(--c-text-soft);margin-bottom:10px;">Decision: <strong>${escapeHtml(cp.prompt)}</strong></div>
          <ul class="next-steps">${items}</ul>
          <div class="detail-actions">${actionsBtns}</div>
        </div>
      </section>
    `;
  }

  function detailAttachmentsCard(step) {
    const a = step.attachments || [];
    if (!a.length) {
      return `
        <section class="detail-card">
          <div class="detail-card-head">Attachments</div>
          <div class="detail-card-body" style="color:var(--c-text-mute);font-size:12.5px;">No attachments.</div>
        </section>
      `;
    }
    const rows = a.map(f => {
      const inner = `
        <div class="attach-icon">${escapeHtml(extLabel(f))}</div>
        <div class="attach-name">${escapeHtml(f.name)}</div>
        <div class="attach-meta">${escapeHtml(f.size || '')}</div>
      `;
      return f.href
        ? `<a class="attach-row attach-link" href="${escapeHtml(f.href)}" download>${inner}</a>`
        : `<div class="attach-row">${inner}</div>`;
    }).join('');
    return `
      <section class="detail-card">
        <div class="detail-card-head">Attachments (${a.length})</div>
        <div class="detail-card-body"><div class="attach-list">${rows}</div></div>
      </section>
    `;
  }

  function extLabel(file) {
    const m = /\.([a-z0-9]+)$/i.exec(file.name);
    if (m) return m[1].toUpperCase();
    if (file.kind === 'data')  return 'CSV';
    if (file.kind === 'image') return 'IMG';
    return 'FILE';
  }

  function detailCommentsCard(step) {
    const baseComments = step.comments || [];
    const userComments = state.userComments[step.id] || [];
    const all = [...baseComments, ...userComments];
    const items = all.map(c => {
      const isAi = /\bAI\b/i.test(c.role) || /Assistant/i.test(c.author);
      const initials = (c.author || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
      return `
        <div class="comment ${isAi ? 'is-ai' : ''}">
          <div class="comment-avatar">${escapeHtml(initials)}</div>
          <div class="comment-bubble">
            <div class="comment-meta">
              <span class="name">${escapeHtml(c.author)}</span>
              <span class="role">${escapeHtml(c.role)}</span>
              <span>· ${escapeHtml(c.ts)}</span>
            </div>
            <div class="comment-text">${escapeHtml(c.text)}</div>
          </div>
        </div>
      `;
    }).join('');
    const empty = `<div style="color:var(--c-text-mute);font-size:12.5px;">No comments yet.</div>`;
    return `
      <section class="detail-card">
        <div class="detail-card-head">Comments (${all.length})</div>
        <div class="detail-card-body">
          <div class="comment-list">${all.length ? items : empty}</div>
          <form class="comment-add" data-step-id="${step.id}" autocomplete="off">
            <input type="text" name="text" placeholder="Add a comment as ${escapeHtml(step.humanCheckpoint ? step.humanCheckpoint.actor : 'user')}…" />
            <button class="btn btn-primary" type="submit">Post</button>
          </form>
        </div>
      </section>
    `;
  }

  function wireDetailActions() { /* handled by global delegated listener */ }

  function wireCommentForm(step) {
    const form = document.querySelector(`#tab-detail .comment-add[data-step-id="${step.id}"]`);
    if (!form) return;
    form.addEventListener('submit', e => {
      e.preventDefault();
      const input = form.querySelector('input[name="text"]');
      const text = input.value.trim();
      if (!text) return;
      const role = step.humanCheckpoint ? step.humanCheckpoint.actor : 'User';
      const author = role.split(',')[0].split('—')[0].trim();
      const entry = { author, role, ts: nowDateTs(), text };
      state.userComments[step.id] = state.userComments[step.id] || [];
      state.userComments[step.id].push(entry);
      logAudit('human', `[${role}] commented on ${step.label}: "${truncate(text, 80)}"`);
      input.value = '';
      renderStepDetail();
    });
  }

  // ---------- Findings Report ----------
  function renderFindingsReport() {
    const view = document.getElementById('tab-report');
    if (!view) return;
    if (!state.approved) {
      view.innerHTML = `<div class="detail-empty">The Findings Report becomes available after 2LOD approval (Step 11).</div>`;
      return;
    }

    const triggerStep   = stepById['trigger'];
    const scopeStep     = stepById['step1'];
    const risksStep     = stepById['step2'];
    const ratingsStep   = stepById['step3'];
    const ctlEvalStep   = stepById['step4'];
    const testStep      = stepById['step5'];
    const gapsStep      = stepById['step6'];
    const remediation   = stepById['step7'];
    const residual      = stepById['step8'];
    const submission    = stepById['step9'];
    const challengeStep = stepById['step10'];
    const approveStep   = stepById['step11'];

    const approveDecision = state.decisions.find(d => d.stepId === 'step11');
    const challengeDecision = state.decisions.find(d => d.stepId === 'step10' && /NO/i.test(d.label));

    view.innerHTML = `
      <div class="report-actions">
        <button class="btn" id="report-print">🖨 Print / Save as PDF</button>
        <button class="btn btn-secondary" id="report-back">← Back to Workflow Map</button>
      </div>
      <div class="report-doc">
        <h1>Cyber RCSA — Findings Report</h1>
        <div class="report-meta">
          <div class="k">Cycle ID</div><div>RCSA-2026-Q2-PAYC-001</div>
          <div class="k">Scope</div><div>PAYMENTS-CORE application cluster — IAM domain &amp; logging controls</div>
          <div class="k">Generated</div><div>${escapeHtml(nowDateTs())}</div>
          <div class="k">Trigger</div><div>${escapeHtml(triggerSummary(triggerStep))}</div>
        </div>

        <h2>1. Scope</h2>
        ${kvTable(scopeStep.workItems)}

        <h2>2. Risks Identified</h2>
        ${tableFromWorkItems(risksStep.workItems)}

        <h2>3. Risk Assessment (Inherent Ratings)</h2>
        ${tableFromWorkItems(ratingsStep.workItems)}

        <h2>4. Controls Tested</h2>
        ${tableFromWorkItems(testStep.workItems)}

        <h2>5. Gaps Identified</h2>
        ${tableFromWorkItems(gapsStep.workItems)}

        <h2>6. Remediation Actions Taken</h2>
        ${tableFromWorkItems(remediation.workItems)}

        <h2>7. Residual Risk</h2>
        ${tableFromWorkItems(residual.workItems)}

        <h2>8. Pre-Submission Validation (resolved)</h2>
        ${tableFromWorkItems(submission.workItems)}

        <h2>9. 2LOD Check &amp; Challenge</h2>
        ${reviewBriefForReport(challengeStep, 'isolation', '9.1 Internal Challenge')}
        ${reviewBriefForReport(challengeStep, 'peer', '9.2 Peer Comparison')}
        ${peerCorpusSummaryForReport()}
        ${tableFromWorkItems(challengeStep.workItems)}
        ${challengeDecision ? `<p><strong>Outcome:</strong> ${escapeHtml(challengeDecision.label)} — ${escapeHtml(challengeDecision.actor)}</p>` : ''}

        <h2>10. Approval &amp; Sign-off</h2>
        ${kvTable(approveStep.workItems)}

        <div class="report-stamp">
          <div class="stamp-icon">✓</div>
          <div class="stamp-text">
            APPROVED &amp; VALIDATED
            <small>${approveDecision ? escapeHtml(`${approveDecision.actor} · ${approveDecision.ts}`) : 'Pending sign-off timestamp'}</small>
          </div>
        </div>

        <h2>11. Decision Trail</h2>
        ${decisionsTable()}
      </div>
    `;

    const printBtn = document.getElementById('report-print');
    if (printBtn) printBtn.addEventListener('click', () => window.print());
    const backBtn = document.getElementById('report-back');
    if (backBtn) backBtn.addEventListener('click', () => switchTab('map'));
  }

  function triggerSummary(step) {
    if (!step || !step.workItems || !Array.isArray(step.workItems.rows)) return '—';
    const src = step.workItems.rows.find(r => /trigger source/i.test(r.k));
    const scope = step.workItems.rows.find(r => /recommended scope/i.test(r.k));
    if (src && scope) return `${src.v} — ${scope.v}`;
    if (src) return src.v;
    return '—';
  }

  function tableFromWorkItems(w) {
    if (!w) return '<p style="color:var(--c-text-mute);">No data captured for this section.</p>';
    if (w.type === 'table') {
      const head = `<tr>${w.cols.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr>`;
      const rows = w.rows.map(r => `<tr>${r.map(c => `<td>${decorateCell(c)}</td>`).join('')}</tr>`).join('');
      return `<table><thead>${head}</thead><tbody>${rows}</tbody></table>`;
    }
    return kvTable(w);
  }

  function kvTable(w) {
    if (!w) return '<p style="color:var(--c-text-mute);">No data.</p>';
    const rows = w.rows.map(r => `<tr><th style="width:240px;">${escapeHtml(r.k)}</th><td>${escapeHtml(r.v)}</td></tr>`).join('');
    return `<table><tbody>${rows}</tbody></table>`;
  }

  function reviewBriefForReport(step, reviewId, heading) {
    if (!step || !step.aiReviews) return '';
    const review = step.aiReviews.find(r => r.id === reviewId);
    if (!review || !review.output) return '';
    const o = review.output;
    const bullets = (o.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join('');
    const live = state.aiReviewSources[step.id] && state.aiReviewSources[step.id][reviewId] === 'live';
    const modelLabel = (live && o._model) ? o._model : 'org LLM gateway';
    const attribution = live ? ` <em style="color:#6b3fa0;">(Powered by ${escapeHtml(modelLabel)})</em>` : '';
    return `
      <h3>${escapeHtml(heading)}${attribution}</h3>
      <p><strong>${escapeHtml(o.verdict || '')}.</strong> ${o.lead}</p>
      ${bullets ? `<ul>${bullets}</ul>` : ''}
    `;
  }

  function peerCorpusSummaryForReport() {
    const peers = (window.__RCSA__ && window.__RCSA__.PEER_SUBMISSIONS) || [];
    if (!peers.length) return '';
    const rows = peers.map(p => `<tr><td>${escapeHtml(p.app)}</td><td>${escapeHtml(p.cycleId)}</td><td>${escapeHtml(p.completedDate || '')}</td><td>${(p.risks || []).length}</td></tr>`).join('');
    return `
      <h3>Peer corpus reviewed</h3>
      <table>
        <thead><tr><th>Peer App</th><th>Cycle</th><th>Completed</th><th>Risks in register</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function decisionsTable() {
    if (!state.decisions.length) return '<p style="color:var(--c-text-mute);">No decisions recorded.</p>';
    const rows = state.decisions.map(d =>
      `<tr><td>${escapeHtml(d.ts)}</td><td>${escapeHtml(d.stepLabel)}</td><td>${escapeHtml(d.actor)}</td><td>${escapeHtml(d.label)}</td></tr>`
    ).join('');
    return `<table><thead><tr><th>Time</th><th>Step</th><th>Actor (role)</th><th>Decision</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  // ---------- Audit ----------
  function logAudit(actor, message) {
    state.history.push({ ts: nowTs(), actor, message });
    renderAudit();
  }
  function renderAudit() {
    const list = document.getElementById('audit-list');
    const count = document.getElementById('audit-count');
    count.textContent = `${state.history.length} event${state.history.length === 1 ? '' : 's'}`;
    if (state.history.length === 0) {
      list.innerHTML = `<div class="audit-empty">No events yet. Begin the simulation from the Trigger Event.</div>`;
      return;
    }
    list.innerHTML = state.history.slice().reverse().map(e => `
      <div class="audit-row">
        <span class="ts">${e.ts}</span>
        <span class="actor ${e.actor}">${actorLabel(e.actor)}</span>
        <span class="msg">${escapeHtml(e.message)}</span>
      </div>
    `).join('');
  }
  function actorLabel(a) { return ({ ai: 'AI', human: 'HUMAN', system: 'SYSTEM' })[a] || a.toUpperCase(); }

  // ---------- Terminate ----------
  function renderTerminatePanel() {
    const panel = document.getElementById('panel');
    panel.innerHTML = `
      <div class="panel-head">
        <div class="crumb">RCSA cycle</div>
        <h1>No RCSA initiated</h1>
        <div class="owner">Cyber RCSA Lead rejected the trigger and chose not to initiate an RCSA. Rationale recorded in audit trail.</div>
      </div>
      <div class="panel-body">
        <div class="terminate-banner">
          <strong>Continuing in monitoring posture.</strong><br>
          Continuous monitoring (Step 12) remains active. A new trigger will surface if KRIs, SIEM signals, or audit findings cross threshold.
        </div>
        <button class="btn btn-primary" id="back-to-monitoring">Open Monitoring &amp; Review (Step 12)</button>
      </div>
    `;
    document.getElementById('back-to-monitoring').addEventListener('click', () => {
      state.terminated = false;
      state.currentStepId = 'step12';
      state.selectedStepId = 'step12';
      state.visited.add('step12');
      logAudit('system', 'Jumped to Monitoring & Review (Step 12).');
      renderAll();
    });
  }

  // ---------- Tabs ----------
  function switchTab(tabId) {
    state.activeTab = tabId;
    document.querySelectorAll('.tab').forEach(t => {
      const isActive = t.dataset.tab === tabId;
      t.classList.toggle('is-active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    document.getElementById('tab-map').classList.toggle('is-hidden', tabId !== 'map');
    document.getElementById('tab-detail').classList.toggle('is-hidden', tabId !== 'detail');
    document.getElementById('tab-report').classList.toggle('is-hidden', tabId !== 'report');
    if (tabId === 'detail') renderStepDetail();
    if (tabId === 'report') renderFindingsReport();
  }

  // ---------- Helpers ----------
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function stripTags(s) { return String(s || '').replace(/<[^>]*>/g, ''); }
  function nowTs() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  function nowDateTs() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function truncate(s, n) { s = String(s||''); return s.length <= n ? s : s.slice(0, n - 1) + '…'; }

  // ---------- Wiring ----------
  document.getElementById('reset-btn').addEventListener('click', resetSimulationAndPrereq);

  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      if (t.classList.contains('is-hidden')) return;
      switchTab(t.dataset.tab);
    });
  });

  const auditEl = document.getElementById('audit');
  document.getElementById('audit-head').addEventListener('click', () => {
    auditEl.classList.toggle('collapsed');
    document.getElementById('audit-toggle').textContent = auditEl.classList.contains('collapsed') ? '▸' : '▾';
  });

  // ---------- Prerequisites Pack modal ----------
  // Singular file insertion at the start of every cycle. Blocks the swimlane
  // until a pack is "ingested" (animated, no real parse). Real .xlsx ships in
  // docs/samples/ for download credibility.
  const CHECKLIST_KEYS = ['risks', 'assets', 'prior', 'policy', 'evidence'];
  const PER_SECTION_MS = 600;

  function lockShell() {
    document.body.classList.add('app-shell-locked');
  }
  function unlockShell() {
    document.body.classList.remove('app-shell-locked');
  }

  function showPrereqModal({ summary = false } = {}) {
    const modal = document.getElementById('prereq-modal');
    if (!modal) return;
    resetChecklistUI();
    const filenameEl = document.getElementById('prereq-filename');
    const beginBtn = document.getElementById('prereq-begin-btn');
    if (summary && state.prereq.loaded) {
      // Summary mode — pre-populate with the loaded pack and mark all done.
      filenameEl.textContent = `${state.prereq.filename} · ingested ${state.prereq.ts}`;
      filenameEl.classList.add('is-set');
      CHECKLIST_KEYS.forEach(k => {
        const li = document.querySelector(`.prereq-checklist-item[data-key="${k}"]`);
        if (li) li.classList.add('is-done');
      });
      beginBtn.textContent = 'Close';
      beginBtn.disabled = false;
    } else {
      filenameEl.textContent = 'No file selected.';
      filenameEl.classList.remove('is-set');
      beginBtn.textContent = 'Begin RCSA cycle →';
      beginBtn.disabled = true;
    }
    modal.classList.remove('is-hidden');
    lockShell();
  }
  function hidePrereqModal() {
    const modal = document.getElementById('prereq-modal');
    if (modal) modal.classList.add('is-hidden');
  }

  function resetChecklistUI() {
    CHECKLIST_KEYS.forEach(k => {
      const li = document.querySelector(`.prereq-checklist-item[data-key="${k}"]`);
      if (li) { li.classList.remove('is-active'); li.classList.remove('is-done'); }
    });
  }

  function setPrereqChipVisible(visible) {
    const chip = document.getElementById('prereq-chip');
    if (!chip) return;
    chip.classList.toggle('is-hidden', !visible);
  }

  function runPrereqIngestAnimation(filename) {
    return new Promise(resolve => {
      const filenameEl = document.getElementById('prereq-filename');
      filenameEl.textContent = filename;
      filenameEl.classList.add('is-set');
      resetChecklistUI();
      const beginBtn = document.getElementById('prereq-begin-btn');
      beginBtn.disabled = true;

      let i = 0;
      function step() {
        if (i > 0) {
          const prevKey = CHECKLIST_KEYS[i - 1];
          const prev = document.querySelector(`.prereq-checklist-item[data-key="${prevKey}"]`);
          if (prev) { prev.classList.remove('is-active'); prev.classList.add('is-done'); }
        }
        if (i >= CHECKLIST_KEYS.length) {
          beginBtn.disabled = false;
          resolve();
          return;
        }
        const cur = document.querySelector(`.prereq-checklist-item[data-key="${CHECKLIST_KEYS[i]}"]`);
        if (cur) cur.classList.add('is-active');
        i += 1;
        setTimeout(step, PER_SECTION_MS);
      }
      setTimeout(step, 200);
    });
  }

  async function ingestPack(filename, opts) {
    opts = opts || {};
    await runPrereqIngestAnimation(filename);
    state.prereq.loaded = true;
    state.prereq.filename = filename;
    state.prereq.ts = nowDateTs();
    state.prereq.context = opts.context || PREREQ_CONTEXT;
    state.prereq.source = opts.source || 'static';
  }

  function commitPrereqAndDismiss() {
    if (!state.prereq.loaded) return;
    // First commit = chip is currently hidden. Subsequent commits (re-opening
    // via the chip's summary view and clicking Close) should not re-log.
    const chip = document.getElementById('prereq-chip');
    const firstCommit = chip.classList.contains('is-hidden');
    hidePrereqModal();
    unlockShell();
    setPrereqChipVisible(true);
    if (firstCommit) {
      logAudit('system', `Prerequisites pack ingested: ${state.prereq.filename} (5 sections).`);
    }
  }

  function initPrereqModal() {
    const dropzone = document.getElementById('prereq-dropzone');
    const fileInput = document.getElementById('prereq-file-input');
    const browseBtn = document.getElementById('prereq-browse-btn');
    const beginBtn = document.getElementById('prereq-begin-btn');
    const chip = document.getElementById('prereq-chip');

    if (!dropzone || !fileInput || !browseBtn || !beginBtn || !chip) return;

    browseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (f) ingestPack(f.name);
    });

    ['dragenter', 'dragover'].forEach(ev => dropzone.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation();
      dropzone.classList.add('is-dragover');
    }));
    ['dragleave', 'drop'].forEach(ev => dropzone.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation();
      dropzone.classList.remove('is-dragover');
    }));
    dropzone.addEventListener('drop', e => {
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) ingestPack(f.name);
    });

    beginBtn.addEventListener('click', () => {
      if (state.prereq.loaded) commitPrereqAndDismiss();
    });

    chip.addEventListener('click', () => showPrereqModal({ summary: true }));

    // "✨ Generate with AI" — toggle inline form
    const aiBtn = document.getElementById('prereq-ai-btn');
    const aiForm = document.getElementById('prereq-ai-form');
    const aiCancel = document.getElementById('prereq-ai-cancel');
    const aiSubmit = document.getElementById('prereq-ai-submit');
    const aiAppInput = document.getElementById('prereq-ai-app');
    const aiDomainInput = document.getElementById('prereq-ai-domain');
    if (aiBtn && aiForm && aiCancel && aiSubmit) {
      aiBtn.addEventListener('click', () => {
        if (!window.AIClient || !window.AIClient.isLive || !window.AIClient.isLive()) {
          showToast('Configure your gateway URL and API key in ⚙ API first.', true);
          return;
        }
        aiForm.classList.remove('is-hidden');
        aiAppInput.focus();
      });
      aiCancel.addEventListener('click', () => aiForm.classList.add('is-hidden'));
      aiSubmit.addEventListener('click', async () => {
        const app = (aiAppInput.value || '').trim() || 'PAYMENTS-CORE';
        const domain = (aiDomainInput.value || '').trim() || 'Payments';
        aiSubmit.disabled = true;
        aiCancel.disabled = true;
        aiSubmit.textContent = 'Generating…';
        try {
          const generated = await generatePrereqPack({ app, domain });
          aiForm.classList.add('is-hidden');
          await ingestPack(`AI-generated-pack-${app}-${nowDateTs().replace(/[: ]/g, '-')}.json`, {
            context: generated,
            source: 'live'
          });
        } catch (err) {
          const reason = err && err.message ? err.message : 'unknown error';
          showToast(`AI generation failed: ${reason}`, true);
          logAudit('system', `Prereq AI generation failed (${err && err.type ? err.type : 'error'}): ${reason}`);
        } finally {
          aiSubmit.disabled = false;
          aiCancel.disabled = false;
          aiSubmit.textContent = 'Generate';
        }
      });
    }
  }

  // ---------- Prereq pack AI generation ----------
  const PREREQ_PACK_SCHEMA = {
    type: 'object',
    properties: {
      cycleId: { type: 'string' },
      inScopeApp: { type: 'string' },
      generated: { type: 'string' },
      owner: { type: 'string' },
      riskInventory: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            risk: { type: 'string' },
            application: { type: 'string' },
            mappedControls: { type: 'array', items: { type: 'string' } },
            owner: { type: 'string' },
            inherent: { type: 'string' }
          },
          required: ['id', 'risk', 'application', 'mappedControls', 'owner', 'inherent'],
          additionalProperties: false
        }
      },
      assets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            cmdbId: { type: 'string' },
            name: { type: 'string' },
            tier: { type: 'string' },
            appOwner: { type: 'string' },
            techOwner: { type: 'string' },
            pci: { type: 'boolean' },
            sox: { type: 'boolean' },
            lifecycle: { type: 'string' }
          },
          required: ['cmdbId', 'name', 'tier', 'appOwner', 'techOwner', 'pci', 'sox', 'lifecycle'],
          additionalProperties: false
        }
      },
      priorIssues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            cycleId: { type: 'string' },
            finding: { type: 'string' },
            status: { type: 'string' },
            openDate: { type: 'string' },
            owner: { type: 'string' },
            linkedControl: { type: 'string' },
            carryForward: { type: 'boolean' }
          },
          required: ['cycleId', 'finding', 'status', 'openDate', 'owner', 'linkedControl', 'carryForward'],
          additionalProperties: false
        }
      },
      policies: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            standard: { type: 'string' },
            section: { type: 'string' },
            applicability: { type: 'string' },
            internalPolicyId: { type: 'string' },
            lastReviewed: { type: 'string' }
          },
          required: ['standard', 'section', 'applicability', 'internalPolicyId', 'lastReviewed'],
          additionalProperties: false
        }
      },
      evidence: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            source: { type: 'string' },
            signal: { type: 'string' },
            trend: { type: 'string' },
            linkedAsset: { type: 'string' },
            lastUpdated: { type: 'string' }
          },
          required: ['source', 'signal', 'trend', 'linkedAsset', 'lastUpdated'],
          additionalProperties: false
        }
      }
    },
    required: ['cycleId', 'inScopeApp', 'generated', 'owner', 'riskInventory', 'assets', 'priorIssues', 'policies', 'evidence'],
    additionalProperties: false
  };

  async function generatePrereqPack({ app, domain }) {
    const userMsg = `Application: ${app}\nDomain: ${domain}\n\nGenerate a realistic Cyber RCSA Prerequisites Pack covering: 8–10 risks (riskInventory), 6–8 assets, 5–6 priorIssues, 8–12 policies (NIST CSF / NYDFS 500 / SOX / PCI-DSS), 10–15 evidence rows (Splunk / Sentinel / KRI / Audit / IR / Reg bulletins / Vuln Mgmt). Use the firm's named individuals: M. Chen (Cyber RCSA Lead), L. Ortega (Application Owner), P. Singh (IAM Lead), D. Park (Logging Eng Lead), A. Khan (PKI Eng Lead), R. Diaz (GRC Eng Lead). Use today's date for "generated". Return JSON matching the provided schema. No prose, no markdown.`;
    const result = await window.AIClient.callClaude({
      system: PREREQ_GEN_SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 3000,
      cacheSystem: false,
      jsonSchema: PREREQ_PACK_SCHEMA
    });
    return result.parsed;
  }

  // ---------- API Settings modal ----------
  function initAiSettingsModal() {
    const btn        = document.getElementById('ai-settings-btn');
    const modal      = document.getElementById('ai-settings-modal');
    const closeBtn   = document.getElementById('ai-settings-close');
    const scrim      = modal && modal.querySelector('[data-ai-settings-close]');
    const baseInput  = document.getElementById('ai-base-url-input');
    const keyInput   = document.getElementById('ai-key-input');
    const modelInput = document.getElementById('ai-model-input');
    const saveBtn    = document.getElementById('ai-key-save');
    const testBtn    = document.getElementById('ai-key-test');
    const testResult = document.getElementById('ai-test-result');
    const clearBtn   = document.getElementById('ai-key-clear');
    const aiBtn      = document.getElementById('prereq-ai-btn');
    const fileWarn   = document.getElementById('ai-file-origin-warning');
    if (!btn || !modal || !keyInput || !baseInput || !saveBtn || !clearBtn) return;

    let testTimer = null;

    // Browsers block CORS for file:// origins before any request leaves the
    // tab, so live AI never works when the demo is double-clicked. The modal
    // surfaces a warning so users don't waste time wondering why testing fails.
    function refreshFileOriginWarning() {
      if (!fileWarn) return;
      const isFile = (typeof location !== 'undefined' && location.protocol === 'file:');
      fileWarn.classList.toggle('is-hidden', !isFile);
    }

    function refreshStatus() {
      const ai     = window.AIClient;
      const hasKey = !!(ai && ai.hasApiKey && ai.hasApiKey());
      const hasUrl = !!(ai && ai.hasBaseUrl && ai.hasBaseUrl());
      const live   = hasKey && hasUrl;
      const chip   = document.getElementById('ai-status-chip');
      const dot    = document.getElementById('ai-status-dot');
      const modelLabel = (ai && ai.getModel && ai.getModel()) || 'gateway default';

      // Three states: live (both saved) · partial (one saved) · static (neither).
      let chipText, chipClass;
      if (live) {
        chipText  = '● Live AI enabled · ' + modelLabel;
        chipClass = 'live';
      } else if (hasKey && !hasUrl) {
        chipText  = '◐ Partial config — needs Base URL';
        chipClass = 'partial';
      } else if (hasUrl && !hasKey) {
        chipText  = '◐ Partial config — needs API key';
        chipClass = 'partial';
      } else {
        chipText  = '○ Static mode — no gateway configured';
        chipClass = 'static';
      }
      if (chip) {
        chip.textContent = chipText;
        chip.classList.remove('live', 'static', 'partial');
        chip.classList.add(chipClass);
      }
      if (dot) {
        // Topbar dot stays binary green/grey — partial counts as not-live.
        dot.classList.toggle('live', live);
        dot.classList.toggle('static', !live);
      }
      if (aiBtn) {
        aiBtn.disabled = !live;
        aiBtn.title = live
          ? 'Generate a prerequisites pack via the LLM gateway'
          : 'Set the gateway URL and API key first';
      }
      // Keep the workflow chat FAB in sync with gateway availability.
      if (typeof refreshChatFabAvailability === 'function') refreshChatFabAvailability();
    }

    // Test button is enabled whenever the form has both URL and key entered
    // (form values, not necessarily saved yet — we want to test before save).
    function refreshTestEnabled() {
      if (!testBtn) return;
      const filled = (baseInput.value || '').trim() && (keyInput.value || '').trim();
      testBtn.disabled = !filled;
    }

    function showTestResult(kind, text) {
      if (!testResult) return;
      testResult.classList.remove('is-testing', 'is-success', 'is-failure');
      testResult.classList.add('is-visible', 'is-' + kind);
      testResult.textContent = text;
      if (testTimer) { clearTimeout(testTimer); testTimer = null; }
      // Auto-clear after 12s for non-testing states so the modal doesn't go stale.
      if (kind !== 'testing') {
        testTimer = setTimeout(() => {
          if (!testResult) return;
          testResult.classList.remove('is-visible', 'is-success', 'is-failure');
          testResult.textContent = '';
          testTimer = null;
        }, 12000);
      }
    }
    function clearTestResult() {
      if (!testResult) return;
      if (testTimer) { clearTimeout(testTimer); testTimer = null; }
      testResult.classList.remove('is-visible', 'is-testing', 'is-success', 'is-failure');
      testResult.textContent = '';
    }

    async function testGatewayConnection() {
      const ai = window.AIClient;
      if (!ai) return;
      const base  = (baseInput.value  || '').trim();
      const key   = (keyInput.value   || '').trim();
      const model = (modelInput.value || '').trim();
      if (!base || !key) { showTestResult('failure', '✗ Fill in both Base URL and API key first.'); return; }
      if (!/^https?:\/\//i.test(base)) { showTestResult('failure', '✗ Base URL must start with http:// or https://'); return; }

      // Snapshot existing saved settings so we can restore if the test mutates them.
      const savedBase  = ai.getBaseUrl ? (ai.getBaseUrl() || '') : '';
      const savedKey   = ai.getApiKey  ? (ai.getApiKey()  || '') : '';
      const savedModel = ai.getModel   ? (ai.getModel()   || '') : '';

      // Apply form values temporarily so callClaude reads them.
      ai.setBaseUrl(base);
      ai.setApiKey(key);
      ai.setModel(model);

      testBtn.disabled = true;
      saveBtn.disabled = true;
      clearBtn.disabled = true;
      showTestResult('testing', '⏳ Testing connection to ' + base + ' …');
      const t0 = performance.now();

      try {
        const result = await ai.callClaude({
          system: 'Reply with the single token: ok',
          messages: [{ role: 'user', content: 'ok' }],
          maxTokens: 4
        });
        const ms = Math.round(performance.now() - t0);
        const returnedModel = (result && result.model) || (model || 'gateway default');
        showTestResult('success',
          '✓ Connected — gateway responded in ' + ms + ' ms\n' +
          '  model: ' + returnedModel
        );
      } catch (err) {
        const ms = Math.round(performance.now() - t0);
        const type = (err && err.type) || 'error';
        const msg  = (err && err.message) || String(err);
        let prefix;
        if (type === 'auth') {
          prefix = '✗ Authentication rejected (401/403). Likely a bad or expired key.';
        } else if (type === 'rate_limit') {
          prefix = '✗ Rate-limited by the gateway (429).';
        } else if (type === 'network') {
          prefix = '✗ Couldn\'t reach the gateway (network/CORS).';
        } else if (type === 'parse') {
          prefix = '✗ Connected, but couldn\'t parse the response.';
        } else {
          prefix = '✗ Gateway returned an error.';
        }
        showTestResult('failure', prefix + '\n  ' + msg + '\n  (' + ms + ' ms)');
      } finally {
        // Restore previously-saved values so a test doesn't side-effect.
        ai.setBaseUrl(savedBase);
        ai.setApiKey(savedKey);
        ai.setModel(savedModel);
        testBtn.disabled = false;
        saveBtn.disabled = false;
        clearBtn.disabled = false;
        refreshTestEnabled();
        refreshStatus();
      }
    }

    function open() {
      const ai = window.AIClient;
      baseInput.value  = (ai && ai.getBaseUrl && ai.getBaseUrl()) || '';
      keyInput.value   = (ai && ai.getApiKey  && ai.getApiKey())  || '';
      modelInput.value = (ai && ai.getModel   && ai.getModel())   || '';
      clearTestResult();
      modal.classList.remove('is-hidden');
      refreshStatus();
      refreshTestEnabled();
      refreshFileOriginWarning();
      // Focus the first empty field so the user knows where to start.
      if (!baseInput.value) baseInput.focus();
      else if (!keyInput.value) keyInput.focus();
      else keyInput.focus();
    }
    function close() { modal.classList.add('is-hidden'); }

    btn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (scrim) scrim.addEventListener('click', close);

    // Keep Test button reactive to form state.
    [baseInput, keyInput].forEach(el => el.addEventListener('input', refreshTestEnabled));

    if (testBtn) testBtn.addEventListener('click', testGatewayConnection);

    saveBtn.addEventListener('click', () => {
      const ai    = window.AIClient;
      const base  = (baseInput.value  || '').trim();
      const key   = (keyInput.value   || '').trim();
      const model = (modelInput.value || '').trim();
      if (!base && !key) {
        showToast('Paste both your gateway URL and API key first.', true);
        baseInput.focus();
        return;
      }
      if (!base) {
        showToast('Got it. The gateway URL needs filling too — your key alone can\'t tell us where to send requests.', true);
        baseInput.focus();
        return;
      }
      if (!key) {
        showToast('Got it. The API key needs filling too — the URL alone can\'t authenticate the request.', true);
        keyInput.focus();
        return;
      }
      if (!/^https?:\/\//i.test(base)) {
        showToast('Base URL must start with http:// or https://', true);
        baseInput.focus();
        return;
      }
      ai.setBaseUrl(base);
      ai.setApiKey(key);
      ai.setModel(model); // empty string clears
      refreshStatus();
      const modelLabel = model || 'gateway default';
      showToast('Gateway settings saved for this session.');
      logAudit('system', 'LLM gateway configured (' + base + ' · model: ' + modelLabel + ') — live AI enabled.');
      close();
    });

    clearBtn.addEventListener('click', () => {
      const ai = window.AIClient;
      ai.clearApiKey();
      ai.clearBaseUrl();
      ai.clearModel();
      baseInput.value  = '';
      keyInput.value   = '';
      modelInput.value = '';
      clearTestResult();
      refreshStatus();
      refreshTestEnabled();
      showToast('Gateway settings cleared.');
      logAudit('system', 'LLM gateway settings cleared — reverting to static AI mode.');
    });

    refreshStatus();
    refreshTestEnabled();
    refreshFileOriginWarning();
  }

  function resetSimulationAndPrereq() {
    // Stop any running mode before wiping state.
    if (state.autoPilot && state.autoPilot.running) stopAutoPilot('reset');
    if (typeof demo !== 'undefined' && demo && demo.running) stopDemo('reset');
    state = freshState();
    setPrereqChipVisible(false);
    showPrereqModal({ summary: false });
    switchTab('map');
    renderAll();
    logAudit('system', 'Simulation reset. Re-insert prerequisites to begin a new cycle.');
  }

  // ---------- Demo Mode ----------
  // 90-second guided walkthrough that auto-advances the workflow with
  // on-screen "AI HIGHLIGHT" callouts at every AI-augmented step.

  const DEMO_SCRIPT = [
    { kind: 'prereq-upload',
      narration: 'It starts with one file — the RCSA Prerequisites Pack. Risks, assets, prior cycles, policies, evidence — all consolidated. The user inserts it, and the cycle begins.',
      dur: 6500 },
    { kind: 'caption',   text: 'Cyber RCSA — AI Where It Counts',
      narration: 'From here, AI is used in exactly two places — where it does heavy synthesis a human cannot do at speed. Everything else stays human-driven.',
      dur: 8000 },
    { kind: 'tab',       to: 'map',                                dur: 500 },

    { kind: 'advance',   to: 'step1',                              dur: 700 },
    { kind: 'advance',   to: 'step2',                              dur: 700 },

    { kind: 'highlight', tag: 'AI HIGHLIGHT 1 / 2', text: 'AI surfaces 6 candidate risks — 2 previously missed by the team.',
      spotlight: 'node:step2',
      narration: 'First AI checkpoint — Identify Risks. AI mines prior cycles, audits, and incidents to surface six candidate risks, including two the team would have missed. The Cyber RCSA Lead validates each before it enters the register.',
      dur: 10000 },
    { kind: 'advance',   to: 'step3',                              dur: 600 },
    { kind: 'advance',   to: 'step4',                              dur: 600 },
    { kind: 'advance',   to: 'step5',                              dur: 600 },
    { kind: 'advance',   to: 'step6', via: 1,                      dur: 900 },
    { kind: 'advance',   to: 'step7',                              dur: 600 },
    { kind: 'advance',   to: 'step5', via: 0,                      dur: 800 },
    { kind: 'advance',   to: 'step8', via: 0,                      dur: 600 },
    { kind: 'advance',   to: 'step9', via: 0,                      dur: 600 },
    { kind: 'advance',   to: 'step10',                             dur: 700 },

    { kind: 'highlight', tag: 'AI HIGHLIGHT 2a / 2', text: 'Step 10 · Review 1 — AI challenges the submission in isolation.',
      spotlight: 'node:step10',
      narration: 'Second AI checkpoint, review one — AI challenges the submission in isolation, surfacing weak justifications and unexplained rating changes within this RCSA.',
      dur: 7500 },
    { kind: 'highlight', tag: 'AI HIGHLIGHT 2b / 2', text: 'Step 10 · Review 2 — AI compares against four peer team submissions.',
      spotlight: 'node:step10',
      narration: 'Review two — AI compares the submission against four peer team RCSAs and flags cross-team inconsistencies the reviewer needs to reconcile.',
      dur: 7500 },
    { kind: 'advance',   to: 'step11', via: 3,                     dur: 800 },
    { kind: 'advance',   to: 'step12',                             dur: 700 },

    { kind: 'tab',       to: 'report',                             dur: 800 },
    { kind: 'caption',   text: 'Findings Report — auto-generated with full role-attributed audit trail.',
      spotlight: 'report-stamp',
      narration: 'The platform auto-generates the Findings Report — every AI suggestion and every human decision attributed by role.',
      dur: 7500 },
    { kind: 'scroll',    to: 'middle',                             dur: 3000 },
    { kind: 'scroll',    to: 'bottom',                             dur: 3000 },
    { kind: 'caption',   text: 'AI where it counts. Humans decide. Every step auditable.',
      narration: 'AI accelerates the two steps where synthesis is the bottleneck. Humans hold every material decision. Every step, fully auditable.',
      dur: 6500 },
    { kind: 'end' }
  ];

  const demo = {
    running: false,
    timers: [],
    totalDur: 0,
    elapsed: 0,
    cancel: false,
    voiceEnabled: true,
    preferredVoice: null
  };

  // Browser TTS voice setup
  function loadVoice() {
    if (!window.speechSynthesis) return;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || !voices.length) return;
    demo.preferredVoice =
      voices.find(v => /Microsoft\s+(Aria|Jenny|Davis|Guy|Tony)/i.test(v.name)) ||
      voices.find(v => /Google.*US English/i.test(v.name)) ||
      voices.find(v => /^en-US$/i.test(v.lang)) ||
      voices.find(v => /^en/i.test(v.lang)) ||
      null;
  }
  if (window.speechSynthesis) {
    loadVoice();
    window.speechSynthesis.onvoiceschanged = loadVoice;
  }

  function speakNarration(text) {
    if (!demo.voiceEnabled || !window.speechSynthesis || !text) return;
    try { window.speechSynthesis.cancel(); } catch (e) {}
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    u.pitch = 1.0;
    u.volume = 1.0;
    if (demo.preferredVoice) u.voice = demo.preferredVoice;
    window.speechSynthesis.speak(u);
  }
  function stopSpeak() {
    if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) {} }
  }

  // Spotlight — red box drawing the eye to the highlighted element
  function applySpotlight(target) {
    clearSpotlight();
    if (!target) return;
    if (target.startsWith('node:')) {
      const id = target.slice(5);
      const node = document.querySelector(`.node[data-step-id="${id}"]`);
      if (node) node.classList.add('is-demo-spotlight');
    } else if (target === 'report-stamp') {
      const stamp = document.querySelector('.report-stamp');
      if (stamp) stamp.classList.add('is-demo-spotlight');
    }
  }
  function clearSpotlight() {
    document.querySelectorAll('.is-demo-spotlight').forEach(el => el.classList.remove('is-demo-spotlight'));
  }

  function totalDuration(script) {
    return script.reduce((s, c) => s + (c.dur || 0), 0);
  }

  function startDemo() {
    if (demo.running) return;
    demo.voiceEnabled = !!document.getElementById('demo-voice-cb').checked;
    demo.running = true;
    demo.cancel = false;
    demo.elapsed = 0;
    demo.totalDur = totalDuration(DEMO_SCRIPT);
    document.body.classList.add('is-demo-running');
    document.getElementById('demo-progress').classList.remove('is-hidden');
    document.getElementById('demo-stop').classList.remove('is-hidden');

    // Some browsers need a "warm-up" utterance to unlock TTS reliably.
    if (demo.voiceEnabled && window.speechSynthesis) {
      try {
        loadVoice();
        const warm = new SpeechSynthesisUtterance(' ');
        warm.volume = 0;
        window.speechSynthesis.speak(warm);
      } catch (e) {}
    }

    state = freshState();
    state.history = [];
    setPrereqChipVisible(false);
    hidePrereqModal();
    unlockShell();
    logAudit('system', 'Demo Mode started.');
    switchTab('map');
    renderAll();

    runDemoSequence();
  }

  function stopDemo(reason) {
    if (!demo.running) return;
    demo.cancel = true;
    demo.timers.forEach(t => { try { clearTimeout(t); } catch (e) {} try { clearInterval(t._); } catch (e) {} });
    demo.timers = [];
    demo.running = false;
    document.body.classList.remove('is-demo-running');
    hideHighlight(true);
    hideCaption(true);
    clearSpotlight();
    stopSpeak();
    document.getElementById('demo-stop').classList.add('is-hidden');
    const prog = document.getElementById('demo-progress');
    prog.classList.add('is-hidden');
    prog.querySelector('.demo-progress-bar').style.width = '0%';
    if (reason) logAudit('system', `Demo Mode ended (${reason}).`);
  }

  function delay(ms) {
    return new Promise(resolve => {
      const t = setTimeout(() => {
        demo.timers = demo.timers.filter(x => x !== t);
        resolve();
      }, ms);
      demo.timers.push(t);
    });
  }

  function tickProgress(stepDur) {
    const start = demo.elapsed;
    const end = demo.elapsed + stepDur;
    const t0 = performance.now();
    const bar = document.querySelector('#demo-progress .demo-progress-bar');
    const interval = setInterval(() => {
      if (demo.cancel) { clearInterval(interval); return; }
      const dt = performance.now() - t0;
      const cur = Math.min(start + dt, end);
      const pct = (cur / demo.totalDur) * 100;
      if (bar) bar.style.width = pct + '%';
      if (dt >= stepDur) clearInterval(interval);
    }, 100);
    demo.timers.push({ kind: 'interval', _: interval });
  }

  async function runDemoSequence() {
    for (let i = 0; i < DEMO_SCRIPT.length; i++) {
      if (demo.cancel) return;
      const cmd = DEMO_SCRIPT[i];
      const dur = cmd.dur || 0;
      tickProgress(dur);

      switch (cmd.kind) {
        case 'caption':
          if (cmd.spotlight) applySpotlight(cmd.spotlight);
          showCaption(cmd.text);
          if (cmd.narration) speakNarration(cmd.narration);
          await delay(dur);
          hideCaption();
          if (cmd.spotlight) clearSpotlight();
          break;
        case 'highlight':
          if (cmd.spotlight) applySpotlight(cmd.spotlight);
          showHighlight(cmd.tag || 'AI HIGHLIGHT', cmd.text);
          if (cmd.narration) speakNarration(cmd.narration);
          await delay(dur);
          hideHighlight();
          if (cmd.spotlight) clearSpotlight();
          break;
        case 'tab':
          switchTab(cmd.to);
          await delay(dur);
          break;
        case 'advance':
          demoAdvance(cmd.to, cmd.via);
          await delay(dur);
          break;
        case 'scroll':
          demoScroll(cmd.to);
          await delay(dur);
          break;
        case 'prereq-upload':
          // Demo mode auto-runs the singular prereq insertion: speak the
          // narration while the 5-section animation plays inside the modal,
          // then dismiss and continue.
          if (cmd.narration) speakNarration(cmd.narration);
          showPrereqModal({ summary: false });
          await ingestPack(SAMPLE_PACK_NAME);
          await delay(Math.max(0, dur - (PER_SECTION_MS * CHECKLIST_KEYS.length + 200) - 600));
          commitPrereqAndDismiss();
          await delay(600);
          break;
        case 'end':
          break;
      }
      demo.elapsed += dur;
    }
    if (!demo.cancel) {
      // Final flourish
      const bar = document.querySelector('#demo-progress .demo-progress-bar');
      if (bar) bar.style.width = '100%';
      await delay(800);
      stopDemo('completed');
    }
  }

  function demoAdvance(targetId, actionIdx) {
    const step = stepById[state.currentStepId];
    if (!step || !step.humanCheckpoint) return;
    let action = null;
    if (typeof actionIdx === 'number') {
      action = step.humanCheckpoint.actions[actionIdx];
    } else {
      action = step.humanCheckpoint.actions.find(a => a.target === targetId);
    }
    if (!action) {
      // Fallback: directly advance
      advanceTo(targetId);
      return;
    }
    handleHumanAction(step, action);
  }

  function demoScroll(target) {
    const view = document.getElementById('tab-report');
    if (!view) return;
    if (target === 'top')    view.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (target === 'middle') {
      const stamp = view.querySelector('.report-stamp');
      const target2 = view.querySelector('h2:nth-of-type(6)') || stamp;
      if (target2) target2.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (target === 'bottom') {
      const stamp = view.querySelector('.report-stamp');
      if (stamp) stamp.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function showHighlight(tag, text) {
    const el = document.getElementById('demo-highlight');
    el.classList.remove('is-leaving', 'is-hidden');
    el.innerHTML = `<span class="hl-tag">${escapeHtml(tag)}</span><span>${escapeHtml(text)}</span>`;
  }
  function hideHighlight(immediate) {
    const el = document.getElementById('demo-highlight');
    if (immediate) { el.classList.add('is-hidden'); return; }
    el.classList.add('is-leaving');
    const t = setTimeout(() => { el.classList.add('is-hidden'); el.classList.remove('is-leaving'); }, 220);
    demo.timers.push(t);
  }
  function showCaption(text) {
    const el = document.getElementById('demo-caption');
    el.classList.remove('is-hidden');
    el.textContent = text;
  }
  function hideCaption(immediate) {
    const el = document.getElementById('demo-caption');
    if (immediate) el.classList.add('is-hidden');
    else el.classList.add('is-hidden');
  }

  document.getElementById('demo-btn').addEventListener('click', startDemo);
  document.getElementById('demo-stop-btn').addEventListener('click', () => stopDemo('user stopped'));

  const autoBtn = document.getElementById('autopilot-btn');
  if (autoBtn) autoBtn.addEventListener('click', () => { runAutoPilot(); });
  const autoStopBtn = document.getElementById('autopilot-stop-btn');
  if (autoStopBtn) autoStopBtn.addEventListener('click', () => stopAutoPilot('user stopped'));

  // ---------- Workflow chat widget ----------
  // Floating button + slide-up panel for asking the configured LLM gateway
  // questions about this RCSA workflow. Grounded in the static workflow
  // definition, the loaded prereq context, and the user's current state
  // (active step, decisions taken so far). Messages are session-only —
  // closing the tab clears the conversation.

  const chatState = { messages: [], sending: false };

  function initChatWidget() {
    const fab    = document.getElementById('chat-fab');
    const panel  = document.getElementById('chat-panel');
    const close  = document.getElementById('chat-close-btn');
    const clear  = document.getElementById('chat-clear-btn');
    const form   = document.getElementById('chat-form');
    const input  = document.getElementById('chat-input');
    const send   = document.getElementById('chat-send');
    if (!fab || !panel || !form || !input || !send) return;

    refreshChatFabAvailability();

    fab.addEventListener('click', () => {
      if (fab.disabled) return;
      panel.classList.remove('is-hidden');
      fab.classList.add('is-hidden');
      input.focus();
      refreshChatSendEnabled();
    });
    close.addEventListener('click', () => {
      panel.classList.add('is-hidden');
      fab.classList.remove('is-hidden');
    });
    clear.addEventListener('click', () => {
      chatState.messages = [];
      renderChatMessages();
    });

    input.addEventListener('input', refreshChatSendEnabled);
    input.addEventListener('keydown', (e) => {
      // Enter to send, Shift+Enter for newline.
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!send.disabled) form.requestSubmit();
      }
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!send.disabled) chatSend();
    });

    renderChatMessages();
  }

  function refreshChatFabAvailability() {
    const fab = document.getElementById('chat-fab');
    if (!fab) return;
    const live = !!(window.AIClient && window.AIClient.isLive && window.AIClient.isLive());
    fab.disabled = !live;
    fab.title = live
      ? 'Ask the LLM about this workflow'
      : 'Configure ⚙ API (gateway URL + key) to enable chat';
  }

  function refreshChatSendEnabled() {
    const input = document.getElementById('chat-input');
    const send  = document.getElementById('chat-send');
    if (!input || !send) return;
    const live  = !!(window.AIClient && window.AIClient.isLive && window.AIClient.isLive());
    const hasText = !!input.value.trim();
    send.disabled = chatState.sending || !live || !hasText;
  }

  // Compact summary of the workflow used as the system prompt's static spine.
  // Hand-authored so the LLM has a clean reference even if it doesn't see
  // workflow.js. Updated alongside any structural change to the workflow.
  const CHAT_WORKFLOW_DIGEST = `
WORKFLOW: AI-Enabled Cyber RCSA (12 steps + Trigger). Source-of-truth is cyber_rcsa_process_flow.md.
LANES: System / Data · Business / 1LOD · Risk / 2LOD · Monitoring / Audit.
AI FOOTPRINT: only Step 2 (Identify Risks) and Step 10 (2LOD Check & Challenge — runs TWO reviews:
  Review 1 Internal Challenge + Review 2 Peer Comparison). All other steps are process or decision-only.

STEPS:
- Trigger Event (System lane): receives signal (scheduled cycle, incident, audit finding, biz/tech/reg change). Cyber RCSA Lead, 1LOD picks Full / Partial / No RCSA.
- Step 1 Define Scope (1LOD): Application Owner confirms scope.
- Step 2 Identify Risks (1LOD, **AI**): Cyber RCSA Lead validates AI-proposed risks.
- Step 3 Assess Risk (1LOD): Cyber RCSA Lead assigns inherent rating (likelihood × impact).
- Step 4 Evaluate Controls (1LOD): IAM Lead evaluates controls mapped to each risk.
- Step 5 Control Test (1LOD, decision): IAM Lead. YES (effective) → Step 8. NO (gaps) → Step 6.
- Step 6 Identify Gaps (1LOD): Cyber RCSA Lead clusters failed controls into gaps.
- Step 7 Remediation Plan (1LOD, decision): YES (fixes done, retest) → Step 5. NO (still working) → stay.
- Step 8 Residual Risk (1LOD, decision): YES (acceptable) → Step 9. NO → Step 6.
- Step 9 Submit RCSA (1LOD): Cyber RCSA Lead submits to 2LOD.
- Step 10 2LOD Check & Challenge (2LOD, **AI ×2**, decision): Cyber Risk Officer.
    Review 1 Internal Challenge: surface unexplained rating changes / weak justifications / missing evidence.
    Review 2 Peer Comparison: vs LENDING-CORE, FRAUD-CORE, MOBILE-AUTH, TREASURY-OPS — flag inconsistencies, missed peer-baseline risks, residual divergence from peer median.
    Issues found → return to Step 7 / 8 / 9. No issues → Step 11.
- Step 11 Approve / Validate (2LOD): Head of Cyber Risk Governance signs.
- Step 12 Monitoring & Review (Monitoring, decision): Cyber RCSA Lead. New cycle trigger → Trigger.

LOOP-BACKS: Step 5↔6 (NO branch) · 7→5 (retest) · 7→7 (stay) · 8→6 (NO acceptable) · 10→{7,8,9} (issues) · 12→Trigger (new cycle).

ROLES (locked set):
Trigger / Step 2/3/6/9/12: Cyber RCSA Lead, 1LOD.
Step 1: Application Owner, 1LOD.
Step 4/5: Control Owner — IAM Lead, 1LOD.
Step 7: Remediation Owners (1LOD), approval Cyber RCSA Lead.
Step 8: Application Owner + Cyber RCSA Lead, 1LOD.
Step 10: Cyber Risk Officer, 2LOD.
Step 11: Head of Cyber Risk Governance, 2LOD.
`.trim();

  function buildChatSystemPrompt() {
    const ctx = state.prereq && state.prereq.context;
    const stepLabel = (stepById[state.currentStepId] && stepById[state.currentStepId].label) || state.currentStepId;
    const visited = Array.from(state.visited || []).join(', ');
    const decisions = (state.decisions || []).map(d =>
      `  ${d.ts} · ${d.stepLabel} · ${d.actor} → ${d.label}`
    ).join('\n') || '  (no decisions yet)';

    const ctxBlock = ctx
      ? `PREREQUISITES PACK (loaded · cycle ${ctx.cycleId || 'unknown'}):\n${JSON.stringify(ctx)}`
      : 'PREREQUISITES PACK: (not yet loaded)';

    return [
      'You are a workflow assistant for an AI-enabled Cyber RCSA demo.',
      'Answer ONLY about this RCSA workflow, the AI checkpoints, the current cycle state, and the loaded Prerequisites Pack.',
      'Be concise — usually 1–3 short paragraphs. Use bullet lists when the answer is a list. Cite step numbers, control IDs, and risk IDs precisely.',
      'If the user asks about something not in the workflow definition or the loaded pack, say so plainly rather than inventing details.',
      '',
      CHAT_WORKFLOW_DIGEST,
      '',
      'CURRENT CYCLE STATE:',
      `- Active step: ${stepLabel}`,
      `- Steps visited so far: ${visited || '(none)'}`,
      `- Decisions taken:\n${decisions}`,
      `- Approved at Step 11: ${state.approved ? 'yes' : 'not yet'}`,
      `- Cycle terminated: ${state.terminated ? 'yes' : 'no'}`,
      '',
      ctxBlock
    ].join('\n');
  }

  async function chatSend() {
    const input = document.getElementById('chat-input');
    const send  = document.getElementById('chat-send');
    if (!input || !send) return;
    const text = input.value.trim();
    if (!text || chatState.sending) return;
    if (!window.AIClient || !window.AIClient.isLive || !window.AIClient.isLive()) {
      showToast('Configure your gateway in ⚙ API first.', true);
      return;
    }

    chatState.messages.push({ role: 'user', content: text });
    input.value = '';
    chatState.sending = true;
    refreshChatSendEnabled();
    renderChatMessages();
    showChatTyping();

    try {
      const result = await window.AIClient.callClaude({
        system:   buildChatSystemPrompt(),
        messages: chatState.messages.map(m => ({ role: m.role, content: m.content })),
        maxTokens: 700
      });
      chatState.messages.push({
        role: 'assistant',
        content: result.text || '(no response)',
        _model: result.model || null
      });
    } catch (err) {
      const reason = err && err.message ? err.message : String(err);
      chatState.messages.push({
        role: 'assistant',
        content: `Could not reach the LLM gateway: ${reason}`,
        _error: true
      });
    } finally {
      chatState.sending = false;
      hideChatTyping();
      renderChatMessages();
      refreshChatSendEnabled();
      input.focus();
    }
  }

  function renderChatMessages() {
    const list = document.getElementById('chat-messages');
    if (!list) return;
    const intro = `<div class="chat-msg chat-msg-system">Ask anything about this RCSA workflow — the steps, the AI checkpoints, current state, what a control or risk means, why a decision routed somewhere, etc.</div>`;
    const items = chatState.messages.map(m => {
      let cls = 'chat-msg ';
      if (m._error)             cls += 'chat-msg-error';
      else if (m.role === 'user')      cls += 'chat-msg-user';
      else                              cls += 'chat-msg-assistant';
      const attribution = (!m._error && m.role === 'assistant' && m._model)
        ? `<div class="chat-msg-attribution">${escapeHtml(m._model)}</div>`
        : '';
      return `<div class="${cls}">${escapeHtml(m.content)}${attribution}</div>`;
    }).join('');
    list.innerHTML = intro + items;
    list.scrollTop = list.scrollHeight;
  }

  function showChatTyping() {
    const list = document.getElementById('chat-messages');
    if (!list) return;
    if (document.getElementById('chat-typing')) return;
    const el = document.createElement('div');
    el.id = 'chat-typing';
    el.className = 'chat-typing';
    el.innerHTML = '<span class="chat-typing-dot"></span><span class="chat-typing-dot"></span><span class="chat-typing-dot"></span><span>Thinking…</span>';
    list.appendChild(el);
    list.scrollTop = list.scrollHeight;
  }
  function hideChatTyping() {
    const el = document.getElementById('chat-typing');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  // Init
  buildSwimlanes();
  initAiSettingsModal();
  initPrereqModal();
  initChatWidget();
  showPrereqModal({ summary: false });
  logAudit('system', 'RCSA orchestration initialized. Awaiting Prerequisites Pack.');
  renderAll();
})();

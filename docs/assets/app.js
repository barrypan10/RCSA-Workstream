// Cyber RCSA — simulation engine and renderer (v2).
// Reads workflow definition from window.__RCSA__ (workflow.js).

(function () {
  const { LANES, STAGES, STEPS, EDGES } = window.__RCSA__;

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
      aiResults: {}                  // stepId -> 'idle' | 'thinking' | 'done'
    };
  }
  let state = freshState();

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

    const isAi = step.type === 'ai-assisted' || (step.aiActions && step.aiActions.length > 0);
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
    const isAi = step.type === 'ai-assisted' || (step.aiActions && step.aiActions.length > 0);

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

  function handleHumanAction(step, action) {
    const ts = nowTs();
    state.decisions.push({ stepId: step.id, stepLabel: step.label, label: action.label, actor: step.humanCheckpoint.actor, ts });
    logAudit('human', `[${step.humanCheckpoint.actor}] → ${action.label} (at ${step.label})`);

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
    if (targetId === 'trigger') {
      logAudit('system', 'New RCSA cycle initiated.');
    } else {
      logAudit('system', `Entered ${stepById[targetId].label}.`);
    }
    renderAll();
  }

  // ---------- AI animation ----------
  function runAi(step) {
    const slot = document.getElementById('ai-output-slot');
    if (!slot) return;
    const memoKey = step.id;
    if (state.aiResults[memoKey] === 'done') { showAiOutputImmediate(step); return; }
    state.aiResults[memoKey] = 'thinking';
    slot.innerHTML = `<div class="ai-thinking"><div class="spinner"></div> AI is analyzing inputs…</div>`;
    logAudit('ai', `Analyzing inputs at ${step.label}…`);
    const delay = 900 + Math.random() * 700;
    setTimeout(() => {
      if (state.currentStepId !== step.id) return;
      state.aiResults[memoKey] = 'done';
      slot.innerHTML = renderAiOutputBody(step);
      const regen = slot.querySelector('.ai-regen');
      if (regen) regen.addEventListener('click', () => { state.aiResults[memoKey] = 'idle'; runAi(step); });
      if (step.aiOutput) logAudit('ai', `${step.aiOutput.title}: ${stripTags(step.aiOutput.lead)}`);
    }, delay);
  }

  function showAiOutputImmediate(step) {
    const slot = document.getElementById('ai-output-slot');
    if (!slot) return;
    state.aiResults[step.id] = 'done';
    slot.innerHTML = renderAiOutputBody(step);
    const regen = slot.querySelector('.ai-regen');
    if (regen) regen.addEventListener('click', () => { state.aiResults[step.id] = 'idle'; runAi(step); });
  }

  function renderAiOutputBody(step) {
    if (!step.aiOutput) return `<div class="ai-thinking" style="color:var(--c-text-mute)">No structured output for this step.</div>`;
    const o = step.aiOutput;
    const bullets = (o.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join('');
    return `
      <div class="ai-output">
        <div class="verdict">${escapeHtml(o.verdict || 'AI Output')}</div>
        <p class="lead">${o.lead}</p>
        ${bullets ? `<ul>${bullets}</ul>` : ''}
        <button class="ai-regen" type="button">↻ Regenerate</button>
      </div>
    `;
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
    const rows = a.map(f => `
      <div class="attach-row">
        <div class="attach-icon">${escapeHtml(extLabel(f))}</div>
        <div class="attach-name">${escapeHtml(f.name)}</div>
        <div class="attach-meta">${escapeHtml(f.size || '')}</div>
      </div>
    `).join('');
    return `
      <section class="detail-card">
        <div class="detail-card-head">Attachments (${a.length})</div>
        <div class="detail-card-body"><div class="attach-list">${rows}</div></div>
      </section>
    `;
  }

  function extLabel(file) {
    if (file.kind === 'data')  return 'CSV';
    if (file.kind === 'image') return 'IMG';
    const m = /\.([a-z0-9]+)$/i.exec(file.name);
    return m ? m[1].toUpperCase() : 'FILE';
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
          <div class="k">Trigger</div><div>${escapeHtml((triggerStep.aiOutput && stripTags(triggerStep.aiOutput.lead)) || '—')}</div>
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

        <h2>8. Pre-Submission QC (resolved)</h2>
        ${tableFromWorkItems(submission.workItems)}

        <h2>9. 2LOD Check &amp; Challenge</h2>
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
        <div class="owner">Cyber RCSA Lead rejected the AI triage recommendation. Rationale recorded in audit trail.</div>
      </div>
      <div class="panel-body">
        <div class="terminate-banner">
          <strong>Continuing in monitoring posture.</strong><br>
          Continuous monitoring (Step 12) remains active. AI will resurface a new trigger recommendation if KRIs, SIEM signals, or audit findings cross threshold.
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
  document.getElementById('reset-btn').addEventListener('click', () => {
    state = freshState();
    logAudit('system', 'Simulation reset.');
    switchTab('map');
    renderAll();
  });

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

  // ---------- Demo Mode ----------
  // 90-second guided walkthrough that auto-advances the workflow with
  // on-screen "AI HIGHLIGHT" callouts at every AI-augmented step.

  const DEMO_SCRIPT = [
    { kind: 'caption',   text: 'Cyber RCSA — AI-Enabled Workflow',
      narration: 'Cyber RCSA today is manual, fragmented, and slow. This is what an AI-enabled workflow looks like.',
      dur: 7000 },
    { kind: 'tab',       to: 'map',                                dur: 500 },

    { kind: 'highlight', tag: 'AI HIGHLIGHT 1 / 7', text: 'AI auto-triages the trigger and recommends Full RCSA scope.',
      spotlight: 'node:trigger',
      narration: 'It starts with a trigger. AI auto-triages and recommends the right RCSA scope. The Cyber RCSA Lead approves.',
      dur: 8000 },
    { kind: 'advance',   to: 'step1',                              dur: 800 },
    { kind: 'advance',   to: 'step2',                              dur: 700 },

    { kind: 'highlight', tag: 'AI HIGHLIGHT 2 / 7', text: 'AI surfaces 6 candidate risks — 2 previously missed by the team.',
      spotlight: 'node:step2',
      narration: 'AI mines prior cycles, audits, and incidents to surface six candidate risks — two previously missed.',
      dur: 7500 },
    { kind: 'advance',   to: 'step3',                              dur: 700 },
    { kind: 'advance',   to: 'step4',                              dur: 700 },
    { kind: 'advance',   to: 'step5',                              dur: 700 },

    { kind: 'highlight', tag: 'AI HIGHLIGHT 3 / 7', text: 'AI flags 3 ineffective controls and 1 with missing evidence.',
      spotlight: 'node:step5',
      narration: 'In control testing, AI flags three ineffective controls and one with missing evidence.',
      dur: 6500 },
    { kind: 'advance',   to: 'step6', via: 1,                      dur: 900 },

    { kind: 'highlight', tag: 'AI HIGHLIGHT 4 / 7', text: 'AI clusters gaps and drafts JIRA + ServiceNow tickets — owners auto-assigned from CMDB.',
      spotlight: 'node:step6',
      narration: 'AI clusters the gaps, then drafts JIRA tickets and a ServiceNow change — with owners auto-assigned from the CMDB.',
      dur: 8500 },
    { kind: 'advance',   to: 'step7',                              dur: 700 },
    { kind: 'advance',   to: 'step5', via: 0,                      dur: 800 },
    { kind: 'advance',   to: 'step8', via: 0,                      dur: 700 },
    { kind: 'advance',   to: 'step9', via: 0,                      dur: 700 },

    { kind: 'highlight', tag: 'AI HIGHLIGHT 5 / 7', text: 'AI pre-submission QC — flags weak items before 2LOD review.',
      spotlight: 'node:step9',
      narration: 'Pre-submission, AI runs quality control — catching weak items before 2LOD ever sees the package.',
      dur: 7000 },
    { kind: 'advance',   to: 'step10',                             dur: 800 },

    { kind: 'highlight', tag: 'AI HIGHLIGHT 6 / 7', text: 'AI 2LOD challenge brief — outliers detected vs. peer apps.',
      spotlight: 'node:step10',
      narration: 'At 2LOD, AI generates the challenge brief — surfacing outliers and unexplained rating changes.',
      dur: 6500 },
    { kind: 'advance',   to: 'step11', via: 3,                     dur: 800 },
    { kind: 'advance',   to: 'step12',                             dur: 800 },

    { kind: 'highlight', tag: 'AI HIGHLIGHT 7 / 7', text: 'AI continuous monitoring — KRI breach detected, recommends a new cycle.',
      spotlight: 'node:step12',
      narration: 'And it does not stop at approval. AI continuously monitors KRIs and SIEM signals.',
      dur: 6500 },

    { kind: 'tab',       to: 'report',                             dur: 800 },
    { kind: 'caption',   text: 'Findings Report — auto-generated with full role-attributed audit trail.',
      spotlight: 'report-stamp',
      narration: 'The platform auto-generates a complete Findings Report — every AI suggestion and every human decision attributed by role.',
      dur: 8000 },
    { kind: 'scroll',    to: 'middle',                             dur: 3000 },
    { kind: 'scroll',    to: 'bottom',                             dur: 3000 },
    { kind: 'caption',   text: 'AI accelerates. Humans decide. Every step auditable.',
      narration: 'AI accelerates every bottleneck. Humans hold every material decision. Every step, fully auditable.',
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
    logAudit('system', 'Demo Mode started — 90-second guided walkthrough.');
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

  // Init
  buildSwimlanes();
  logAudit('system', 'RCSA orchestration initialized at Trigger Event.');
  renderAll();
})();

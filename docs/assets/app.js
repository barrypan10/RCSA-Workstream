// Cyber RCSA — simulation engine and renderer.
// Reads workflow definition from window.__RCSA__ (workflow.js).
// Renders the swimlane diagram, the step-detail panel, and the audit trail,
// and drives the click-through simulation per File 1 routing.

(function () {
  const { LANES, STEPS, EDGES } = window.__RCSA__;

  // ---------- Geometry ----------
  const COL_W = 200;
  const LANE_H = 132;
  const NODE_W = 168;
  const NODE_H = 92;
  const NODE_X_PAD = (COL_W - NODE_W) / 2;
  const NODE_Y_PAD = (LANE_H - NODE_H) / 2;
  const LABEL_W = 180;
  const LOOP_CHANNEL_GAP = 30;

  const stepById = Object.fromEntries(STEPS.map(s => [s.id, s]));
  const laneIndex = Object.fromEntries(LANES.map((l, i) => [l.id, i]));
  const maxCol = Math.max(...STEPS.map(s => s.col));
  const trackWidth = (maxCol + 1) * COL_W;
  const totalLaneHeight = LANES.length * LANE_H;
  const overlayHeight = totalLaneHeight + LOOP_CHANNEL_GAP * 2;

  function nodePos(step) {
    const li = laneIndex[step.lane];
    const x = step.col * COL_W + NODE_X_PAD;
    const y = li * LANE_H + NODE_Y_PAD;
    return {
      x, y,
      left: x,
      right: x + NODE_W,
      top: y,
      bottom: y + NODE_H,
      cx: x + NODE_W / 2,
      cy: y + NODE_H / 2
    };
  }

  // ---------- State ----------
  function freshState() {
    return {
      currentStepId: 'trigger',
      history: [],            // { ts, actor: 'ai'|'human'|'system', message }
      visited: new Set(['trigger']),
      traversedEdges: new Set(),
      terminated: false,
      aiResults: {}           // stepId -> 'thinking' | 'done'
    };
  }
  let state = freshState();

  // ---------- Build swimlane (one-time) ----------
  function buildSwimlanes() {
    const root = document.getElementById('swimlanes');
    root.innerHTML = '';
    root.style.width = (LABEL_W + trackWidth) + 'px';
    root.style.height = (overlayHeight + 8) + 'px';

    // Lanes (background stripes + sticky labels)
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

    // Overlay sits to the right of labels and spans all lanes + loop-back channel
    const overlay = document.createElement('div');
    overlay.id = 'overlay';
    overlay.style.cssText = `position:absolute; left:${LABEL_W}px; top:0; width:${trackWidth}px; height:${overlayHeight}px; pointer-events:none;`;

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

    // Render edges first (under nodes)
    EDGES.forEach((edge, i) => renderEdge(svg, edge, i));

    // Nodes layer
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

    let d, labelX, labelY;
    const isLoop = edge.type === 'loopback';
    const colDelta = b.col - a.col;
    const sameLane = a.lane === b.lane;
    const goesBackward = colDelta < 0;

    if (goesBackward) {
      // Route via channel below all lanes
      const baseChannel = totalLaneHeight + 4;
      const stagger = (idx % 5) * 6;
      const channel = baseChannel + stagger;
      const startX = pa.cx;
      const startY = pa.bottom;
      const endX = pb.cx;
      const endY = pb.bottom;
      d = `M ${startX} ${startY} V ${channel} H ${endX} V ${endY}`;
      labelX = (startX + endX) / 2;
      labelY = channel - 6;
    } else if (sameLane && colDelta === 1) {
      // Adjacent same-lane forward: straight horizontal at center
      const startX = pa.right, startY = pa.cy, endX = pb.left, endY = pb.cy;
      d = `M ${startX} ${startY} H ${endX}`;
      labelX = (startX + endX) / 2;
      labelY = startY - 8;
    } else if (sameLane && colDelta > 1) {
      // Skip edge: arc above intermediate nodes
      const startX = pa.cx, startY = pa.top;
      const endX = pb.cx, endY = pb.top;
      const peak = Math.max(8, startY - 22);
      d = `M ${startX} ${startY} V ${peak} H ${endX} V ${endY}`;
      labelX = (startX + endX) / 2;
      labelY = peak - 6;
    } else {
      // Cross-lane forward: simple elbow
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
      // background rect for label legibility
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

    el.innerHTML = `
      <div class="node-head">${escapeHtml(laneShortLabel(step.lane))}</div>
      <div class="node-title">${escapeHtml(step.short || step.label)}</div>
      <div class="node-badges">${badges.join('')}</div>
    `;

    el.addEventListener('click', () => {
      // Allow user to inspect any visited or current step in the panel.
      // Advancement still requires using the checkpoint actions in the panel.
      if (state.visited.has(step.id) || step.id === state.currentStepId) {
        renderPanel(step.id, /*readOnly*/ step.id !== state.currentStepId);
      }
    });

    layer.appendChild(el);
  }

  function laneShortLabel(laneId) {
    return ({ SYSTEM: 'System / Data', '1LOD': '1LOD', '2LOD': '2LOD', MONITORING: 'Monitoring' })[laneId] || laneId;
  }

  // ---------- State-driven rendering ----------
  function renderAll() {
    updateNodeStates();
    updateEdgeStates();
    if (state.terminated) {
      renderTerminatePanel();
    } else {
      renderPanel(state.currentStepId, false);
    }
    renderAudit();
    renderStatePill();
  }

  function updateNodeStates() {
    const layer = document.getElementById('nodes-layer');
    if (!layer) return;
    layer.querySelectorAll('.node').forEach(n => {
      const id = n.dataset.stepId;
      n.classList.remove('is-active', 'is-completed', 'is-pending');
      if (state.terminated) {
        n.classList.add('is-pending');
        return;
      }
      if (id === state.currentStepId) n.classList.add('is-active');
      else if (state.visited.has(id)) n.classList.add('is-completed');
      else n.classList.add('is-pending');
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
    if (state.terminated) {
      pill.textContent = 'Cycle terminated · monitoring';
      return;
    }
    const s = stepById[state.currentStepId];
    pill.textContent = `In progress · ${s.label}`;
  }

  // ---------- Panel ----------
  function renderPanel(stepId, readOnly) {
    const step = stepById[stepId];
    const panel = document.getElementById('panel');

    const isAi = step.type === 'ai-assisted' || (step.aiActions && step.aiActions.length > 0);

    panel.innerHTML = `
      <div class="panel-head">
        <div class="crumb">${escapeHtml(laneFullLabel(step.lane))}${readOnly ? ' · read-only' : ''}</div>
        <h1>${escapeHtml(step.label)}</h1>
        <div class="owner">${escapeHtml(step.summary)}</div>
      </div>
      <div class="panel-body">
        ${isAi ? renderAiCard(step, readOnly) : ''}
        ${step.humanCheckpoint ? renderHumanCard(step, readOnly) : ''}
      </div>
    `;

    if (isAi && !readOnly) runAi(step);
    if (isAi && readOnly) showAiOutputImmediate(step);
  }

  function laneFullLabel(laneId) {
    const lane = LANES.find(l => l.id === laneId);
    return lane ? lane.label : laneId;
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

  function renderHumanCard(step, readOnly) {
    const cp = step.humanCheckpoint;
    const actions = readOnly
      ? `<button class="btn btn-muted" disabled>Read-only · use current step to advance</button>`
      : cp.actions.map((a, i) =>
          `<button class="btn btn-${a.tone}" data-action-idx="${i}">${escapeHtml(a.label)}</button>`
        ).join('');

    return `
      <section class="card human">
        <div class="card-head"><span class="tag">HUMAN</span> Human Checkpoint</div>
        <div class="checkpoint-actor">${escapeHtml(cp.actor)}</div>
        <div class="checkpoint-prompt">${escapeHtml(cp.prompt)}</div>
        <div class="checkpoint-actions">${actions}</div>
      </section>
    `;
  }

  // After renderPanel, attach handlers for human action buttons
  document.addEventListener('click', e => {
    const btn = e.target.closest('.checkpoint-actions .btn[data-action-idx]');
    if (!btn) return;
    const stepId = state.currentStepId;
    const step = stepById[stepId];
    if (!step.humanCheckpoint) return;
    const idx = parseInt(btn.dataset.actionIdx, 10);
    const action = step.humanCheckpoint.actions[idx];
    if (!action) return;
    handleHumanAction(step, action);
  });

  function handleHumanAction(step, action) {
    logAudit('human', `${step.humanCheckpoint.actor} → ${action.label} (at ${step.label})`);
    if (action.target === 'terminate') {
      state.terminated = true;
      logAudit('system', 'RCSA cycle terminated. Continuing in monitoring posture.');
      renderAll();
      return;
    }
    advanceTo(action.target, /*reason*/ action.label);
  }

  function advanceTo(targetId, reason) {
    const fromId = state.currentStepId;
    const edgeKey = `${fromId}__${targetId}`;
    state.traversedEdges.add(edgeKey);
    state.currentStepId = targetId;
    state.visited.add(targetId);
    // Clear AI memo for the entered step so revisits trigger a fresh AI run.
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
    if (state.aiResults[memoKey] === 'done') {
      // Already produced output earlier in this session; show it without re-thinking.
      showAiOutputImmediate(step);
      return;
    }
    state.aiResults[memoKey] = 'thinking';
    slot.innerHTML = `<div class="ai-thinking"><div class="spinner"></div> AI is analyzing inputs…</div>`;
    logAudit('ai', `Analyzing inputs at ${step.label}…`);
    const delay = 900 + Math.random() * 700;
    setTimeout(() => {
      // If the user advanced past this step before AI finished, do nothing.
      if (state.currentStepId !== step.id) return;
      state.aiResults[memoKey] = 'done';
      slot.innerHTML = renderAiOutputBody(step);
      const regen = slot.querySelector('.ai-regen');
      if (regen) regen.addEventListener('click', () => {
        state.aiResults[memoKey] = 'idle';
        runAi(step);
      });
      if (step.aiOutput) {
        logAudit('ai', `${step.aiOutput.title}: ${stripTags(step.aiOutput.lead)}`);
      } else {
        logAudit('ai', `Suggestions surfaced at ${step.label}.`);
      }
    }, delay);
  }

  function showAiOutputImmediate(step) {
    const slot = document.getElementById('ai-output-slot');
    if (!slot) return;
    state.aiResults[step.id] = 'done';
    slot.innerHTML = renderAiOutputBody(step);
    const regen = slot.querySelector('.ai-regen');
    if (regen) regen.addEventListener('click', () => {
      state.aiResults[step.id] = 'idle';
      runAi(step);
    });
  }

  function renderAiOutputBody(step) {
    if (!step.aiOutput) {
      return `<div class="ai-thinking" style="color:var(--c-text-mute)">No structured output for this step.</div>`;
    }
    const o = step.aiOutput;
    const bullets = (o.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join('');
    return `
      <div class="ai-output">
        <div class="verdict">${escapeHtml(o.verdict || 'AI Output')}</div>
        <p class="lead">${o.lead /* trusted: defined in workflow.js */}</p>
        ${bullets ? `<ul>${bullets}</ul>` : ''}
        <button class="ai-regen" type="button">↻ Regenerate</button>
      </div>
    `;
  }

  // ---------- Audit trail ----------
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
    list.innerHTML = state.history
      .slice()
      .reverse()
      .map(e => `
        <div class="audit-row">
          <span class="ts">${e.ts}</span>
          <span class="actor ${e.actor}">${actorLabel(e.actor)}</span>
          <span class="msg">${escapeHtml(e.message)}</span>
        </div>
      `).join('');
  }

  function actorLabel(a) {
    return { ai: 'AI', human: 'HUMAN', system: 'SYSTEM' }[a] || a.toUpperCase();
  }

  // ---------- Terminate panel ----------
  function renderTerminatePanel() {
    const panel = document.getElementById('panel');
    panel.innerHTML = `
      <div class="panel-head">
        <div class="crumb">RCSA cycle</div>
        <h1>No RCSA initiated</h1>
        <div class="owner">Risk Owner rejected the AI triage recommendation. Rationale recorded in audit trail.</div>
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
      state.visited.add('step12');
      logAudit('system', 'Jumped to Monitoring & Review (Step 12).');
      renderAll();
    });
  }

  // ---------- Helpers ----------
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function stripTags(s) {
    return String(s || '').replace(/<[^>]*>/g, '');
  }
  function nowTs() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  // ---------- Wiring ----------
  document.getElementById('reset-btn').addEventListener('click', () => {
    state = freshState();
    logAudit('system', 'Simulation reset.');
    renderAll();
  });

  // Audit collapse toggle
  const auditEl = document.getElementById('audit');
  document.getElementById('audit-head').addEventListener('click', () => {
    auditEl.classList.toggle('collapsed');
    document.getElementById('audit-toggle').textContent = auditEl.classList.contains('collapsed') ? '▸' : '▾';
  });

  // Init
  buildSwimlanes();
  logAudit('system', 'RCSA orchestration initialized at Trigger Event.');
  renderAll();
})();

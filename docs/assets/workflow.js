// Cyber RCSA workflow definition.
// Source of truth: cyber_rcsa_process_flow.md (File 1).
// Steps, decisions, and routing here mirror File 1 exactly.

const LANES = [
  { id: 'SYSTEM',     label: 'System / Data',       sublabel: 'ServiceNow · Archer / Risk360 · CMDB · SharePoint' },
  { id: '1LOD',       label: 'Business / 1LOD',     sublabel: 'RCSA execution · Risk & control ownership · Remediation' },
  { id: '2LOD',       label: 'Risk / 2LOD',         sublabel: 'Independent review · Check & challenge · Approval' },
  { id: 'MONITORING', label: 'Monitoring / Audit',  sublabel: 'KRIs · SIEM (Splunk / Sentinel) · Audit signals' }
];

const STEPS = [
  {
    id: 'trigger',
    label: 'Trigger Event',
    short: 'Trigger',
    lane: 'SYSTEM',
    col: 0,
    type: 'ai-assisted',
    summary: 'A signal initiates the RCSA cycle: scheduled cadence, cyber incident, audit finding, business or technology change, or regulatory change.',
    aiActions: [
      'Classify the trigger source and severity',
      'Recommend Full / Partial / No RCSA',
      'Surface related prior findings, open gaps, SIEM context'
    ],
    aiOutput: {
      title: 'AI Triage Recommendation',
      lead: 'Detected: scheduled annual cycle + correlated SIEM alert cluster on app group <strong>PAYMENTS-CORE</strong>. Two open remediations carried over from prior cycle.',
      verdict: 'Recommendation: Full RCSA',
      bullets: [
        'Trigger source: scheduled cycle + Splunk anomaly cluster (14d window)',
        'Open prior gaps: 2 — CTRL-IAM-04, CTRL-LOG-11',
        'Suggested scope: PAYMENTS-CORE cluster, IAM domain, logging controls'
      ]
    },
    humanCheckpoint: {
      actor: 'Risk Owner (1LOD)',
      prompt: 'Accept AI triage recommendation?',
      actions: [
        { label: 'Accept — Initiate Full RCSA', target: 'step1',     tone: 'primary' },
        { label: 'Reject — Document & Monitor', target: 'terminate', tone: 'muted'   }
      ]
    }
  },
  {
    id: 'step1',
    label: 'Step 1: Define Scope',
    short: 'Define Scope',
    lane: '1LOD',
    col: 1,
    type: 'process',
    summary: '1LOD defines RCSA scope — process, system, data, business area, risk domain, and regulatory drivers in scope.',
    aiActions: [],
    humanCheckpoint: {
      actor: '1LOD Process Owner',
      prompt: 'Confirm RCSA scope.',
      actions: [
        { label: 'Confirm scope & continue', target: 'step2', tone: 'primary' }
      ]
    }
  },
  {
    id: 'step2',
    label: 'Step 2: Identify Risks',
    short: 'Identify Risks',
    lane: '1LOD',
    col: 2,
    type: 'ai-assisted',
    summary: '1LOD identifies relevant cyber risks. AI summarizes prior RCSAs, risk memos, incidents, audit findings, and known control gaps to suggest risks and missed themes.',
    aiActions: [
      'Summarize prior RCSAs, incidents, audit findings, vulnerability records',
      'Propose candidate risks not present in current draft',
      'Highlight recurring themes across linked applications'
    ],
    aiOutput: {
      title: 'AI Risk Suggestions',
      lead: 'Reviewed: 3 prior RCSAs, 11 incidents (24mo), 4 open audit findings, CMDB ownership for PAYMENTS-CORE.',
      verdict: '6 candidate risks · 2 flagged as previously missed',
      bullets: [
        'Privileged access drift on payment processing servers (recurring across 2 prior cycles)',
        'Third-party API key rotation gap — flagged in 2024 audit, not previously RCSA-scoped',
        'Insufficient logging on legacy auth path — Splunk coverage incomplete',
        'Unpatched library in payment gateway component (vuln ID CVE-2025-####)',
        'Data classification drift on customer PII tables',
        'Backup encryption key custody — control owner ambiguity'
      ]
    },
    humanCheckpoint: {
      actor: 'Risk Owner (1LOD)',
      prompt: 'Validate AI-proposed risks before they enter the register.',
      actions: [
        { label: 'Accept all & continue', target: 'step3', tone: 'primary' },
        { label: 'Accept selected & continue', target: 'step3', tone: 'secondary' }
      ]
    }
  },
  {
    id: 'step3',
    label: 'Step 3: Assess Risk',
    short: 'Assess Risk',
    lane: '1LOD',
    col: 3,
    type: 'process',
    summary: '1LOD assesses identified risks — impact, likelihood, exposure, control dependency, and business criticality.',
    aiActions: [],
    humanCheckpoint: {
      actor: 'Risk Owner (1LOD)',
      prompt: 'Risk assessment complete?',
      actions: [
        { label: 'Submit assessment & continue', target: 'step4', tone: 'primary' }
      ]
    }
  },
  {
    id: 'step4',
    label: 'Step 4: Evaluate Controls',
    short: 'Evaluate Controls',
    lane: '1LOD',
    col: 4,
    type: 'process',
    summary: '1LOD evaluates controls mapped to each risk to determine whether existing controls are appropriately designed.',
    aiActions: [],
    humanCheckpoint: {
      actor: 'Control Owner (1LOD)',
      prompt: 'Control evaluation complete?',
      actions: [
        { label: 'Continue to control testing', target: 'step5', tone: 'primary' }
      ]
    }
  },
  {
    id: 'step5',
    label: 'Step 5: Control Test',
    short: 'Control Test',
    lane: '1LOD',
    col: 5,
    type: 'decision',
    summary: '1LOD tests mapped controls to determine operating effectiveness. AI assists by identifying failed results, missing evidence, and potential remediation needs.',
    aiActions: [
      'Identify failed control test results',
      'Flag missing or weak evidence artifacts',
      'Surface recurring failure patterns vs. prior cycles'
    ],
    aiOutput: {
      title: 'AI Test Result Summary',
      lead: '12 controls tested · 9 effective · 3 ineffective · 1 with insufficient evidence.',
      verdict: 'Effectiveness: NOT confirmed',
      bullets: [
        'CTRL-IAM-04 (privileged access review) — failed: cadence not met for 2 quarters',
        'CTRL-LOG-11 (auth path logging) — failed: gap in SIEM coverage',
        'CTRL-CRYPTO-07 (key rotation) — insufficient evidence: rotation log not exported'
      ]
    },
    humanCheckpoint: {
      actor: 'Control Owner (1LOD)',
      prompt: 'Are controls effective overall?',
      actions: [
        { label: 'YES — Effective',     target: 'step8', tone: 'yes' },
        { label: 'NO — Gaps identified', target: 'step6', tone: 'no'  }
      ]
    }
  },
  {
    id: 'step6',
    label: 'Step 6: Identify Gaps',
    short: 'Identify Gaps',
    lane: '1LOD',
    col: 6,
    type: 'ai-assisted',
    summary: '1LOD identifies gaps where controls are missing, weak, incomplete, or not operating effectively. AI summarizes failed control results and recurring gap themes.',
    aiActions: [
      'Cluster failed controls into thematic gaps',
      'Map gaps to affected risks and applications',
      'Cross-reference open audit findings'
    ],
    aiOutput: {
      title: 'AI Gap Summary',
      lead: 'Three gaps identified, two recurring from prior cycle.',
      verdict: '3 gaps · 2 recurring · 1 net-new',
      bullets: [
        'GAP-01 — Privileged access review cadence (recurring; tied to CTRL-IAM-04)',
        'GAP-02 — Auth-path logging coverage (recurring; tied to CTRL-LOG-11)',
        'GAP-03 — Crypto key rotation evidence retention (net-new)'
      ]
    },
    humanCheckpoint: {
      actor: '1LOD Process Owner',
      prompt: 'Gaps documented and accepted?',
      actions: [
        { label: 'Accept & continue to remediation', target: 'step7', tone: 'primary' }
      ]
    }
  },
  {
    id: 'step7',
    label: 'Step 7: Remediation Plan',
    short: 'Remediation',
    lane: '1LOD',
    col: 7,
    type: 'decision',
    summary: '1LOD creates a remediation plan — owners, due dates, JIRA tickets, ServiceNow tasks. AI drafts notifications, task assignments, and reminders.',
    aiActions: [
      'Draft remediation tasks per gap',
      'Suggest owners from CMDB ownership records',
      'Generate stakeholder notifications and SLA reminders'
    ],
    aiOutput: {
      title: 'AI Drafted Remediation Plan',
      lead: 'Generated 3 JIRA tickets and 1 ServiceNow change request. Owners assigned via CMDB lookup.',
      verdict: '4 tasks drafted · awaiting owner confirmation',
      bullets: [
        'JIRA PAY-2041 — Re-baseline privileged access review (Owner: IAM Lead, SLA 30d)',
        'JIRA PAY-2042 — Extend Splunk parsers to legacy auth path (Owner: Logging Eng, SLA 45d)',
        'JIRA PAY-2043 — Crypto key rotation evidence export job (Owner: PKI Eng, SLA 21d)',
        'ServiceNow CHG-9981 — Quarterly access review automation (Owner: GRC Eng, SLA 60d)'
      ]
    },
    humanCheckpoint: {
      actor: 'Risk + Control Owners (1LOD)',
      prompt: 'Are remediation fixes implemented?',
      actions: [
        { label: 'YES — Fixes implemented (retest)', target: 'step5',  tone: 'yes' },
        { label: 'NO — Stay in remediation',         target: 'step7',  tone: 'no'  }
      ]
    }
  },
  {
    id: 'step8',
    label: 'Step 8: Residual Risk',
    short: 'Residual Risk',
    lane: '1LOD',
    col: 8,
    type: 'decision',
    summary: '1LOD evaluates remaining risk after considering control effectiveness and any remediation activity.',
    aiActions: [],
    humanCheckpoint: {
      actor: 'Risk Owner (1LOD)',
      prompt: 'Is residual risk acceptable?',
      actions: [
        { label: 'YES — Acceptable',          target: 'step9', tone: 'yes' },
        { label: 'NO — Identify more gaps',   target: 'step6', tone: 'no'  }
      ]
    }
  },
  {
    id: 'step9',
    label: 'Step 9: Submit RCSA',
    short: 'Submit',
    lane: '1LOD',
    col: 9,
    type: 'ai-assisted',
    summary: '1LOD prepares the RCSA for submission. Before reaching 2LOD, AI runs a pre-submission quality check.',
    aiActions: [
      'Flag missing fields, weak justifications, incomplete ratings',
      'Detect inconsistencies between inherent and residual ratings',
      'Compare narrative quality vs. prior accepted submissions'
    ],
    aiOutput: {
      title: 'AI Pre-Submission QC',
      lead: '2 missing fields, 1 weak justification, 1 inconsistency detected.',
      verdict: '4 issues flagged for resolution',
      bullets: [
        'Missing field: Inherent likelihood rationale (Risk R-04)',
        'Missing field: Control test evidence link (CTRL-CRYPTO-07)',
        'Weak justification: Residual risk narrative (Risk R-02) is < 1 sentence',
        'Inconsistency: inherent High → residual Low without remediation evidence (Risk R-05)'
      ]
    },
    humanCheckpoint: {
      actor: 'Risk Owner (1LOD)',
      prompt: 'Resolve flagged items, then submit.',
      actions: [
        { label: 'Resolve & submit to 2LOD', target: 'step10', tone: 'primary' },
        { label: 'Override with documented justification', target: 'step10', tone: 'secondary' }
      ]
    }
  },
  {
    id: 'step10',
    label: 'Step 10: 2LOD Check & Challenge',
    short: '2LOD Challenge',
    lane: '2LOD',
    col: 10,
    type: 'decision',
    summary: '2LOD independently reviews the submitted RCSA. AI compares vs. prior RCSAs, surfaces unexplained rating changes, flags outliers, and drafts challenge questions.',
    aiActions: [
      'Compare submission to prior RCSAs and peer applications',
      'Flag unexplained rating changes and outliers',
      'Draft challenge questions for the reviewer'
    ],
    aiOutput: {
      title: 'AI Challenge Brief',
      lead: '3 challenge questions generated. 1 outlier detected vs. peer apps.',
      verdict: 'Reviewer attention recommended',
      bullets: [
        'Q1 — Residual risk dropped 2 tiers without remediation evidence (Risk R-05). Justify.',
        'Q2 — Control CTRL-IAM-04 marked effective despite cadence gap. Reconcile.',
        'Q3 — No risks identified for third-party API integrations — outlier vs. peer apps.'
      ]
    },
    humanCheckpoint: {
      actor: '2LOD Reviewer',
      prompt: 'Are issues identified that block approval?',
      actions: [
        { label: 'YES — Return to Remediation (Step 7)',    target: 'step7',  tone: 'no' },
        { label: 'YES — Return to Residual Risk (Step 8)',  target: 'step8',  tone: 'no' },
        { label: 'YES — Return to Submit (Step 9)',         target: 'step9',  tone: 'no' },
        { label: 'NO — No issues, approve',                 target: 'step11', tone: 'yes' }
      ]
    }
  },
  {
    id: 'step11',
    label: 'Step 11: Approve / Validate',
    short: 'Approve',
    lane: '2LOD',
    col: 11,
    type: 'process',
    summary: '2LOD approves and validates the RCSA when no material issues remain.',
    aiActions: [],
    humanCheckpoint: {
      actor: '2LOD Approver',
      prompt: 'Approve and validate the RCSA.',
      actions: [
        { label: 'Approve & validate', target: 'step12', tone: 'primary' }
      ]
    }
  },
  {
    id: 'step12',
    label: 'Step 12: Monitoring & Review',
    short: 'Monitoring',
    lane: 'MONITORING',
    col: 12,
    type: 'decision',
    summary: 'Approved RCSA enters ongoing monitoring — KRIs, SIEM signals (Splunk / Sentinel), audit findings, control monitoring, incidents, regulatory changes. AI analyzes trends and recommends whether a new cycle should trigger.',
    aiActions: [
      'Continuously summarize SIEM activity and KRI trends',
      'Correlate operational findings across signals',
      'Recommend retrigger when thresholds are breached'
    ],
    aiOutput: {
      title: 'AI Monitoring Signal',
      lead: 'KRI breach trend on auth control. Splunk signal correlation suggests reassessment.',
      verdict: 'Recommendation: Retrigger RCSA',
      bullets: [
        'KRI-AUTH-FAIL — breached threshold 3 of last 4 weeks',
        'Splunk: anomalous privileged-session pattern on PAYMENTS-CORE',
        'New regulatory guidance issued affecting in-scope controls'
      ]
    },
    humanCheckpoint: {
      actor: 'Risk Owner (1LOD)',
      prompt: 'Trigger a new RCSA cycle?',
      actions: [
        { label: 'YES — Retrigger',          target: 'trigger', tone: 'yes' },
        { label: 'NO — Continue monitoring', target: 'step12',  tone: 'no'  }
      ]
    }
  }
];

// Connector edges. type: 'forward' | 'loopback'.
// Decision branches are rendered with their own labels (YES / NO) at runtime.
const EDGES = [
  { from: 'trigger', to: 'step1',  type: 'forward', label: 'Accept' },
  { from: 'step1',   to: 'step2',  type: 'forward' },
  { from: 'step2',   to: 'step3',  type: 'forward' },
  { from: 'step3',   to: 'step4',  type: 'forward' },
  { from: 'step4',   to: 'step5',  type: 'forward' },
  { from: 'step5',   to: 'step8',  type: 'forward',  label: 'YES' },
  { from: 'step5',   to: 'step6',  type: 'loopback', label: 'NO' },
  { from: 'step6',   to: 'step7',  type: 'forward' },
  { from: 'step7',   to: 'step5',  type: 'loopback', label: 'YES (retest)' },
  { from: 'step8',   to: 'step9',  type: 'forward',  label: 'YES' },
  { from: 'step8',   to: 'step6',  type: 'loopback', label: 'NO' },
  { from: 'step9',   to: 'step10', type: 'forward' },
  { from: 'step10',  to: 'step11', type: 'forward',  label: 'NO issues' },
  { from: 'step10',  to: 'step9',  type: 'loopback', label: 'Issue → Submit' },
  { from: 'step10',  to: 'step8',  type: 'loopback', label: 'Issue → Residual' },
  { from: 'step10',  to: 'step7',  type: 'loopback', label: 'Issue → Remediate' },
  { from: 'step11',  to: 'step12', type: 'forward' },
  { from: 'step12',  to: 'trigger', type: 'loopback', label: 'New cycle' }
];

window.__RCSA__ = { LANES, STEPS, EDGES };

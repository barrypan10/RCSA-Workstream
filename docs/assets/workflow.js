// Cyber RCSA workflow definition.
// Source of truth: cyber_rcsa_process_flow.md (File 1).
// Steps, decisions, and routing here mirror File 1 exactly.

const LANES = [
  { id: 'SYSTEM',     label: 'System / Data',       sublabel: 'ServiceNow · Archer / Risk360 · CMDB · SharePoint' },
  { id: '1LOD',       label: 'Business / 1LOD',     sublabel: 'RCSA execution · Risk & control ownership · Remediation' },
  { id: '2LOD',       label: 'Risk / 2LOD',         sublabel: 'Independent review · Check & challenge · Approval' },
  { id: 'MONITORING', label: 'Monitoring / Audit',  sublabel: 'KRIs · SIEM (Splunk / Sentinel) · Audit signals' }
];

// Stage groupings for visual banding on the workflow map.
const STAGES = [
  { id: 'TRIGGER',    label: 'Trigger',     cols: [0, 0]  },
  { id: 'IDENTIFY',   label: 'Identify',    cols: [1, 2]  },
  { id: 'ASSESS',     label: 'Assess',      cols: [3, 4]  },
  { id: 'TEST',       label: 'Test',        cols: [5, 5]  },
  { id: 'REMEDIATE',  label: 'Remediate',   cols: [6, 8]  },
  { id: 'SUBMIT',     label: 'Submit',      cols: [9, 9]  },
  { id: 'APPROVE',    label: 'Approve',     cols: [10, 11] },
  { id: 'MONITOR',    label: 'Monitor',     cols: [12, 12] }
];

const STEPS = [
  {
    id: 'trigger',
    label: 'Trigger Event',
    short: 'Trigger',
    lane: 'SYSTEM',
    col: 0,
    stage: 'TRIGGER',
    type: 'ai-assisted',
    summary: 'A signal initiates the RCSA cycle: scheduled cadence, cyber incident, audit finding, business or technology change, or regulatory change.',
    description: 'The Trigger Event is the entry point of the RCSA lifecycle. The platform receives a signal (scheduled cycle date, SIEM anomaly cluster, incident, audit finding, regulatory bulletin, or business change) and the AI engine performs initial triage to recommend whether a Full, Partial, or No RCSA is required. The Cyber RCSA Lead in 1LOD reviews and accepts, modifies, or rejects the recommendation.',
    dueDays: 1,
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
      actor: 'Cyber RCSA Lead, 1LOD',
      prompt: 'Accept AI triage recommendation?',
      actions: [
        { label: 'Accept — Initiate Full RCSA', target: 'step1',     tone: 'primary' },
        { label: 'Reject — Document & Monitor', target: 'terminate', tone: 'muted'   }
      ]
    },
    workItems: {
      heading: 'Trigger context',
      type: 'kv',
      rows: [
        { k: 'Trigger source',    v: 'Scheduled annual cycle + Splunk anomaly cluster' },
        { k: 'In-scope app',      v: 'PAYMENTS-CORE' },
        { k: 'Recommended scope', v: 'Full RCSA — IAM domain + logging controls' },
        { k: 'Cycle ID',          v: 'RCSA-2026-Q2-PAYC-001' }
      ]
    },
    attachments: [
      { name: 'splunk-anomaly-cluster-14d.csv', kind: 'data',    size: '184 KB' },
      { name: 'prior-cycle-open-gaps.pdf',      kind: 'doc',     size: '92 KB'  }
    ],
    comments: [
      { author: 'M. Chen',     role: 'Cyber RCSA Lead, 1LOD',         ts: '2026-05-05 09:14', text: 'Confirming we want a full RCSA — the SIEM cluster overlaps the prior IAM gap.' },
      { author: 'AI Assistant', role: 'AI Triage',                    ts: '2026-05-05 09:08', text: 'Auto-attached prior cycle finding bundle for context.' }
    ]
  },
  {
    id: 'step1',
    label: 'Step 1: Define Scope',
    short: 'Define Scope',
    lane: '1LOD',
    col: 1,
    stage: 'IDENTIFY',
    type: 'process',
    summary: '1LOD defines RCSA scope — process, system, data, business area, risk domain, and regulatory drivers in scope.',
    description: 'The Application Owner and Cyber RCSA Lead define the boundary of the assessment. Scope captures applications and infrastructure in CMDB, supporting business processes, regulatory applicability (e.g., SOX, PCI), and dependencies. The platform pre-populates from CMDB and prior RCSA scope where available.',
    dueDays: 3,
    aiActions: [],
    humanCheckpoint: {
      actor: 'Application Owner, 1LOD',
      prompt: 'Confirm RCSA scope.',
      actions: [
        { label: 'Confirm scope & continue', target: 'step2', tone: 'primary' }
      ]
    },
    workItems: {
      heading: 'In-scope assets',
      type: 'list',
      rows: [
        { k: 'PAYMENTS-CORE-API',     v: 'Application · Tier 1 · PCI in-scope' },
        { k: 'PAYMENTS-CORE-DB',      v: 'Database · Tier 1 · PII + PCI' },
        { k: 'PAYMENTS-AUTH-SVC',     v: 'IAM dependency · Tier 1' },
        { k: 'PAYMENTS-LOG-PIPELINE', v: 'Logging dependency · Splunk-fed' }
      ]
    },
    attachments: [
      { name: 'cmdb-extract-payments-core.csv', kind: 'data', size: '46 KB' },
      { name: 'scope-memo-v1.docx',             kind: 'doc',  size: '28 KB' }
    ],
    comments: [
      { author: 'L. Ortega', role: 'Application Owner, 1LOD',  ts: '2026-05-06 10:22', text: 'Adding PAYMENTS-LOG-PIPELINE — last cycle missed it and we had a Splunk gap downstream.' }
    ]
  },
  {
    id: 'step2',
    label: 'Step 2: Identify Risks',
    short: 'Identify Risks',
    lane: '1LOD',
    col: 2,
    stage: 'IDENTIFY',
    type: 'ai-assisted',
    summary: '1LOD identifies relevant cyber risks. AI summarizes prior RCSAs, risk memos, incidents, audit findings, and known control gaps to suggest risks and missed themes.',
    description: 'Risks are identified for each in-scope asset. The AI engine reviews prior RCSAs, vulnerability records, audit findings, and incident history to propose candidate risks (including risks the team may have missed). The Cyber RCSA Lead validates each before it enters the risk register.',
    dueDays: 5,
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
        'Unpatched library in payment gateway component (CVE-2025-####)',
        'Data classification drift on customer PII tables',
        'Backup encryption key custody — control owner ambiguity'
      ]
    },
    humanCheckpoint: {
      actor: 'Cyber RCSA Lead, 1LOD',
      prompt: 'Validate AI-proposed risks before they enter the register.',
      actions: [
        { label: 'Accept all & continue',       target: 'step3', tone: 'primary' },
        { label: 'Accept selected & continue',  target: 'step3', tone: 'secondary' }
      ]
    },
    workItems: {
      heading: 'Risk register (proposed)',
      type: 'table',
      cols: ['Risk ID', 'Risk', 'Source', 'Status'],
      rows: [
        ['R-01', 'Privileged access drift',         'Prior RCSA (recurring)', 'AI-proposed · Pending'],
        ['R-02', 'Third-party API key rotation',     '2024 audit finding',     'AI-proposed · Pending'],
        ['R-03', 'Insufficient legacy auth logging', 'SIEM coverage analysis', 'AI-proposed · Pending'],
        ['R-04', 'Unpatched payment gateway lib',    'Vulnerability scan',     'AI-proposed · Pending'],
        ['R-05', 'PII data classification drift',    'Prior incident IR-2024-08', 'AI-proposed · Pending'],
        ['R-06', 'Backup key custody ambiguity',     'Control mapping review', 'AI-proposed · Pending']
      ]
    },
    attachments: [
      { name: 'prior-rcsa-summary-2024.pdf',  kind: 'doc',  size: '142 KB' },
      { name: 'incident-history-24mo.xlsx',   kind: 'data', size: '88 KB'  }
    ],
    comments: [
      { author: 'M. Chen',     role: 'Cyber RCSA Lead, 1LOD',         ts: '2026-05-08 14:01', text: 'R-04 is being remediated separately — keep it in the register but note SLA.' },
      { author: 'AI Assistant', role: 'AI Risk Suggestions',          ts: '2026-05-08 13:50', text: 'Surfaced R-02 because the 2024 audit finding remains open and not previously RCSA-scoped.' }
    ]
  },
  {
    id: 'step3',
    label: 'Step 3: Assess Risk',
    short: 'Assess Risk',
    lane: '1LOD',
    col: 3,
    stage: 'ASSESS',
    type: 'process',
    summary: '1LOD assesses identified risks — impact, likelihood, exposure, control dependency, and business criticality.',
    description: 'For each risk in the register, 1LOD assigns inherent likelihood, inherent impact, and inherent rating using the enterprise risk taxonomy. Business criticality and regulatory weighting (PCI, SOX) feed into the inherent score.',
    dueDays: 7,
    aiActions: [],
    humanCheckpoint: {
      actor: 'Cyber RCSA Lead, 1LOD',
      prompt: 'Risk assessment complete?',
      actions: [
        { label: 'Submit assessment & continue', target: 'step4', tone: 'primary' }
      ]
    },
    workItems: {
      heading: 'Inherent risk ratings',
      type: 'table',
      cols: ['Risk', 'Likelihood', 'Impact', 'Inherent rating'],
      rows: [
        ['R-01 Privileged access drift',         'Likely',    'High',     'High'],
        ['R-02 API key rotation gap',            'Possible',  'High',     'High'],
        ['R-03 Legacy auth logging',             'Likely',    'Moderate', 'High'],
        ['R-04 Unpatched gateway lib',           'Possible',  'High',     'High'],
        ['R-05 PII classification drift',        'Possible',  'Moderate', 'Moderate'],
        ['R-06 Backup key custody',              'Unlikely',  'High',     'Moderate']
      ]
    },
    attachments: [
      { name: 'risk-rating-rationale.docx', kind: 'doc', size: '34 KB' }
    ],
    comments: []
  },
  {
    id: 'step4',
    label: 'Step 4: Evaluate Controls',
    short: 'Evaluate Controls',
    lane: '1LOD',
    col: 4,
    stage: 'ASSESS',
    type: 'process',
    summary: '1LOD evaluates controls mapped to each risk to determine whether existing controls are appropriately designed.',
    description: 'Each risk is mapped to its supporting controls in Archer / Risk360. Control owners verify the design adequacy of each control — coverage, owner clarity, evidence path, and frequency.',
    dueDays: 9,
    aiActions: [],
    humanCheckpoint: {
      actor: 'Control Owner — IAM Lead, 1LOD',
      prompt: 'Control evaluation complete?',
      actions: [
        { label: 'Continue to control testing', target: 'step5', tone: 'primary' }
      ]
    },
    workItems: {
      heading: 'Control mapping',
      type: 'table',
      cols: ['Control ID', 'Control', 'Owner', 'Design adequacy'],
      rows: [
        ['CTRL-IAM-04',    'Quarterly privileged access review',        'IAM Lead',         'Adequate (design)'],
        ['CTRL-LOG-11',    'Authentication path SIEM ingestion',        'Logging Eng Lead', 'Adequate (design)'],
        ['CTRL-CRYPTO-07', 'API key rotation cadence',                  'PKI Eng Lead',     'Adequate (design)'],
        ['CTRL-VULN-02',   'Critical patching SLA enforcement',         'Vuln Mgmt Lead',   'Adequate (design)'],
        ['CTRL-DATA-09',   'PII classification gate on schema changes', 'Data Gov Lead',    'Partial — needs uplift']
      ]
    },
    attachments: [
      { name: 'control-mapping-archer-export.xlsx', kind: 'data', size: '64 KB' }
    ],
    comments: []
  },
  {
    id: 'step5',
    label: 'Step 5: Control Test',
    short: 'Control Test',
    lane: '1LOD',
    col: 5,
    stage: 'TEST',
    type: 'decision',
    summary: '1LOD tests mapped controls to determine operating effectiveness. AI assists by identifying failed results, missing evidence, and potential remediation needs.',
    description: 'Control owners execute the test plan and submit evidence. AI parses evidence (logs, screenshots, ServiceNow records, ticket extracts) and flags failures, weak evidence, and recurring failure patterns vs prior cycles.',
    dueDays: 14,
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
      actor: 'Control Owner — IAM Lead, 1LOD',
      prompt: 'Are controls effective overall?',
      actions: [
        { label: 'YES — Effective',     target: 'step8', tone: 'yes' },
        { label: 'NO — Gaps identified', target: 'step6', tone: 'no'  }
      ]
    },
    workItems: {
      heading: 'Control test results',
      type: 'table',
      cols: ['Control', 'Tested by', 'Result', 'Evidence'],
      rows: [
        ['CTRL-IAM-04',    'IAM Lead',       'FAILED',   'Cadence log shows 2 missed quarters'],
        ['CTRL-LOG-11',    'Logging Eng',    'FAILED',   'Splunk coverage report shows gaps'],
        ['CTRL-CRYPTO-07', 'PKI Eng',        'INCOMPLETE', 'Rotation log not exported'],
        ['CTRL-VULN-02',   'Vuln Mgmt',      'EFFECTIVE','SLA dashboard within tolerance'],
        ['CTRL-DATA-09',   'Data Gov',       'EFFECTIVE','Recent schema changes gated correctly']
      ]
    },
    attachments: [
      { name: 'iam-cadence-log-Q3-Q4.csv',           kind: 'data', size: '12 KB'  },
      { name: 'splunk-coverage-auth-path.pdf',        kind: 'doc',  size: '208 KB' },
      { name: 'crypto-rotation-evidence-request.eml', kind: 'doc',  size: '14 KB'  }
    ],
    comments: [
      { author: 'P. Singh',    role: 'IAM Lead, 1LOD',                ts: '2026-05-15 16:08', text: 'CTRL-IAM-04 failure is the same root cause as last cycle — cadence automation never landed.' },
      { author: 'AI Assistant', role: 'AI Test Result Summary',       ts: '2026-05-15 11:30', text: 'Pattern match: CTRL-IAM-04 failure recurring in 2 of last 3 cycles.' }
    ]
  },
  {
    id: 'step6',
    label: 'Step 6: Identify Gaps',
    short: 'Identify Gaps',
    lane: '1LOD',
    col: 6,
    stage: 'REMEDIATE',
    type: 'ai-assisted',
    summary: '1LOD identifies gaps where controls are missing, weak, incomplete, or not operating effectively. AI summarizes failed control results and recurring gap themes.',
    description: 'AI clusters failed and incomplete controls into thematic gaps, maps each gap to the affected risks and applications, and cross-references open audit findings. Cyber RCSA Lead accepts the gap list.',
    dueDays: 16,
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
      actor: 'Cyber RCSA Lead, 1LOD',
      prompt: 'Gaps documented and accepted?',
      actions: [
        { label: 'Accept & continue to remediation', target: 'step7', tone: 'primary' }
      ]
    },
    workItems: {
      heading: 'Identified gaps',
      type: 'table',
      cols: ['Gap', 'Theme', 'Linked controls', 'Severity'],
      rows: [
        ['GAP-01', 'Privileged access review cadence',     'CTRL-IAM-04',    'High · recurring'],
        ['GAP-02', 'Auth-path logging coverage',           'CTRL-LOG-11',    'High · recurring'],
        ['GAP-03', 'Crypto key rotation evidence retention','CTRL-CRYPTO-07', 'Moderate · net-new']
      ]
    },
    attachments: [
      { name: 'gap-summary-cycle-2026Q2.pdf', kind: 'doc', size: '76 KB' }
    ],
    comments: []
  },
  {
    id: 'step7',
    label: 'Step 7: Remediation Plan',
    short: 'Remediation',
    lane: '1LOD',
    col: 7,
    stage: 'REMEDIATE',
    type: 'decision',
    summary: '1LOD creates a remediation plan — owners, due dates, JIRA tickets, ServiceNow tasks. AI drafts notifications, task assignments, and reminders.',
    description: 'AI drafts JIRA tickets and ServiceNow change requests for each gap, suggests owners using CMDB ownership records, and generates SLA-aware reminder notifications. Remediation owners confirm and execute the actions; status flows back automatically as tickets close.',
    dueDays: 30,
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
      actor: 'Remediation Owners (1LOD) · approval by Cyber RCSA Lead',
      prompt: 'Are remediation fixes implemented?',
      actions: [
        { label: 'YES — Fixes implemented (retest)', target: 'step5',  tone: 'yes' },
        { label: 'NO — Stay in remediation',         target: 'step7',  tone: 'no'  }
      ]
    },
    workItems: {
      heading: 'Remediation actions',
      type: 'table',
      cols: ['Ticket', 'Action', 'Owner', 'SLA', 'Status'],
      rows: [
        ['JIRA PAY-2041', 'Re-baseline privileged access review',         'P. Singh (IAM Lead)',         '30d', 'In progress'],
        ['JIRA PAY-2042', 'Extend Splunk parsers to legacy auth path',    'D. Park (Logging Eng Lead)',  '45d', 'In progress'],
        ['JIRA PAY-2043', 'Crypto key rotation evidence export job',      'A. Khan (PKI Eng Lead)',      '21d', 'Done — pending verify'],
        ['CHG-9981',      'Quarterly access review automation',           'R. Diaz (GRC Eng Lead)',      '60d', 'Drafted']
      ]
    },
    attachments: [
      { name: 'remediation-plan-2026Q2.pdf',     kind: 'doc',  size: '124 KB' },
      { name: 'jira-export-pay-2041-2043.csv',   kind: 'data', size: '22 KB'  }
    ],
    comments: [
      { author: 'P. Singh', role: 'IAM Lead, 1LOD',          ts: '2026-05-22 09:11', text: 'Re-baseline running. Will have evidence pack ready before retest.' },
      { author: 'A. Khan',  role: 'PKI Eng Lead, 1LOD',      ts: '2026-05-24 13:40', text: 'PAY-2043 done. Rotation log export job scheduled nightly.' }
    ]
  },
  {
    id: 'step8',
    label: 'Step 8: Residual Risk',
    short: 'Residual Risk',
    lane: '1LOD',
    col: 8,
    stage: 'REMEDIATE',
    type: 'decision',
    summary: '1LOD evaluates remaining risk after considering control effectiveness and any remediation activity.',
    description: 'After remediation outcomes are factored in, the residual risk for each item is assigned. The Application Owner accepts residual exposure if it is within tolerance; otherwise the cycle returns to Step 6 for additional gap identification.',
    dueDays: 32,
    aiActions: [],
    humanCheckpoint: {
      actor: 'Application Owner + Cyber RCSA Lead, 1LOD',
      prompt: 'Is residual risk acceptable?',
      actions: [
        { label: 'YES — Acceptable',          target: 'step9', tone: 'yes' },
        { label: 'NO — Identify more gaps',   target: 'step6', tone: 'no'  }
      ]
    },
    workItems: {
      heading: 'Residual ratings',
      type: 'table',
      cols: ['Risk', 'Inherent', 'Residual', 'Acceptance'],
      rows: [
        ['R-01 Privileged access drift',  'High',     'Moderate', 'Within tolerance (post-remediation)'],
        ['R-02 API key rotation gap',     'High',     'Low',      'Within tolerance'],
        ['R-03 Legacy auth logging',      'High',     'Moderate', 'Within tolerance (post-remediation)'],
        ['R-04 Unpatched gateway lib',    'High',     'Low',      'Within tolerance'],
        ['R-05 PII classification drift', 'Moderate', 'Low',      'Within tolerance'],
        ['R-06 Backup key custody',       'Moderate', 'Low',      'Within tolerance']
      ]
    },
    attachments: [
      { name: 'residual-risk-narrative.docx', kind: 'doc', size: '38 KB' }
    ],
    comments: []
  },
  {
    id: 'step9',
    label: 'Step 9: Submit RCSA',
    short: 'Submit',
    lane: '1LOD',
    col: 9,
    stage: 'SUBMIT',
    type: 'ai-assisted',
    summary: '1LOD prepares the RCSA for submission. Before reaching 2LOD, AI runs a pre-submission quality check.',
    description: 'AI runs a quality gate over the submission package — looks for missing fields, weak justifications, incomplete ratings, and inherent-vs-residual inconsistencies. Cyber RCSA Lead resolves flagged items or overrides with documented justification.',
    dueDays: 35,
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
      actor: 'Cyber RCSA Lead, 1LOD',
      prompt: 'Resolve flagged items, then submit.',
      actions: [
        { label: 'Resolve & submit to 2LOD',                  target: 'step10', tone: 'primary' },
        { label: 'Override with documented justification',     target: 'step10', tone: 'secondary' }
      ]
    },
    workItems: {
      heading: 'Pre-submission QC findings',
      type: 'table',
      cols: ['Issue', 'Item', 'Action'],
      rows: [
        ['Missing field',  'R-04 inherent likelihood rationale',           'Add narrative'],
        ['Missing field',  'CTRL-CRYPTO-07 evidence link',                 'Attach link'],
        ['Weak narrative', 'R-02 residual narrative (< 1 sentence)',       'Expand'],
        ['Inconsistency',  'R-05 inherent → residual delta unsupported',   'Justify or revise']
      ]
    },
    attachments: [
      { name: 'rcsa-submission-package-v1.pdf', kind: 'doc', size: '412 KB' }
    ],
    comments: []
  },
  {
    id: 'step10',
    label: 'Step 10: 2LOD Check & Challenge',
    short: '2LOD Challenge',
    lane: '2LOD',
    col: 10,
    stage: 'APPROVE',
    type: 'decision',
    summary: '2LOD independently reviews the submitted RCSA. AI compares vs. prior RCSAs, surfaces unexplained rating changes, flags outliers, and drafts challenge questions.',
    description: 'The Cyber Risk Officer in 2LOD reviews the submission independently. AI provides a challenge brief comparing against prior cycles and peer applications, with specific questions to raise. The reviewer determines whether issues exist and where to route the package back if so.',
    dueDays: 40,
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
      actor: 'Cyber Risk Officer, 2LOD',
      prompt: 'Are issues identified that block approval?',
      actions: [
        { label: 'YES — Return to Remediation (Step 7)',    target: 'step7',  tone: 'no' },
        { label: 'YES — Return to Residual Risk (Step 8)',  target: 'step8',  tone: 'no' },
        { label: 'YES — Return to Submit (Step 9)',         target: 'step9',  tone: 'no' },
        { label: 'NO — No issues, approve',                 target: 'step11', tone: 'yes' }
      ]
    },
    workItems: {
      heading: 'Challenge brief',
      type: 'table',
      cols: ['#', 'Question', 'Source'],
      rows: [
        ['Q1', 'Residual risk dropped 2 tiers without remediation evidence (R-05).', 'AI vs prior cycles'],
        ['Q2', 'CTRL-IAM-04 effective despite cadence gap — reconcile.',             'AI vs control test data'],
        ['Q3', 'No risks identified for third-party API integrations.',              'AI vs peer apps']
      ]
    },
    attachments: [
      { name: '2lod-review-notes.docx', kind: 'doc', size: '52 KB' }
    ],
    comments: [
      { author: 'V. Romano', role: 'Cyber Risk Officer, 2LOD', ts: '2026-06-05 11:45', text: 'Q1 looks resolved with new R-05 narrative. Q2 needs control owner reply before I can sign.' }
    ]
  },
  {
    id: 'step11',
    label: 'Step 11: Approve / Validate',
    short: 'Approve',
    lane: '2LOD',
    col: 11,
    stage: 'APPROVE',
    type: 'process',
    summary: '2LOD approves and validates the RCSA when no material issues remain.',
    description: 'Once challenge questions are resolved, the Head of Cyber Risk Governance (2LOD) provides formal approval and validation. The package is locked and the cycle moves into ongoing monitoring.',
    dueDays: 45,
    aiActions: [],
    humanCheckpoint: {
      actor: 'Head of Cyber Risk Governance, 2LOD',
      prompt: 'Approve and validate the RCSA.',
      actions: [
        { label: 'Approve & validate', target: 'step12', tone: 'primary' }
      ]
    },
    workItems: {
      heading: 'Approval package',
      type: 'kv',
      rows: [
        { k: 'Submission ID',     v: 'RCSA-2026-Q2-PAYC-001' },
        { k: '2LOD Reviewer',     v: 'V. Romano · Cyber Risk Officer, 2LOD' },
        { k: 'Approver',          v: 'S. Beauchamp · Head of Cyber Risk Governance, 2LOD' },
        { k: 'Outstanding items', v: '0' }
      ]
    },
    attachments: [
      { name: '2lod-approval-letter.pdf', kind: 'doc', size: '28 KB' }
    ],
    comments: []
  },
  {
    id: 'step12',
    label: 'Step 12: Monitoring & Review',
    short: 'Monitoring',
    lane: 'MONITORING',
    col: 12,
    stage: 'MONITOR',
    type: 'decision',
    summary: 'Approved RCSA enters ongoing monitoring — KRIs, SIEM signals (Splunk / Sentinel), audit findings, control monitoring, incidents, regulatory changes. AI analyzes trends and recommends whether a new cycle should trigger.',
    description: 'Continuous monitoring runs against the approved baseline. AI summarizes KRI trends, correlates SIEM activity, surfaces incidents and audit findings, and recommends a new RCSA cycle when thresholds are crossed. The Cyber RCSA Lead accepts or rejects each retrigger recommendation.',
    dueDays: null,
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
      actor: 'Cyber RCSA Lead, 1LOD (with Continuous Monitoring Team)',
      prompt: 'Trigger a new RCSA cycle?',
      actions: [
        { label: 'YES — Retrigger',          target: 'trigger', tone: 'yes' },
        { label: 'NO — Continue monitoring', target: 'step12',  tone: 'no'  }
      ]
    },
    workItems: {
      heading: 'Monitoring signals',
      type: 'table',
      cols: ['Signal', 'Source', 'Trend', 'Status'],
      rows: [
        ['KRI-AUTH-FAIL',                     'KRI dashboard',     'Breached 3/4 weeks',     'Action recommended'],
        ['Privileged-session anomaly',        'Splunk',            'Cluster (last 7d)',      'Action recommended'],
        ['New regulatory guidance',           'Reg bulletin feed', 'Affects in-scope ctls',  'Review'],
        ['Audit findings (post-approval)',    'Internal Audit',    'None',                    'Stable']
      ]
    },
    attachments: [
      { name: 'kri-trend-30d.png',           kind: 'image', size: '64 KB' },
      { name: 'splunk-priv-session-7d.csv',  kind: 'data',  size: '108 KB' }
    ],
    comments: []
  }
];

// Connector edges. type: 'forward' | 'loopback'.
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

window.__RCSA__ = { LANES, STAGES, STEPS, EDGES };

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
    type: 'process',
    summary: 'A signal initiates the RCSA cycle: scheduled cadence, cyber incident, audit finding, business or technology change, or regulatory change.',
    description: 'The Trigger Event is the entry point of the RCSA lifecycle. The platform receives a signal (scheduled cycle date, SIEM anomaly cluster, incident, audit finding, regulatory bulletin, or business change). Trigger source and prior-cycle context drive a rule-based recommendation of Full, Partial, or No RCSA. The Cyber RCSA Lead in 1LOD reviews and accepts, modifies, or rejects the recommendation. The prerequisites bundle inserted at cycle start (5-tab Excel pack) is the canonical input for scope, risk, control, and evidence context.',
    dueDays: 1,
    aiActions: [],
    humanCheckpoint: {
      actor: 'Cyber RCSA Lead, 1LOD',
      prompt: 'Confirm RCSA scope based on trigger context.',
      actions: [
        { label: 'Initiate Full RCSA',          target: 'step1',     tone: 'primary' },
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
      { name: 'RCSA-Prerequisites-Pack-PAYMENTS-CORE-2026Q2.xlsx', kind: 'data', size: '~12 KB', href: 'samples/RCSA-Prerequisites-Pack-PAYMENTS-CORE-2026Q2.xlsx' }
    ],
    comments: [
      { author: 'M. Chen', role: 'Cyber RCSA Lead, 1LOD', ts: '2026-05-05 09:14', text: 'Prerequisites pack ingested. SIEM cluster in Tab 5 overlaps the prior IAM gap in Tab 3 — confirming Full RCSA.' }
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
      lead: 'Reviewed: 5-tab Prerequisites Pack — 3 prior RCSAs, 11 incidents (24mo), 4 open audit findings, CMDB ownership for PAYMENTS-CORE, applicable NIST/NYDFS/SOX/PCI mappings.',
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
    summary: '1LOD tests mapped controls to determine operating effectiveness. Control owners execute the test plan and submit evidence.',
    description: 'Control owners execute the test plan and submit evidence (logs, screenshots, ServiceNow records, ticket extracts). Each result is recorded as Effective, Failed, or Incomplete. The Control Owner determines whether the control set is operating effectively overall.',
    dueDays: 14,
    aiActions: [],
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
      { author: 'P. Singh', role: 'IAM Lead, 1LOD', ts: '2026-05-15 16:08', text: 'CTRL-IAM-04 failure is the same root cause as last cycle — cadence automation never landed.' }
    ]
  },
  {
    id: 'step6',
    label: 'Step 6: Identify Gaps',
    short: 'Identify Gaps',
    lane: '1LOD',
    col: 6,
    stage: 'REMEDIATE',
    type: 'process',
    summary: '1LOD identifies gaps where controls are missing, weak, incomplete, or not operating effectively.',
    description: 'Failed and incomplete control results from Step 5 are mapped to thematic gaps, linked to affected risks and applications, and cross-referenced against open audit findings. The Cyber RCSA Lead accepts the gap list.',
    dueDays: 16,
    aiActions: [],
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
    summary: '1LOD creates a remediation plan — owners, due dates, JIRA tickets, ServiceNow tasks. Owners are sourced from CMDB; SLA reminders are auto-generated.',
    description: 'JIRA tickets and ServiceNow change requests are created for each gap from templates, with owners populated from CMDB ownership records. SLA-aware reminder notifications are generated automatically by the workflow platform. Remediation owners confirm and execute the actions; status flows back as tickets close.',
    dueDays: 30,
    aiActions: [],
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
    type: 'process',
    summary: '1LOD prepares the RCSA for submission. An automated validation gate runs deterministic completeness checks before the package goes to 2LOD.',
    description: 'The submission package runs through a deterministic validation gate that checks for missing fields, incomplete ratings, and inherent-vs-residual rating inconsistencies. The Cyber RCSA Lead resolves any flagged items, then submits to 2LOD.',
    dueDays: 35,
    aiActions: [],
    humanCheckpoint: {
      actor: 'Cyber RCSA Lead, 1LOD',
      prompt: 'Resolve any validation findings, then submit.',
      actions: [
        { label: 'Resolve & submit to 2LOD', target: 'step10', tone: 'primary' }
      ]
    },
    workItems: {
      heading: 'Validation findings',
      type: 'table',
      cols: ['Issue', 'Item', 'Action'],
      rows: [
        ['Missing field',  'R-04 inherent likelihood rationale',           'Add narrative'],
        ['Missing field',  'CTRL-CRYPTO-07 evidence link',                 'Attach link'],
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
    summary: '2LOD independently reviews the submitted RCSA. AI runs two passes — Review 1 challenges the submission in isolation; Review 2 compares it against peer team submissions and surfaces cross-team inconsistencies.',
    description: 'The Cyber Risk Officer in 2LOD reviews the submission independently. AI provides two distinct review passes: an internal challenge against the submission itself, and a peer-comparison brief against a corpus of other teams’ RCSAs. The reviewer decides which findings to raise and whether the package routes back upstream or proceeds to approval.',
    dueDays: 40,
    aiReviews: [
      {
        id: 'isolation',
        title: 'Review 1 — Internal Challenge',
        subtitle: 'Challenge the submission in isolation',
        actions: [
          'Detect unexplained rating changes within this submission',
          'Flag weak justifications and missing evidence',
          'Draft challenge questions answerable by control owners'
        ],
        output: {
          title: 'AI Internal Challenge Brief',
          lead: '3 internal challenge questions generated against this submission alone.',
          verdict: 'Internal review: reviewer attention recommended',
          bullets: [
            'Q1 — Residual risk on R-05 dropped 2 tiers without remediation evidence in this submission. Justify.',
            'Q2 — CTRL-IAM-04 marked effective in Step 5 despite cadence-gap evidence in the prereq pack. Reconcile.',
            'Q3 — Step 9 pre-submission validation flagged a missing CTRL-CRYPTO-07 evidence link — not visible in the final submission. Confirm resolution.'
          ]
        }
      },
      {
        id: 'peer',
        title: 'Review 2 — Peer Comparison',
        subtitle: 'Compare against other teams’ submissions',
        actions: [
          'Compare risk register against peer apps’ registers',
          'Identify ratings that diverge from peer median',
          'Surface risks identified by peers but missed here'
        ],
        output: {
          title: 'AI Peer Comparison Brief',
          lead: 'Compared against 4 peer apps (LENDING-CORE, FRAUD-CORE, MOBILE-AUTH, TREASURY-OPS) within the last 2 cycles.',
          verdict: '3 cross-team inconsistencies detected',
          bullets: [
            'CTRL-IAM-04 marked effective here; LENDING-CORE and FRAUD-CORE both marked it INEFFECTIVE in their last cycle. Reconcile.',
            '3 of 4 peers identified third-party API key rotation as a top risk; this submission only included it after AI proposal at Step 2.',
            'Residual rating delta on R-05 is 2 tiers steeper than the peer median for similar PII-classification risks — outlier, justify.'
          ]
        }
      }
    ],
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
      heading: 'Challenge brief (combined)',
      type: 'table',
      cols: ['#', 'Question', 'Review', 'Source'],
      rows: [
        ['I-Q1', 'Residual risk on R-05 dropped 2 tiers without remediation evidence.', 'Internal',    'AI vs this submission'],
        ['I-Q2', 'CTRL-IAM-04 effective in Step 5 despite cadence-gap evidence — reconcile.', 'Internal', 'AI vs prereq pack'],
        ['I-Q3', 'Missing CTRL-CRYPTO-07 evidence link from Step 9 — confirm resolution.', 'Internal', 'AI vs Step 9 QC'],
        ['P-Q1', 'CTRL-IAM-04 effectiveness disagrees with LENDING-CORE / FRAUD-CORE peer cycles.', 'Peer',       'AI vs peer corpus'],
        ['P-Q2', 'API key rotation risk added late — 3 of 4 peers had it baseline.',                  'Peer',       'AI vs peer corpus'],
        ['P-Q3', 'R-05 residual delta is 2 tiers steeper than peer median.',                          'Peer',       'AI vs peer corpus']
      ]
    },
    attachments: [
      { name: '2lod-review-notes.docx', kind: 'doc', size: '52 KB' },
      { name: 'peer-cycle-summary-2026Q1.csv', kind: 'data', size: '18 KB' }
    ],
    comments: [
      { author: 'V. Romano', role: 'Cyber Risk Officer, 2LOD', ts: '2026-06-05 11:45', text: 'Internal Q1 resolved with new R-05 narrative. Internal Q2 needs control owner reply. Peer Q1 (CTRL-IAM-04 disagreement vs LENDING-CORE) is the one I will raise.' }
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
    summary: 'Approved RCSA enters ongoing monitoring — KRIs, SIEM signals (Splunk / Sentinel), audit findings, control monitoring, incidents, regulatory changes. KRI threshold breaches and SIEM alerts surface signals; correlated breaches recommend a retrigger.',
    description: 'Continuous monitoring runs against the approved baseline. KRI dashboards, SIEM rules, audit findings, incidents, and regulatory bulletins each emit signals. When correlated thresholds are breached, the platform recommends a new RCSA cycle. The Cyber RCSA Lead accepts or rejects the retrigger.',
    dueDays: null,
    aiActions: [],
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

// Static prereq context — mirrors the data in
// docs/samples/RCSA-Prerequisites-Pack-PAYMENTS-CORE-2026Q2.xlsx so live AI
// calls (when an API key is set) and the static demo path share one structure.
// Used as the fallback when "Use sample pack" or a real upload is chosen.
const PREREQ_CONTEXT = {
  cycleId: 'RCSA-2026-Q2-PAYC-001',
  inScopeApp: 'PAYMENTS-CORE',
  generated: '2026-05-05',
  owner: 'M. Chen, Cyber RCSA Lead, 1LOD',
  riskInventory: [
    { id: 'R-01', risk: 'Privileged access drift on payment processing servers',     application: 'PAYMENTS-CORE-API',     mappedControls: ['CTRL-IAM-04'],    owner: 'P. Singh (IAM Lead)',         inherent: 'High' },
    { id: 'R-02', risk: 'Third-party API key rotation gap',                          application: 'PAYMENTS-AUTH-SVC',     mappedControls: ['CTRL-CRYPTO-07'], owner: 'A. Khan (PKI Eng Lead)',      inherent: 'High' },
    { id: 'R-03', risk: 'Insufficient logging on legacy auth path',                  application: 'PAYMENTS-LOG-PIPELINE', mappedControls: ['CTRL-LOG-11'],    owner: 'D. Park (Logging Eng Lead)',  inherent: 'High' },
    { id: 'R-04', risk: 'Unpatched library in payment gateway component',            application: 'PAYMENTS-CORE-API',     mappedControls: ['CTRL-VULN-02'],   owner: 'Vuln Mgmt Lead',              inherent: 'High' },
    { id: 'R-05', risk: 'Data classification drift on customer PII tables',          application: 'PAYMENTS-CORE-DB',      mappedControls: ['CTRL-DATA-09'],   owner: 'Data Gov Lead',               inherent: 'Moderate' },
    { id: 'R-06', risk: 'Backup encryption key custody — control owner ambiguity',   application: 'PAYMENTS-CORE-DB',      mappedControls: ['CTRL-CRYPTO-12'], owner: 'PKI Eng / Backup Eng',        inherent: 'Moderate' },
    { id: 'R-07', risk: 'Session timeout policy not enforced uniformly',             application: 'PAYMENTS-AUTH-SVC',     mappedControls: ['CTRL-IAM-09'],    owner: 'P. Singh (IAM Lead)',         inherent: 'Moderate' },
    { id: 'R-08', risk: 'Insider threat — privileged user activity not reviewed',    application: 'PAYMENTS-CORE-API',     mappedControls: ['CTRL-IAM-04'],    owner: 'P. Singh (IAM Lead)',         inherent: 'Moderate' },
    { id: 'R-09', risk: 'DR / failover configuration drift',                          application: 'PAYMENTS-CORE-API',     mappedControls: ['CTRL-RES-03'],    owner: 'Resilience Eng Lead',         inherent: 'Low' },
    { id: 'R-10', risk: 'Vendor SLA monitoring gap on payment processor',            application: 'PAYMENTS-AUTH-SVC',     mappedControls: ['CTRL-VENDOR-05'], owner: 'Vendor Mgmt Lead',            inherent: 'Low' }
  ],
  assets: [
    { cmdbId: 'CMDB-PAYC-001', name: 'PAYMENTS-CORE-API',     tier: 'Tier 1', appOwner: 'L. Ortega', techOwner: 'Platform Eng — Payments', pci: true,  sox: true,  lifecycle: 'Production' },
    { cmdbId: 'CMDB-PAYC-002', name: 'PAYMENTS-CORE-DB',      tier: 'Tier 1', appOwner: 'L. Ortega', techOwner: 'DBA — Payments',          pci: true,  sox: true,  lifecycle: 'Production' },
    { cmdbId: 'CMDB-PAYC-003', name: 'PAYMENTS-AUTH-SVC',     tier: 'Tier 1', appOwner: 'L. Ortega', techOwner: 'P. Singh (IAM)',          pci: true,  sox: false, lifecycle: 'Production' },
    { cmdbId: 'CMDB-PAYC-004', name: 'PAYMENTS-LOG-PIPELINE', tier: 'Tier 2', appOwner: 'L. Ortega', techOwner: 'D. Park (Logging Eng)',   pci: false, sox: false, lifecycle: 'Production' },
    { cmdbId: 'CMDB-PAYC-005', name: 'PAYMENTS-FRAUD-RULES',  tier: 'Tier 2', appOwner: 'L. Ortega', techOwner: 'Risk Analytics',          pci: true,  sox: false, lifecycle: 'Production' },
    { cmdbId: 'CMDB-PAYC-006', name: 'PAYMENTS-RECON-BATCH',  tier: 'Tier 2', appOwner: 'L. Ortega', techOwner: 'Platform Eng — Payments', pci: false, sox: true,  lifecycle: 'Production' },
    { cmdbId: 'CMDB-PAYC-007', name: 'PAYMENTS-VAULT-SVC',    tier: 'Tier 1', appOwner: 'L. Ortega', techOwner: 'A. Khan (PKI Eng)',       pci: true,  sox: false, lifecycle: 'Production' },
    { cmdbId: 'CMDB-PAYC-008', name: 'PAYMENTS-LEGACY-AUTH',  tier: 'Tier 2', appOwner: 'L. Ortega', techOwner: 'D. Park (Logging Eng)',   pci: false, sox: false, lifecycle: 'Sunset 2026Q4' }
  ],
  priorIssues: [
    { cycleId: 'RCSA-2025-Q2-PAYC', finding: 'Privileged access review cadence not met (2 quarters)',   status: 'Open',        openDate: '2025-07-12', owner: 'P. Singh (IAM Lead)',        linkedControl: 'CTRL-IAM-04',    carryForward: true  },
    { cycleId: 'RCSA-2025-Q2-PAYC', finding: 'Splunk coverage gap on legacy auth path',                  status: 'Open',        openDate: '2025-07-12', owner: 'D. Park (Logging Eng Lead)', linkedControl: 'CTRL-LOG-11',    carryForward: true  },
    { cycleId: 'RCSA-2025-Q2-PAYC', finding: 'API key rotation evidence not retained',                   status: 'In-progress', openDate: '2025-09-04', owner: 'A. Khan (PKI Eng Lead)',     linkedControl: 'CTRL-CRYPTO-07', carryForward: true  },
    { cycleId: 'RCSA-2024-Q4-PAYC', finding: 'DR runbook not updated post platform migration',           status: 'Closed',      openDate: '2024-12-08', owner: 'Resilience Eng Lead',        linkedControl: 'CTRL-RES-03',    carryForward: false },
    { cycleId: 'AUDIT-2024-INT-22', finding: 'Third-party API key rotation gap (audit finding)',         status: 'Open',        openDate: '2024-11-19', owner: 'A. Khan (PKI Eng Lead)',     linkedControl: 'CTRL-CRYPTO-07', carryForward: true  },
    { cycleId: 'IR-2024-08',        finding: 'PII classification drift surfaced in incident review',     status: 'Open',        openDate: '2024-08-22', owner: 'Data Gov Lead',              linkedControl: 'CTRL-DATA-09',    carryForward: true  }
  ],
  policies: [
    { standard: 'NIST CSF 2.0',  section: 'PR.AC-1 Identity & access management',    applicability: 'PAYMENTS-CORE-API, PAYMENTS-AUTH-SVC', internalPolicyId: 'POL-IAM-001',    lastReviewed: '2026-01-15' },
    { standard: 'NIST CSF 2.0',  section: 'DE.AE-3 Event data aggregation',           applicability: 'PAYMENTS-LOG-PIPELINE',                 internalPolicyId: 'POL-LOG-004',    lastReviewed: '2026-02-02' },
    { standard: 'NIST CSF 2.0',  section: 'PR.DS-1 Data-at-rest protection',          applicability: 'PAYMENTS-CORE-DB, PAYMENTS-VAULT-SVC',  internalPolicyId: 'POL-CRYPTO-002', lastReviewed: '2025-11-10' },
    { standard: 'NYDFS 500.07',  section: 'Access privileges & management',           applicability: 'All Tier 1 systems',                    internalPolicyId: 'POL-IAM-001',    lastReviewed: '2026-01-15' },
    { standard: 'NYDFS 500.14',  section: 'Training and monitoring',                  applicability: 'Continuous Monitoring Team',            internalPolicyId: 'POL-MON-003',    lastReviewed: '2025-12-01' },
    { standard: 'NYDFS 500.16',  section: 'Incident response plan',                   applicability: 'Cyber RCSA Lead, IR Team',              internalPolicyId: 'POL-IR-001',     lastReviewed: '2026-03-22' },
    { standard: 'SOX ITGC',      section: 'Logical access controls',                  applicability: 'PAYMENTS-CORE-API, PAYMENTS-CORE-DB',   internalPolicyId: 'POL-SOX-IAM-1',  lastReviewed: '2026-01-30' },
    { standard: 'SOX ITGC',      section: 'Change management',                        applicability: 'All in-scope apps',                     internalPolicyId: 'POL-SOX-CM-1',   lastReviewed: '2026-01-30' },
    { standard: 'PCI-DSS 4.0',   section: 'Req 7 — Restrict access by business need', applicability: 'PAYMENTS-CORE-API, PAYMENTS-AUTH-SVC',  internalPolicyId: 'POL-PCI-A7',     lastReviewed: '2025-10-05' },
    { standard: 'PCI-DSS 4.0',   section: 'Req 10 — Log and monitor all access',      applicability: 'PAYMENTS-LOG-PIPELINE',                 internalPolicyId: 'POL-PCI-A10',    lastReviewed: '2025-10-05' },
    { standard: 'PCI-DSS 4.0',   section: 'Req 3 — Protect stored account data',      applicability: 'PAYMENTS-CORE-DB',                      internalPolicyId: 'POL-PCI-A3',     lastReviewed: '2025-10-05' },
    { standard: 'Internal',      section: 'Cyber Risk Appetite Statement',            applicability: 'Enterprise-wide',                       internalPolicyId: 'POL-RISK-001',   lastReviewed: '2026-02-14' }
  ],
  evidence: [
    { source: 'Splunk',         signal: 'Anomalous privileged-session pattern (14d cluster)', trend: 'Spiking',           linkedAsset: 'PAYMENTS-CORE-API',     lastUpdated: '2026-05-04' },
    { source: 'Splunk',         signal: 'Auth-path coverage gap on legacy endpoint',          trend: 'Persistent',        linkedAsset: 'PAYMENTS-LEGACY-AUTH',  lastUpdated: '2026-05-04' },
    { source: 'Sentinel',       signal: 'Suspicious API key reuse across geos',                trend: 'Recurring',         linkedAsset: 'PAYMENTS-AUTH-SVC',     lastUpdated: '2026-04-29' },
    { source: 'KRI Dashboard',  signal: 'KRI-AUTH-FAIL — auth failure rate',                   trend: 'Breach (3/4w)',     linkedAsset: 'PAYMENTS-AUTH-SVC',     lastUpdated: '2026-05-03' },
    { source: 'KRI Dashboard',  signal: 'KRI-IAM-REVIEW — privileged access review cadence',  trend: 'Breach',            linkedAsset: 'PAYMENTS-CORE-API',     lastUpdated: '2026-05-01' },
    { source: 'KRI Dashboard',  signal: 'KRI-PATCH-SLA — critical patch SLA breach rate',      trend: 'Within tolerance',  linkedAsset: 'Enterprise-wide',       lastUpdated: '2026-05-02' },
    { source: 'Internal Audit', signal: 'Open finding: API key rotation gap',                  trend: 'Open since 2024-11', linkedAsset: 'PAYMENTS-AUTH-SVC',     lastUpdated: '2026-04-25' },
    { source: 'Internal Audit', signal: 'Open finding: privileged review cadence',             trend: 'Open since 2025-07', linkedAsset: 'PAYMENTS-CORE-API',     lastUpdated: '2026-04-25' },
    { source: 'Internal Audit', signal: 'Open finding: PII classification gates',              trend: 'Open since 2024-08', linkedAsset: 'PAYMENTS-CORE-DB',      lastUpdated: '2026-04-25' },
    { source: 'IR (24mo)',      signal: 'IR-2024-08 PII classification drift',                 trend: '1 incident',         linkedAsset: 'PAYMENTS-CORE-DB',      lastUpdated: '2024-08-22' },
    { source: 'IR (24mo)',      signal: 'IR-2025-03 Splunk parser silent failure',             trend: '1 incident',         linkedAsset: 'PAYMENTS-LOG-PIPELINE', lastUpdated: '2025-03-11' },
    { source: 'IR (24mo)',      signal: 'IR-2025-09 Vendor key rotation miss',                 trend: '1 incident',         linkedAsset: 'PAYMENTS-AUTH-SVC',     lastUpdated: '2025-09-04' },
    { source: 'Reg Bulletin',   signal: 'NYDFS 500 amendments — November 2025',                trend: 'New',                linkedAsset: 'Enterprise-wide',       lastUpdated: '2025-11-01' },
    { source: 'Vuln Mgmt',      signal: 'CVE-2025-#### in payment-gateway-lib',                trend: 'Open',               linkedAsset: 'PAYMENTS-CORE-API',     lastUpdated: '2026-04-30' }
  ]
};

// Static peer-submission corpus — used by Step 10 Review 2 (peer comparison).
// Mirrors the shape of PREREQ_CONTEXT.riskInventory and Step 5/Step 8 outputs
// so the AI engine (or static fallback) can compare like-for-like.
// Four peer apps cover the comparison narratives: LENDING-CORE flagged IAM-04,
// FRAUD-CORE challenged on logging, MOBILE-AUTH a clean baseline, TREASURY-OPS
// a similar Tier-1 PCI scope.
const PEER_SUBMISSIONS = [
  {
    app: 'LENDING-CORE',
    cycleId: 'RCSA-2026-Q1-LEND-001',
    completedDate: '2026-03-18',
    summary: 'Tier-1 lending platform. Recently flagged IAM cadence issue in 2LOD challenge.',
    risks: [
      { id: 'L-R01', risk: 'Privileged access drift on lending core', source: 'Recurring',          residual: 'Moderate' },
      { id: 'L-R02', risk: 'Third-party API key rotation gap',         source: 'Audit finding',      residual: 'Low' },
      { id: 'L-R03', risk: 'KYC vendor data freshness',                 source: 'Operations review',  residual: 'Low' },
      { id: 'L-R04', risk: 'Adverse-action notification logging gap',   source: 'Reg bulletin',       residual: 'Moderate' }
    ],
    controls: [
      { id: 'CTRL-IAM-04',    name: 'Quarterly privileged access review', lastTest: 'INEFFECTIVE — cadence missed' },
      { id: 'CTRL-LOG-11',    name: 'Auth-path SIEM ingestion',           lastTest: 'EFFECTIVE' },
      { id: 'CTRL-CRYPTO-07', name: 'API key rotation cadence',           lastTest: 'EFFECTIVE' },
      { id: 'CTRL-KYC-02',    name: 'KYC vendor data freshness',          lastTest: 'EFFECTIVE' }
    ],
    notable: [
      'CTRL-IAM-04 marked INEFFECTIVE — same recurring root cause flagged here',
      'Third-party API key rotation in baseline risk register from cycle start',
      '2LOD raised challenge on residual delta tightness — accepted with rationale'
    ]
  },
  {
    app: 'FRAUD-CORE',
    cycleId: 'RCSA-2026-Q1-FRAUD-002',
    completedDate: '2026-04-02',
    summary: 'Fraud detection platform. Logging-coverage challenge dominated the 2LOD review.',
    risks: [
      { id: 'F-R01', risk: 'Privileged access drift on fraud rules engine', source: 'Recurring',         residual: 'Moderate' },
      { id: 'F-R02', risk: 'Third-party threat-feed key rotation',          source: 'Vendor mgmt',       residual: 'Low' },
      { id: 'F-R03', risk: 'Fraud rules logging coverage gap',              source: 'Splunk analysis',   residual: 'High' },
      { id: 'F-R04', risk: 'Model drift on production scoring',             source: 'Model risk team',   residual: 'Moderate' },
      { id: 'F-R05', risk: 'PII exposure in fraud notifications',           source: 'IR-2025-11',        residual: 'Low' }
    ],
    controls: [
      { id: 'CTRL-IAM-04',    name: 'Quarterly privileged access review', lastTest: 'INEFFECTIVE — cadence missed' },
      { id: 'CTRL-LOG-11',    name: 'Auth-path SIEM ingestion',           lastTest: 'INEFFECTIVE — coverage gap on rules-engine traffic' },
      { id: 'CTRL-CRYPTO-07', name: 'API key rotation cadence',           lastTest: 'EFFECTIVE' },
      { id: 'CTRL-MODEL-02',  name: 'Model risk monitoring',              lastTest: 'EFFECTIVE' }
    ],
    notable: [
      'CTRL-IAM-04 marked INEFFECTIVE — confirms cross-app pattern',
      'Third-party API key rotation in baseline risk register from cycle start',
      'CTRL-LOG-11 INEFFECTIVE drove a Step 7 → Step 5 retest loop'
    ]
  },
  {
    app: 'MOBILE-AUTH',
    cycleId: 'RCSA-2026-Q1-MOB-003',
    completedDate: '2026-04-22',
    summary: 'Mobile authentication service. Clean cycle — used as peer-median baseline.',
    risks: [
      { id: 'M-R01', risk: 'Session token refresh gap',                source: 'Engineering review', residual: 'Low' },
      { id: 'M-R02', risk: 'Biometric vendor SLA monitoring',          source: 'Vendor mgmt',        residual: 'Low' },
      { id: 'M-R03', risk: 'Third-party API key rotation gap',         source: 'Recurring',          residual: 'Low' },
      { id: 'M-R04', risk: 'Device-binding bypass on jailbroken phones', source: 'Pen test',         residual: 'Moderate' }
    ],
    controls: [
      { id: 'CTRL-IAM-04',    name: 'Quarterly privileged access review', lastTest: 'EFFECTIVE' },
      { id: 'CTRL-LOG-11',    name: 'Auth-path SIEM ingestion',           lastTest: 'EFFECTIVE' },
      { id: 'CTRL-CRYPTO-07', name: 'API key rotation cadence',           lastTest: 'EFFECTIVE' },
      { id: 'CTRL-MOB-08',    name: 'Device-binding integrity check',     lastTest: 'EFFECTIVE' }
    ],
    notable: [
      'Clean cycle — no 2LOD challenges raised',
      'Third-party API key rotation baseline risk',
      'Residual rating deltas all within ±1 tier of inherent — peer-median reference'
    ]
  },
  {
    app: 'TREASURY-OPS',
    cycleId: 'RCSA-2026-Q1-TREAS-004',
    completedDate: '2026-04-30',
    summary: 'Treasury & payments operations. Tier-1 PCI scope, similar to PAYMENTS-CORE.',
    risks: [
      { id: 'T-R01', risk: 'Privileged access drift on treasury workstations', source: 'Recurring',     residual: 'Moderate' },
      { id: 'T-R02', risk: 'Third-party API key rotation gap',                 source: 'Audit finding', residual: 'Low' },
      { id: 'T-R03', risk: 'Wire-transfer logging completeness',                source: 'IA review',    residual: 'Moderate' },
      { id: 'T-R04', risk: 'PII data classification drift on settlement files', source: 'Data Gov',     residual: 'Moderate' },
      { id: 'T-R05', risk: 'Backup encryption key custody',                     source: 'PKI review',   residual: 'Low' }
    ],
    controls: [
      { id: 'CTRL-IAM-04',    name: 'Quarterly privileged access review', lastTest: 'EFFECTIVE' },
      { id: 'CTRL-LOG-11',    name: 'Auth-path SIEM ingestion',           lastTest: 'EFFECTIVE' },
      { id: 'CTRL-CRYPTO-07', name: 'API key rotation cadence',           lastTest: 'EFFECTIVE' },
      { id: 'CTRL-DATA-09',   name: 'PII classification gates',           lastTest: 'EFFECTIVE' },
      { id: 'CTRL-CRYPTO-12', name: 'Backup encryption key custody',      lastTest: 'EFFECTIVE' }
    ],
    notable: [
      'CTRL-IAM-04 EFFECTIVE — automation rolled out 2025-Q4',
      'Third-party API key rotation baseline risk',
      'Residual on PII-classification risk dropped 1 tier (not 2) with remediation evidence — peer-median reference'
    ]
  }
];

window.__RCSA__ = { LANES, STAGES, STEPS, EDGES, PREREQ_CONTEXT, PEER_SUBMISSIONS };

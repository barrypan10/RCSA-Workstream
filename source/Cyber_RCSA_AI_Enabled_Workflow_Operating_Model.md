# Cyber RCSA AI-Enabled Workflow Operating Model

## Executive Summary

The Cyber RCSA workflow is a cross-functional governance process used to identify, assess, remediate, validate, and monitor cyber risks across enterprise applications, infrastructure, and supporting business processes.

The workflow spans:
- Business / Front Office (1LOD)
- Risk & Compliance (2LOD)
- Monitoring & Audit Functions
- GRC and Operational Technology Platforms

The process is designed to support:
- regulatory defensibility
- evidence traceability
- residual risk governance
- continuous oversight of cyber risk posture

The current-state operating model remains highly manual and dependent on fragmented systems, spreadsheet-based coordination, evidence collection activities, and iterative review cycles.

AI capabilities are selectively embedded within the workflow to augment operational bottlenecks including:
- risk identification support
- remediation recommendation generation
- review and challenge assistance
- monitoring signal summarization

Human governance oversight remains mandatory across all approval and risk acceptance activities.

---

# Phase 1 — Scope Definition & Risk Identification

The workflow begins with definition of the RCSA scope, where business, application, infrastructure, and cyber risk stakeholders identify:
- systems
- applications
- infrastructure assets
- supporting processes

included within the assessment boundary.

Teams validate:
- ownership
- business criticality
- regulatory applicability
- supporting technology dependencies

before transitioning into risk identification activities.

## Systems Used

- ServiceNow
- Archer / Risk360
- SharePoint
- CMDB inventories
- spreadsheets
- prior RCSA repositories

## AI-Augmented Activity

AI is selectively introduced during risk identification to analyze:
- prior RCSA submissions
- historical findings
- CMDB data
- application inventories
- vulnerability records

AI generates:
- draft risk recommendations
- dependency observations
- suggested risk categorizations

Final scope and risk determinations remain under business and risk owner control.

---

# Phase 2 — Risk Assessment & Control Evaluation

Following risk identification, the workflow transitions into inherent risk assessment and control evaluation activities.

1LOD teams evaluate:
- likelihood of occurrence
- operational impact
- regulatory exposure
- existing control effectiveness

## Systems Used

- Archer / Risk360
- control libraries
- policy repositories
- AuditBoard
- SharePoint evidence repositories

The process remains highly manual and dependent on:
- subjective scoring
- evidence gathering coordination
- fragmented control documentation

No explicit AI capability is embedded within this phase.

---

# Phase 3 — Testing, Evidence Collection & Gap Identification

Once controls are evaluated, the workflow transitions into testing and evidence validation activities.

Control owners and testing teams collect supporting evidence to demonstrate operational effectiveness and validate whether controls function as intended.

## Teams Collect

- screenshots
- configuration exports
- log records
- ticket evidence
- audit artifacts

## Systems Used

- SharePoint
- ServiceNow
- JIRA
- SIEM exports
- audit repositories
- spreadsheets

## Key Pain Points

- inconsistent evidence quality
- duplicate evidence requests
- fragmented documentation
- delayed testing cycles
- operational bottlenecks during validation

No explicit AI capability is shown within this phase.

---

# Phase 4 — Remediation Planning & Residual Risk Review

Following identification of control gaps and deficiencies, the workflow transitions into remediation planning activities.

Technology, business, and cyber risk stakeholders coordinate to:
- assign remediation ownership
- define corrective actions
- establish timelines
- reassess residual exposure

## Systems Used

- JIRA
- ServiceNow ITSM
- project tracking repositories
- Archer / Risk360

## AI-Augmented Activity

AI supports remediation planning by analyzing:
- identified deficiencies
- historical remediation activities
- policy requirements
- issue management records

AI generates:
- draft remediation recommendations
- corrective action suggestions
- prioritization guidance

Residual risk approval acts as the primary workflow checkpoint prior to formal RCSA submission.

---

# Phase 5 — RCSA Submission, 2LOD Review & Governance Approval

Following residual risk approval, the completed RCSA package is formally submitted for independent review and challenge by 2LOD governance functions.

This phase introduces the largest amount of:
- iterative review
- evidence revalidation
- challenge cycles
- remediation rework

## Primary Activities

- assessment documentation review
- evidence validation
- residual risk review
- challenge and escalation
- governance approval

## Systems Used

- Archer / Risk360
- AuditBoard
- SharePoint
- email workflows
- governance repositories

## AI-Augmented Activity

AI assists reviewers by:
- identifying incomplete submissions
- flagging inconsistent evidence
- summarizing unresolved findings
- generating challenge recommendations

The AI capability supports reviewer efficiency but does not replace independent governance review authority.

---

# Phase 6 — Continuous Monitoring & Feedback Loop

Once governance approval is completed, the workflow transitions into ongoing monitoring and operational review activities.

Monitoring functions continuously review:
- KRIs
- SIEM alerts
- operational incidents
- audit findings
- remediation status

## Systems Used

- Splunk
- Sentinel
- SIEM platforms
- monitoring dashboards
- audit repositories

## AI-Augmented Activity

AI:
- summarizes SIEM activity
- identifies recurring risk patterns
- correlates operational findings
- recommends reassessment triggers

Monitoring and escalation decisions remain fully controlled by monitoring and governance teams.

---

# Governance Characteristics

The workflow is optimized to support:
- audit traceability
- evidence retention
- regulatory examinations
- formal governance accountability

The operating environment remains fragmented across:
- GRC systems
- SharePoint repositories
- spreadsheets
- email coordination
- ticketing systems
- monitoring tools

The workflow also contains multiple feedback loops driven by:
- remediation validation
- residual risk reassessment
- 2LOD challenge activities
- evidence quality reviews

Although monitoring exists, the workflow remains assessment-driven and periodically coordinated rather than continuously recalculated through integrated telemetry-driven risk intelligence.

# Cyber RCSA Process Flow

## Purpose

This document explains the Cyber RCSA process in a human-readable format. The workflow is a trigger-based, human-in-the-loop process for identifying cyber risks, evaluating controls, managing remediation, validating residual risk, and supporting ongoing monitoring.

AI is applied selectively — only where it accelerates cross-document synthesis a human cannot realistically perform at speed and scale. Two checkpoints use AI: **Step 2 (Identify Risks)** and **Step 10 (2LOD Check & Challenge)**. Every other step is standard process or decision logic. Human owners remain accountable for all final decisions, approvals, overrides, and risk acceptance.

---

## Swimlane Ownership

| Swimlane | Primary Role |
|---|---|
| System / Data Layer | Provides source data and workflow platforms such as ServiceNow, Archer, or Risk 360 |
| Business / Front Office, 1LOD | Owns the RCSA execution, risk identification, control assessment, remediation, and submission |
| Risk / Compliance, 2LOD | Performs independent review, check and challenge, and approval or rejection |
| Monitoring / Audit | Provides KRI, SIEM, audit, and continuous monitoring signals that may retrigger the RCSA cycle |

---

## Prerequisites (Baseline)

A single consolidated **RCSA Prerequisites Pack** is ingested at the start of every cycle. It bundles five baseline categories into one Excel workbook, providing the canonical input for scope, risk, control, evidence, and regulatory context. Without the pack, the cycle does not begin.

| Prerequisite | Purpose |
|---|---|
| Risk & Control Inventory | Establishes the baseline risks and mapped controls in scope |
| Asset & Ownership Inventory | Confirms system owners, application owners, and accountability |
| Prior RCSA & Open Issues | Carries forward historical risks, gaps, and remediation items |
| Policies & Regulatory Requirements | Aligns assessment criteria to NIST, NYDFS, SOX, and internal standards |
| Evidence & Monitoring Data | Ensures logs, KRIs, incidents, and testing evidence are available for validation |

The pack is the singular input to the **Trigger Event** stage that follows. Downstream AI synthesis (Step 2 — Identify Risks) operates over the pack's contents.

---

# End-to-End Process

## Trigger Event

The process begins when a trigger occurs.

Common triggers include:
- Scheduled RCSA cycle
- Cyber incident
- Audit finding
- Business or technology change
- Regulatory change

Trigger source and prior-cycle context drive the recommendation of whether a Full, Partial, or No RCSA is required (rule-based: e.g., scheduled annual cycle defaults to Full; a low-severity bulletin with no in-scope overlap defaults to No).

**Human-in-the-loop:**
The Risk Owner reviews the recommendation and either accepts, rejects, or modifies the trigger decision.

**Next step:**
If an RCSA is required, proceed to **Step 1: Define Scope**.
If no RCSA is required, document the rationale and continue monitoring.

---

## Step 1: Define Scope

1LOD defines the scope of the RCSA, including the process, system, data, business area, risk domain, and regulatory drivers in scope.

**Output:**
Confirmed RCSA scope.

**Next step:**
Proceed to **Step 2: Identify Risks**.

---

## Step 2: Identify Risks

1LOD identifies relevant cyber risks based on the scoped process, prior RCSAs, risk memos, incidents, audit findings, and known control gaps.

AI may summarize inputs and recommend additional risks or missed risk themes.

**Human-in-the-loop:**
The Risk Owner accepts or rejects each AI-proposed risk before it enters the risk register.

**Output:**
Validated list of cyber risks.

**Next step:**
Proceed to **Step 3: Assess Risk**.

---

## Step 3: Assess Risk

1LOD assesses the identified risks. This may include evaluating impact, likelihood, exposure, control dependency, and business criticality.

**Output:**
Assessed risk profile.

**Next step:**
Proceed to **Step 4: Evaluate Controls**.

---

## Step 4: Evaluate Controls

1LOD evaluates the controls mapped to each risk. The objective is to determine whether the existing controls are appropriately designed to manage the identified risks.

**Output:**
Control inventory and control evaluation results.

**Next step:**
Proceed to **Step 5: Control Test**.

---

## Step 5: Control Test

1LOD tests the mapped controls to determine whether they are operating effectively. Control owners execute the test plan and submit evidence (logs, screenshots, ServiceNow records, ticket extracts).

**Output:**
Control testing result.

### Decision: Is the control effective?

**If YES:**
Go to **Step 8: Residual Risk**.

**If NO:**
Go to **Step 6: Identify Gaps**.

---

## Step 6: Identify Gaps

1LOD identifies gaps where controls are missing, weak, incomplete, or not operating effectively. Failed and incomplete control results from Step 5 are mapped to thematic gaps and linked to affected risks and applications.

**Output:**
Documented control gaps.

**Next step:**
Proceed to **Step 7: Remediation Plan**.

---

## Step 7: Remediation Plan

1LOD creates a remediation plan to address identified gaps. This includes assigning owners (sourced from CMDB ownership records), due dates, Jira tickets, ServiceNow tasks, and status tracking workflows. SLA-aware reminders are generated automatically by the workflow platform.

**Human-in-the-loop:**
Risk Owners and control owners validate and own remediation actions.

**Output:**
Approved remediation plan and assigned remediation tasks.

### Decision: Are fixes implemented?

**If YES:**
Go back to **Step 5: Control Test** to retest the control.

**If NO:**
Remain in **Step 7: Remediation Plan** until the fix is implemented or formally escalated.

---

## Step 8: Residual Risk

1LOD evaluates the remaining risk after considering control effectiveness and any remediation activity.

**Output:**
Residual risk assessment.

### Decision: Is residual risk acceptable?

**If YES:**
Proceed to **Step 9: Submit RCSA**.

**If NO:**
Go back to **Step 6: Identify Gaps** to identify additional gaps or required remediation.

---

## Step 9: Submit RCSA

1LOD prepares the RCSA for submission.

Before submission reaches 2LOD, an automated validation gate runs deterministic checks for missing fields, incomplete ratings, and inherent-vs-residual rating inconsistencies.

**Human-in-the-loop:**
The Risk Owner resolves flagged items before submitting.

**Output:**
Submitted RCSA package.

**Next step:**
Proceed to **Step 10: 2LOD Check & Challenge**.

---

## Step 10: 2LOD Check & Challenge

2LOD independently reviews the submitted RCSA.

AI may compare the submission against prior RCSAs, identify unexplained rating changes, flag outliers, and generate challenge questions for the reviewer.

**Human-in-the-loop:**
The 2LOD Reviewer decides which AI-generated challenges to raise and makes the final review determination.

**Output:**
2LOD review result.

### Decision: Are issues identified?

**If YES:**
Go back upstream to the relevant remediation or correction step. Most commonly:
- Go to **Step 7: Remediation Plan** if the issue relates to an unresolved control gap or fix
- Go to **Step 8: Residual Risk** if the issue relates to residual risk rationale or acceptance
- Go to **Step 9: Submit RCSA** if the issue relates to incomplete documentation or submission quality

**If NO:**
Proceed to **Step 11: Approve / Validate**.

---

## Step 11: Approve / Validate

2LOD approves and validates the RCSA when no material issues remain.

**Output:**
Approved and validated RCSA.

**Next step:**
Proceed to **Step 12: Monitoring & Review**.

---

## Step 12: Monitoring & Review

The approved RCSA enters ongoing monitoring.

Monitoring may include:
- KRI trends
- SIEM signals from Splunk or Sentinel
- Audit findings
- Control monitoring results
- Incident activity
- Regulatory changes

KRI threshold breaches and SIEM alerts surface monitoring signals; correlated breaches recommend whether a new RCSA cycle should be triggered.

**Human-in-the-loop:**
The Risk Owner reviews the monitoring signals and accepts or rejects the need to restart the RCSA process.

### Decision: Is a new RCSA trigger required?

**If YES:**
Go back to the **Trigger Event** stage and begin a new RCSA cycle.

**If NO:**
Remain in **Step 12: Monitoring & Review**.

---

# Decision Flow Summary

| Decision Point | If YES | If NO |
|---|---|---|
| RCSA required after trigger? | Step 1: Define Scope | Document rationale and continue monitoring |
| Control effective? | Step 8: Residual Risk | Step 6: Identify Gaps |
| Fixes implemented? | Step 5: Control Test | Stay in Step 7: Remediation Plan |
| Residual risk acceptable? | Step 9: Submit RCSA | Step 6: Identify Gaps |
| Issues identified by 2LOD? | Return to relevant correction step | Step 11: Approve / Validate |
| New monitoring trigger required? | Trigger Event | Stay in Step 12: Monitoring & Review |

---

# AI and Human Decision Rights

AI is applied at exactly two checkpoints — both involve cross-document synthesis at a scale humans cannot reasonably perform manually. All other steps are standard human-driven process or rule-based logic.

| Area | AI Role | Human Role |
|---|---|---|
| **Step 2 — Risk identification** | Synthesizes prior RCSAs, audit findings, incidents, and vulnerability records to surface candidate risks (especially risks the team would otherwise miss) | Risk Owner validates each risk before it enters the register |
| **Step 10 — 2LOD challenge** | Compares submission against prior cycles and peer applications, flags unexplained rating changes and outliers, drafts independent challenge questions | 2LOD Reviewer decides which challenges to raise and makes the final approval determination |

---

# Live-AI Mode (Demo Implementation)

The reference demo at `barrypan10/RCSA-Workstream` supports an opt-in **Live AI mode** at the same two checkpoints. Demo viewers paste their own Anthropic API key into a topbar settings panel; the key lives only in the browser tab's `sessionStorage`. With a key set, Step 2 and Step 10 call **Claude Haiku 4.5** directly with the ingested Prerequisites Pack as system context, and the Step 10 call reads the prompt cache written by Step 2 (≈90% input-token reduction). Without a key, both checkpoints render the static hand-authored content; the public GitHub Pages site works either way. The "Generate with AI" option in the prereq upload modal uses the same key to fabricate a realistic 5-section pack from a seed (app name + domain) for demo flexibility.

---

# Key Governance Principle

AI accelerates the RCSA process, but it does not replace human accountability. Every material decision, including RCSA initiation, risk inclusion, remediation ownership, residual risk acceptance, 2LOD challenge, approval, and retriggering, remains subject to human review and decision-making.

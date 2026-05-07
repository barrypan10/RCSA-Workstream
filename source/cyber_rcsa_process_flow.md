# Cyber RCSA Process Flow

## Purpose

This document explains the Cyber RCSA process in a human-readable format. The workflow is a trigger-based, AI-assisted, human-in-the-loop process for identifying cyber risks, evaluating controls, managing remediation, validating residual risk, and supporting ongoing monitoring.

AI supports the workflow by recommending, summarizing, flagging, and automating tasks. Human owners remain accountable for final decisions, approvals, overrides, and risk acceptance.

---

## Swimlane Ownership

| Swimlane | Primary Role |
|---|---|
| System / Data Layer | Provides source data and workflow platforms such as ServiceNow, Archer, or Risk 360 |
| Business / Front Office, 1LOD | Owns the RCSA execution, risk identification, control assessment, remediation, and submission |
| Risk / Compliance, 2LOD | Performs independent review, check and challenge, and approval or rejection |
| Monitoring / Audit | Provides KRI, SIEM, audit, and continuous monitoring signals that may retrigger the RCSA cycle |

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

AI reviews the trigger and recommends whether a full, partial, or no RCSA is required.

**Human-in-the-loop:**
The Risk Owner reviews the AI recommendation and either accepts, rejects, or modifies the trigger decision.

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

1LOD tests the mapped controls to determine whether they are operating effectively.

AI may support the process by helping identify failed control results, missing evidence, and potential remediation needs.

**Output:**
Control testing result.

### Decision: Is the control effective?

**If YES:**
Go to **Step 8: Residual Risk**.

**If NO:**
Go to **Step 6: Identify Gaps**.

---

## Step 6: Identify Gaps

1LOD identifies gaps where controls are missing, weak, incomplete, or not operating effectively.

AI may help summarize failed control results and identify recurring gap themes.

**Output:**
Documented control gaps.

**Next step:**
Proceed to **Step 7: Remediation Plan**.

---

## Step 7: Remediation Plan

1LOD creates a remediation plan to address identified gaps. This may include assigning owners, due dates, Jira tickets, ServiceNow tasks, or status tracking workflows.

AI may draft notifications, create task assignments, and send automated reminders to stakeholders.

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

Before submission reaches 2LOD, AI performs a pre-submission quality check. It may flag missing fields, weak justifications, incomplete ratings, or inconsistent information.

**Human-in-the-loop:**
The Risk Owner resolves flagged items or overrides them with documented justification.

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

AI analyzes trends and anomalies to recommend whether a new RCSA cycle should be triggered.

**Human-in-the-loop:**
The Risk Owner reviews the AI recommendation and accepts or rejects the need to restart the RCSA process.

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

| Area | AI Role | Human Role |
|---|---|---|
| Trigger triage | Recommends full, partial, or no RCSA | Risk Owner accepts, rejects, or modifies |
| Risk identification | Suggests missed risks and summarizes inputs | Risk Owner validates risks |
| Gap management | Flags failed controls and drafts remediation tasks | Control owners confirm and execute remediation |
| Pre-submission QC | Flags missing or weak submission content | Risk Owner resolves or overrides |
| 2LOD challenge | Identifies outliers and drafts challenge questions | 2LOD Reviewer decides final challenge and approval outcome |
| Monitoring | Detects KRI/SIEM anomalies and recommends retrigger | Risk Owner approves whether to restart the cycle |

---

# Key Governance Principle

AI accelerates the RCSA process, but it does not replace human accountability. Every material decision, including RCSA initiation, risk inclusion, remediation ownership, residual risk acceptance, 2LOD challenge, approval, and retriggering, remains subject to human review and decision-making.

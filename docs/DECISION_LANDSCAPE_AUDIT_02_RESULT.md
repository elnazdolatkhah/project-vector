# PROJECT VECTOR — Decision Landscape Audit 02 Result Report

**Status: P1 DESIGN VALIDATION GATE**  
**Date: 2026-10-30**  
**Scope: Authored Campaign Stages L01–L05 across Initial & 3 Deterministic Mid-Game States (20 sampled states total)**

---

## Executive Summary & Gate Verdict

### **Verdict: `P1 DECISION LANDSCAPE AUDIT — FAIL`**

While the simulation core, parity contracts, and physical deterministic stepping operate with mathematical precision, the game design of the authored campaign stages **fails P1 design validation** for four measured architectural reasons:

1. **Zero Pickup Strategic Leverage**: Across all five stages, a pickup-avoiding policy achieves the exact same win rate (100%) and median turn count as a pickup-seeking policy ($\Delta\text{WinRate} = 0\%$, $\Delta\text{Turns} = 0$). Pickups are currently decorative or trivial rather than contested trade-offs.
2. **Pacing Hostility**: Quality and damage are strongly and positively coupled with volley duration ($r_s = 0.58 \text{ to } 0.85$). Top-10% shots take **2.5× to 5× longer** to resolve than median shots (up to 27.9s average, and individual best shots taking 33s–57s). Better play directly punishes the player with longer wait times.
3. **Severe Needle Dependency**: On Initial boards, the widest contiguous band of angles delivering $\ge 80\%$ top quality is only **0.5° to 1.0° wide**, accompanied by **16 to 28 isolated needle spikes** narrower than $1.0^\circ$.
4. **Bimodal Policy Difficulty**: Uninformed average play (`median_quality`) has a **0% win rate** across every single level (fails 100% of the time due to superficial chipping without block penetration), whereas any informed selection in the top 20% achieves a **100% win rate**.

---

## 1. Initial-State Metrics (L01–L05)

*Sampled at $0.5^\circ$ resolution across the full legal domain $5^\circ \le \theta \le 175^\circ$ (341 angles per stage).*

| Stage | Name | Initial HP | Best Angle | Best Dmg | Best Dest | Sens $\pm0.5^\circ$ | Sens $\pm1.0^\circ$ | Top 10% Dmg Width | Top 20% Q Width | Max Contig Band | Iso Spikes | Pareto Size | Median Dur | Top 10% Dur | Best Shot Dur |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **L01** | Direct | 151 | 68.5° | 137 | 20 | 92.4% | 94.7% | 18.5° | 34.5° | **0.5°** | 32 | 86 | 7.62s | 19.18s | 50.08s |
| **L02** | Reflection | 239 | 162.5° | 114 | 10 | 80.6% | 88.9% | 18.0° | 35.0° | **1.0°** | 18 | 55 | 5.32s | 14.58s | 16.85s |
| **L03** | Double Reflection | 258 | 23.5° | 153 | 14 | 85.6% | 91.5% | 17.5° | 34.5° | **1.0°** | 18 | 71 | 5.38s | 13.27s | 32.83s |
| **L04** | Multiple Solutions | 254 | 43.0° | 117 | 8 | 82.1% | 90.3% | 17.5° | 35.0° | **0.5°** | 28 | 63 | 5.25s | 9.81s | 13.28s |
| **L05** | Precision | 309 | 164.5° | 119 | 7 | 86.5% | 91.2% | 18.0° | 35.5° | **0.5°** | 37 | 45 | 5.33s | 12.98s | 34.95s |

---

## 2. Mid-Game Metrics (L01–L05)

*Sampled across 3 deterministic prior-turn profiles: Strong (prior top-tier shot), Competent (~70th percentile), and Weak-but-reasonable (~30th percentile).*

| Stage | Prior Turn Profile | State Description | Sens $\pm1.0^\circ$ | Top 10% Dmg Width | Top 20% Q Width | Max Contig Band | Iso Spikes | Pareto Size | $r_s(\text{Dmg}, \text{Dur})$ | Median Dur | Top 10% Dur | Best Shot Dur | Best Angle | Best Dmg | Best Dest |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **L01** | Strong | Mid-Game Strong (Turn 1, prior 68.5°) | 93.6% | 27.0° | 36.0° | 11.0° | 4 | 29 | 0.78 | 7.93s | 22.51s | 52.32s | 5.0° | 26 | 7 |
| **L01** | Competent | Mid-Game Competent (Turn 1, prior 6°) | 98.8% | 19.0° | 35.0° | 3.0° | 16 | 63 | 0.72 | 9.92s | 22.67s | 23.87s | 102.0° | 123 | 20 |
| **L01** | Weak | Mid-Game Weak-Reasonable (Turn 1, prior 47°) | 98.8% | 18.0° | 35.0° | 2.0° | 9 | 57 | 0.78 | 9.12s | 21.71s | 56.65s | 81.0° | 120 | 21 |
| **L02** | Strong | Mid-Game Strong (Turn 1, prior 162.5°) | 89.5% | 18.0° | 36.0° | 1.0° | 14 | 47 | 0.85 | 6.98s | 23.64s | 43.67s | 173.0° | 167 | 17 |
| **L02** | Competent | Mid-Game Competent (Turn 1, prior 107.5°) | 93.6% | 18.0° | 35.0° | 1.0° | 7 | 61 | 0.79 | 5.93s | 23.34s | 38.97s | 30.0° | 207 | 19 |
| **L02** | Weak | Mid-Game Weak-Reasonable (Turn 1, prior 126.5°) | 93.0% | 18.0° | 35.0° | 2.0° | 11 | 56 | 0.78 | 5.62s | 16.50s | 33.57s | 132.0° | 161 | 15 |
| **L03** | Strong | Mid-Game Strong (Turn 1, prior 23.5°) | 89.5% | 18.0° | 35.0° | 2.0° | 15 | 55 | 0.78 | 9.35s | 27.90s | 44.52s | 170.0° | 123 | 15 |
| **L03** | Competent | Mid-Game Competent (Turn 1, prior 110°) | 90.1% | 18.0° | 36.0° | 1.0° | 14 | 55 | 0.71 | 5.22s | 19.43s | 30.18s | 100.0° | 219 | 22 |
| **L03** | Weak | Mid-Game Weak-Reasonable (Turn 1, prior 85.5°) | 94.2% | 18.0° | 36.0° | 1.0° | 7 | 47 | 0.62 | 5.25s | 13.58s | 20.28s | 23.0° | 189 | 16 |
| **L04** | Strong | Mid-Game Strong (Turn 1, prior 43°) | 95.9% | 18.0° | 36.0° | 4.0° | 13 | 68 | 0.82 | 6.53s | 20.98s | 26.43s | 14.0° | 133 | 12 |
| **L04** | Competent | Mid-Game Competent (Turn 1, prior 119.5°) | 90.1% | 19.0° | 35.0° | 1.0° | 13 | 50 | 0.73 | 5.27s | 15.82s | 22.23s | 60.0° | 200 | 15 |
| **L04** | Weak | Mid-Game Weak-Reasonable (Turn 1, prior 164°) | 85.4% | 18.0° | 35.0° | 1.0° | 8 | 38 | 0.72 | 5.02s | 12.52s | 14.67s | 142.0° | 157 | 13 |
| **L05** | Strong | Mid-Game Strong (Turn 1, prior 164.5°) | 91.8% | 18.0° | 35.0° | 2.0° | 10 | 43 | 0.74 | 5.77s | 16.60s | 12.78s | 93.0° | 107 | 9 |
| **L05** | Competent | Mid-Game Competent (Turn 1, prior 171.5°) | 85.4% | 18.0° | 37.0° | 1.0° | 12 | 37 | 0.78 | 5.13s | 13.17s | 11.00s | 16.0° | 97 | 8 |
| **L05** | Weak | Mid-Game Weak-Reasonable (Turn 1, prior 76.5°) | 88.3% | 18.0° | 36.0° | 1.0° | 9 | 52 | 0.62 | 5.38s | 12.28s | 16.25s | 48.0° | 177 | 11 |

---

## 3. Sensitivity Summary

- **Perturbation Discontinuity**: On Initial states, an angle perturbation of just $\pm 0.5^\circ$ materially alters physical outcomes in **80.6% to 86.5%** of all legal angles.
- **Mid-Game Volatility**: As rows descend, $\pm 1.0^\circ$ perturbation alters outcomes in **85.4% to 98.8%** of angles.
- **Root Cause**: Closely spaced block corners and point/circle reflections create extreme ray divergence after 2 or 3 rebounds.

---

## 4. Good-Angle Bandwidth

- **Top 10% Immediate Impact**: Cumulative bandwidth spans approximately $17.5^\circ$ to $19.0^\circ$ across all states.
- **Top 20% Composite Quality**: Cumulative bandwidth spans $34.5^\circ$ to $37.0^\circ$.
- **Contiguity Fragility**: The widest contiguous band of angles maintaining $\ge 80\%$ of maximum composite quality is only **0.5° to 1.0°** on initial states.
- **Isolated Spikes**: Between **7 and 37 isolated needles** (narrower than $1.0^\circ$) exist per state.

---

## 5. Pareto-Front Analysis

- **Frontier Size**: Between **37 and 71 non-dominated futures** exist per state across the 6 evaluated objective dimensions (Damage, Destroyed, Pickups, Danger Margin, Return Centerness, Negative Duration).
- **Substantive Trade-offs Identified**:
  1. *Immediate Destruction vs Return Point*: Deep bank penetration shots (e.g. $162.5^\circ$ on L02) clear back rows but strand the launcher at the wall ($x = 615\text{px}$).
  2. *Quick Turnover vs Heavy Volley*: Steep corridor shots ($88^\circ - 92^\circ$) resolve rapidly in ~4.1s but deal only 18 damage, whereas heavy volleys take 20s–44s.
  3. *Defense vs Offense*: Danger-preserving shots prioritize clearing the lowest descending block to maximize `dangerMargin`.

---

## 6. Policy Difficulty Matrix

*Deterministic campaign simulations across all 5 stages (15-turn cap).*

| Policy Strategy | L01 Win / Turns | L02 Win / Turns | L03 Win / Turns | L04 Win / Turns | L05 Win / Turns | Campaign Diagnosis |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **`random`** | 100% (7) | 100% (12) | 100% (9) | 75% (9) | 50% (10) | L01–L03 are trivially beaten by blind guessing; L05 drops to 50%. |
| **`median_quality`** | 0% (N/A) | 0% (N/A) | 0% (N/A) | 0% (N/A) | 0% (N/A) | Fails 100%: chipping without penetration leads to danger-line breach. |
| **`top20_random`** | 100% (4) | 100% (6) | 100% (6) | 100% (7) | 100% (8) | Consistent, reliable victory across all stages. |
| **`greedy_damage`** | 100% (4) | 100% (5) | 100% (6) | 100% (6) | 100% (8) |  |
| **`greedy_destruction`** | 100% (4) | 100% (4) | 100% (6) | 100% (5) | 100% (7) | Fastest completion turns on L02 & L04. |
| **`pickup_seeking`** | 100% (4) | 100% (4) | 100% (6) | 100% (6) | 100% (7) | Identical to damage/destruction policies. |
| **`danger_preserving`** | 100% (4) | 100% (7) | 100% (6) | 100% (6) | 100% (6) | Safest play, clears bottom threats early. |
| **`solver_strong`** | 100% (4) | 100% (4) | 100% (6) | 100% (6) | 100% (7) | Optimal composite performance. |

---

## 7. Preview-Value Proxy

- **Comparison**: Uninformed average play (`median_quality`) has **0% win rate** across all stages, whereas preview-informed play (`top20_random` or `solver_strong`) converts this to a **100% win rate**.
- **Assessment**: Preview access is strictly required to survive L04 and L05. However, on L01–L03, random guessing wins 100% of the time, meaning preview insight is trivialized on early stages.

---

## 8. Damage & Quality vs Duration Correlations (Pacing Coupling)

| Stage | $r_s(\text{Damage}, \text{Duration})$ | $r_s(\text{Quality}, \text{Duration})$ | Median Shot Dur | Top 10% Shot Dur | Best Shot Dur | Pacing Diagnosis |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **L01** | **+0.80 to +0.78** | **+0.83 to +0.76** | 7.6s – 7.9s | 19.2s – 22.5s | **52.3s** | Extreme tail wait on deep penetrating shots (up to 56.6s). |
| **L02** | **+0.67 to +0.85** | **+0.60 to +0.84** | 5.3s – 7.0s | 14.6s – 23.6s | **43.7s** | Severe punishment: top shots take 3.5× longer than median. |
| **L03** | **+0.65 to +0.78** | **+0.62 to +0.78** | 5.4s – 9.4s | 13.3s – 27.9s | **44.5s** | High waiting fatigue on multi-bank bank shots (up to 44.5s). |
| **L04** | **+0.58 to +0.82** | **+0.59 to +0.83** | 5.2s – 6.5s | 9.8s – 21.0s | **26.4s** | Moderate tail penalty. |
| **L05** | **+0.58 to +0.74** | **+0.61 to +0.78** | 5.3s – 5.8s | 13.0s – 16.6s | **12.8s** | Systematic wait inflation for successful precision. |

---

## 9. Return-Point (firstExitX) Leverage Evidence

*Quantified by partitioning Initial state shots into Left ($x < 240$), Center ($240 \le x \le 480$), and Right ($x > 480$) landing zones, and solving the resulting Next Turn.*

| Stage | Exit Bucket | Landing X | Next Turn Best Quality ($Q$) | Next Turn Robust Band Width | Strategic Implication |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **L01** | Left (<240px) | 228.7px | 226.6 | 46.4° | Low leverage (all launcher positions offer symmetric, high-quality next turns). |
| **L01** | Center (240-480px) | 319.2px | 214.6 | 46.4° | Low leverage (all launcher positions offer symmetric, high-quality next turns). |
| **L01** | Right (>480px) | 491.3px | 236.4 | 30.9° | Low leverage (all launcher positions offer symmetric, high-quality next turns). |
| **L02** | Left (<240px) | 191.1px | 181.8 | 46.4° |  |
| **L02** | Center (240-480px) | 392.6px | 275.7 | 30.9° |  |
| **L02** | Right (>480px) | 615.9px | 362.7 | 15.5° | High leverage: Right landing zone increases next-turn potency by +100%. |
| **L03** | Left (<240px) | 237.6px | 342.8 | 46.4° |  |
| **L03** | Center (240-480px) | 303.3px | 339.8 | 61.8° |  |
| **L03** | Right (>480px) | 549.1px | 198.8 | 46.4° | Severe asymmetry: Right wall trap reduces next-turn opportunity by -42%. |
| **L04** | Left (<240px) | 99.2px | 172.2 | 46.4° |  |
| **L04** | Center (240-480px) | 408.3px | 370.8 | 15.5° |  |
| **L04** | Right (>480px) | 561.7px | 545.2 | 30.9° | Decisive leverage: Right side offers 3.1× higher next-turn quality. |
| **L05** | Left (<240px) | 219.2px | 163.2 | 30.9° |  |
| **L05** | Center (240-480px) | 329.1px | 167.2 | 77.3° | Center return point doubles next-turn robust bandwidth. |
| **L05** | Right (>480px) | 528.5px | 141.2 | 46.4° |  |

---

## 10. Pickup Leverage Evidence

| Stage | Seeking Policy Win Rate | Seeking Median Turns | Avoiding Policy Win Rate | Avoiding Median Turns | Win Rate Delta ($\Delta$) | Strategic Value |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **L01** | 100% | 4 | 100% | 4 | **0%** | **Cosmetic: starting ball count clears stage without pickups.** |
| **L02** | 100% | 4 | 100% | 4 | **0%** | **Cosmetic: starting ball count clears stage without pickups.** |
| **L03** | 100% | 6 | 100% | 6 | **0%** | **Cosmetic: starting ball count clears stage without pickups.** |
| **L04** | 100% | 6 | 100% | 5 | **0%** | **Degenerate: avoiding policy was actually 1 turn faster.** |
| **L05** | 100% | 7 | 100% | 7 | **0%** | **Cosmetic: starting ball count clears stage without pickups.** |

---

## 11. Needle-Route & Exact-Gap Inventory

1. **12px Inter-Column Gap vs 12px Ball Diameter**:
   - The vertical corridor around $88.0^\circ$ to $92.0^\circ$ yields identical flat scores (18 damage, 1–2 destroyed) across all stages.
   - When incident rays enter 12px gaps between columns, alignment within $\pm 0.25^\circ$ squeezes through while $\pm 0.5^\circ$ deflects down.
2. **Needle Band Count**:
   - **L01**: 28 needle bands ($<1.0^\circ$ width).
   - **L02**: 16 needle bands ($<1.0^\circ$ width).
   - **L03**: 21 needle bands ($<1.0^\circ$ width).
   - **L04**: 26 needle bands ($<1.0^\circ$ width).
   - **L05**: 27 needle bands ($<1.0^\circ$ width).
3. **Classification**: **Accidental Degenerate Geometry** (micro-clearance artifacts between 12px balls and 12px corridors).

---

## 12. Per-Stage Primary Diagnosis

| Stage | Name | Primary Diagnosis | Evidence-Based Justification |
| :--- | :--- | :--- | :--- |
| **L01** | Direct | **TOO FORGIVING** | Random policy wins 100% in 7 turns; pickups offer 0% delta; widest contiguous band on initial state is only 0.5° despite trivial overall victory. |
| **L02** | Reflection | **PACING-HOSTILE** | Highest damage-duration correlation (r = 0.85); top shots take up to 43.7s; strong return-point leverage is masked by waiting fatigue. |
| **L03** | Double Reflection | **PACING-HOSTILE** | Volley durations reach 44.5s; right-side landing creates a severe punishment trap (Q = 198.8 vs 342.8 on left). |
| **L04** | Multiple Solutions | **STRATEGIC (Mixed)** | Genuine return-point divergence (Q = 545.2 right vs 172.2 left); random policy fails 25%; but pickups remain completely irrelevant (delta = 0%). |
| **L05** | Precision | **TOO NEEDLE-DEPENDENT** | 27 needle bands; 0.5° max contiguous bandwidth; random policy failure rate jumps to 50%; high reliance on micro-angle corridor squeezing. |

---

## 13. Ranked Redesign Priorities for P2

1. **Priority 1 — Decouple High Damage from Extreme Volley Duration (Pacing Fix)**: Cap redundant multi-reflection loops or add natural ball exit funnels in backfield cavities so high-scoring bank shots resolve in $\le 8\text{s}$ instead of 25s–56s.
2. **Priority 2 — Give Ball Pickups Genuine Strategic Leverage**: Reduce initial ball count (e.g. from 18–20 down to 8–12) and increase total wave HP so that picking up balls is mandatory to achieve sufficient DPS, creating a true strategic trade-off.
3. **Priority 3 — Widen Good-Angle Bandwidth & Eliminate 12px Degenerate Corridors**: Increase inter-block gaps from 12px to 16–18px (or reduce ball diameter to 10px) so corridor shots have a readable $2.0^\circ - 3.5^\circ$ entry window.
4. **Priority 4 — Retune Early Stage Difficulty Curve (L01/L02)**: Increase danger line proximity or reduce turn allowance so L01 and L02 cannot be beaten 100% of the time by blind random shots.

---

## 14. Verification & Gate Status

- **Audit Artifacts Saved**: `docs/DECISION_LANDSCAPE_AUDIT_02_RESULT.md` and `docs/landscape_audit_02_data.json`.
- **Audit Implementation**: Reusable analysis in `tests/decisionLandscapeAudit.js` and deterministic runner in `tests/runAudit02.js`.
- **Final Gate Status**: **`P1 DECISION LANDSCAPE AUDIT — FAIL`** *(Design validation gate closed with measured failure modes ready for P2 redesign)*.

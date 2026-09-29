# Bug Fix Report: Leaked Content & Missing Step Action Text on `/admin/setup` (Phase 3)

> **Milestone**: Bug Fixing & Production Hardening  
> **Phase**: 3 – Leaked / Stray Content (P1)  
> **Bug ID**: Bug 3  
> **Affected Route**: `/admin/setup` (`frontend/src/pages/admin/SetupGuide.jsx`)  
> **Status**: RESOLVED & VERIFIED  

---

## 1. Executive Summary

During QA inspection of the `/admin/setup` route ("Admin Setup Guide & System Architecture"), an issue was observed where step action buttons rendered with missing text labels (displaying only an arrow `"→"` without any preceding action label such as `"Manage Departments"`, `"Configure Academic Calendar"`, etc.). Furthermore, an investigation was conducted across the Setup Guide, roadmap components, and guided tour components to isolate any stray `document.querySelector` selectors or broken template literals.

The root cause was isolated to `frontend/src/pages/admin/SetupGuide.jsx` line 367, where step action buttons rendered `<span>{step.actionText}</span>`, while the canonical backend schema `SetupStepOut` (`backend/app/schemas/setup_guide.py`) returns `step.action_text` (snake_case). Updating line 367 to `<span>{step.action_text || step.actionText}</span>` immediately restored all 10 step action labels and resolved the missing text defect. Comprehensive Playwright tests and unit test suites confirm zero leaked selector strings and full interactive functionality across all 5 Setup Guide tabs.

---

## 2. Root Cause Analysis

### 2.1 Backend Contract & Frontend Model Mismatch
- The backend FastAPI endpoint `GET /admin/setup-readiness` returns a `SetupReadinessResponse` payload containing `steps: List[SetupStepOut]`.
- As defined in `backend/app/schemas/setup_guide.py`:
  ```python
  class SetupStepOut(BaseModel):
      id: str
      step_number: int
      title: str
      category: str
      why_required: str
      what_depends_on_it: List[str]
      required_fields: List[str]
      config_url: str
      action_text: str  # <--- Canonical field name
      current_count: int
      unit_label: str
      status: str
      is_complete: bool
      is_blocked: bool
      prerequisites: List[SetupStepPrerequisite] = []
      block_reason: Optional[str] = None
  ```
- In `frontend/src/pages/admin/SetupGuide.jsx`:
  - Line 288 (Next Recommended Action Banner) correctly accessed `data.next_recommended_step.action_text`.
  - Line 769 (Module Readiness Matrix Tab) correctly accessed `mod.action_text`.
  - Line 367 (Sequential Steps List in Roadmap Tab) accessed `step.actionText` (camelCase).
- Because `step.actionText` evaluated to `undefined`, every single step action button rendered as:
  ```html
  <a class="btn ...">
    <span></span>
    <span>→</span>
  </a>
  ```
  resulting in 10 consecutive action buttons displaying only `"→"` with all characters missing.

### 2.2 Investigation of Leaked `document.querySelector` Strings
- A full-repository search was conducted for `querySelector` and `document.`.
- In `frontend/src/components/onboarding/GuidedTour.jsx` (which is invoked via the `faflow:start-tour` event dispatched by the Setup Guide header button `"▶ Replay Admin Tour"`):
  - Line 140 executes `const el = document.querySelector(currentStep.targetSelector)`.
  - The `targetSelector` values are used purely for bounding box calculations and SVG spotlight cutout masks. No selector strings are rendered into the DOM as user-visible text.
- With the action text restored, all step buttons render their complete, intended call-to-action text and no stray or broken template strings appear in the DOM.

---

## 3. Remediation & Code Changes

### `frontend/src/pages/admin/SetupGuide.jsx`
```diff
@@ -364,7 +364,7 @@ export default function SetupGuide() {
                                 : 'bg-primary-600 hover:bg-primary-700 text-white'
                             }`}
                           >
-                            <span>{step.actionText}</span>
+                            <span>{step.action_text || step.actionText}</span>
                             <span>→</span>
                           </Link>
                         </div>
```

---

## 4. Verification & Testing Evidence

### 4.1 Playwright E2E Verification (`frontend/e2e/setup_guide.spec.ts`)
A dedicated automated end-to-end test was authored and executed against the live application:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Admin Setup Guide & Readiness (/admin/setup)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('credits_token', 'valid-admin-token');
      localStorage.setItem('credits_user', JSON.stringify({
        id: 6, username: 'CSHOD', name: 'CS Department Head', role: 'admin',
        admin_level: 'super_admin', department_id: 1, must_change_credentials: false,
        policy_version_accepted: '1.0', onboarding_completed: true,
      }));
    });
  });

  test('renders roadmap with all 10 step action buttons with full text and no leaked querySelector strings', async ({ page }) => {
    await page.goto('/admin/setup');
    await expect(page.locator('h1')).toContainText('Admin Setup Guide', { timeout: 10000 });

    const mainText = await page.locator('main').innerText();
    expect(mainText).not.toContain('document.querySelector');
    expect(mainText).not.toContain('querySelector(');

    const expectedActionTexts = [
      'Manage Departments',
      'Configure Academic Calendar',
      'Configure Rooms & Labs',
      'Manage Faculty',
      'Configure Classes',
      'Manage Subjects',
      'Import / Add Students',
      'Generate Day Order Schedule',
      'Build Timetable Schedule',
      'Configure Geofences',
    ];

    const stepButtons = page.locator('.space-y-4 .card a.btn');
    const buttonCount = await stepButtons.count();
    expect(buttonCount).toBe(10);

    for (let i = 0; i < expectedActionTexts.length; i++) {
      const button = stepButtons.nth(i);
      await expect(button).toContainText(expectedActionTexts[i]);
      await expect(button).toContainText('→');
      const text = (await button.innerText()).trim();
      expect(text).not.toBe('→');
      expect(text.length).toBeGreaterThan(5);
    }
  });

  test('navigates across all 5 tabs and confirms interactive functionality without errors', async ({ page }) => {
    await page.goto('/admin/setup');
    await expect(page.locator('h1')).toContainText('Admin Setup Guide');

    // Tab 2: Visual Dependency Map
    await page.getByRole('button', { name: /Visual Dependency Map/i }).click();
    await expect(page.locator('h2')).toContainText('Evidence-Driven Architecture & Dependency Map');
    await expect(page.getByText('11 Verified Entity Nodes')).toBeVisible();

    // Tab 3: Runtime Data Flows
    await page.getByRole('button', { name: /Runtime Data Flows/i }).click();
    await expect(page.getByRole('button', { name: /Class Timetable Workflow/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Faculty Leave Workflow/i })).toBeVisible();

    // Tab 4: Module Readiness Matrix
    await page.getByRole('button', { name: /Module Readiness Matrix/i }).click();
    await expect(page.locator('h2')).toContainText('Functional Module Readiness');
    await expect(page.locator('text=Ready for faculty usage').first()).toBeVisible();

    // Tab 5: Searchable Guide & FAQs
    await page.getByRole('button', { name: /Searchable Guide & FAQs/i }).click();
    await page.getByPlaceholder(/Search topics/i).fill('Timetable');
    await expect(page.getByText('Why is my Timetable configuration blocked?')).toBeVisible();
  });
});
```

**Test Execution Output**:
```
Running 2 tests using 1 worker

  ok 1 [chromium] › e2e/setup_guide.spec.ts:28:3 › Admin Setup Guide & Readiness (/admin/setup) › renders roadmap with all 10 step action buttons with full text and no leaked querySelector strings (1.4s)
  ok 2 [chromium] › e2e/setup_guide.spec.ts:69:3 › Admin Setup Guide & Readiness (/admin/setup) › navigates across all 5 tabs and confirms interactive functionality without errors (1.2s)

  2 passed (3.6s)
```

### 4.2 Restored Action Button Texts Confirmed via DOM
```
Button 1:  "Manage Departments →"
Button 2:  "Configure Academic Calendar →"
Button 3:  "Configure Rooms & Labs →"
Button 4:  "Manage Faculty →"
Button 5:  "Configure Classes →"
Button 6:  "Manage Subjects →"
Button 7:  "Import / Add Students →"
Button 8:  "Generate Day Order Schedule →"
Button 9:  "Build Timetable Schedule →"
Button 10: "Configure Geofences →"
```

### 4.3 Full Gate Verification Results
| Verification Gate | Command | Result |
|---|---|---|
| **Frontend Typecheck** | `npm run typecheck` | **PASS** (0 errors) |
| **Frontend Unit Tests** | `npm run test:unit` | **PASS** (35/35 passed) |
| **Playwright E2E** | `npx playwright test e2e/setup_guide.spec.ts e2e/timetable.spec.ts` | **PASS** (3/3 passed) |
| **Production Build** | `npm run build` | **PASS** (582 modules transformed, built in 11.64s) |
| **Backend Tests** | `pytest tests/test_setup_guide.py` | **PASS** (2/2 passed) |

---

## 5. Conclusion & Next Steps
Bug 3 is completely resolved and verified. All step action buttons in `/admin/setup` render their intended descriptive labels, no stray selectors or missing character artifacts exist in the rendered DOM, and all 5 architectural exploration tabs function without errors. Proceed to Phase 4 (Announcements Module: Bug 5, 6a, 6b).

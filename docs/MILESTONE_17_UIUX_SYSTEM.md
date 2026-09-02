# Milestone 17 — FAFLOW Mobile UI/UX Design System

### 1. Design Philosophy
The FAFLOW mobile user interface follows a calm, mature, institutional aesthetic suitable for faculty and academic leaders:
- **Clarity over Clutter**: Information is prioritized into scannable metric cards, status badges, and action tiles.
- **Fast Execution**: Critical faculty actions (e.g. attendance punch, leave submission, substitute assignment) are achievable in under 3 taps.
- **Institutional Palette**: Premium deep slates, indigo accents, emerald confirmations, and amber warnings replace generic primary colors.

---

### 2. Design Tokens (`FaflowDesignTokens.kt`)

#### Spacing Scale
- `xxs`: 2dp
- `xs`: 4dp
- `sm`: 8dp
- `md`: 12dp
- `lg`: 16dp
- `xl`: 20dp
- `xxl`: 24dp
- `xxxl`: 32dp

#### Corner Radius Scale (`FaflowShapes`)
- `small`: 8dp (Buttons, chips)
- `medium`: 12dp (Input fields, dropdowns)
- `card`: 16dp (Metric & action cards)
- `large`: 20dp (Dialogs, modals)
- `sheet`: 24dp (Bottom sheets)
- `pill`: 50% (Badges, primary action pills)

#### Role Badge Palette
- **Faculty / Teacher**: Indigo (`#4F46E5` on `#EEF2FF`)
- **HOD / Department Admin**: Purple (`#7C3AED` on `#F5F3FF`)
- **Principal**: Amber (`#D97706` on `#FFFBEB`)
- **Governance**: Sky (`#0284C7` on `#F0F9FF`)

#### Status Palette
- **Approved / Active / Present**: Emerald (`#059669` on `#ECFDF5`)
- **Pending / In Review**: Amber (`#D97706` on `#FFFBEB`)
- **Rejected / Absent**: Red (`#DC2626` on `#FEF2F2`)
- **Cancelled / Neutral**: Slate (`#64748B` on `#F8FAFC`)

---

### 3. Core Component Library
1. **`PremiumTopBar.kt`**: Institutional top app bar with title, subtitle, role badge, action icons, and smooth status-bar insets.
2. **`FaflowBadges.kt`**: `DayOrderBadge`, `RoleBadge`, `StatusBadge`.
3. **`FaflowCards.kt`**: `MetricCard`, `ActionCard`, `SectionHeader`.
4. **`MainBottomNavigation.kt`**: Role-aware navigation bar dynamically switching between Teacher (4 tabs) and HOD (5 tabs).

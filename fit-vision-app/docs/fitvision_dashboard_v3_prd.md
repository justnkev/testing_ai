**Product Requirements Document (PRD)**  
**Feature Name:** FitVision Dashboard Data Visualizations  
**Owner:** Product Manager  
**Developer Lead:** Codex Agent  
**Last Updated:** 2025-12-18  

---

### 1. **Overview**
This PRD outlines the requirements for enhancing the FitVision app by adding a new **Dashboard page** that visualizes users' historical health data. The goal is to enable users to identify patterns, understand their behaviors, and make informed decisions on improving their wellness. This upgrade is foundational to increasing user engagement and sets the stage for future integrations with wearable devices.

### 2. **Goals**
- Enable users to analyze trends in their macros, sleep, and workouts.
- Simplify complex data into clean, easy-to-understand visualizations.
- Drive engagement through visual feedback.
- Encourage reflection and next-step behavior (e.g., improving sleep, consistency in workouts).

### 3. **Target Users**
- Casual individuals seeking to live healthier lives.
- Likely lack deep health knowledge or structured routines.
- Need clarity, motivation, and ease of understanding.

### 4. **Data Sources**
All visualizations are powered by the existing Supabase schema:

- **meals** table:
  - `protein_g`, `fat_g`, `carbs_g`, `calories`, `meal_type`, `date_inferred`
- **sleep** table:
  - `time_asleep` (text), `quality`, `date_inferred`
- **workouts** table:
  - `workout_type`, `duration_min`, `date_inferred`
- **progress_logs** (links all entries via `progress_log_id` and contains `date_inferred`)

---

### 5. **Features & Functionality**

#### 5.1 Dashboard Page (New Route)
A new `/dashboard` page will be created that includes:

##### a. **Macros Overview (Stacked Bar Chart)**
- **Chart Type:** Stacked bar chart
- **X-axis:** Date (grouped by Day / Week / Month toggle)
- **Y-axis:** Grams of macros
- **Stacked Sections:** Protein, Carbs, Fat
- **Data Source:** Aggregate meals by `date_inferred` using `progress_log_id`
- **Additional Info:** Tooltip shows calorie count and macro breakdown per time unit

##### b. **Sleep Duration by Quality (Grouped Bar Chart)**
- **Chart Type:** Grouped bar chart
- **X-axis:** Date (grouped by Day / Week / Month toggle)
- **Y-axis:** Hours asleep (parsed from `time_asleep`)
- **Groupings:** Sleep quality (e.g., Good, Fair, Poor)
- **Data Source:** sleep table + progress_log_id + date_inferred
- **Additional Info:** Tooltip on hover shows exact hours

##### c. **Workout Sessions by Type (Donut or Bar Chart)**
- **Chart Type:** Donut chart or horizontal bar chart (mobile responsive option)
- **Data Bucketing:** Count of workouts by `workout_type`, grouped by time frame (Day / Week / Month)
- **Data Source:** workouts table + progress_log_id + date_inferred
- **Additional Info:** Show total duration per type on hover or as side label

##### d. **Time Filter Toggle (Global UI Control)**
- Controls all visualizations
- Options: Daily / Weekly / Monthly
- Default: Weekly
- Updates all charts with selected time granularity

---

### 6. **Technical Requirements**
- **Frontend Stack:** Python (logic), JavaScript (interactivity), HTML/CSS (markup/styling)
- **Deployment Platform:** Vercel (Web App)
- **Charting Library:** Use a responsive JavaScript charting library (e.g., Chart.js, D3.js, or Recharts)
- **State Management:** Maintain selected time filter globally using React context or a simple global store.
- **Parsing:** Convert `time_asleep` (text) into float hours server-side or in frontend utils.
- **Responsiveness:** Charts should be fully mobile-responsive with collapsible views if needed.

---

### 7. **User Experience (UX) Requirements**
- Clear labeling of all axes and tooltips.
- Use of color schemes to distinguish data categories (e.g., different macro types, sleep qualities).
- Smooth transitions/animations between time ranges.
- Default view should offer a "Weekly" summary to give a meaningful snapshot.
- Charts should have brief summary cards above or below (e.g., "Avg Sleep: 6.8 hrs / week").

---

### 8. **Success Metrics**
- % of returning users who view the dashboard at least once/week
- Increase in session time post-dashboard release
- User feedback scores around clarity and usefulness
- Engagement rate with different chart tabs (e.g., which chart is used most)

---

### 9. **Future Considerations**
- Integrate data from wearables (Apple Health, Fitbit, etc.)
- Add recommendations (e.g., "Try increasing protein intake on workout days")
- Weekly email summaries pulling from dashboard trends

---

### 10. **Open Questions / Dependencies**
- Should data be cached per user for faster dashboard loads?
- Will the Codex agent auto-generate chart components, or should pre-built chart templates be used?
- Do we want to allow CSV export of dashboard data?
- Need decision on charting library: Chart.js (simple) vs D3.js (powerful but complex)?

---


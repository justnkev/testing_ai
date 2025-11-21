# Product Requirements Document (PRD)

## Feature: Dashboard Visualizations for Meals, Workouts, and Sleep

---

### Overview
Enhance the Fitvision user dashboard by visualizing health data—specifically meals, workouts, and sleep—using sleek, minimalist charts and data displays. This feature aims to improve user engagement, comprehension, and behavior tracking by making progress easy to see and understand at a glance.

---

### Problem Statement
While users log valuable health data (meals, workouts, and sleep), there is currently no structured, visual way to track this information in the app. Without intuitive visual feedback, users lack motivation and awareness of patterns or progress.

---

### Objective
Create a clean, modern dashboard that allows users to:
- View **graphical representations** of their meals, workouts, and sleep.
- Easily **digest trends over time**.
- Quickly **identify areas for improvement**.

---

### Platforms
- Web App (hosted on Vercel)
- Built with Python, HTML, CSS, and JavaScript

---

### Users Impacted
- All active users accessing their dashboard

---

### Key Features

#### 1. **Dashboard Layout**
- **Sectioned Interface**: Display three main sections: Meals, Workouts, Sleep
- **Responsive Design**: Optimized for desktop and mobile views
- **Lightweight Aesthetic**: Flat design, minimal color palette, smooth animations

#### 2. **Visualization Types**
| Data Type | Chart Type   | Description                             |
|-----------|--------------|-----------------------------------------|
| Meals     | Bar Chart    | Daily caloric intake                    |
| Workouts  | Line Chart   | Workout duration per day/week          |
| Sleep     | Area Chart   | Hours of sleep tracked over 7 days     |

- Tooltips on hover for additional data
- Toggle between **daily**, **weekly**, and **monthly** views

#### 3. **Visualization Library**
- Use [Recharts](https://recharts.org/en-US/) (or Chart.js as backup)
- Animate on data load and updates
- Exportable chart components

---

### Supabase Schema Recommendations

#### Table: `meals`
| Column        | Type     | Description                      |
|---------------|----------|----------------------------------|
| `id`          | `uuid`   | Primary key                      |
| `user_id`     | `uuid`   | Foreign key to `auth.users.id`   |
| `created_at`  | `timestamp` | Meal log timestamp            |
| `meal_type`   | `text`   | e.g., breakfast, lunch, dinner   |
| `calories`    | `int4`   | Caloric value                    |
| `metadata`    | `jsonb`  | Optional macros, notes, etc.     |

#### Table: `workouts`
| Column        | Type     | Description                      |
|---------------|----------|----------------------------------|
| `id`          | `uuid`   | Primary key                      |
| `user_id`     | `uuid`   | Foreign key to `auth.users.id`   |
| `created_at`  | `timestamp` | Workout timestamp             |
| `workout_type`| `text`   | e.g., running, yoga, strength     |
| `duration_min`| `int4`   | Duration in minutes              |
| `metadata`    | `jsonb`  | Optional: calories burned, notes |

#### Table: `sleep`
| Column        | Type     | Description                      |
|---------------|----------|----------------------------------|
| `id`          | `uuid`   | Primary key                      |
| `user_id`     | `uuid`   | Foreign key to `auth.users.id`   |
| `start_time`  | `timestamp` | Sleep start time              |
| `end_time`    | `timestamp` | Sleep end time                |
| `quality`     | `text`   | Optional: subjective quality      |
| `metadata`    | `jsonb`  | Device data, sleep phases, etc.  |

---

### Technical Requirements
- Use Supabase client to query new data types
- Use charting library to render graphs dynamically
- Cache or throttle chart rendering for performance

---

### Success Metrics
- Increased dashboard engagement (views per user/week)
- Increased logging of meals, workouts, and sleep
- Positive user feedback or NPS improvement

---

### Appendix
- Supabase Auth Docs: [https://supabase.com/docs/guides/auth](https://supabase.com/docs/guides/auth)
- Supabase client JS: [https://supabase.com/docs/reference/javascript](https://supabase.com/docs/reference/javascript)


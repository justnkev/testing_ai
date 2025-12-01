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
| Meals     | Bar Chart    | Daily/weekly/monthly caloric intake     |
| Workouts  | Line Chart   | Workouts per week/month                 |
| Sleep     | Area Chart   | Hours of sleep tracked per week/month   |

- Tooltips on hover for additional data
- Toggle between **daily**, **weekly**, and **monthly** views

#### 3. **Visualization Library**
- Use [Recharts](https://recharts.org/en-US/) (or Chart.js as backup)
- Animate on data load and updates
- Exportable chart components

---

### Supabase Schema

Database Schema Documentation

Table: conversations
--------------------------------------------------------------
| Column Name       | Data Type   | Key / Relations          |
|-------------------|-------------|--------------------------|
| id                | int8        | Primary Key              |
| user_id           | uuid        | FK -> auth.users.id      |
| updated_at        | timestamptz |                          |
| conversation_type | text        |                          |
| history           | jsonb       |                          |
| conversation_data | jsonb       |                          |

Table: profiles
--------------------------------------------------------------
| Column Name       | Data Type   | Key / Relations          |
|-------------------|-------------|--------------------------|
| id                | uuid        | Primary Key, FK -> auth  |
| created_at        | timestamptz |                          |
| display_name      | text        |                          |
| email             | varchar     |                          |

Table: user_plans
--------------------------------------------------------------
| Column Name       | Data Type   | Key / Relations          |
|-------------------|-------------|--------------------------|
| id                | int8        | Primary Key              |
| updated_at        | timestamptz |                          |
| user_id           | uuid        | FK -> auth.users.id      |
| plan_data         | jsonb       |                          |

Table: user_onboarding
--------------------------------------------------------------
| Column Name       | Data Type   | Key / Relations          |
|-------------------|-------------|--------------------------|
| user_id           | uuid        | Primary Key, FK -> auth  |
| is_complete       | bool        |                          |

Table: visualizations
--------------------------------------------------------------
| Column Name          | Data Type   | Key / Relations       |
|----------------------|-------------|-----------------------|
| id                   | uuid        | Primary Key           |
| user_id              | uuid        | FK -> auth.users.id   |
| created_at           | timestamptz |                       |
| original_image_url   | text        |                       |
| generated_image_url  | text        |                       |
| metadata             | jsonb       |                       |

Table: workouts
--------------------------------------------------------------
| Column Name       | Data Type   | Key / Relations          |
|-------------------|-------------|--------------------------|
| id                | uuid        | Primary Key              |
| user_id           | uuid        | FK -> auth.users.id      |
| created_at        | timestamptz |                          |
| workout_type      | text        |                          |
| duration_min      | int4        |                          |
| metadata          | jsonb       |                          |
| date_inferred     | date        |                          |
| progress_log_id   | int8        | FK -> progress_logs.id   |

Table: sleep
--------------------------------------------------------------
| Column Name       | Data Type   | Key / Relations          |
|-------------------|-------------|--------------------------|
| user_id           | uuid        | FK -> auth.users.id      |
| quality           | text        |                          |
| metadata          | jsonb       |                          |
| id                | int8        | Primary Key              |
| time_asleep       | text        |                          |
| created_at        | timestamptz |                          |
| date_inferred     | date        |                          |
| progress_log_id   | int8        | FK -> progress_logs.id   |

Table: meals
--------------------------------------------------------------
| Column Name       | Data Type   | Key / Relations          |
|-------------------|-------------|--------------------------|
| user_id           | uuid        | FK -> auth.users.id      |
| created_at        | timestamptz |                          |
| meal_type         | text        |                          |
| calories          | int4        |                          |
| metadata          | jsonb       |                          |
| id                | int8        | Primary Key              |
| date_inferred     | date        |                          |
| progress_log_id   | int8        | FK -> progress_logs.id   |

Table: progress_logs
--------------------------------------------------------------
| Column Name       | Data Type   | Key / Relations          |
|-------------------|-------------|--------------------------|
| id                | int8        | Primary Key              |
| created_at        | timestamptz |                          |
| user_id           | uuid        | FK -> auth.users.id      |
| log_data          | jsonb       |                          |

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


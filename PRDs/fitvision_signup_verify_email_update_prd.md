# Product Requirements Document (PRD)

## Feature: Improved Signup and Email Verification Flow

---

### Overview
Improve the post-signup experience on the Fitvision web app by adding a dedicated email verification guidance page. This new flow will reduce user confusion by clearly instructing them to verify their email and return to continue onboarding.

---

### Problem Statement
Currently, when users sign up by entering their name, email, and password, an authentication email is sent. However, the app attempts to log them in immediately—even though their email is not yet verified. This results in an error that says the profile could not be created, causing confusion and frustration. Users think the signup failed, when in fact it is pending email verification.

Additionally, the current signup form does not include a "Confirm Password" field. This leads to situations where users mistype their password, which is then saved incorrectly in the system. They are unable to log in even after verifying their email, which results in user frustration and abandonment.

---

### Objective
To increase successful user onboarding by improving clarity in the signup process. We aim to:
- Clearly inform users that a verification email has been sent.
- Provide instructions on what to do next.
- Allow users to resend the email if needed.
- Let users refresh once verified to continue into the app.
- Reduce password-related login issues by adding a password confirmation field.

---

### Platforms
- Web App
- Hosted on Vercel
- Built using Python, HTML, CSS, and JavaScript

---

### Users Impacted
- All new users signing up via the Fitvision signup form.

---

### Proposed Solution

#### 1. **Signup Flow Update**
After successful signup and triggering of the verification email, redirect the user to a new page:

**Route:** `/verify-email`

#### 2. **New Email Verification Page**

##### Page Elements:
- Fitvision logo and branding
- Message: "✅ Your account has been created!"
- Sub-message: "We've sent a verification email to [user@email.com]."
- Instructional text:
  - "Please check your inbox and click the link in the email to verify your account."
  - "Don't forget to check your spam or junk folder."
- Button: **Resend Email**
- Button: **I’ve Verified My Email (Refresh)**
- Optional: Loading spinner, visuals, or animations to make the page engaging

##### Behavior:
- **Resend Email:** Sends a new authentication email using Supabase’s `auth.resend` API.
- **I’ve Verified My Email:** Triggers a call to `auth.getUser()` (or equivalent) to check if the email is verified. If verified, redirect to `/onboarding`.
- If not verified, show a toast/alert: "Email still not verified. Please check your inbox."

#### 3. **Add Confirm Password Field**

##### Field Addition:
- Add a new input field labeled **"Confirm Password"** below the password field on the signup form.

##### Validation Logic:
- Require that the "Password" and "Confirm Password" fields match before submission.
- If they do not match, display a clear error message: "Passwords do not match."

##### UX Considerations:
- Ensure validation is shown in real-time (on field blur or form submit).
- Prevent form submission if passwords do not match.

---

### Technical Requirements

#### Backend / Auth
- Leverage Supabase Auth for email signups and verification status checks
- Use Supabase client SDK to resend verification email

#### Frontend
- Build new page using existing component structure (HTML/CSS/JS)
- Integrate with current routing (e.g., Next.js or static router)
- Ensure accessibility and mobile responsiveness
- Add frontend validation for password confirmation field

#### Edge Hosting (Vercel)
- No changes needed to infrastructure

---

### Success Metrics
- Reduction in support messages related to signup/login confusion
- Increased % of users completing onboarding after signup
- Fewer login failures caused by password typos

---

### Appendix
- Supabase Auth Docs: [https://supabase.com/docs/guides/auth](https://supabase.com/docs/guides/auth)

---

## Supabase Database Schema (Markdown)

---

### Table: `profiles`

| Column          | Type        | Description                  |
| --------------- | ----------- | ---------------------------- |
| `id`            | `uuid`      | Primary key                  |
| `created_at`    | `timestamp` | Timestamp of record creation |
| `display_name`  | `text`      | User's display name          |
| `email`         | `varchar`   | User's email address         |
| **Foreign Key** |             | `auth.users.id`              |

---

### Table: `user_plans`

| Column          | Type        | Description                  |
| --------------- | ----------- | ---------------------------- |
| `id`            | `int8`      | Primary key                  |
| `updated_at`    | `timestamp` | Last updated timestamp       |
| `user_id`       | `uuid`      | Reference to user            |
| `plan_data`     | `jsonb`     | Subscription or plan details |
| **Foreign Key** |             | `auth.users.id`              |

---

### Table: `progress_logs`

| Column          | Type        | Description               |
| --------------- | ----------- | ------------------------- |
| `id`            | `int8`      | Primary key               |
| `created_at`    | `timestamp` | Timestamp of progress log |
| `user_id`       | `uuid`      | Reference to user         |
| `log_data`      | `jsonb`     | Progress tracking data    |
| **Foreign Key** |             | `auth.users.id`           |

---

### Table: `conversations`

| Column              | Type        | Description                            |
| ------------------- | ----------- | -------------------------------------- |
| `id`                | `int8`      | Primary key                            |
| `user_id`           | `uuid`      | Reference to user                      |
| `updated_at`        | `timestamp` | Last updated timestamp                 |
| `conversation_type` | `text`      | Type of conversation (e.g., AI, coach) |
| `history`           | `jsonb`     | Message history                        |
| `conversation_data` | `jsonb`     | Metadata or context info               |
| **Foreign Key**     |             | `auth.users.id`                        |

---

### Table: `user_onboarding`

| Column          | Type   | Description                    |
| --------------- | ------ | ------------------------------ |
| `user_id`       | `uuid` | Primary key / foreign key      |
| `is_complete`   | `bool` | Whether onboarding is finished |
| **Foreign Key** |        | `auth.users.id`                |

---

### Table: `visualizations`

| Column                | Type        | Description                           |
| --------------------- | ----------- | ------------------------------------- |
| `id`                  | `int8`      | Primary key                           |
| `user_id`             | `uuid`      | Reference to user                     |
| `created_at`          | `timestamp` | Timestamp of image creation           |
| `original_image_url`  | `text`      | URL of uploaded image                 |
| `generated_image_url` | `text`      | URL of AI-generated visualization     |
| `metadata`            | `jsonb`     | Additional info (e.g., prompt, style) |
| **Foreign Key**       |             | `auth.users.id`                       |

---


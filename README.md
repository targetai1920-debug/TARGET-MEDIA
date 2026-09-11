# Target Media

Static animated landing page for Target Media.

## Current product positioning

- **Monitor — €299 / quarter / location**
- **Standard installation and initial configuration are included**
- **Intelligence — roadmap only / disabled**
- **Growth Partner — roadmap only / disabled**
- Monitor is the only plan currently offered for purchase.

## Current application flow

1. Visitor clicks **Apply for Monitor** and goes to `apply.html`.
2. Visitor submits business, contact, location and technical-fit information only.
3. No appointment date or time is requested during the application.
4. Target Media reviews whether the location is suitable.
5. Approved customers receive a unique approval code.
6. The approval code is verified server-side before a payment link is revealed.
7. The customer completes payment.
8. After payment is confirmed, the customer is redirected to `schedule.html`.
9. The installation calendar then becomes available.
10. Service hours are Monday–Sunday, 09:00–18:00, with unavailable dates/times supplied by the connected calendar.
11. The customer chooses an installation date and time.
12. After booking confirmation, Target Media proceeds with installation.

Important: approval codes and payment status must never be trusted from public frontend code. Render/server-side logic must verify both before payment or scheduling is unlocked.

## Privacy / compliance posture of current website build

- No analytics scripts.
- No advertising pixels.
- No cookies set by the site code.
- No external font loading.
- No third-party embeds.
- Public dashboard metrics and charts are explicitly labelled as illustrative sample data.
- No customer reviews/testimonials are shown.
- Legal pages included: Privacy Policy, Terms & Conditions, Cookie Policy, Refund Policy, Accessibility Statement.
- Main page and application page include keyboard focus styles and labelled controls. The post-payment scheduling page includes keyboard-friendly date/time controls.
- Application data is not transmitted until the Google Apps Script endpoint is connected.

## IMPORTANT pre-launch blockers

Before accepting paid orders, replace the legal-identity gap in the legal pages with the real:

1. Full registered legal name and trade name.
2. KVK number.
3. VAT ID (if applicable).
4. Physical/visiting address.
5. Working email address and phone/chat contact.
6. Formal complaints contact/procedure.

Before turning on the application endpoint, update the Privacy Policy with the final Google/Apps Script/Sheets data flow, retention, access and processor information.

For every camera deployment, complete a site-specific privacy assessment and document controller/processor roles, lawful basis, field of view, signage, retention, security, processor agreements and whether a DPIA is required.

## Run locally

Open `index.html` directly in a browser.

## Deploy with GitHub Pages

In the repository settings, enable **Pages** and deploy from the `main` branch/root folder.

## Re-audit triggers

Re-run privacy, cookie, accessibility and legal review before activating the application backend, analytics, third-party widgets, video/maps, chat, login, payments, customer reviews, new camera/AI features or a different production hosting stack.

import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT_DIR = "C:\\Users\\Admin\\Pictures\\job-board\\.codex-presentations\\jobforge-features";
const FINAL_PPTX = "C:\\Users\\Admin\\Pictures\\job-board\\JobForge-Feature-Overview.pptx";
const LOGO_PATH = "C:\\Users\\Admin\\Pictures\\job-board\\public\\brand\\jobforge-master.png";

const W = 1280;
const H = 720;
const C = {
  bg: "#0d0d0f",
  panel: "#17171b",
  panel2: "#202025",
  white: "#f7f7f5",
  muted: "#a3a3ad",
  soft: "#d7d7dc",
  yellow: "#f5c400",
  yellowSoft: "#2a2508",
  line: "#34343b",
  red: "#ef6c6c",
  green: "#78d49a",
};

function addShape(slide, geometry, left, top, width, height, fill = "none", lineFill = "none", lineWidth = 0) {
  return slide.shapes.add({
    geometry,
    position: { left, top, width, height },
    fill,
    line: { style: "solid", fill: lineFill, width: lineWidth },
  });
}

function addText(slide, text, left, top, width, height, style = {}) {
  const shape = addShape(slide, "textbox", left, top, width, height);
  shape.text = text;
  shape.text.style = {
    fontFamily: "Arial",
    fontSize: style.fontSize ?? 20,
    color: style.color ?? C.white,
    bold: style.bold ?? false,
    alignment: style.alignment ?? "left",
    italic: style.italic ?? false,
  };
  return shape;
}

function addImage(slide, blob, left, top, width, height, alt = "JobForge") {
  slide.images.add({
    blob,
    contentType: "image/png",
    alt,
    fit: "contain",
    position: { left, top, width, height },
  });
}

function addRule(slide, left, top, width, color = C.line, height = 2) {
  addShape(slide, "rect", left, top, width, height, color);
}

function addFooter(slide, index) {
  addRule(slide, 72, 676, 1136, C.line, 1);
  addText(slide, "JOBFORGE / PRODUCT OVERVIEW", 72, 687, 400, 18, {
    fontSize: 12,
    color: C.muted,
    bold: true,
  });
  addText(slide, String(index).padStart(2, "0"), 1160, 687, 48, 18, {
    fontSize: 12,
    color: C.yellow,
    bold: true,
    alignment: "right",
  });
}

function addHeader(slide, eyebrow, title, subtitle = "") {
  addText(slide, eyebrow.toUpperCase(), 72, 48, 520, 24, {
    fontSize: 13,
    color: C.yellow,
    bold: true,
  });
  addText(slide, title, 72, 82, 1120, 64, {
    fontSize: 38,
    color: C.white,
    bold: true,
  });
  if (subtitle) {
    addText(slide, subtitle, 72, 148, 1120, 38, {
      fontSize: 19,
      color: C.muted,
    });
  }
}

function addBullet(slide, text, left, top, width, options = {}) {
  addShape(slide, "roundRect", left, top + 7, 10, 10, options.dotColor ?? C.yellow);
  addText(slide, text, left + 24, top, width - 24, options.height ?? 36, {
    fontSize: options.fontSize ?? 18,
    color: options.color ?? C.soft,
    bold: options.bold ?? false,
  });
}

function addBullets(slide, items, left, top, width, gap = 42, options = {}) {
  items.forEach((item, index) => addBullet(slide, item, left, top + index * gap, width, options));
}

function addBand(slide, label, text, left, top, width, accent = C.yellow) {
  addRule(slide, left, top, 5, accent, 62);
  addText(slide, label.toUpperCase(), left + 22, top + 2, width - 22, 20, {
    fontSize: 12,
    color: accent,
    bold: true,
  });
  addText(slide, text, left + 22, top + 26, width - 22, 34, {
    fontSize: 20,
    color: C.white,
    bold: true,
  });
}

function addStep(slide, number, title, body, left, top, width) {
  addText(slide, number, left, top, 62, 58, {
    fontSize: 42,
    color: C.yellow,
    bold: true,
  });
  addText(slide, title, left + 74, top + 2, width - 74, 30, {
    fontSize: 22,
    color: C.white,
    bold: true,
  });
  addText(slide, body, left + 74, top + 35, width - 74, 52, {
    fontSize: 16,
    color: C.muted,
  });
}

async function readImageBlob(path) {
  const bytes = await fs.readFile(path);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function newSlide(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = C.bg;
  return slide;
}

function slide01(p, logo) {
  const s = newSlide(p);
  addRule(s, 72, 70, 112, C.yellow, 6);
  addText(s, "JOBFORGE", 72, 94, 360, 28, { fontSize: 16, color: C.yellow, bold: true });
  addText(s, "The complete product story", 72, 176, 760, 88, { fontSize: 54, color: C.white, bold: true });
  addText(s, "A job marketplace and hiring workspace for candidates, recruiters and platform administrators.", 76, 288, 660, 66, { fontSize: 24, color: C.muted });
  addImage(s, logo, 850, 176, 320, 132, "JobForge logo");
  addRule(s, 850, 340, 330, C.line, 2);
  addText(s, "Feature inventory", 850, 366, 330, 30, { fontSize: 20, color: C.soft, bold: true });
  addText(s, "Public experience\nCandidate tools\nRecruiter operations\nAdmin and platform systems", 850, 412, 330, 128, { fontSize: 19, color: C.muted });
  addText(s, "Based on the current JobForge codebase", 76, 616, 450, 24, { fontSize: 14, color: C.muted });
  addFooter(s, 1);
}

function slide02(p) {
  const s = newSlide(p);
  addHeader(s, "01 / Product model", "One platform, three operating modes", "JobForge connects opportunity discovery with the full hiring workflow.");
  addRule(s, 72, 230, 1136, C.yellow, 4);
  addText(s, "CANDIDATE", 72, 264, 240, 24, { fontSize: 14, color: C.yellow, bold: true });
  addText(s, "Discover, save, apply", 72, 300, 330, 36, { fontSize: 28, color: C.white, bold: true });
  addText(s, "Build a profile, manage applications, follow interviews and control privacy.", 72, 346, 310, 78, { fontSize: 18, color: C.muted });
  addText(s, "RECRUITER", 470, 264, 240, 24, { fontSize: 14, color: C.yellow, bold: true });
  addText(s, "Post, review, hire", 470, 300, 330, 36, { fontSize: 28, color: C.white, bold: true });
  addText(s, "Manage companies and jobs, review applicants, schedule interviews and measure hiring activity.", 470, 346, 330, 78, { fontSize: 18, color: C.muted });
  addText(s, "ADMIN", 880, 264, 240, 24, { fontSize: 14, color: C.yellow, bold: true });
  addText(s, "Operate the marketplace", 880, 300, 330, 36, { fontSize: 28, color: C.white, bold: true });
  addText(s, "Monitor users, companies, jobs, applications, payments and moderation activity.", 880, 346, 300, 78, { fontSize: 18, color: C.muted });
  addRule(s, 72, 480, 1136, C.line, 2);
  addText(s, "DISCOVER", 72, 520, 200, 24, { fontSize: 13, color: C.muted, bold: true });
  addText(s, "APPLY", 430, 520, 200, 24, { fontSize: 13, color: C.muted, bold: true });
  addText(s, "HIRE", 780, 520, 200, 24, { fontSize: 13, color: C.muted, bold: true });
  addText(s, ">", 300, 508, 70, 36, { fontSize: 28, color: C.yellow, bold: true, alignment: "center" });
  addText(s, ">", 650, 508, 70, 36, { fontSize: 28, color: C.yellow, bold: true, alignment: "center" });
  addText(s, "A single product loop, with role-specific access and workflows.", 72, 578, 700, 28, { fontSize: 20, color: C.white, bold: true });
  addFooter(s, 2);
}

function slide03(p) {
  const s = newSlide(p);
  addHeader(s, "02 / Public experience", "The public site turns browsing into a next step", "The discovery layer is designed to help people find jobs, understand employers and choose an action.");
  addBand(s, "Homepage", "Hero, latest jobs, About section, pricing and clear entry points", 72, 232, 510);
  addBand(s, "Jobs", "Keyword search, filters, sorting, featured jobs and pagination", 72, 324, 510);
  addBand(s, "Job detail", "Description, requirements, benefits, salary, workplace and apply flow", 72, 416, 510);
  addBand(s, "Company pages", "Public profiles, culture, benefits, social links and open roles", 72, 508, 510);
  addRule(s, 690, 232, 1, C.line, 340);
  addText(s, "A job is more than a title", 740, 248, 410, 36, { fontSize: 28, color: C.white, bold: true });
  addText(s, "Each public job can expose the context a candidate needs before applying:", 740, 306, 410, 54, { fontSize: 18, color: C.muted });
  addBullets(s, ["Company and location", "Employment and workplace type", "Experience level and category", "Salary range and application method", "Featured status and application count"], 740, 390, 420, 42, { fontSize: 18 });
  addFooter(s, 3);
}

function slide04(p) {
  const s = newSlide(p);
  addHeader(s, "03 / Authentication and account", "The account layer sets the right experience from the start", "Authentication, onboarding and role-aware navigation determine what each person can see and do.");
  addStep(s, "01", "Create an account", "Email/password signup, full name, password confirmation and Terms/Privacy consent.", 72, 246, 520);
  addStep(s, "02", "Verify and recover", "Email verification, resend cooldown, forgot password and reset-password flows.", 72, 356, 520);
  addStep(s, "03", "Choose a mode", "Onboarding lets the account start as Job Seeker or Recruiter.", 72, 466, 520);
  addRule(s, 676, 242, 5, C.yellow, 328);
  addText(s, "Once signed in", 720, 246, 360, 30, { fontSize: 26, color: C.white, bold: true });
  addBullets(s, ["Protected-route redirects preserve the intended destination.", "The account menu exposes Settings, Pricing, Theme and Logout.", "Users can securely switch between Job Seeker and Recruiter modes.", "Restricted accounts and incomplete onboarding receive dedicated flows.", "Supabase sessions persist across refreshes and role-specific navigation updates."], 720, 310, 410, 54, { fontSize: 17 });
  addFooter(s, 4);
}

function slide05(p) {
  const s = newSlide(p);
  addHeader(s, "04 / Candidate experience", "Candidates get a full job-search workspace", "Discovery, profile building, applications, alerts and privacy controls live in one connected journey.");
  addText(s, "DASHBOARD", 72, 236, 220, 24, { fontSize: 13, color: C.yellow, bold: true });
  addText(s, "The candidate home shows saved jobs, active alerts, profile completion, recent applications and recommended roles.", 72, 274, 460, 88, { fontSize: 23, color: C.white, bold: true });
  addRule(s, 72, 392, 460, C.line, 2);
  addBullets(s, ["Browse Jobs", "Saved Jobs", "Job Alerts", "Recent applications", "Upcoming interview details"], 72, 424, 460, 38, { fontSize: 18 });
  addText(s, "CANDIDATE TOOLKIT", 660, 236, 300, 24, { fontSize: 13, color: C.yellow, bold: true });
  addBullets(s, ["Profile: headline, bio, skills, experience, education, location and social links.", "Files: profile photo and private resume storage.", "Alerts: keywords, location, salary, employment, workplace and experience filters.", "Applications: search, status/company/date filters, timeline, cover letter and withdrawal.", "Privacy: profile, resume, portfolio, social links, location and experience visibility."], 660, 274, 470, 58, { fontSize: 17 });
  addFooter(s, 5);
}

function slide06(p) {
  const s = newSlide(p);
  addHeader(s, "05 / Candidate journey", "The application workflow carries the candidate past the Apply button", "JobForge keeps the application, status history and interview context together.");
  const steps = [
    ["01", "Find", "Search public jobs by title, company, location, category and filters."],
    ["02", "Save", "Bookmark roles and create alerts for future matches."],
    ["03", "Apply", "Submit a PDF resume, cover letter and custom answers."],
    ["04", "Follow", "Track status, history, recruiter updates and interviews."],
    ["05", "Respond", "See meeting details, instructions and current interview state."],
  ];
  steps.forEach((item, index) => {
    const x = 72 + index * 226;
    addText(s, item[0], x, 256, 60, 48, { fontSize: 34, color: C.yellow, bold: true });
    addRule(s, x, 318, 180, index < steps.length - 1 ? C.line : C.yellow, 3);
    addText(s, item[1], x, 350, 180, 30, { fontSize: 23, color: C.white, bold: true });
    addText(s, item[2], x, 396, 182, 110, { fontSize: 16, color: C.muted });
  });
  addRule(s, 72, 566, 1136, C.line, 2);
  addText(s, "Guardrails include duplicate-application prevention, closed-job checks, own-job checks, resume validation and withdrawal confirmation.", 72, 590, 1030, 34, { fontSize: 18, color: C.soft, bold: true });
  addFooter(s, 6);
}

function slide07(p) {
  const s = newSlide(p);
  addHeader(s, "06 / Recruiter workspace", "Recruiters move from a blank page to a managed hiring pipeline", "Company setup, job publishing and applicant operations are designed as one continuous workspace.");
  addStep(s, "01", "Build the company", "Create the public company profile, add brand assets, culture, benefits and social links.", 72, 244, 520);
  addStep(s, "02", "Create the job", "Draft, preview, autosave, schedule or publish with salary, location and application details.", 72, 356, 520);
  addStep(s, "03", "Manage the pipeline", "Search applicants, update status, add private notes, tag candidates and invite interviews.", 72, 468, 520);
  addRule(s, 680, 244, 5, C.yellow, 300);
  addText(s, "Job lifecycle", 720, 246, 360, 30, { fontSize: 26, color: C.white, bold: true });
  addText(s, "Draft  ->  Pending  ->  Published  ->  Closed  ->  Archived", 720, 310, 440, 32, { fontSize: 18, color: C.yellow, bold: true });
  addBullets(s, ["Scheduled future publishing with timezone conversion.", "Application email or URL support.", "Status, salary, workplace and experience validation.", "Searchable recruiter-owned job management with pagination."], 720, 382, 420, 52, { fontSize: 17 });
  addFooter(s, 7);
}

function slide08(p) {
  const s = newSlide(p);
  addHeader(s, "07 / Applicant and interview operations", "Shortlisting has a clear next action: invite the right person", "The recruiter workflow is built around review, controlled status changes, private notes and scheduled interviews.");
  addText(s, "APPLICANT MANAGEMENT", 72, 238, 360, 24, { fontSize: 13, color: C.yellow, bold: true });
  addBullets(s, ["Summary: total applicants, new, shortlisted and interviews scheduled.", "Search by name, email, skills or location.", "Filter by job, status, dates, resume availability and tags.", "Review profile, resume, cover letter, custom answers and application history.", "Private recruiter notes and tags remain outside the candidate view."], 72, 280, 500, 54, { fontSize: 17 });
  addText(s, "INTERVIEW INVITATIONS", 680, 238, 360, 24, { fontSize: 13, color: C.yellow, bold: true });
  addBullets(s, ["Video, phone or on-site interview type.", "Future date/time, timezone and duration.", "Meeting link, phone number or physical location.", "Candidate instructions and recruiter notes.", "Duplicate prevention, status update, notification and email workflow."], 680, 280, 470, 54, { fontSize: 17 });
  addRule(s, 72, 590, 1136, C.line, 2);
  addText(s, "Application flow", 72, 612, 160, 24, { fontSize: 14, color: C.muted, bold: true });
  addText(s, "Applied  ->  Reviewing  ->  Shortlisted  ->  Interview  ->  Offered / Hired", 250, 610, 860, 28, { fontSize: 19, color: C.white, bold: true });
  addFooter(s, 8);
}

function slide09(p) {
  const s = newSlide(p);
  addHeader(s, "08 / Plans, billing and insight", "Monetization unlocks the recruiter operating layer", "Razorpay-backed one-time plans control posting capacity, featured visibility and analytics access.");
  addText(s, "PLANS", 72, 240, 150, 24, { fontSize: 13, color: C.yellow, bold: true });
  addText(s, "STARTER", 72, 286, 240, 30, { fontSize: 22, color: C.white, bold: true });
  addText(s, "$49", 72, 320, 220, 52, { fontSize: 42, color: C.yellow, bold: true });
  addText(s, "1 active job post\nCore applications and applicant management\nDashboard, billing and email notifications", 72, 390, 300, 110, { fontSize: 17, color: C.muted });
  addText(s, "GROWTH", 430, 286, 240, 30, { fontSize: 22, color: C.white, bold: true });
  addText(s, "$99", 430, 320, 220, 52, { fontSize: 42, color: C.yellow, bold: true });
  addText(s, "5 active job posts\nFeatured posts and priority listings\nUsage analytics and hiring activity", 430, 390, 300, 110, { fontSize: 17, color: C.muted });
  addText(s, "PRO", 788, 286, 240, 30, { fontSize: 22, color: C.white, bold: true });
  addText(s, "$299", 788, 320, 220, 52, { fontSize: 42, color: C.yellow, bold: true });
  addText(s, "Unlimited active and featured posts\nPremium priority support\nMaximum flexibility for hiring at scale", 788, 390, 320, 110, { fontSize: 17, color: C.muted });
  addRule(s, 72, 558, 1136, C.line, 2);
  addText(s, "Billing includes current-plan state, usage, purchase history, payment references, retry support and verified entitlement activation.", 72, 584, 1020, 34, { fontSize: 18, color: C.soft, bold: true });
  addFooter(s, 9);
}

function slide10(p) {
  const s = newSlide(p);
  addHeader(s, "09 / Everyday product layer", "The product stays useful between major actions", "Notifications, preferences, storage and search keep the workspace connected day to day.");
  addBand(s, "Notifications", "All/read/unread views, search, pagination, mark-read, delete, clear-all and automatic unread toasts", 72, 244, 330);
  addBand(s, "Settings", "Profile, account, security, notifications, privacy, job alerts, appearance, billing, preferences and danger zone", 475, 244, 330);
  addBand(s, "Storage", "Private resumes, profile photos, recruiter avatars, company logos, banners and galleries with signed URLs", 878, 244, 330);
  addRule(s, 72, 360, 1136, C.line, 2);
  addText(s, "Account controls", 72, 394, 300, 28, { fontSize: 24, color: C.white, bold: true });
  addBullets(s, ["Theme: Light, Dark or System", "Email and in-app preferences", "Candidate privacy visibility controls", "Recruiter and candidate profile settings", "Password and account access information"], 72, 440, 430, 38, { fontSize: 17 });
  addText(s, "Search and navigation", 660, 394, 300, 28, { fontSize: 24, color: C.white, bold: true });
  addBullets(s, ["Ctrl+K / Cmd+K command palette", "Debounced job search", "Recent searches stored per account", "Quick links to core workspace destinations", "Responsive desktop and mobile navigation"], 660, 440, 430, 38, { fontSize: 17 });
  addFooter(s, 10);
}

function slide11(p) {
  const s = newSlide(p);
  addHeader(s, "10 / Administration", "Admins see the platform as an operating system", "The admin console combines health signals, records, payments and moderation controls.");
  addText(s, "PLATFORM VIEW", 72, 244, 250, 24, { fontSize: 13, color: C.yellow, bold: true });
  addText(s, "Overview", 72, 288, 200, 30, { fontSize: 24, color: C.white, bold: true });
  addBullets(s, ["Users, candidates and recruiters", "Companies, jobs and applications", "Active paid users and successful payments", "Revenue, growth and plan distribution", "Top companies and recruiters", "Recent platform activity"], 72, 340, 470, 42, { fontSize: 17 });
  addText(s, "CONTROL SURFACES", 690, 244, 270, 24, { fontSize: 13, color: C.yellow, bold: true });
  addText(s, "Operational sections", 690, 288, 360, 30, { fontSize: 24, color: C.white, bold: true });
  addText(s, "Users\nCompanies\nJobs\nApplications\nPayments\nModeration", 690, 342, 280, 210, { fontSize: 22, color: C.soft, bold: true });
  addText(s, "Moderation supports review, warn, hide, suspend, restrict and mark-as-spam actions with reason capture, confirmation and audit history.", 980, 342, 220, 146, { fontSize: 16, color: C.muted });
  addFooter(s, 11);
}

function slide12(p) {
  const s = newSlide(p);
  addHeader(s, "11 / Platform foundation", "The visible product is backed by a protected service layer", "Supabase, PostgreSQL, Razorpay, storage policies and route-level authorization support the user-facing workflows.");
  addText(s, "DATA AND ACCESS", 72, 240, 260, 24, { fontSize: 13, color: C.yellow, bold: true });
  addBullets(s, ["Supabase Auth and persistent sessions", "PostgreSQL tables, constraints, indexes and functions", "RLS policies for candidate, recruiter and admin data", "Ownership checks for jobs, applications, companies, interviews and notes", "Private storage policies and signed asset URLs"], 72, 282, 500, 50, { fontSize: 17 });
  addText(s, "BACKEND ENTRY POINTS", 690, 240, 300, 24, { fontSize: 13, color: C.yellow, bold: true });
  addBullets(s, ["Recruiter jobs API and admin section API", "Razorpay order, verification, ledger and webhook routes", "Billing and payment history route", "Email queue processing and provider events", "Scheduled job publishing and public cache revalidation", "Job view tracking and audit/security events"], 690, 282, 470, 50, { fontSize: 17 });
  addRule(s, 72, 590, 1136, C.line, 2);
  addText(s, "The codebase also includes rate-limit foundations, input validation, error sanitization, webhook idempotency and subscription feature gates.", 72, 614, 1080, 28, { fontSize: 18, color: C.soft, bold: true });
  addFooter(s, 12);
}

function slide13(p) {
  const s = newSlide(p);
  addHeader(s, "12 / Route map", "Every major surface has a clear home", "The application is organized around public discovery, role-specific workspaces and supporting platform routes.");
  addText(s, "PUBLIC AND AUTH", 72, 232, 330, 24, { fontSize: 13, color: C.yellow, bold: true });
  addText(s, "/\n/jobs\n/jobs/[slug]\n/company/[slug]\n/pricing\n/login / signup\n/forgot-password / reset-password\n/verify-email / auth/callback", 72, 274, 330, 250, { fontSize: 17, color: C.soft });
  addText(s, "WORKSPACE", 480, 232, 260, 24, { fontSize: 13, color: C.yellow, bold: true });
  addText(s, "/dashboard\n/applications\n/saved-jobs\n/job-alerts\n/interviews\n/post-job\n/notifications\n/settings/[section]\n/dashboard/billing", 480, 274, 330, 250, { fontSize: 17, color: C.soft });
  addText(s, "ADMIN AND SUPPORT", 888, 232, 300, 24, { fontSize: 13, color: C.yellow, bold: true });
  addText(s, "/admin\n/admin/[section]\n/onboarding\n/account-restricted\n/success\n/robots.txt / sitemap.xml\n/manifest.webmanifest\n/api/* payment, email, jobs, admin", 888, 274, 320, 250, { fontSize: 17, color: C.soft });
  addRule(s, 72, 576, 1136, C.line, 2);
  addText(s, "Current boundaries", 72, 602, 220, 24, { fontSize: 15, color: C.yellow, bold: true });
  addText(s, "About is a homepage section; global search has live job results while other categories are scaffolded; 2FA, data export and standalone legal pages are not confirmed as active features.", 300, 600, 860, 36, { fontSize: 16, color: C.muted });
  addFooter(s, 13);
}

function slide14(p) {
  const s = newSlide(p);
  addHeader(s, "13 / Summary", "JobForge is a connected hiring platform, not just a job board", "The product spans discovery, applications, recruitment operations, monetization and platform governance.");
  addRule(s, 72, 238, 1136, C.yellow, 5);
  addText(s, "FOR CANDIDATES", 72, 282, 300, 24, { fontSize: 13, color: C.yellow, bold: true });
  addText(s, "Find better-fit work, present a complete profile, apply with context and follow the hiring process.", 72, 326, 320, 102, { fontSize: 24, color: C.white, bold: true });
  addText(s, "FOR RECRUITERS", 470, 282, 300, 24, { fontSize: 13, color: C.yellow, bold: true });
  addText(s, "Build a company presence, publish jobs, manage real applicants and turn shortlists into interviews.", 470, 326, 330, 102, { fontSize: 24, color: C.white, bold: true });
  addText(s, "FOR OPERATORS", 880, 282, 300, 24, { fontSize: 13, color: C.yellow, bold: true });
  addText(s, "Run the marketplace with analytics, payments, moderation, security controls and auditable workflows.", 880, 326, 320, 102, { fontSize: 24, color: C.white, bold: true });
  addRule(s, 72, 502, 1136, C.line, 2);
  addText(s, "The core product loop is complete: discover -> apply -> review -> interview -> hire.", 72, 550, 930, 40, { fontSize: 30, color: C.yellow, bold: true });
  addText(s, "Source: current JobForge application codebase and migration inventory.", 72, 618, 600, 22, { fontSize: 14, color: C.muted });
  addFooter(s, 14);
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const logo = await readImageBlob(LOGO_PATH);
  const p = Presentation.create({ slideSize: { width: W, height: H } });
  slide01(p, logo);
  slide02(p);
  slide03(p);
  slide04(p);
  slide05(p);
  slide06(p);
  slide07(p);
  slide08(p);
  slide09(p);
  slide10(p);
  slide11(p);
  slide12(p);
  slide13(p);
  slide14(p);
  await (await p.export({ format: "webp", montage: true, scale: 1 })).arrayBuffer().then((buffer) => fs.writeFile(`${OUT_DIR}\\deck-montage.webp`, new Uint8Array(buffer)));
  const pptx = await PresentationFile.exportPptx(p);
  await pptx.save(FINAL_PPTX);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

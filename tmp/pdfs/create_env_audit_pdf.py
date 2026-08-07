from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from xml.sax.saxutils import escape

OUTPUT = "output/pdf/environment-variable-audit-report.pdf"

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="ReportTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=24, leading=29, textColor=colors.HexColor("#111827"), spaceAfter=8))
styles.add(ParagraphStyle(name="Subtitle", parent=styles["Normal"], fontName="Helvetica", fontSize=10, leading=15, textColor=colors.HexColor("#6B7280"), spaceAfter=20))
styles.add(ParagraphStyle(name="Section", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=15, leading=19, textColor=colors.HexColor("#111827"), spaceBefore=14, spaceAfter=8))
styles.add(ParagraphStyle(name="BodySmall", parent=styles["BodyText"], fontName="Helvetica", fontSize=9, leading=13, textColor=colors.HexColor("#374151"), spaceAfter=6))
styles.add(ParagraphStyle(name="TableHead", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=7.6, leading=9, textColor=colors.white))
styles.add(ParagraphStyle(name="TableCell", parent=styles["Normal"], fontName="Helvetica", fontSize=7.2, leading=9.2, textColor=colors.HexColor("#1F2937")))
styles.add(ParagraphStyle(name="TableCellMono", parent=styles["Normal"], fontName="Courier", fontSize=6.0, leading=7.4, textColor=colors.HexColor("#1F2937")))
styles.add(ParagraphStyle(name="Callout", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.3, leading=14, textColor=colors.HexColor("#1F2937"), backColor=colors.HexColor("#FFF7D6"), borderColor=colors.HexColor("#EAB308"), borderWidth=0.8, borderPadding=9, spaceBefore=6, spaceAfter=10))

def p(text, style="BodySmall"):
    return Paragraph(text, styles[style])

def mono(text):
    return Paragraph(escape(text).replace("\n", "<br/>"), styles["TableCellMono"])

def cell(text):
    return Paragraph(escape(text).replace("\n", "<br/>"), styles["TableCell"])

def files(items):
    return "<br/>".join(escape(x) for x in items)

variables = [
    ("NEXT_PUBLIC_SUPABASE_URL", ["lib/api-auth.ts", "lib/supabase.ts", "lib/supabase-admin.ts", "proxy.ts"], "Required for Supabase functionality. Build-time for client bundle and runtime for server/proxy use.", "Yes"),
    ("NEXT_PUBLIC_SUPABASE_ANON_KEY", ["lib/api-auth.ts", "lib/supabase.ts", "proxy.ts"], "Required for browser auth and API authentication. Build-time for client bundle and runtime use.", "Yes"),
    ("SUPABASE_SERVICE_ROLE_KEY", ["lib/supabase-admin.ts"], "Runtime-only. Required for trusted admin/server operations; optional for build.", "NO"),
    ("NEXT_PUBLIC_SITE_URL", ["app/api/email/events/route.ts", "app/api/jobs/publish-scheduled/route.ts", "app/forgot-password/page.tsx", "lib/auth-redirects.ts", "lib/email/templates.ts", "lib/seo.ts"], "Optional in code, but required in production for canonical URLs, metadata, sitemap, redirects and email links.", "Yes"),
    ("NEXT_PUBLIC_APP_URL", ["lib/seo.ts"], "Optional SEO URL fallback.", "Yes"),
    ("NEXT_PUBLIC_AUTH_CALLBACK_URL", ["lib/auth-redirects.ts"], "Optional authentication callback override.", "Yes, if trusted"),
    ("NEXT_PUBLIC_PASSWORD_RESET_REDIRECT_URL", ["app/forgot-password/page.tsx"], "Optional password-reset redirect override.", "Yes, if trusted"),
    ("VERCEL_PROJECT_PRODUCTION_URL", ["lib/email/templates.ts", "lib/seo.ts"], "Optional Vercel-provided production URL fallback.", "Yes, non-secret"),
    ("VERCEL_ENV", ["lib/seo.ts"], "Optional Vercel deployment metadata.", "Yes, non-secret"),
    ("RAZORPAY_KEY_ID", ["lib/razorpay-server.ts"], "Runtime-required for payment operations.", "Yes in isolation; current code keeps it server-only"),
    ("RAZORPAY_KEY_SECRET", ["lib/razorpay-server.ts"], "Runtime-required for Razorpay API requests and payment verification.", "NO"),
    ("RAZORPAY_WEBHOOK_SECRET", ["lib/razorpay-server.ts"], "Runtime-required for webhook signature verification.", "NO"),
    ("JOB_SCHEDULER_SECRET", ["app/api/jobs/publish-scheduled/route.ts"], "Runtime-required when scheduled publishing is enabled.", "NO"),
    ("CRON_SECRET", ["app/api/email/process/route.ts", "app/api/jobs/publish-scheduled/route.ts"], "Optional fallback secret for scheduler/email endpoint authorization.", "NO"),
    ("EMAIL_QUEUE_SECRET", ["app/api/email/process/route.ts"], "Runtime-required when email queue processing is enabled.", "NO"),
    ("EMAIL_HTTP_ENDPOINT", ["lib/email/providers.ts"], "Optional runtime email-provider endpoint. Missing value selects the missing-provider adapter.", "NO; keep server-only"),
    ("EMAIL_HTTP_AUTH_HEADER_NAME", ["lib/email/providers.ts"], "Optional runtime email-provider header configuration.", "NO; keep server-only"),
    ("EMAIL_HTTP_AUTH_HEADER_VALUE", ["lib/email/providers.ts"], "Optional runtime provider credential.", "NO"),
    ("EMAIL_FROM_ADDRESS", ["lib/email/providers.ts"], "Optional runtime sender address; code has a fallback.", "Yes, non-secret"),
    ("EMAIL_REPLY_TO_ADDRESS", ["lib/email/providers.ts"], "Optional runtime reply-to address.", "Yes, non-secret"),
    ("EMAIL_LOGO_URL", ["lib/email/templates.ts"], "Optional runtime email branding URL.", "Yes, non-secret"),
    ("EMAIL_SUPPORT_ADDRESS", ["lib/email/templates.ts"], "Optional runtime support contact.", "Yes, non-secret"),
]

node_env_files = [
    "app/api/admin/[section]/route.ts", "app/api/email/events/route.ts", "app/api/jobs/[slug]/view/route.ts",
    "app/api/jobs/publish-scheduled/route.ts", "app/api/recruiter/jobs/route.ts",
    "app/applications/candidate-applications.tsx", "app/applications/page.tsx", "app/applications/recruiter-applications.tsx",
    "app/auth/callback/page.tsx", "app/dashboard/use-dashboard-data.ts", "app/interviews/interview-schedule-dialog.tsx",
    "app/interviews/page.tsx", "app/interviews/recruiter-interviews.tsx", "app/jobs/[slug]/job-application-panel.tsx",
    "app/jobs/[slug]/job-view-tracker.tsx", "app/jobs/saved-jobs-state.tsx", "app/post-job/page.tsx",
    "lib/api-auth.ts", "lib/auth-errors.ts", "lib/candidate-dashboard.ts", "lib/dashboard-data.ts", "lib/dashboard-jobs.ts",
    "lib/email/client.ts", "lib/email/queue.ts", "lib/job-alerts.ts", "lib/notification-server.ts", "lib/public-company.ts",
    "lib/public-jobs.ts", "lib/saved-jobs.ts", "lib/seo.ts", "lib/sitemap-data.ts", "lib/supabase.ts", "next.config.ts",
]

def draw_page(canvas, doc):
    canvas.saveState()
    width, _ = A4
    canvas.setStrokeColor(colors.HexColor("#E5E7EB"))
    canvas.setLineWidth(0.6)
    canvas.line(doc.leftMargin, 14 * mm, width - doc.rightMargin, 14 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#9CA3AF"))
    canvas.drawString(doc.leftMargin, 9 * mm, "JobForge - Environment Variable Audit")
    canvas.drawRightString(width - doc.rightMargin, 9 * mm, f"Page {doc.page}")
    canvas.restoreState()

doc = SimpleDocTemplate(
    OUTPUT, pagesize=A4, rightMargin=14 * mm, leftMargin=14 * mm,
    topMargin=15 * mm, bottomMargin=21 * mm,
    title="Environment Variable Audit Report", author="Codex",
)

story = [
    p("Environment Variable Audit Report", "ReportTitle"),
    p("Next.js App Router + Supabase + PostgreSQL + Razorpay", "Subtitle"),
    p("<b>Scope</b><br/>All environment access found in application source, Next.js configuration, proxy/auth code, email/payment integrations, and deployment-related code. No files were modified and no secret values are included.", "Callout"),
    p("1. Executive Summary", "Section"),
]

summary_data = [
    [p("Finding", "TableHead"), p("Result", "TableHead")],
    [cell("Variables identified"), cell("23 application/framework environment variables")],
    [cell("Supabase service-role reference"), cell("Yes - referenced only by lib/supabase-admin.ts in application code")],
    [cell("NEXT_PUBLIC_ secret exposure"), cell("No service-role, payment secret, webhook secret, scheduler secret, or email credential uses the NEXT_PUBLIC_ prefix")],
    [cell("Razorpay build failure risk"), cell("Missing or blank Razorpay variables do not fail the Next.js/Vercel build; affected payment/webhook requests fail at runtime")],
]
summary_table = Table(summary_data, colWidths=[54 * mm, 116 * mm], repeatRows=1)
summary_table.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#111827")),
    ("GRID", (0,0), (-1,-1), 0.35, colors.HexColor("#D1D5DB")),
    ("VALIGN", (0,0), (-1,-1), "TOP"),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.HexColor("#F9FAFB"), colors.white]),
    ("LEFTPADDING", (0,0), (-1,-1), 7), ("RIGHTPADDING", (0,0), (-1,-1), 7),
    ("TOPPADDING", (0,0), (-1,-1), 6), ("BOTTOMPADDING", (0,0), (-1,-1), 6),
]))
story.append(summary_table)

story.append(p("2. Complete Variable Inventory", "Section"))
rows = [[p("Exact variable", "TableHead"), p("Files where referenced", "TableHead"), p("Requirement", "TableHead"), p("Public-safe?", "TableHead")]]
for name, file_list, requirement, exposure in variables:
    rows.append([mono(name), Paragraph(files(file_list), styles["TableCellMono"]), cell(requirement), cell(exposure)])
variable_table = Table(rows, colWidths=[48 * mm, 50 * mm, 50 * mm, 26 * mm], repeatRows=1)
variable_table.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#111827")),
    ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#D1D5DB")),
    ("VALIGN", (0,0), (-1,-1), "TOP"),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#F9FAFB")]),
    ("LEFTPADDING", (0,0), (-1,-1), 5), ("RIGHTPADDING", (0,0), (-1,-1), 5),
    ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5),
]))
story.append(variable_table)

node_rows = [
    [p("Exact variable", "TableHead"), p("Files where referenced", "TableHead"), p("Requirement / exposure", "TableHead")],
    [mono("NODE_ENV"), Paragraph(files(node_env_files), styles["TableCellMono"]), cell("Framework-provided at build/runtime. No manual configuration required. Non-secret; do not create a custom NEXT_PUBLIC_NODE_ENV variable.")],
]
node_table = Table(node_rows, colWidths=[33 * mm, 112 * mm, 29 * mm], repeatRows=1)
node_table.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#111827")),
    ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#D1D5DB")),
    ("VALIGN", (0,0), (-1,-1), "TOP"),
    ("BACKGROUND", (0,1), (-1,1), colors.HexColor("#F9FAFB")),
    ("LEFTPADDING", (0,0), (-1,-1), 6), ("RIGHTPADDING", (0,0), (-1,-1), 6),
    ("TOPPADDING", (0,0), (-1,-1), 6), ("BOTTOMPADDING", (0,0), (-1,-1), 6),
]))
story.append(KeepTogether([
    p("3. NODE_ENV References", "Section"),
    p("NODE_ENV is framework-provided and is not a manually managed secret. It is read for development-only logging, production cookie behavior, SEO/indexing behavior, production headers, and runtime checks.", "BodySmall"),
    node_table,
]))

story.append(KeepTogether([
    p("4. SUPABASE_SERVICE_ROLE_KEY Review", "Section"),
    p("<b>Referenced:</b> Yes.", "BodySmall"),
    p('<b>Application code:</b> <font name="Courier">lib/supabase-admin.ts</font>.', "BodySmall"),
    p('<b>Behavior:</b> The module is marked <font name="Courier">server-only</font> and creates a privileged Supabase client only when both the Supabase URL and service-role key are present.', "BodySmall"),
    p("<b>Exposure assessment:</b> Unsafe for NEXT_PUBLIC_ exposure. It must remain a server-only Vercel environment variable and must never be serialized, logged, or returned to the browser.", "Callout"),
]))

story.append(p("5. Razorpay Blank/Missing Variable Behavior", "Section"))
razorpay_rows = [
    [p("Variable", "TableHead"), p("Build behavior", "TableHead"), p("Runtime behavior", "TableHead")],
    [mono("RAZORPAY_KEY_ID"), cell("Does not fail the build."), cell("Payment configuration becomes unavailable; order creation and verification return a runtime configuration error.")],
    [mono("RAZORPAY_KEY_SECRET"), cell("Does not fail the build."), cell("Razorpay API requests and checkout verification cannot run.")],
    [mono("RAZORPAY_WEBHOOK_SECRET"), cell("Does not fail the build."), cell("Webhook endpoint returns a runtime not-configured response and cannot verify signatures.")],
]
razorpay_table = Table(razorpay_rows, colWidths=[43 * mm, 48 * mm, 83 * mm], repeatRows=1)
razorpay_table.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#111827")),
    ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#D1D5DB")),
    ("VALIGN", (0,0), (-1,-1), "TOP"),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#F9FAFB")]),
    ("LEFTPADDING", (0,0), (-1,-1), 6), ("RIGHTPADDING", (0,0), (-1,-1), 6),
    ("TOPPADDING", (0,0), (-1,-1), 6), ("BOTTOMPADDING", (0,0), (-1,-1), 6),
]))
story.append(razorpay_table)
story.append(Spacer(1, 5))
story.append(p("The current implementation reads Razorpay configuration when payment or webhook handlers execute rather than throwing at module import. A production build can therefore complete with missing values, but payment functionality will not be operational until the runtime variables are configured.", "Callout"))

notes_section = [p("6. Configuration Notes", "Section")]
for note in [
    "The public Supabase URL and anon key are intentionally browser-safe and are required for client-side authentication to work.",
    "Production should set NEXT_PUBLIC_SITE_URL even though the code has safe fallbacks; otherwise canonical metadata, absolute email links and production indexing behavior are incomplete.",
    "Email provider variables are runtime-only. Without EMAIL_HTTP_ENDPOINT, the application selects its missing-provider adapter and email delivery does not occur.",
    "JOB_SCHEDULER_SECRET, EMAIL_QUEUE_SECRET, and the CRON_SECRET fallback must not be exposed to the client.",
    "The .env.example file documents the deployment/application variables. It contains placeholders only; this report intentionally reproduces no environment values.",
]:
    notes_section.append(p("&bull; " + escape(note), "BodySmall"))
story.append(KeepTogether(notes_section))

story.append(p("Audit conclusion", "Section"))
story.append(p("The codebase references 23 environment variables. The only privileged Supabase key is SUPABASE_SERVICE_ROLE_KEY, used in one server-only module. Blank or missing Razorpay variables do not cause a Vercel build failure, but they disable payment and webhook operations at runtime.", "Callout"))

doc.build(story, onFirstPage=draw_page, onLaterPages=draw_page)
print(OUTPUT)

import type { ReactNode } from "react";

type DrawingProps = { className?: string };

function DrawingFrame({ children, className = "", viewBox }: DrawingProps & { children: ReactNode; viewBox: string }) {
  return <svg aria-hidden="true" className={className} fill="none" focusable="false" viewBox={viewBox}>{children}</svg>;
}

export function RecruiterSparkle({ className = "" }: DrawingProps) {
  return <DrawingFrame className={className} viewBox="0 0 30 30"><path d="m15 3 2.4 9.6L27 15l-9.6 2.4L15 27l-2.4-9.6L3 15l9.6-2.4L15 3Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></DrawingFrame>;
}

export function WorkspaceEntranceIllustration({ className = "" }: DrawingProps) {
  return <DrawingFrame className={className} viewBox="0 0 240 280"><path d="M64 227V99l73-59v114l-73 73Z" fill="#F0EEFF" opacity=".34" /><path d="m137 40 43 31v115l-43-32Z" fill="#E7E3FF" opacity=".24" /><path d="M93 223v-53h37v53Z" fill="#FBFAFF" opacity=".76" /><g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6"><path d="m64 227 73-73 43 32v61H64v-20Zm0 0V99l73-59 43 31v115M64 99l73 55 43-40M137 40v114" /><path d="M93 223v-53h37v53m-29-35h12m-12 17h12m25-74v61m-31 55h89m-121 14h136" /><path d="M45 247v-45m0 18c-12-8-18-18-17-30 14 4 20 15 17 28Zm1 11c12-10 23-11 30-5-7 10-18 13-30 8" /></g><path d="M57 245c28-23 76-28 125-9v15H57Z" fill="#EEEAFE" opacity=".78" /></DrawingFrame>;
}

export function TelescopeIllustration({ className = "" }: DrawingProps) {
  return <DrawingFrame className={className} viewBox="0 0 300 260"><path d="M51 228c24-28 65-35 99-18 28-15 63-7 87 18H51Z" fill="#EEEAFE" opacity=".62" /><g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.55"><path d="m110 80 75 29-17 42-75-29 17-42Zm-17 42-17-7 17-42 17 7m75 29 20 8-17 42-20-8" fill="#F1EFFF" opacity=".48" /><ellipse cx="101.5" cy="101" rx="10" ry="22" transform="rotate(20 101.5 101)" /><ellipse cx="101.5" cy="101" rx="6.5" ry="17" transform="rotate(20 101.5 101)" /><path d="m146 151 8 21m-28 54 28-54 31 54m-31-54-40 29m40-29 42 28m-13-18 15 44m-43-44-8 44" /><circle cx="154" cy="172" r="13" fill="#E9E5FF" opacity=".65" /><path d="M73 226h165m-140-29c-13-8-21-18-20-31 16 4 23 16 20 30" /></g><ellipse cx="236" cy="53" rx="31" ry="8" transform="rotate(13 236 53)" fill="#FFF2D8" opacity=".8" stroke="#FFB21A" strokeWidth="1.5" /><circle cx="236" cy="53" r="20" fill="#FFF2D8" opacity=".74" stroke="#FFB21A" strokeWidth="1.5" /><path d="M218 44c10 3 19 12 25 26m-23-7c10-2 22 1 32 9" stroke="#FFB21A" strokeLinecap="round" strokeWidth="1.25" /><path d="M45 130c7-7 16-7 23 0m30-15 6-8m7 13 9-4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" /></DrawingFrame>;
}

export function CloudIllustration({ className = "" }: DrawingProps) {
  return <DrawingFrame className={className} viewBox="0 0 120 80"><path d="M21 56c0-8 7-15 15-15 2-12 12-20 24-20 13 0 23 8 25 20 3-3 7-4 11-4 8 0 14 6 14 14h2c5 0 8 3 8 7H28c-4 0-7-1-7-2Z" fill="#F5F3FF" opacity=".52" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></DrawingFrame>;
}

export function PieSketchIllustration({ className = "" }: DrawingProps) {
  return <DrawingFrame className={className} viewBox="0 0 160 160"><g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"><circle cx="80" cy="80" r="51" /><path d="M80 29v51l46 21M80 80 46 119m34-39 1 51" /><path d="m113 42 18 25-5 35-46-22 33-38Z" stroke="#F5B82E" /></g></DrawingFrame>;
}

export function PlanDocumentIllustration({ className = "" }: DrawingProps) {
  return <DrawingFrame className={className} viewBox="0 0 180 130"><path d="m28 96 63-20 63 20-63 24-63-24Z" fill="#EEEAFE" opacity=".92" /><path d="m28 96 63 24 63-24v11l-63 22-63-22V96Z" fill="#DCD6FF" opacity=".7" /><g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"><path d="m28 96 63 24 63-24m-63 24v11m-63-35v11l63 24 63-24V96" opacity=".7" /><path d="m69 27 45 13 10 9v48L69 84V27Z" fill="#F9F8FF" opacity=".84" /><path d="m69 27 9-6 45 14 1 14-10-9-45-13Z" fill="#E8E4FF" opacity=".72" /><path d="M69 27v57l45 13V40L69 27Zm9 19 26 8m-26 10 26 8m-26 10 18 5" /><path d="M48 97h73m-91 12h121" opacity=".72" /></g></DrawingFrame>;
}

export function UsageBarsIllustration({ className = "" }: DrawingProps) {
  return <DrawingFrame className={className} viewBox="0 0 180 130"><path d="m29 101 88-13 26 10-88 16-26-13Z" fill="#EDE9FF" opacity=".52" /><g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"><path d="m35 88 12-6 13 5-12 7-13-6Zm0 0v17l13 6V94m12-7v18l-12 6m13-43 14-7 15 6-14 8-15-7Zm0 0v30l15 7V68m14-7v30l-14 7m15-53 15-8 17 7-16 9-16-8Zm0 0v42l16 8V46m16-8v42l-16 8M29 111h113" /><path d="M143 105V76m0 13c-8-5-12-12-12-20 10 3 14 11 12 19Zm1 7c8-7 15-7 20-2-4 7-12 8-20 5" /></g><path d="m69 61 14-7 15 6-14 8-15-7Zm30-23 16-8 17 7-16 9-17-8Z" fill="#DCD6FF" opacity=".86" /></DrawingFrame>;
}

export function AnalyticsIllustration({ className = "" }: DrawingProps) {
  return <DrawingFrame className={className} viewBox="0 0 240 135"><g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45"><path d="M17 111h116M28 94h95M28 75h95M28 56h95M28 37h95" opacity=".22" /><path d="m26 109 25-29 23 12 26-37 23 20 28-38" /><circle cx="26" cy="109" r="2.5" /><circle cx="51" cy="80" r="2.5" /><circle cx="74" cy="92" r="2.5" /><circle cx="100" cy="55" r="2.5" /><circle cx="123" cy="75" r="2.5" /><circle cx="151" cy="37" r="2.5" /><circle cx="193" cy="77" r="31" /><path d="M193 46v31l26 16" /><path d="M193 46a31 31 0 0 1 27 47" stroke="#F5B82E" /></g><path d="M193 77V46a31 31 0 0 0-24 49Z" fill="#EEEAFE" opacity=".9" /></DrawingFrame>;
}

export function LaptopIllustration({ className = "" }: DrawingProps) {
  return <DrawingFrame className={className} viewBox="0 0 250 140"><g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"><path d="M61 27h107l8 74H53l8-74Z" /><path d="M62 38h103l6 52H57l5-52Zm17 13h27v16H79V51Zm39 0h31m-31 13h31M79 77h17m8 0h17m8 0h18" /><path d="M37 102h153l15 14H22l15-14Zm155-3v-25m0 10c-8-5-12-12-11-20 10 3 14 10 11 19Zm1 8c8-7 15-8 21-3-5 8-13 9-21 6" /></g><path d="M47 111c24-25 77-30 127-14l16 19H37l10-5Z" fill="#EEEAFE" opacity=".75" /></DrawingFrame>;
}

export function InterviewRoomIllustration({ className = "" }: DrawingProps) {
  return <DrawingFrame className={className} viewBox="0 0 250 150"><g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.55"><path d="M71 119V75c0-18 41-18 41 0v44m-41-31h41M78 119l-9 18m37-18 9 18M55 138h69" /><path d="M73 75c-15 6-24 19-23 36 17 4 28-6 29-20m33-16c16 7 23 20 20 34-15 4-25-6-26-18" /><circle cx="173" cy="57" r="24" /><path d="M173 40v18l12 8M137 138h75m-31 0v-38m0 16c-10-6-16-16-14-27 13 4 19 14 15 26Zm0 7c10-9 19-10 26-3-6 9-16 11-26 7" /></g><path d="M56 138c30-20 95-22 148 0H56Z" fill="#FFF0E8" opacity=".72" /></DrawingFrame>;
}

export function ClipboardIllustration({ className = "" }: DrawingProps) {
  return <DrawingFrame className={className} viewBox="0 0 170 200"><g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.55"><path d="M35 34h86l13 126H48L35 34Z" /><path d="M65 34v-8c0-7 31-7 31 0v8M56 66h14m14 0h24M56 91h14m14 0h24M56 116h14m14 0h24M56 141h14m14 0h24" /><path d="m137 150 18 28m-26-20 28-14m-8 34 13 17" stroke="#F5B82E" /></g></DrawingFrame>;
}

export function PaperTrailIllustration({ className = "" }: DrawingProps) {
  return <DrawingFrame className={className} viewBox="0 0 210 190"><g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45"><path d="M27 158c26-12 45-7 46 10 2 20-28 21-35 1-8-24 25-47 60-37 36 11 57-4 70-38" strokeDasharray="5 6" /><path d="m140 44 48-20-20 51-13-17-17 14Z" /><path d="m155 58 33-34-20 51" /></g></DrawingFrame>;
}

export function PlantIllustration({ className = "" }: DrawingProps) {
  return <DrawingFrame className={className} viewBox="0 0 120 170"><g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"><path d="M60 108V43m0 30c-15-8-23-19-21-32 16 4 24 15 21 31Zm1 10c15-14 29-15 39-6-8 14-23 17-39 11Zm-2-29C47 51 35 41 24 44c0 15 13 26 34 30Z" /><path d="m36 107-6 39h58l-6-39H36Z" /><path d="M29 146h60" /></g></DrawingFrame>;
}

export function EnvelopeIllustration({ className = "" }: DrawingProps) {
  return <DrawingFrame className={className} viewBox="0 0 190 150"><g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"><path d="M24 55h111v70H24z" /><path d="m25 58 55 42 55-42M25 123l38-35m74 35-38-35" /><path d="M58 57V24h60l16 16v17M118 24v17h16M69 34h36M69 43h27" /></g></DrawingFrame>;
}

export function RecruiterDashboardDecorations() {
  return <div aria-hidden="true" className="recruiter-dashboard-decorations"><span className="recruiter-wash recruiter-wash-left" /><span className="recruiter-wash recruiter-wash-right" /><span className="recruiter-wash recruiter-wash-bottom" /><span className="recruiter-wash recruiter-wash-bottom-left" /><WorkspaceEntranceIllustration className="recruiter-workspace-art" /><TelescopeIllustration className="recruiter-telescope-art" /><CloudIllustration className="recruiter-cloud-art" /><PieSketchIllustration className="recruiter-pie-art" /><PlantIllustration className="recruiter-plant-art" /><ClipboardIllustration className="recruiter-clipboard-art" /><EnvelopeIllustration className="recruiter-envelope-art" /><RecruiterSparkle className="recruiter-sparkle recruiter-sparkle-one" /><RecruiterSparkle className="recruiter-sparkle recruiter-sparkle-two" /><RecruiterSparkle className="recruiter-sparkle recruiter-sparkle-three" /><RecruiterSparkle className="recruiter-sparkle recruiter-sparkle-four" /><RecruiterSparkle className="recruiter-sparkle recruiter-sparkle-five" /><RecruiterSparkle className="recruiter-sparkle recruiter-sparkle-six" /><span className="recruiter-dot-matrix" /><span className="recruiter-wash recruiter-wash-plan-left" /><span className="recruiter-wash recruiter-wash-plan-right" /><span className="recruiter-wash recruiter-wash-analytics-right" /><PlantIllustration className="recruiter-lower-plant-art" /><PaperTrailIllustration className="recruiter-lower-paper-trail-art" /><EnvelopeIllustration className="recruiter-lower-envelope-art" /><RecruiterSparkle className="recruiter-lower-sparkle-one" /><RecruiterSparkle className="recruiter-lower-sparkle-two" /><RecruiterSparkle className="recruiter-lower-sparkle-three" /><span className="recruiter-lower-dot-matrix" /></div>;
}

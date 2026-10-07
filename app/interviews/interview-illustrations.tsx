import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

function IconBase({ size = 20, children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      {children}
    </svg>
  );
}

export function InterviewCalendarIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect height="16" rx="2.5" width="17" x="3.5" y="5" />
      <path d="M7.5 3.5v4M16.5 3.5v4M3.5 10h17" />
      <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" strokeWidth="2.4" />
    </IconBase>
  );
}

export function InterviewCheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.8" />
      <path d="m8.1 12.1 2.5 2.5 5.4-5.3" />
    </IconBase>
  );
}

export function InterviewCancelIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.8" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </IconBase>
  );
}

export function InterviewSearchIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="10.8" cy="10.8" r="6.2" />
      <path d="m15.5 15.5 4.6 4.6" />
    </IconBase>
  );
}

export function InterviewFilterIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" fill="currentColor" r="1.5" stroke="none" />
      <circle cx="15" cy="12" fill="currentColor" r="1.5" stroke="none" />
      <circle cx="11" cy="17" fill="currentColor" r="1.5" stroke="none" />
    </IconBase>
  );
}

export function InterviewChevronIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6 9 6 6 6-6" />
    </IconBase>
  );
}

function ChairDrawing() {
  return (
    <svg className="interview-art-chair" aria-hidden="true" focusable="false" viewBox="0 0 280 250">
      <path d="M46 30c23-3 56-4 78 0 10 2 16 9 17 20l9 90c2 17 14 25 38 29 18 3 25 14 17 25-8 10-38 12-67 8-34-5-53-19-57-49L70 58" />
      <path d="M70 58 87 183c3 22 19 34 43 37M109 195l-17 50M166 199l4 45M81 191l-16 48M189 198l17 42" />
      <path d="M50 31c-8 27-7 75 0 112 4 23 15 34 38 43" className="interview-art-peach" />
      <path d="M21 230h245" className="interview-art-soft-line" />
      <path d="M202 178h31v55h-31zM196 178h43M202 233h31" />
      <path d="M217 178v-68M217 140c-30-19-38-45-24-65 24 7 32 29 24 65ZM218 148c23-28 41-35 55-25-8 23-29 34-55 34ZM217 130c-22-1-39-14-41-29 17-8 32 2 41 18" />
    </svg>
  );
}

function DeskDrawing() {
  return (
    <svg className="interview-art-desk" aria-hidden="true" focusable="false" viewBox="0 0 380 260">
      <path d="M24 206h330M77 206v18M310 206v19" className="interview-art-soft-line" />
      <path d="m215 206-10-37h34l8 37M209 169c-2-10 5-17 16-17s18 7 16 17M217 158h27" />
      <path d="M234 151 285 86l33 24-49 66" />
      <path d="m282 84 14-24M296 60h18M314 60c10-16 21-21 31-13 10 9 5 23-8 31" />
      <path d="M255 204h70M268 177h52" />
      <path d="M106 206h92v-14h-92zM118 192v-17h70v17M125 175h54v-9h-54z" />
      <path d="m82 198 9-33 35 8-10 31M94 167c4-16 12-25 23-37M116 130c8-13 19-17 27-10 8 8 3 20-7 27M130 147l-18 22" />
      <path d="m249 127 29 17-8 28-31-17Z" />
      <path d="m277 144 5 20M259 139l-12 9" className="interview-art-peach" />
      <path d="M298 95 352 48 381 81l-42 52z" className="interview-art-light-beam" />
      <path d="M307 211c19 7 35 7 53 0" className="interview-art-soft-line" />
    </svg>
  );
}

function ClockDrawing() {
  return (
    <svg className="interview-art-clock" aria-hidden="true" focusable="false" viewBox="0 0 130 130">
      <circle cx="65" cy="65" r="47" />
      <circle cx="65" cy="65" r="42" className="interview-art-soft-line" />
      <path d="M65 65V36M65 65l-19 12" />
      <path d="M65 22v6M65 102v6M22 65h6M102 65h6" className="interview-art-soft-line" />
      <circle cx="65" cy="65" r="2.5" fill="currentColor" stroke="none" />
      <path d="m110 27 9-4M114 39l10-1M29 20l-3-8" className="interview-art-peach" />
    </svg>
  );
}

function PlantDrawing() {
  return (
    <svg className="interview-art-plant" aria-hidden="true" focusable="false" viewBox="0 0 210 250">
      <path d="M72 155h69l-9 66H81Z" />
      <path d="M76 155h61M84 221h46M105 155V54" />
      <path d="M105 93C74 83 51 62 57 37c25 3 43 20 48 56ZM105 112c31-17 57-20 70-5-9 22-36 31-70 22ZM104 126c-27-2-49-15-53-33 19-8 39 3 53 22ZM105 75c11-28 28-41 47-37 0 20-16 35-43 46" />
      <path d="M17 230c47-13 100-6 155 2 18 2 28 1 40-4" className="interview-art-soft-line" />
    </svg>
  );
}

export function InterviewPageDecorations() {
  return (
    <div className="interview-page-decorations" aria-hidden="true">
      <div className="interview-watercolor interview-watercolor-left" />
      <div className="interview-watercolor interview-watercolor-right" />
      <div className="interview-watercolor interview-watercolor-bottom" />
      <ChairDrawing />
      <DeskDrawing />
      <ClockDrawing />
      <PlantDrawing />
      <svg className="interview-art-cloud" focusable="false" viewBox="0 0 160 90">
        <path d="M20 64c0-11 9-20 20-20 3-15 15-25 30-25 14 0 26 9 30 22 3-2 7-3 11-3 11 0 20 9 20 20 0 2 0 4-1 6H20Z" />
      </svg>
      <span className="interview-art-birds interview-art-birds-one">~~</span>
      <span className="interview-art-birds interview-art-birds-two">~ ~</span>
      <span className="interview-art-spark interview-art-spark-one" />
      <span className="interview-art-spark interview-art-spark-two" />
    </div>
  );
}

export function InterviewEmptyIllustration() {
  return (
    <div className="interview-empty-illustration" aria-hidden="true">
      <div className="interview-empty-wash" />
      <svg focusable="false" viewBox="0 0 290 160">
        <path d="M78 37h83l14 15v72H78Z" />
        <path d="M161 37v17h14M94 68h48M94 82h48M94 96h35" />
        <path d="M91 35c0-13 19-13 19 0M121 35c0-13 19-13 19 0M151 35c0-13 19-13 19 0" />
        <circle cx="174" cy="111" r="25" />
        <path d="M166 111c0-7 5-12 11-12s11 5 11 12M169 114c-5 2-9 7-10 12h31c-1-5-5-10-10-12" />
        <circle cx="177" cy="107" r="3" />
        <path d="M42 102c28 7 47-6 62-28 8-11 18-18 32-24" className="interview-empty-trail" />
        <path d="m132 49 24-12-10 27-6-9Z" />
        <path d="m53 61-3-11M61 69l10-3" className="interview-art-peach" />
        <path d="m209 38 6-10 3 10 9 4-9 3-3 10-3-10-9-3Z" className="interview-art-peach" />
      </svg>
      <svg className="interview-empty-cloud" focusable="false" viewBox="0 0 130 75">
        <path d="M15 54c0-9 7-16 16-16 3-12 12-19 24-19 11 0 21 7 24 17 3-2 5-2 8-2 9 0 16 7 16 16 0 2 0 3-1 4H15Z" />
      </svg>
    </div>
  );
}

import type { ReactNode } from "react";

type DrawingProps = {
  className?: string;
};

function DrawingFrame({
  children,
  className = "",
  viewBox,
}: DrawingProps & { children: ReactNode; viewBox: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox={viewBox}
    >
      {children}
    </svg>
  );
}

export function DashboardSearchIcon({ className = "" }: DrawingProps) {
  return (
    <DrawingFrame className={className} viewBox="0 0 24 24">
      <path d="m20 20-4.4-4.4m1.4-5.1a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </DrawingFrame>
  );
}

export function DashboardBookmarkIcon({ className = "" }: DrawingProps) {
  return (
    <DrawingFrame className={className} viewBox="0 0 24 24">
      <path d="M7 4.5c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v16l-5-3.3-5 3.3v-16Z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
    </DrawingFrame>
  );
}

export function DashboardBellIcon({ className = "" }: DrawingProps) {
  return (
    <DrawingFrame className={className} viewBox="0 0 24 24">
      <path d="M18 16.5H6l1.4-2.1v-4a4.6 4.6 0 0 1 9.2 0v4l1.4 2.1ZM10 20h4" fill="currentColor" opacity="0.95" />
      <path d="M18 16.5H6l1.4-2.1v-4a4.6 4.6 0 0 1 9.2 0v4l1.4 2.1ZM10 20h4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </DrawingFrame>
  );
}

export function DashboardPersonIcon({ className = "" }: DrawingProps) {
  return (
    <DrawingFrame className={className} viewBox="0 0 24 24">
      <circle cx="12" cy="8" fill="currentColor" r="4" />
      <path d="M4.5 21c.8-4.3 3.3-6.4 7.5-6.4s6.7 2.1 7.5 6.4" fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </DrawingFrame>
  );
}

export function DashboardDiamondIcon({ className = "" }: DrawingProps) {
  return (
    <DrawingFrame className={className} viewBox="0 0 24 24">
      <path d="m12 3.5 7.5 5.2L12 20.5 4.5 8.7 12 3.5Zm-7.5 5.2h15M8.5 3.5 12 8.7l3.5-5.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </DrawingFrame>
  );
}

export function DashboardSparkle({ className = "" }: DrawingProps) {
  return (
    <DrawingFrame className={className} viewBox="0 0 30 30">
      <path d="m15 3 2.4 9.6L27 15l-9.6 2.4L15 27l-2.4-9.6L3 15l9.6-2.4L15 3Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </DrawingFrame>
  );
}

export function OpportunityPortalIllustration({ className = "" }: DrawingProps) {
  return (
    <DrawingFrame className={className} viewBox="0 0 260 300">
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6">
        <path d="M65 247V86c0-12 6-22 17-28L142 24c15-8 29 3 29 19v180" />
        <path d="m142 24 25 12c7 4 12 12 12 21v166M65 86l15 7m62-69 25 12" />
        <path d="M77 247V113c0-11 5-19 15-24l41-24c12-7 22 2 22 16v141" />
        <path d="M77 247h99m-104 14h125m-112 14h130" />
        <path d="M58 261h137v14H45l13-14Zm27-14h78v14H72l13-14Zm28-14h45v14h-58l13-14Z" />
        <path d="M90 233v-24h39v24m-31-15h6m15 0h5" />
        <path d="M100 209v-18h19v18m-13-9h7" />
        <path d="M106 191v-14h8v14" />
        <path d="M46 260V213m0 15c-13-7-21-18-20-33 17 4 24 16 20 32Zm0 5c13-11 25-13 33-5-7 12-20 15-33 10Zm-1 12c-11-2-19-9-21-18 12-4 20 4 22 14" />
      </g>
      <circle cx="115" cy="95" fill="#FFB51B" opacity="0.78" r="17" />
      <circle cx="123" cy="86" fill="#FFE9B6" opacity="0.45" r="18" />
    </DrawingFrame>
  );
}

export function PlaneJourneyIllustration({ className = "" }: DrawingProps) {
  return (
    <DrawingFrame className={className} viewBox="0 0 300 250">
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6">
        <path d="M62 220c22-26 50-30 72-11 21 19 4 45-20 42-24-3-33-31-12-50 27-25 75-21 98-57 20-31 5-60 33-78" strokeDasharray="6 7" />
        <path d="m206 58 64-30-28 65-17-22-23 20Z" />
        <path d="m225 71 45-43-28 65m-17-22-25 14" />
        <path d="m279 107 6-8m5 14 8-4m-2 14 6 1" stroke="#FFAB71" />
        <path d="M89 98c7-6 13-6 20 0m9 8c5-4 10-4 15 0" />
      </g>
    </DrawingFrame>
  );
}

export function ProfileDocumentIllustration({ className = "" }: DrawingProps) {
  return (
    <DrawingFrame className={className} viewBox="0 0 180 150">
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.55">
        <path d="m42 25 88-10 12 97-88 11-12-98Z" />
        <circle cx="66" cy="51" r="8" />
        <path d="M55 70c2-7 7-10 13-10 5 0 9 3 11 8M83 43l29-3m-27 15 34-4m-32 15 29-3m-59 27 50-6m-48 15 38-5" />
        <path d="m134 40 5-9 3 9 9 3-9 3-3 10-3-10-9-3Z" />
        <path d="m35 94-8-3m13 12-2 6" stroke="#FFAB71" />
      </g>
    </DrawingFrame>
  );
}

export function ApplicationDocumentsIllustration({ className = "" }: DrawingProps) {
  return (
    <DrawingFrame className={className} viewBox="0 0 180 150">
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.55">
        <path d="m43 39 69-7 14 72-70 9-13-74Z" opacity="0.55" />
        <path d="m60 26 67 11 1 75-67-11-1-75Z" />
        <circle cx="80" cy="54" r="7" />
        <path d="M70 70c2-6 6-9 11-9s9 3 10 8m10-19 12 2m-12 12 15 2m-15 13 14 2m-42 8 38 6" />
      </g>
    </DrawingFrame>
  );
}

export function RecommendationIllustration({ className = "" }: DrawingProps) {
  return (
    <DrawingFrame className={className} viewBox="0 0 190 150">
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.55">
        <path d="M38 51h48l14 13h46v50H38V51Z" />
        <path d="M38 51h49l14 13h45" />
        <path d="M61 79h42m-42 12h29" />
        <path d="m123 43 6-11 4 11 11 4-11 4-4 11-4-11-11-4Z" />
        <path d="M143 107c15-4 27-12 37-25" strokeDasharray="4 5" />
        <path d="m168 74 15-8-6 16-4-6-5 5Z" />
      </g>
      <path d="M56 112c9-25 29-40 53-39 23 1 39 19 42 39H56Z" fill="#EEEAFE" opacity="0.78" />
    </DrawingFrame>
  );
}

export function CareerMonumentIllustration({ className = "" }: DrawingProps) {
  return (
    <DrawingFrame className={className} viewBox="0 0 270 260">
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6">
        <path d="M53 217V73l46-22 35 21v145" />
        <path d="M99 51v166m35-145 21 15v130" />
        <path d="M53 217h102v16H41l12-16Zm29-145v145m36-145v145" />
        <path d="M164 210c0-25 18-45 40-45s40 20 40 45-18 38-40 38-40-13-40-38Z" />
        <path d="M190 248h45l10 11h-74l19-11Zm-113-1h88v12H63l14-12Z" />
        <path d="M42 214v-41m0 13c-13-8-20-19-18-32 15 5 21 16 18 31Zm1 13c13-11 24-13 32-5-7 11-20 14-32 9" />
      </g>
      <path d="M77 216c14-34 24-56 44-77 15 20 28 39 34 77H77Z" fill="#ECE8FF" opacity="0.72" />
    </DrawingFrame>
  );
}

export function CareerStepsIllustration({ className = "" }: DrawingProps) {
  return (
    <DrawingFrame className={className} viewBox="0 0 270 250">
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6">
        <path d="M37 220h42v-31h42v-31h42v-31h42v-31h34v124H37Z" />
        <path d="M79 220v-31m42 0v-31m42 0v-31m42 0V96" />
        <path d="M205 96V52m0 0 32 11-32 11V52Z" stroke="#FFAB21" />
        <path d="M230 220v-36m0 11c-12-7-18-17-17-28 14 4 20 15 17 27Zm0 11c12-10 22-11 29-4-6 10-17 12-29 8" />
        <path d="M20 232h231" />
      </g>
    </DrawingFrame>
  );
}

export function DecorativeVaseIllustration({ className = "" }: DrawingProps) {
  return (
    <DrawingFrame className={className} viewBox="0 0 120 190">
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.55">
        <path d="M46 96h28l-4 64H50l-4-64Zm2 17h24m-20 31h16" />
        <path d="M60 96V36m0 34c-18-7-28-20-26-38 16 3 25 15 26 34Zm1 14c18-13 32-15 42-7-8 14-23 18-42 12Zm-1-35c9-18 21-26 34-23-1 15-12 25-31 30" />
      </g>
    </DrawingFrame>
  );
}

export function CandidateDashboardDecorations() {
  return (
    <div aria-hidden="true" className="candidate-dashboard-decorations">
      <div className="candidate-dashboard-wash candidate-dashboard-wash-left-top" />
      <div className="candidate-dashboard-wash candidate-dashboard-wash-right-top" />
      <div className="candidate-dashboard-wash candidate-dashboard-wash-left-bottom" />
      <div className="candidate-dashboard-wash candidate-dashboard-wash-right-bottom" />
      <OpportunityPortalIllustration className="candidate-dashboard-portal" />
      <PlaneJourneyIllustration className="candidate-dashboard-plane" />
      <DecorativeVaseIllustration className="candidate-dashboard-vase" />
      <CareerMonumentIllustration className="candidate-dashboard-monument" />
      <CareerStepsIllustration className="candidate-dashboard-steps" />
      <DashboardSparkle className="candidate-dashboard-sparkle candidate-dashboard-sparkle-one" />
      <DashboardSparkle className="candidate-dashboard-sparkle candidate-dashboard-sparkle-two" />
      <DashboardSparkle className="candidate-dashboard-sparkle candidate-dashboard-sparkle-three" />
      <span className="candidate-dashboard-dot-grid candidate-dashboard-dot-grid-left" />
      <span className="candidate-dashboard-dot-grid candidate-dashboard-dot-grid-right" />
    </div>
  );
}

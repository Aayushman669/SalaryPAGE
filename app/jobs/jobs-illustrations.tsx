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

export function BriefcaseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect height="12" rx="2" width="17" x="3.5" y="7.5" />
      <path d="M8 7.5V5.8A1.8 1.8 0 0 1 9.8 4h4.4A1.8 1.8 0 0 1 16 5.8v1.7" />
      <path d="M3.5 12.5h17M10 12.5v2h4v-2" />
    </IconBase>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="10.8" cy="10.8" r="6.2" />
      <path d="m15.5 15.5 4.6 4.6" />
    </IconBase>
  );
}

export function LocationIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M19 10.2c0 4.7-7 10-7 10s-7-5.3-7-10a7 7 0 1 1 14 0Z" />
      <circle cx="12" cy="10" r="2.2" />
    </IconBase>
  );
}

export function CategoryIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect height="5" rx="1" width="5" x="4" y="4" />
      <rect height="5" rx="1" width="5" x="15" y="4" />
      <rect height="5" rx="1" width="5" x="4" y="15" />
      <rect height="5" rx="1" width="5" x="15" y="15" />
    </IconBase>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" fill="currentColor" r="1.5" stroke="none" />
      <circle cx="15" cy="12" fill="currentColor" r="1.5" stroke="none" />
      <circle cx="11" cy="17" fill="currentColor" r="1.5" stroke="none" />
    </IconBase>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </IconBase>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6 9 6 6 6-6" />
    </IconBase>
  );
}

function Spark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M12 2.5 13.8 9l6.2 3-6.2 3L12 21.5 10.2 15 4 12l6.2-3L12 2.5Z" />
    </svg>
  );
}

function DocumentDrawing() {
  return (
    <svg className="jobs-art-document" aria-hidden="true" focusable="false" viewBox="0 0 150 170">
      <path d="m35 16 49-7 31 29-1 86-64 11-15-20Z" />
      <path d="m84 10 2 29 29-1" />
      <path d="M52 55 92 49M53 71l43-7M54 87l29-5" />
      <path d="M83 107c6-11 20-17 28-12 8 5 9 16 2 23-7 8-22 8-30 2" className="jobs-art-peach" />
      <path d="M101 101c-3 8-2 17 4 23" className="jobs-art-peach" />
      <path d="m30 42-12 5M27 32l-5-11" className="jobs-art-peach" />
    </svg>
  );
}

function CityDrawing() {
  return (
    <svg className="jobs-art-city" aria-hidden="true" focusable="false" viewBox="0 0 270 190">
      <path d="M20 168h230" />
      <path d="M31 168V82h34v86M42 82V69h12v13M76 168V45h45v123M90 45V30h17v15M130 168v-64h30v64M169 168V70h40v98M181 70V51h16v19M218 168v-43h24v43" />
      <path d="M39 94h8M53 94h7M39 108h8M53 108h7M39 122h8M53 122h7M39 136h8M53 136h7M86 61h8M103 61h8M86 77h8M103 77h8M86 93h8M103 93h8M86 109h8M103 109h8M86 125h8M103 125h8M139 117h6M149 117h6M139 131h6M149 131h6M178 86h8M193 86h8M178 102h8M193 102h8M178 118h8M193 118h8M178 134h8M193 134h8M224 138h5M233 138h5M224 150h5M233 150h5" />
      <path d="M17 169c28-5 45-4 63 0M205 169c17-5 29-4 49 0" />
    </svg>
  );
}

function DeskDrawing() {
  return (
    <svg className="jobs-art-desk" aria-hidden="true" focusable="false" viewBox="0 0 350 220">
      <path d="M22 168h302M64 168v14M279 168v13" />
      <path d="M102 169h79v-12h-79zM112 156v-15h60v15M118 141h47v-8h-47z" />
      <path d="m219 168-10-31h30l8 31M214 137c-2-9 4-15 14-15s16 6 14 15M220 126h22" />
      <path d="m263 168 9-36 31 7-10 29M276 135c4-15 11-23 21-35M297 100c10-15 20-19 28-12 9 7 5 21-6 29M313 117l-17 20" />
      <path d="M295 117c7-5 15-4 21 1" />
      <path d="M267 94 285 62l28 20-16 31zM280 61l11-22M291 39h8" />
      <path d="M236 179c20 7 36 7 55 0" />
    </svg>
  );
}

function PlantDrawing() {
  return (
    <svg className="jobs-art-plant" aria-hidden="true" focusable="false" viewBox="0 0 210 250">
      <path d="M72 155h69l-9 66H81Z" />
      <path d="M76 155h61M84 221h46" />
      <path d="M105 155V54" />
      <path d="M105 93C74 83 51 62 57 37c25 3 43 20 48 56ZM105 112c31-17 57-20 70-5-9 22-36 31-70 22ZM104 126c-27-2-49-15-53-33 19-8 39 3 53 22ZM105 75c11-28 28-41 47-37 0 20-16 35-43 46" />
      <path d="M17 230c47-13 100-6 155 2 18 2 28 1 40-4" className="jobs-art-soft-line" />
    </svg>
  );
}

function BriefcaseDrawing() {
  return (
    <svg className="jobs-art-briefcase" aria-hidden="true" focusable="false" viewBox="0 0 230 170">
      <path d="m42 39 86 16 19 74-95-16Z" />
      <path d="m42 39 12-18 88 16-14 18M70 31l3-15 34 6 1 15" />
      <path d="m52 83 92 17M94 92l4 18 17 3 3-17" />
      <path d="M150 129c30 8 47 2 68-18M174 151c-26-2-40 0-61 10" className="jobs-art-soft-line" />
      <path d="m31 29 8-8M32 47l-11-2M153 42l8-7" className="jobs-art-peach" />
    </svg>
  );
}

export function JobsPageDecorations() {
  return (
    <div className="jobs-page-decorations" aria-hidden="true">
      <div className="jobs-watercolor jobs-watercolor-left" />
      <div className="jobs-watercolor jobs-watercolor-right" />
      <div className="jobs-watercolor jobs-watercolor-bottom-left" />
      <div className="jobs-watercolor jobs-watercolor-bottom-right" />
      <DocumentDrawing />
      <CityDrawing />
      <DeskDrawing />
      <PlantDrawing />
      <BriefcaseDrawing />
      <svg className="jobs-art-cloud" focusable="false" viewBox="0 0 160 90">
        <path d="M20 64c0-11 9-20 20-20 3-15 15-25 30-25 14 0 26 9 30 22 3-2 7-3 11-3 11 0 20 9 20 20 0 2 0 4-1 6H20Z" />
      </svg>
      <Spark className="jobs-art-spark jobs-art-spark-one" />
      <Spark className="jobs-art-spark jobs-art-spark-two" />
      <span className="jobs-art-birds jobs-art-birds-one">~~</span>
      <span className="jobs-art-dots jobs-art-dots-left" />
      <span className="jobs-art-dots jobs-art-dots-right" />
    </div>
  );
}

export function JobsEmptyIllustration() {
  return (
    <div className="jobs-empty-illustration" aria-hidden="true">
      <div className="jobs-empty-illustration-wash" />
      <svg focusable="false" viewBox="0 0 300 150">
        <path d="M74 42h54l15 16v56H74Z" />
        <path d="M128 42v17h15M87 70h37M87 82h33M87 94h24" />
        <circle cx="166" cy="83" r="23" />
        <path d="m183 100 18 18" />
        <path d="M212 96c15-3 28-12 35-28" className="jobs-empty-trail" />
        <path d="m240 63 22-13-8 24-5-9Z" />
        <path d="m52 44-9-4M58 32l-1-9" className="jobs-art-peach" />
        <path d="m218 46 6-10 3 10 9 4-9 3-3 10-3-10-9-3Z" className="jobs-art-peach" />
      </svg>
    </div>
  );
}

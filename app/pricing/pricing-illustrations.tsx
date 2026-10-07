function CloudDoodle({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 120 70"
    >
      <path d="M10 52c0-10 8-18 18-18 2-15 15-25 30-25 16 0 28 10 31 25 4-4 9-6 15-6 10 0 18 8 18 18h4c8 0 14 6 14 14H25c-8 0-15-4-15-8Z" />
    </svg>
  );
}

export function PricingChecklistIllustration() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute left-[3.1%] top-[16.5%] z-[1] hidden h-56 w-64 select-none lg:block">
      <CloudDoodle className="absolute left-[6.4rem] top-[-4.7rem] h-16 w-24 stroke-[#A891FF] stroke-[1.45] opacity-80" />
      <svg fill="none" focusable="false" viewBox="0 0 260 230" className="h-full w-full overflow-visible">
        <g strokeLinecap="round" strokeLinejoin="round">
          <path d="M58 47 152 22c13 32 31 57 55 79l-83 68C98 128 74 89 58 47Z" stroke="#A891FF" strokeWidth="1.55" transform="rotate(-13 130 96)" />
          <path d="M82 53c6-2 12 2 14 8 1 5-1 10-6 13l17 8-28 8 7-18c-5-1-8-4-9-9-2-5 0-9 5-10Z" stroke="#8F7BFF" strokeWidth="1.45" transform="rotate(-13 92 71)" />
          <path d="M118 52h48M117 71h62M91 107l8 7 13-16M125 101h57M124 120h46M104 143l8 7 13-15M138 137h43" stroke="#A891FF" strokeWidth="1.45" transform="rotate(-13 133 98)" />
          <circle cx="167" cy="155" r="25" fill="#FFF6D8" stroke="#F4A400" strokeWidth="1.8" />
          <path d="M167 140v30M158 148c3-7 18-7 19 1 1 9-18 6-18 15 0 8 16 8 20 1" stroke="#F4A400" strokeWidth="1.55" />
          <path d="M50 163c-12-15-23-22-35-22m42 10c-7-17-6-29 3-39m-35 44c-10 0-18 5-25 14m46 6c-14 1-24 8-30 20" stroke="#A891FF" strokeWidth="1.45" />
          <path d="M29 137c12 0 16 6 14 14-12 0-17-5-14-14Zm31-25c9 10 8 17 1 22-9-10-9-17-1-22ZM8 169c11-4 17-1 19 7-11 4-18 1-19-7Zm9 25c12-4 19 0 20 8-12 4-18 1-20-8Z" stroke="#A891FF" strokeWidth="1.35" />
          <path d="M211 27l3 8 7 3-7 3-3 8-3-8-8-3 8-3 3-8ZM237 104l3 5 5 2-5 3-3 5-2-5-6-3 6-2 2-5Z" stroke="#F4A400" strokeWidth="1.25" />
          <path d="M218 88h1M225 90h1" stroke="#7B5CFF" strokeWidth="2.2" />
        </g>
      </svg>
    </div>
  );
}

export function PricingAnalyticsIllustration() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute right-[3.3%] top-[10.8%] z-[1] hidden h-64 w-72 select-none lg:block">
      <div className="absolute right-[-3rem] top-[3.5rem] h-44 w-44 rounded-[45%_55%_48%_52%] bg-[radial-gradient(ellipse_at_center,rgba(255,218,201,0.42),rgba(255,231,218,0.18)_54%,transparent_76%)] blur-2xl" />
      <CloudDoodle className="absolute right-[4.7rem] top-[-1rem] h-14 w-24 stroke-[#A891FF] stroke-[1.35] opacity-75" />
      <svg fill="none" focusable="false" viewBox="0 0 300 255" className="relative h-full w-full overflow-visible">
        <g strokeLinecap="round" strokeLinejoin="round">
          <path d="M52 145h126M70 145V124h15v21M101 145V104h15v41M132 145V78h15v67M163 145V54h15v91" stroke="#9A83FF" strokeWidth="1.6" />
          <path d="M65 90c35-12 68-36 96-73m0 0-3 20m3-20-20 8" stroke="#8F73FF" strokeWidth="1.55" />
          <path d="M216 101a39 39 0 1 1-1 0Zm0 0v39l34-18m-34 18 14-37" stroke="#8F73FF" strokeWidth="1.55" />
          <path d="M196 180h80M182 182h8M60 178h92" stroke="#B8AAFF" strokeWidth="1.3" />
          <path d="M235 37l4 10 10 4-10 4-4 10-4-10-10-4 10-4 4-10ZM20 196l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4Z" stroke="#F4A400" strokeWidth="1.25" />
          <path d="M275 79c-8 8-9 18-3 29m6-20c8-1 13-5 16-13m-18 22c8 6 16 7 24 2" stroke="#A891FF" strokeWidth="1.35" />
          <path d="M246 11h1M260 11h1M274 11h1M288 11h1M246 25h1M260 25h1M274 25h1M288 25h1M246 39h1M260 39h1M274 39h1M288 39h1" stroke="#FF9BA7" strokeWidth="2.2" />
        </g>
      </svg>
    </div>
  );
}

export function PricingCalculatorIllustration() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute bottom-[3.4rem] left-[-1.7rem] z-[1] hidden h-56 w-64 select-none lg:block">
      <div className="absolute left-[-3rem] top-[2.3rem] h-40 w-48 rounded-[48%_52%_55%_45%] bg-[radial-gradient(ellipse_at_center,rgba(211,202,255,0.36),rgba(255,226,211,0.2)_58%,transparent_78%)] blur-2xl" />
      <svg fill="none" focusable="false" viewBox="0 0 260 225" className="relative h-full w-full overflow-visible">
        <g strokeLinecap="round" strokeLinejoin="round">
          <path d="M42 44 112 25c7-2 13 2 15 9l37 137c2 7-2 14-9 16l-70 19c-7 2-13-2-15-9L33 60c-2-7 2-14 9-16Z" stroke="#9A83FF" strokeWidth="1.55" transform="rotate(-10 98 116)" />
          <path d="M58 62h56v24H58zM62 107h15M92 107h15M122 107h15M66 133h15M96 133h15M126 133h15M70 159h15M100 159h15M130 159h15" stroke="#A891FF" strokeWidth="1.35" transform="rotate(-10 98 116)" />
          <ellipse cx="168" cy="181" rx="24" ry="8" stroke="#F4A400" strokeWidth="1.45" />
          <path d="M144 181v18c0 4 11 8 24 8s24-4 24-8v-18M144 190c0 5 11 8 24 8s24-3 24-8" stroke="#F4A400" strokeWidth="1.45" />
          <ellipse cx="206" cy="164" rx="23" ry="8" stroke="#F4A400" strokeWidth="1.45" />
          <path d="M183 164v27c0 4 10 8 23 8s23-4 23-8v-27M183 173c0 4 10 8 23 8s23-4 23-8M183 182c0 4 10 8 23 8s23-4 23-8" stroke="#F4A400" strokeWidth="1.45" />
          <path d="M25 23l3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z" stroke="#A891FF" strokeWidth="1.15" />
        </g>
      </svg>
    </div>
  );
}

export function PricingPlantIllustration() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute bottom-[2.4rem] right-[1.8rem] z-[1] hidden h-64 w-56 select-none lg:block">
      <div className="absolute bottom-[-0.5rem] right-[-4rem] h-48 w-52 rounded-[45%_55%_52%_48%] bg-[radial-gradient(ellipse_at_center,rgba(255,218,201,0.44),rgba(255,233,222,0.18)_56%,transparent_77%)] blur-2xl" />
      <svg fill="none" focusable="false" viewBox="0 0 220 260" className="relative h-full w-full overflow-visible">
        <g stroke="#9A83FF" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.55">
          <path d="M83 216h78l-8 38H92l-9-38Z" />
          <path d="M103 216c-8-47-24-80-61-113 28 10 47 27 61 52-6-38 4-72 29-102 4 43-3 77-21 103 21-42 47-67 78-74-9 43-32 73-70 90 25-19 51-24 78-13-17 29-42 43-75 40m-3 17c4-39 1-78-8-118" />
          <path d="M44 103c22 6 39 22 51 48M132 53c3 28-4 58-20 90M189 82c-15 34-38 59-68 77M197 159c-23 16-47 25-73 27" opacity="0.65" />
        </g>
      </svg>
    </div>
  );
}

export function PricingTinyDecorations() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] hidden select-none overflow-hidden lg:block">
      <span className="absolute left-[18%] top-[7%] h-4 w-4 rotate-45 border border-[#F4A400]" />
      <span className="absolute left-[19.8%] top-[15.3%] text-lg font-bold leading-none text-[#6E55FF]">..</span>
      <span className="absolute right-[8%] top-[18%] h-5 w-5 rotate-45 border border-[#F4A400]" />
      <span className="absolute right-[7.5%] bottom-[27%] grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }).map((_, index) => (
          <span key={index} className="h-1 w-1 rounded-full bg-[#8F73FF]/55" />
        ))}
      </span>
      <span className="absolute left-[5%] bottom-[30%] h-4 w-4 rotate-45 border border-[#C8BFFF]" />
    </div>
  );
}

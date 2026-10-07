function SavedFolderDrawing({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 220 190"
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6">
        <path d="M34 75V48c0-9 7-16 16-16h54l20 21h48c8 0 14 6 14 14v8" />
        <path d="M47 61h119c8 0 14 6 13 14l-11 90H49c-10 0-17-8-16-18l9-70c1-9 8-16 17-16Z" />
        <path d="m48 61 19 18h112" />
        <path d="M84 91c24-6 48-2 67 12-17 5-33 19-42 35-18-10-27-26-25-47Z" />
        <path d="m111 100 4 15 15 4-15 4-4 15-4-15-15-4 15-4Z" />
        <path d="m176 80 18 18m-7-28 18 9" />
      </g>
    </svg>
  );
}

function SavedCloudDrawing({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 140 90"
    >
      <path d="M14 64c0-10 8-18 18-18 2-15 14-25 29-25 16 0 28 10 30 25 4-2 7-3 11-3 10 0 18 8 18 18 0 2 0 4-1 6H29c-9 0-15-4-15-11Z" />
      <path className="saved-jobs-bird" d="M87 76c7-6 13-6 20 0m10 2c5-4 10-4 15 0" />
    </svg>
  );
}

function SavedPlaneDrawing({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 250 205"
    >
      <path className="saved-jobs-flight-trail" d="M205 72c-1 20 11 32 30 42 28 15 37 42 18 60-16 15-43 15-64 3" />
      <path d="m171 46 61-31-27 62-15-22-22 23Z" />
      <path d="m189 54 43-39-27 62m-15-23-22 13" />
    </svg>
  );
}

function SavedPlantCoffeeDrawing({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 260 230"
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6">
        <path d="M104 139h68l-9 63h-50Z" />
        <path d="M109 139h58M117 202h43M138 139V48" />
        <path d="M138 82c-29-11-48-29-45-52 23 2 40 17 45 45ZM138 108c28-17 52-19 63-7-10 21-33 28-63 21ZM137 125c-25-3-43-15-47-31 18-8 37 2 48 20ZM138 71c9-24 25-35 42-31 0 18-14 31-39 40Z" />
        <path d="M28 190h55c1 14-9 24-27 24-17 0-27-9-28-24Z" />
        <path d="M28 190h55M83 195c14-2 19-13 11-21-4-4-9-5-15-4M39 184h34" />
        <path d="M45 177c0-9 4-14 0-21m12 21c1-11 7-16 5-24m10 24c2-7 6-10 6-17" />
      </g>
    </svg>
  );
}

function SavedNotebookDrawing({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 250 190"
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6">
        <path d="m43 48 124-20 19 116-121 19Z" />
        <path d="m52 38 124-18 17 113-121 18Z" />
        <path d="m61 51 112-16M66 73l93-14m-88 33 83-12m-78 31 58-9" />
        <path d="M73 30c-2-8 6-11 9-3m14-9c-2-8 6-11 9-3m14-10c-2-8 6-11 9-3m14-9c-2-8 6-11 9-3" />
        <path d="m184 141 31-84 12 5-31 84Z" />
        <path d="m215 57 10-22 12 5-9 22m-20 84 8 5" />
      </g>
    </svg>
  );
}

function SavedLeafDrawing({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 80 100"
    >
      <path d="M39 92c-1-32 5-52 25-75M38 69c-13-2-21-8-25-19 12-2 22 4 26 13m2 11c12-8 22-9 30-4-5 10-16 15-29 13M47 52c-2-11 2-20 10-26 6 10 2 20-8 28" />
    </svg>
  );
}

function SavedSparkle({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 30 30"
    >
      <path d="M15 3 17 12l9 3-9 3-2 9-2-9-9-3 9-3Z" />
    </svg>
  );
}

export function SavedJobsDecorations() {
  return (
    <div aria-hidden="true" className="saved-jobs-decorations">
      <div className="saved-jobs-watercolor saved-jobs-watercolor-left" />
      <div className="saved-jobs-watercolor saved-jobs-watercolor-right" />
      <div className="saved-jobs-watercolor saved-jobs-watercolor-bottom-left" />
      <div className="saved-jobs-watercolor saved-jobs-watercolor-bottom-right" />
      <SavedFolderDrawing className="saved-jobs-folder-drawing" />
      <SavedCloudDrawing className="saved-jobs-cloud-drawing" />
      <SavedPlaneDrawing className="saved-jobs-plane-drawing" />
      <SavedLeafDrawing className="saved-jobs-leaf-drawing saved-jobs-leaf-drawing-left" />
      <SavedLeafDrawing className="saved-jobs-leaf-drawing saved-jobs-leaf-drawing-right" />
      <SavedPlantCoffeeDrawing className="saved-jobs-plant-drawing" />
      <SavedNotebookDrawing className="saved-jobs-notebook-drawing" />
      <SavedSparkle className="saved-jobs-sparkle saved-jobs-sparkle-one" />
      <SavedSparkle className="saved-jobs-sparkle saved-jobs-sparkle-two" />
      <span className="saved-jobs-dot-grid saved-jobs-dot-grid-left" />
      <span className="saved-jobs-dot-grid saved-jobs-dot-grid-right" />
    </div>
  );
}

export function SavedJobsEmptyIllustration() {
  return (
    <div aria-hidden="true" className="saved-jobs-empty-illustration">
      <div className="saved-jobs-empty-wash" />
      <svg fill="none" focusable="false" viewBox="0 0 420 190">
        <path d="M70 78V61c0-7 5-12 12-12h45l16 15h45c7 0 12 5 12 12v10" />
        <path d="M80 76h121c7 0 12 5 11 12l-9 65H79c-7 0-12-5-11-12l7-54c1-7 5-11 12-11Z" />
        <path d="m81 76 16 15h114" />
        <path d="M112 101c19-5 38-2 53 9-14 4-26 14-33 28-14-8-21-21-20-37Z" />
        <path d="m133 109 3 12 12 3-12 3-3 12-3-12-12-3 12-3Z" />
        <path d="M227 145c30-4 56-17 75-39 13-15 29-25 55-31" className="saved-jobs-empty-trail" />
        <path d="m338 55 48-24-21 48-11-16-17 18Z" />
        <path d="m355 62 31-31-21 48m-11-16-18 12" />
        <path d="m54 56-9-4m17-8-1-11" className="saved-jobs-empty-accent" />
        <path d="m272 43 5-10 4 10 10 4-10 4-4 11-4-11-10-4Z" className="saved-jobs-empty-spark" />
        <path d="m247 147-6-2m13 10-3 6" className="saved-jobs-empty-accent" />
      </svg>
    </div>
  );
}

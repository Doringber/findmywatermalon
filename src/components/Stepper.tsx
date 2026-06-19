export type Step = 'start' | 'look' | 'listen' | 'result';

const ORDER: Step[] = ['look', 'listen', 'result'];
const LABELS: Record<Step, string> = {
  start: 'Start',
  look: 'Look',
  listen: 'Listen',
  result: 'Result',
};

/** Three seed-shaped dots that fill in as the hunt progresses. */
export function Stepper({ step }: { step: Step }) {
  const activeIndex = ORDER.indexOf(step);
  return (
    <div className="seeds" role="progressbar" aria-label={`Step: ${LABELS[step]}`}>
      {ORDER.map((s, i) => {
        const state = activeIndex < 0 ? '' : i < activeIndex ? 'done' : i === activeIndex ? 'current' : '';
        return <span key={s} className={`seed ${state}`.trim()} />;
      })}
    </div>
  );
}

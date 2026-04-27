/**
 * The user's question — clearly labeled "Tu pregunta", in a soft chip-like
 * card so it's instantly distinguishable from the verse and response.
 */
export function QuestionLine({ text }: { text: string }) {
  return (
    <div className="anim-fade-in mb-4">
      <span className="label-section">Tu pregunta</span>
      <div className="card-question">
        <p className="font-sans text-[0.96rem] sm:text-[1rem] leading-[1.55] text-[var(--ink)]">
          {text}
        </p>
      </div>
    </div>
  );
}

import { memo } from "react";

/**
 * The user's question — rendered as a chat-style bubble aligned to the
 * right, in soft gold-tinged paper. Distinguishes the user's voice from
 * the response without needing an explicit "Tu pregunta" label.
 *
 * memo()'d so previous turns don't re-render every time the chat state
 * changes (e.g. while a new turn is streaming).
 */
export const QuestionLine = memo(function QuestionLine({ text }: { text: string }) {
  return (
    <div className="anim-fade-in mb-5 flex justify-end">
      <div
        className="max-w-[85%] rounded-2xl rounded-tr-md px-4 py-2.5"
        style={{
          backgroundColor: "rgba(184, 146, 74, 0.13)",
          border: "1px solid rgba(184, 146, 74, 0.25)",
        }}
      >
        <p className="font-sans text-[0.94rem] sm:text-[0.98rem] leading-[1.5] text-[var(--ink)]">
          {text}
        </p>
      </div>
    </div>
  );
});

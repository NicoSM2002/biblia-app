import { memo } from "react";

/**
 * The user's question — a chat-style bubble aligned right.
 *
 * It used to be gold-tinged, which put the user's voice in the same colour as
 * Scripture, the rubrics, the active tab and every button in the app. Now it
 * carries the marian blue: gold belongs to the Word, blue to the person using
 * it. At a glance down a long conversation you can tell who is speaking
 * without reading a single line.
 *
 * memo()'d so previous turns don't re-render every time the chat state
 * changes (e.g. while a new turn is streaming).
 */
export const QuestionLine = memo(function QuestionLine({ text }: { text: string }) {
  return (
    <div className="anim-fade-in mb-4 flex justify-end">
      <div
        className="max-w-[86%] rounded-2xl rounded-tr-md px-4 py-2.5"
        style={{
          backgroundColor: "color-mix(in srgb, var(--marian) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--marian) 26%, transparent)",
        }}
      >
        <p className="font-sans text-[0.92rem] sm:text-[0.96rem] leading-[1.5] text-[var(--ink)]">
          {text}
        </p>
      </div>
    </div>
  );
});

/**
 * Helpers to export a conversation as plain text, share via the native
 * share sheet, or trigger a print/save-as-PDF dialog.
 */

export type ExportableTurn = {
  question: string;
  verse?: { reference: string; text: string } | null;
  response?: string;
};

export function formatTurnsAsText(turns: ExportableTurn[]): string {
  const date = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const sep = "─".repeat(40);
  let out = `HABLA CON LA PALABRA\nConversación del ${date}\n${sep}\n\n`;
  for (const t of turns) {
    out += `Tu pregunta:\n${t.question}\n\n`;
    if (t.verse) {
      const cleanText = t.verse.text
        .replace(/\s*\|\s*/g, " — ")
        .replace(
          /\((?:Alef|Bet|Guímel|Guimel|Dálet|Dalet|He|Vau|Zain|Jet|Tet|Yod|Kaf|Lámed|Lamed|Mem|Nun|Sámec|Samec|Ain|Pe|Sade|Kof|Cof|Res|Sin|Sín|Shin|Tau)\)\s*/gi,
          "",
        );
      out += `${t.verse.reference}\n"${cleanText.trim()}"\n\n`;
    }
    if (t.response) {
      out += `${t.response}\n\n`;
    }
    out += `${sep}\n\n`;
  }
  out += `Sagrada Biblia · Versión oficial de la Conferencia Episcopal Española`;
  return out;
}

export async function copyConversation(turns: ExportableTurn[]): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(formatTurnsAsText(turns));
    return true;
  } catch {
    return false;
  }
}

export async function shareConversation(turns: ExportableTurn[]): Promise<boolean> {
  if (typeof navigator === "undefined" || !("share" in navigator)) {
    return copyConversation(turns);
  }
  try {
    await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
      title: "Habla con la Palabra",
      text: formatTurnsAsText(turns),
    });
    return true;
  } catch {
    return false;
  }
}

export function printConversation() {
  if (typeof window === "undefined") return;
  window.print();
}

export function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && "share" in navigator;
}

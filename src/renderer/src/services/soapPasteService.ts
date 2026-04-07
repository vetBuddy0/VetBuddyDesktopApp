/**
 * SOAP Paste Service - Desktop Overlay
 * Tab injection is not available in desktop app.
 * All paste operations fall back to clipboard copy.
 */

type NoteContent = {
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  clientSummary: string | null;
};

type PasteRecord = {
  displayName: string;
  inputSelector: string;
  content: string;
};

function formatNoteContent(content: NoteContent): string {
  const sections: string[] = [];
  if (content.subjective) sections.push(`SUBJECTIVE:\n${content.subjective}`);
  if (content.objective) sections.push(`OBJECTIVE:\n${content.objective}`);
  if (content.assessment) sections.push(`ASSESSMENT:\n${content.assessment}`);
  if (content.plan) sections.push(`PLAN:\n${content.plan}`);
  if (content.clientSummary) sections.push(`CLIENT SUMMARY:\n${content.clientSummary}`);
  return sections.join('\n\n');
}

export async function copyToClipboard(
  content: NoteContent
): Promise<{ success: boolean; message: string }> {
  try {
    const text = formatNoteContent(content);
    await navigator.clipboard.writeText(text);
    return { success: true, message: 'Note copied to clipboard — paste it into your EHR.' };
  } catch {
    return { success: false, message: 'Failed to copy to clipboard.' };
  }
}

export async function pasteSOAPNote(
  content: NoteContent
): Promise<{ success: boolean; message: string }> {
  // Desktop app: paste not available, copy to clipboard instead
  return copyToClipboard(content);
}

export async function pasteSOAPNoteWithRecords(
  content: NoteContent,
  records?: PasteRecord[]
): Promise<{ success: boolean; message: string }> {
  // Desktop app: format records into clipboard text
  try {
    let text = '';
    if (records && records.length > 0) {
      text = records.map(r => `${r.displayName}:\n${r.content}`).join('\n\n');
    } else {
      text = formatNoteContent(content);
    }
    await navigator.clipboard.writeText(text);
    return { success: true, message: 'Note copied to clipboard — paste it into your EHR.' };
  } catch {
    return { success: false, message: 'Failed to copy to clipboard.' };
  }
}

export async function checkPasteAllowed(): Promise<{
  allowed: boolean;
  config?: { name: string };
}> {
  // Desktop app: direct EHR paste is not available
  return { allowed: false };
}

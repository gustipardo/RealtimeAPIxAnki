
/**
 * Utilities for cleaning and normalizing text from Anki cards.
 * Removes HTML tags, media references, and normalizes whitespace.
 */
export function cleanAnkiText(rawHtml: string): string {
    if (!rawHtml) return "";

    // 1. Remove style blocks and script blocks
    let text = rawHtml.replace(/<style([\s\S]*?)<\/style>/gi, "");
    text = text.replace(/<script([\s\S]*?)<\/script>/gi, "");

    // 2. Remove media references (images, sounds, etc.)
    // Standard HTML img tags
    text = text.replace(/<img[^>]*>/gi, "");
    // Anki sound/video references often in format [sound:filename.mp3]
    text = text.replace(/\[sound:[^\]]*\]/gi, "");

    // 3. Replace common block elements with newlines to preserve structure for TTS
    text = text.replace(/<\/div>/gi, "\n");
    text = text.replace(/<\/p>/gi, "\n");
    text = text.replace(/<br\s*\/?>/gi, "\n");

    // 4. Remove all remaining HTML tags
    text = text.replace(/<[^>]+>/g, "");

    // 5. Decode HTML entities (basic set)
    const entities: { [key: string]: string } = {
        "&nbsp;": " ",
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": "\"",
        "&apos;": "'",
        "&#39;": "'"
    };
    text = text.replace(/&[a-z0-9#]+;/gi, (entity) => {
        return entities[entity] || entity;
    });

    // 6. Normalize whitespace
    // Replace multiple spaces/newlines with single space/newline if needed, 
    // but for TTS, sometimes newlines are good pauses. 
    // Let's trim and collapse excessive multiple newlines to max 2.
    text = text.replace(/\n\s*\n\s*\n/g, "\n\n");
    text = text.trim();

    return text;
}

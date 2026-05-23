import type { Scribe } from "../domain/index.js";
import type { MemberProfile } from "./mock-data.js";

export type DraftSource = "template" | "handwritten" | "ai";
export type LetterType = "ordinary" | "registered";

export interface ScribeDraftInput {
  oralText: string;
  scribe: Scribe | null;
  sender: MemberProfile;
  recipient: MemberProfile;
  senderCity: string;
  recipientCity: string;
  letterType: LetterType;
  replyContext: string | null;
  emotionTags: string[];
}

export interface LocalTemplateGenerationMeta {
  engine: "local-template-v1";
  templateId: string;
  scribeId: string | null;
  sceneTags: string[];
  letterType: LetterType;
  senderCity: string;
  recipientCity: string;
}

export interface AiScribeGenerationMeta {
  engine: "ai-scribe-v1";
  provider: string;
  model: string;
  promptVersion: string;
  scribeId: string | null;
  sceneTags: string[];
  letterType: LetterType;
  senderCity: string;
  recipientCity: string;
  latencyMs: number;
  failureReason?: string;
}

export type ScribeGenerationMeta = LocalTemplateGenerationMeta | AiScribeGenerationMeta;

export interface ScribeDraftResult {
  oralText: string;
  scribeDraft: string;
  readAloudText: string;
  signature: string;
  draftSource: DraftSource;
  generationMeta: ScribeGenerationMeta;
}

export function generateScribeDraft(input: ScribeDraftInput): ScribeDraftResult {
  const oralText = normalizeText(input.oralText) || "近来平安，只是心里记挂。";
  const sceneTags = collectSceneTags(oralText, input.replyContext, input.emotionTags);
  const templateId = chooseTemplateId(input.scribe, sceneTags);
  const greeting = input.sender.letterGreeting;
  const signature = input.sender.signatureName;
  const scribeDraft = renderTemplate(templateId, {
    greeting,
    oralText,
    signature,
    scribeName: input.scribe?.name ?? null
  });

  return {
    oralText,
    scribeDraft,
    readAloudText: scribeDraft,
    signature,
    draftSource: input.scribe === null ? "handwritten" : "template",
    generationMeta: {
      engine: "local-template-v1",
      templateId,
      scribeId: input.scribe?.id ?? null,
      sceneTags,
      letterType: input.letterType,
      senderCity: input.senderCity,
      recipientCity: input.recipientCity
    }
  };
}

function chooseTemplateId(scribe: Scribe | null, sceneTags: string[]): string {
  if (scribe === null) {
    return "handwritten-plain";
  }

  const mainScene = sceneTags.includes("想念") ? "longing" : sceneTags.includes("道歉") ? "apology" : "ordinary";

  return `${scribe.style}-${mainScene}`;
}

function renderTemplate(
  templateId: string,
  input: {
    greeting: string;
    oralText: string;
    signature: string;
    scribeName: string | null;
  }
): string {
  if (templateId.startsWith("handwritten")) {
    return `${input.greeting}：${input.oralText}\n${input.signature}`;
  }

  if (templateId.startsWith("old-scholar")) {
    return `${input.greeting}：见字如晤。${stripEndingPunctuation(input.oralText)}。路远信迟，惟愿珍重。\n${input.signature}`;
  }

  if (templateId.startsWith("clerk")) {
    return `${input.greeting}：兹托${input.scribeName ?? "代书先生"}代书一纸，告知${stripEndingPunctuation(input.oralText)}。盼收信后回音。\n${input.signature}`;
  }

  if (templateId.startsWith("schoolmaster")) {
    return `${input.greeting}：展信安好。${stripEndingPunctuation(input.oralText)}。诸事慢慢说来，切勿挂怀。\n${input.signature}`;
  }

  return `${input.greeting}：${stripEndingPunctuation(input.oralText)}。我这里尚好，你那里也要安心。得空请回一纸。\n${input.signature}`;
}

function collectSceneTags(oralText: string, replyContext: string | null, emotionTags: string[]): string[] {
  const tags = new Set<string>(emotionTags);

  if (/想|念|记挂|挂念/.test(oralText)) {
    tags.add("想念");
  }

  if (/平安|尚好|都好|安心/.test(oralText)) {
    tags.add("报平安");
  }

  if (/风|雨|雪|冷|热|天阴|天气/.test(oralText)) {
    tags.add("天气");
  }

  if (/歉|对不住|不是|错/.test(oralText)) {
    tags.add("道歉");
  }

  if (/病|咳|痛|药/.test(oralText)) {
    tags.add("生病");
  }

  if (/生日|生辰/.test(oralText)) {
    tags.add("生日");
  }

  if (replyContext !== null && /久|未回|前信/.test(replyContext)) {
    tags.add("久未回信");
  }

  if (tags.size === 0) {
    tags.add("问安");
  }

  return Array.from(tags);
}

function normalizeText(text: string): string {
  return text.trim();
}

function stripEndingPunctuation(text: string): string {
  return text.replace(/[。！？!?]+$/u, "");
}

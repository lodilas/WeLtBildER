import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const config = window.LEHRPLAN_REVIEW_CONFIG || {};
const entityTypes = [
  "country", "region", "continent", "substate", "historical_country",
  "historical_region", "city", "river", "mountain_range", "sea", "other_geographic",
];

const supabase = config.supabaseUrl && config.supabaseAnonKey
  ? createClient(config.supabaseUrl, config.supabaseAnonKey)
  : null;

const state = {
  documents: [],
  current: null,
  text: "",
  entities: [],
  sections: [],
  entityTypes: [],
  metadataOptions: {},
  subjectLexicon: [],
  selectedEntityId: null,
  selectedSectionId: null,
  pendingSelection: null,
  pendingSectionSelection: null,
  search: { query: "", matches: [], index: 0 },
  documentQuery: "",
  step: "text",
  nerRunning: false,
};

const elements = {
  list: document.querySelector("#document-list"),
  documentSearch: document.querySelector("#document-search-input"),
  documentSearchCount: document.querySelector("#document-search-count"),
  title: document.querySelector("#document-title"),
  pdf: document.querySelector("#pdf-viewer"),
  sourceLink: document.querySelector("#source-link"),
  toggleSidebar: document.querySelector("#toggle-sidebar"),
  sectionPdf: document.querySelector("#section-pdf-viewer"),
  sectionSourceLink: document.querySelector("#section-source-link"),
  editor: document.querySelector("#manual-editor"),
  manualSearchPreview: document.querySelector("#manual-search-preview"),
  textStatus: document.querySelector("#text-status"),
  metadataForm: document.querySelector("#metadata-form"),
  metadataSource: document.querySelector("#metadata-source"),
  metadataSummary: document.querySelector("#metadata-summary"),
  toggleMetadata: document.querySelector("#toggle-metadata"),
  metaTitle: document.querySelector("#meta-title"),
  metaFederalState: document.querySelector("#meta-federal-state"),
  metaSubjects: document.querySelector("#meta-subjects"),
  metaSubjectComplexes: document.querySelector("#meta-subject-complexes"),
  metaSchoolTypes: document.querySelector("#meta-school-types"),
  metaGradeLevels: document.querySelector("#meta-grade-levels"),
  metaPerformanceLevel: document.querySelector("#meta-performance-level"),
  metaPublicationYear: document.querySelector("#meta-publication-year"),
  metaValidityStart: document.querySelector("#meta-validity-start"),
  metaValidityEnd: document.querySelector("#meta-validity-end"),
  metaLanguages: document.querySelector("#meta-languages"),
  metaSourceUrl: document.querySelector("#meta-source-url"),
  subjectLexiconTable: document.querySelector("#subject-lexicon-table"),
  stepText: document.querySelector("#step-text"),
  stepSections: document.querySelector("#step-sections"),
  stepNer: document.querySelector("#step-ner"),
  pdfToggles: [...document.querySelectorAll(".pdf-pane-toggle")],
  textPanel: document.querySelector("#text-panel"),
  sectionsPanel: document.querySelector("#sections-panel"),
  nerPanel: document.querySelector("#ner-panel"),
  saveManual: document.querySelector("#save-manual"),
  runNer: document.querySelector("#run-ner"),
  rerunNer: document.querySelector("#rerun-ner"),
  acceptAll: document.querySelector("#accept-all"),
  highlightedText: document.querySelector("#highlighted-text"),
  entityList: document.querySelector("#entity-list"),
  entityForm: document.querySelector("#entity-form"),
  entitySurface: document.querySelector("#entity-surface"),
  entityCanonical: document.querySelector("#entity-canonical"),
  entityType: document.querySelector("#entity-type"),
  entityNote: document.querySelector("#entity-note"),
  captureSelection: document.querySelector("#capture-selection"),
  newEntityForm: document.querySelector("#new-entity-form"),
  newEntitySurface: document.querySelector("#new-entity-surface"),
  newEntityCanonical: document.querySelector("#new-entity-canonical"),
  newEntityType: document.querySelector("#new-entity-type"),
  newEntityNote: document.querySelector("#new-entity-note"),
  statusFilter: document.querySelector("#status-filter"),
  refresh: document.querySelector("#refresh-documents"),
  nerSummary: document.querySelector("#ner-summary"),
  sectionsSummary: document.querySelector("#sections-summary"),
  sectionText: document.querySelector("#section-text"),
  sectionList: document.querySelector("#section-list"),
  sectionForm: document.querySelector("#section-form"),
  sectionRange: document.querySelector("#section-range"),
  captureSection: document.querySelector("#capture-section"),
  wholeDocumentSection: document.querySelector("#whole-document-section"),
  sectionTitle: document.querySelector("#section-title"),
  sectionSubjects: document.querySelector("#section-subjects"),
  sectionSubjectComplexes: document.querySelector("#section-subject-complexes"),
  sectionSchoolTypes: document.querySelector("#section-school-types"),
  sectionGradeLevels: document.querySelector("#section-grade-levels"),
  sectionPerformanceLevel: document.querySelector("#section-performance-level"),
  sectionNote: document.querySelector("#section-note"),
  deleteSection: document.querySelector("#delete-section"),
  authGate: document.querySelector("#auth-gate"),
  appShell: document.querySelector("#app-shell"),
  authForm: document.querySelector("#auth-form"),
  authEmail: document.querySelector("#auth-email"),
  authPassword: document.querySelector("#auth-password"),
  authStatus: document.querySelector("#auth-status"),
  signUp: document.querySelector("#sign-up"),
  signOut: document.querySelector("#sign-out"),
  signedInUser: document.querySelector("#signed-in-user"),
};

function requireClient() {
  if (!supabase) throw new Error("Supabase ist noch nicht konfiguriert. Bitte config.js ausfüllen.");
  return supabase;
}

function splitStored(values) {
  if (Array.isArray(values)) return values;
  return String(values || "").split(";").map((item) => item.trim()).filter(Boolean);
}

function arrayToUi(values) {
  return Array.isArray(values) ? values.join("; ") : String(values || "");
}

function toDocument(row) {
  return {
    ...row,
    federal_state: arrayToUi(row.federal_state),
    subjects: arrayToUi(row.subjects),
    subject_complexes: arrayToUi(row.subject_complexes),
    school_types: arrayToUi(row.school_types),
    grade_levels: arrayToUi(row.grade_levels),
    performance_level: arrayToUi(row.performance_level),
    languages: arrayToUi(row.languages),
    publication_year: row.publication_year ? String(row.publication_year) : "",
  };
}

function docUpdatePayload(payload) {
  const year = Number.parseInt(payload.publication_year, 10);
  return {
    title: payload.title || "Ohne Titel",
    federal_state: splitStored(payload.federal_state),
    subjects: splitStored(payload.subjects),
    subject_complexes: splitStored(payload.subject_complexes),
    school_types: splitStored(payload.school_types),
    grade_levels: splitStored(payload.grade_levels).map(Number).filter(Number.isFinite),
    performance_level: splitStored(payload.performance_level),
    publication_year: Number.isFinite(year) ? year : null,
    validity_start: payload.validity_start || "",
    validity_end: payload.validity_end || "",
    languages: splitStored(payload.languages),
    source_url: payload.source_url || "",
    metadata_source: "manual_review",
  };
}

function unwrap(result) {
  if (result.error) throw result.error;
  return result.data;
}

async function awaitUserId() {
  const { data, error } = await requireClient().auth.getUser();
  if (error || !data.user) throw new Error("Sitzung abgelaufen. Bitte erneut anmelden.");
  return data.user.id;
}

async function currentDocument(id) {
  const row = unwrap(await requireClient().from("documents").select("*").eq("id", id).single());
  return toDocument(row);
}

async function currentTextVersionId(documentId) {
  const document = await currentDocument(documentId);
  if (!document.current_text_version_id) throw new Error("Für dieses Dokument ist keine Textversion hinterlegt.");
  return document.current_text_version_id;
}

function normalizeLexiconSurface(value) {
  return String(value || "").replace(/\s+/gu, " ").trim().toLocaleLowerCase("de-DE");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

async function loadConfirmedGeoLexicon() {
  // Supabase limits a single REST response. Page through the shared lexicon
  // so every manually confirmed entry participates in browser-side NER.
  const rows = [];
  const pageSize = 1000;
  for (let start = 0; ; start += pageSize) {
    const result = await requireClient()
      .from("geo_lexicon")
      .select("surface_form, canonical_entity, entity_type")
      .eq("reviewed", true)
      .order("surface_form")
      .range(start, start + pageSize - 1);
    const page = unwrap(result) || [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  const unique = new Map();
  rows.forEach((row) => {
    const key = normalizeLexiconSurface(row.surface_form);
    if (key && !unique.has(key)) unique.set(key, row);
  });
  return [...unique.values()];
}

function findLexiconMentions(text, lexicon, protectedSpans = []) {
  const bySurface = new Map();
  lexicon.forEach((entry) => bySurface.set(normalizeLexiconSurface(entry.surface_form), entry));
  const surfaces = [...bySurface.values()]
    .map((entry) => entry.surface_form.trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
  const mentions = [];

  // Chunk the alternatives so the regular expression remains well within
  // browser limits when the shared lexicon grows with manual additions.
  for (let start = 0; start < surfaces.length; start += 350) {
    const alternatives = surfaces.slice(start, start + 350)
      .map((surface) => escapeRegex(surface).replace(/\s+/gu, "\\s+"));
    if (!alternatives.length) continue;
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])(${alternatives.join("|")})(?![\\p{L}\\p{N}_])`, "giu");
    for (const match of text.matchAll(pattern)) {
      const surface = match[0];
      const entry = bySurface.get(normalizeLexiconSurface(surface));
      if (!entry) continue;
      const charStart = match.index;
      mentions.push({
        char_start: charStart,
        char_end: charStart + surface.length,
        surface_form: surface,
        canonical_entity: entry.canonical_entity,
        entity_type: entry.entity_type,
        source: "shared_lexicon",
      });
    }
  }
  const occupied = [...protectedSpans].sort((a, b) => a.char_start - b.char_start || b.char_end - a.char_end);
  return mentions
    .sort((a, b) => a.char_start - b.char_start || (b.char_end - b.char_start) - (a.char_end - a.char_start))
    .filter((mention) => {
      if (occupied.some((span) => mention.char_start < span.char_end && mention.char_end > span.char_start)) return false;
      occupied.push(mention);
      return true;
    });
}

function entityStatusPriority(entity) {
  if (entity.source === "manual") return 5;
  if (["accepted", "changed", "rejected"].includes(entity.status)) return 4;
  if (entity.status === "pending") return 2;
  return 1;
}

function spansOverlap(left, right) {
  return left.char_start < right.char_end && left.char_end > right.char_start;
}

function orderedDistinctEntities(entities = state.entities) {
  // A text span can represent exactly one active geographic mention. For
  // purely automatic hits, prefer the longest name ("Europäische Union"
  // before its component "Union"). Human decisions take precedence.
  const retained = [];
  [...entities]
    .filter((entity) => entity.status !== "stale")
    .sort((left, right) => entityStatusPriority(right) - entityStatusPriority(left)
      || (right.char_end - right.char_start) - (left.char_end - left.char_start)
      || left.char_start - right.char_start
      || right.id - left.id)
    .forEach((entity) => {
      if (!retained.some((existing) => spansOverlap(existing, entity))) retained.push(entity);
    });
  return retained.sort((left, right) => left.char_start - right.char_start || left.char_end - right.char_end || left.id - right.id);
}

function syncCurrentDocumentSummary() {
  if (!state.current) return;
  const occurrenceCount = state.entities.length;
  const pendingCount = state.entities.filter((entity) => entity.status === "pending").length;
  state.documents = state.documents.map((document) => document.id === state.current.id
    ? { ...document, status: state.current.status, section_count: state.sections.length, occurrence_count: occurrenceCount, pending_count: pendingCount }
    : document);
  renderDocuments();
}

function allExactPositions(text, surface) {
  const positions = [];
  let position = text.indexOf(surface);
  while (position !== -1) {
    positions.push(position);
    position = text.indexOf(surface, position + Math.max(1, surface.length));
  }
  return positions;
}

function commonPrefixLength(left, right) {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left[index] === right[index]) index += 1;
  return index;
}

function commonSuffixLength(left, right) {
  const limit = Math.min(left.length, right.length);
  let offset = 0;
  while (offset < limit && left[left.length - 1 - offset] === right[right.length - 1 - offset]) offset += 1;
  return offset;
}

function reanchorOccurrence(oldText, newText, occurrence) {
  const start = Number(occurrence.char_start);
  const end = Number(occurrence.char_end);
  const surface = occurrence.surface_form;
  if (!surface || start < 0 || end < start || oldText.slice(start, end) !== surface) return null;
  if (newText.slice(start, end) === surface) return { char_start: start, char_end: end };

  const positions = allExactPositions(newText, surface);
  if (positions.length === 1) return { char_start: positions[0], char_end: positions[0] + surface.length };
  if (!positions.length) return null;

  // This is the browser-side equivalent of the local SequenceMatcher rule:
  // copy an occurrence only if an unchanged context anchors it unambiguously.
  // Ambiguous or edited mentions are deliberately left for a fresh NER pass.
  const oldLeft = oldText.slice(Math.max(0, start - 100), start);
  const oldRight = oldText.slice(end, end + 100);
  const candidates = positions.map((candidateStart) => {
    const candidateEnd = candidateStart + surface.length;
    const left = commonSuffixLength(oldLeft, newText.slice(Math.max(0, candidateStart - 100), candidateStart));
    const right = commonPrefixLength(oldRight, newText.slice(candidateEnd, candidateEnd + 100));
    return { char_start: candidateStart, char_end: candidateEnd, left, right, score: left + right };
  }).sort((left, right) => right.score - left.score || right.left - left.left || right.right - left.right);
  const best = candidates[0];
  const second = candidates[1];
  const sufficientlyAnchored = (best.left >= 12 && best.right >= 12) || best.score >= 40;
  const unambiguous = !second || best.score >= second.score + 12;
  return sufficientlyAnchored && unambiguous ? { char_start: best.char_start, char_end: best.char_end } : null;
}

async function copyReanchoredOccurrences(documentId, oldVersionId, newVersionId, oldText, newText, userId) {
  const client = requireClient();
  const previous = unwrap(await client.from("entity_occurrences").select("*")
    .eq("document_id", documentId).eq("text_version_id", oldVersionId));
  const copied = [];
  let invalidated = 0;
  let moved = 0;
  previous.filter((entry) => entry.status !== "stale").forEach((entry) => {
    const offset = reanchorOccurrence(oldText, newText, entry);
    if (!offset) {
      invalidated += 1;
      return;
    }
    if (offset.char_start !== entry.char_start || offset.char_end !== entry.char_end) moved += 1;
    copied.push({
      document_id: documentId,
      text_version_id: newVersionId,
      char_start: offset.char_start,
      char_end: offset.char_end,
      surface_form: entry.surface_form,
      canonical_entity: entry.canonical_entity,
      entity_type: entry.entity_type,
      source: entry.source,
      status: entry.status,
      note: entry.note || "",
      created_by: userId,
      updated_by: userId,
    });
  });
  for (let start = 0; start < copied.length; start += 250) {
    unwrap(await client.from("entity_occurrences").insert(copied.slice(start, start + 250)));
  }
  return { unchanged: copied.length - moved, moved, invalidated };
}

async function runBrowserLexiconNer(documentId) {
  const client = requireClient();
  const userId = await awaitUserId();
  const versionId = await currentTextVersionId(documentId);
  const textRow = unwrap(await client.from("text_versions").select("content").eq("id", versionId).single());
  const text = textRow.content;
  const existing = unwrap(await client.from("entity_occurrences").select("*").eq("document_id", documentId).eq("text_version_id", versionId));
  const invalid = existing.filter((entry) => text.slice(entry.char_start, entry.char_end) !== entry.surface_form);
  const replaceable = existing.filter((entry) => entry.status === "pending" && entry.source !== "manual");
  const invalidIds = new Set(invalid.map((entry) => entry.id));
  const active = existing.filter((entry) => entry.status !== "stale" && !invalidIds.has(entry.id));
  const retained = orderedDistinctEntities(active);
  const retainedIds = new Set(retained.map((entry) => entry.id));
  const duplicates = active.filter((entry) => !retainedIds.has(entry.id));
  const staleIds = [...new Set([...invalid, ...replaceable, ...duplicates].map((entry) => entry.id))];
  if (staleIds.length) {
    unwrap(await client.from("entity_occurrences").update({ status: "stale", updated_by: userId }).in("id", staleIds));
  }
  const protectedSpans = existing
    .filter((entry) => !staleIds.includes(entry.id) && text.slice(entry.char_start, entry.char_end) === entry.surface_form)
    .map((entry) => ({ char_start: entry.char_start, char_end: entry.char_end }));
  const lexicon = await loadConfirmedGeoLexicon();
  const mentions = findLexiconMentions(text, lexicon, protectedSpans);
  for (let start = 0; start < mentions.length; start += 250) {
    const rows = mentions.slice(start, start + 250).map((mention) => ({
      document_id: documentId,
      text_version_id: versionId,
      ...mention,
      status: "pending",
      created_by: userId,
      updated_by: userId,
    }));
    unwrap(await client.from("entity_occurrences").insert(rows));
  }
  unwrap(await client.from("documents").update({ status: "ner_done", updated_by: userId }).eq("id", documentId));
  await client.from("review_actions").insert({
    document_id: documentId,
    text_version_id: versionId,
    action_type: "run_lexicon_ner",
    before_json: { stale: staleIds.length },
    after_json: { proposed: mentions.length, lexicon_entries: lexicon.length },
    reviewer_id: userId,
  });
  return { proposed: mentions.length, stale: staleIds.length };
}

function metadataOptions() {
  const schoolYears = [];
  for (let year = 1996; year <= 2030; year += 1) schoolYears.push(`Schuljahr ${year}/${year + 1}`);
  return {
    federal_state: ["Baden-Württemberg", "Bayern", "Berlin", "Brandenburg", "Bremen", "Hamburg", "Hessen", "Mecklenburg-Vorpommern", "Niedersachsen", "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland", "Sachsen", "Sachsen-Anhalt", "Schleswig-Holstein", "Thüringen"],
    subjects: ["Geschichte", "Geographie", "Erdkunde", "Sozialkunde", "Politik", "Gesellschaftskunde", "Gesellschaftslehre", "Gemeinschaftskunde", "Gesellschaftswissenschaften", "Wirtschaft", "Weltkunde"],
    subject_complexes: ["Geographie", "Geschichte", "Religion/Ethik", "Sozialkunde/Politik", "Verbundfach Gesellschaft"],
    school_types: ["Gymnasium", "Gesamtschule", "Gemeinschaftsschule", "Stadtteilschule", "Oberschule", "Realschule", "Hauptschule", "Fachoberschule", "Berufliches Gymnasium", "Berufliche Schule"],
    grade_levels: Array.from({ length: 13 }, (_, index) => String(index + 1)),
    performance_level: ["Grundkurs", "Leistungskurs", "Grundfach", "Leistungsfach", "Basisfach"],
    publication_year: Array.from({ length: 31 }, (_, index) => String(1996 + index)),
    validity_start: schoolYears,
    validity_end: schoolYears,
    languages: ["Deutsch", "Englisch", "Französisch", "weitere Sprache (nicht spezifiziert)"],
  };
}

async function apiJson(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const payload = options.body ? JSON.parse(options.body) : {};
  const path = new URL(url, window.location.origin).pathname;
  const segments = path.split("/").filter(Boolean).map(decodeURIComponent);
  const client = requireClient();

  if (path === "/api/entity-types") return entityTypes;
  if (path === "/api/metadata-options") return metadataOptions();
  if (path === "/api/subject-lexicon") return unwrap(await client.from("subject_lexicon").select("*").order("subject_label"));
  if (path === "/api/documents" && method === "GET") {
    const documents = unwrap(await client.from("documents").select("*").order("id")).map(toDocument);
    // The original local API supplied summary counts. In the static cloud
    // client they are derived from the rows belonging to each current text
    // version, so that the document list reflects the imported review state.
    return Promise.all(documents.map(async (document) => {
      const versionId = document.current_text_version_id;
      if (!versionId) return { ...document, section_count: 0, occurrence_count: 0, pending_count: 0 };
      const [sections, occurrences, pending] = await Promise.all([
        client.from("text_sections").select("id", { count: "exact", head: true }).eq("document_id", document.id).eq("text_version_id", versionId),
        client.from("entity_occurrences").select("id", { count: "exact", head: true }).eq("document_id", document.id).eq("text_version_id", versionId),
        client.from("entity_occurrences").select("id", { count: "exact", head: true }).eq("document_id", document.id).eq("text_version_id", versionId).eq("status", "pending"),
      ]);
      if (sections.error) throw sections.error;
      if (occurrences.error) throw occurrences.error;
      if (pending.error) throw pending.error;
      return { ...document, section_count: sections.count || 0, occurrence_count: occurrences.count || 0, pending_count: pending.count || 0 };
    }));
  }
  if (segments[1] === "documents" && segments.length === 3 && method === "GET") return currentDocument(segments[2]);
  if (segments[1] === "documents" && segments[3] === "metadata" && method === "POST") {
    const userId = await awaitUserId();
    const update = docUpdatePayload(payload); update.updated_by = userId;
    const saved = unwrap(await client.from("documents").update(update).eq("id", segments[2]).select("*").single());
    return toDocument(saved);
  }
  if (segments[1] === "entities" && segments.length === 3 && method === "GET") {
    const versionId = await currentTextVersionId(segments[2]);
    return unwrap(await client.from("entity_occurrences").select("*").eq("document_id", segments[2]).eq("text_version_id", versionId).order("char_start"));
  }
  if (segments[1] === "sections" && segments.length === 3 && method === "GET") {
    const versionId = await currentTextVersionId(segments[2]);
    const rows = unwrap(await client.from("text_sections").select("*").eq("document_id", segments[2]).eq("text_version_id", versionId).order("char_start"));
    return rows.map((row) => ({ ...row, subjects: arrayToUi(row.subjects), subject_complexes: arrayToUi(row.subject_complexes), school_types: arrayToUi(row.school_types), grade_levels: arrayToUi(row.grade_levels), performance_level: arrayToUi(row.performance_level) }));
  }
  if (segments[1] === "text" && segments[3] === "manual" && method === "POST") {
    const document = await currentDocument(segments[2]);
    const previousId = document.current_text_version_id;
    const previous = previousId ? unwrap(await client.from("text_versions").select("content").eq("id", previousId).single()) : null;
    if (previous?.content === payload.text) return { status: document.status, entity_offsets: { moved: 0, invalidated: 0 } };
    const userId = await awaitUserId();
    const version = unwrap(await client.from("text_versions").insert({ document_id: document.id, version_kind: "manual", content: payload.text, parent_version_id: previousId, created_by: userId }).select("*").single());
    const offsets = previousId
      ? await copyReanchoredOccurrences(document.id, previousId, version.id, previous.content, payload.text, userId)
      : { unchanged: 0, moved: 0, invalidated: 0 };
    unwrap(await client.from("documents").update({ current_text_version_id: version.id, status: "manual_review", updated_by: userId }).eq("id", document.id));
    await client.from("review_actions").insert({
      document_id: document.id,
      text_version_id: version.id,
      action_type: "save_manual_text",
      before_json: { length: previous?.content.length || 0 },
      after_json: { length: payload.text.length, entity_offsets: offsets },
      reviewer_id: userId,
    });
    return { status: "manual_review", entity_offsets: offsets };
  }
  if (segments[1] === "ner" && segments[3] === "run" && method === "POST") {
    return runBrowserLexiconNer(segments[2]);
  }
  if (segments[1] === "entities" && segments[3] === "review" && method === "POST") {
    const userId = await awaitUserId();
    // The selected occurrence is already loaded in the review UI. Reuse it
    // for the audit trail instead of performing a redundant database read.
    const before = state.entities.find((entity) => entity.id === Number(segments[2]));
    if (!before) throw new Error("Die ausgewählte Fundstelle ist nicht mehr verfügbar. Bitte das Dokument neu laden.");
    const update = { status: payload.status, canonical_entity: payload.canonical_entity, entity_type: payload.entity_type, note: payload.note || "", updated_by: userId };
    const after = { ...before, ...update };
    const [saved, audit] = await Promise.all([
      client.from("entity_occurrences").update(update).eq("id", before.id).select("*").single(),
      client.from("review_actions").insert({ document_id: before.document_id, text_version_id: before.text_version_id, occurrence_id: before.id, action_type: `entity_${payload.status}`, before_json: before, after_json: after, reviewer_id: userId }),
    ]);
    unwrap(saved);
    unwrap(audit);
    return after;
  }
  if (segments[1] === "entities" && segments[3] === "accept-all" && method === "POST") {
    const versionId = await currentTextVersionId(segments[2]); const userId = await awaitUserId();
    const result = unwrap(await client.from("entity_occurrences").update({ status: "accepted", updated_by: userId }).eq("document_id", segments[2]).eq("text_version_id", versionId).eq("status", "pending").select("id"));
    return { accepted: result.length };
  }
  if (segments[1] === "entities" && segments[3] === "create" && method === "POST") {
    const versionId = await currentTextVersionId(segments[2]); const userId = await awaitUserId();
    const entity = unwrap(await client.from("entity_occurrences").insert({ document_id: segments[2], text_version_id: versionId, char_start: payload.char_start, char_end: payload.char_end, surface_form: state.text.slice(payload.char_start, payload.char_end), canonical_entity: payload.canonical_entity, entity_type: payload.entity_type, source: "manual", status: "accepted", note: payload.note || "", created_by: userId, updated_by: userId }).select("*").single());
    await client.from("geo_lexicon").upsert({ surface_form: entity.surface_form, canonical_entity: entity.canonical_entity, entity_type: entity.entity_type, source: "manual", reviewed: true, created_by: userId });
    return entity;
  }
  if (segments[1] === "sections" && segments[3] === "create" && method === "POST") {
    const userId = await awaitUserId(); const versionId = await currentTextVersionId(segments[2]);
    return unwrap(await client.from("text_sections").insert({ document_id: segments[2], text_version_id: versionId, char_start: payload.char_start, char_end: payload.char_end, section_title: payload.section_title || "", subjects: splitStored(payload.subjects), subject_complexes: splitStored(payload.subject_complexes), school_types: splitStored(payload.school_types), grade_levels: splitStored(payload.grade_levels).map(Number).filter(Number.isFinite), performance_level: splitStored(payload.performance_level), note: payload.note || "", created_by: userId, updated_by: userId }).select("*").single());
  }
  if (segments[1] === "sections" && segments[3] === "whole-document" && method === "POST") {
    const document = await currentDocument(segments[2]); const userId = await awaitUserId(); const versionId = await currentTextVersionId(document.id);
    const text = await apiText(`/api/text/${encodeURIComponent(document.id)}?version=manual`);
    return unwrap(await client.from("text_sections").insert({ document_id: document.id, text_version_id: versionId, char_start: 0, char_end: text.length, section_title: "Ganzes Dokument", subjects: splitStored(document.subjects), subject_complexes: splitStored(document.subject_complexes), school_types: splitStored(document.school_types), grade_levels: splitStored(document.grade_levels).map(Number).filter(Number.isFinite), performance_level: splitStored(document.performance_level), created_by: userId, updated_by: userId }).select("*").single());
  }
  if (segments[1] === "sections" && segments[3] === "update" && method === "POST") {
    const userId = await awaitUserId();
    return unwrap(await client.from("text_sections").update({ section_title: payload.section_title || "", subjects: splitStored(payload.subjects), subject_complexes: splitStored(payload.subject_complexes), school_types: splitStored(payload.school_types), grade_levels: splitStored(payload.grade_levels).map(Number).filter(Number.isFinite), performance_level: splitStored(payload.performance_level), note: payload.note || "", updated_by: userId }).eq("id", Number(segments[2])).select("*").single());
  }
  if (segments[1] === "sections" && segments[3] === "delete" && method === "POST") {
    unwrap(await client.from("text_sections").delete().eq("id", Number(segments[2]))); return { deleted: true };
  }
  throw new Error(`Nicht unterstützte Cloud-API-Anfrage: ${method} ${path}`);
}

function updateSearchMatches(query) {
  const normalized = query.toLocaleLowerCase("de-DE");
  const haystack = state.text.toLocaleLowerCase("de-DE");
  const matches = [];
  if (normalized) {
    let start = 0;
    while (start < haystack.length) {
      const index = haystack.indexOf(normalized, start);
      if (index < 0) break;
      matches.push({ start: index, end: index + query.length });
      start = index + Math.max(1, query.length);
    }
  }
  state.search = { query, matches, index: 0 };
}

function searchContainer(target) {
  if (target === "sections") return elements.sectionText;
  if (target === "ner") return elements.highlightedText;
  return null;
}

function positionInText(container, offset) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node;
  let count = 0;
  let last = null;
  while ((node = walker.nextNode())) {
    const next = count + node.nodeValue.length;
    if (offset <= next) return { node, offset: Math.max(0, offset - count) };
    count = next;
    last = node;
  }
  return last ? { node: last, offset: last.nodeValue.length } : null;
}

function renderManualSearchPreview() {
  const wrapper = elements.editor.closest(".editor-search-wrap");
  const match = state.search.matches[state.search.index];
  if (!state.search.query || !match) {
    wrapper.classList.remove("search-active");
    elements.manualSearchPreview.textContent = "";
    return;
  }
  let cursor = 0;
  let html = "";
  state.search.matches.forEach((item, index) => {
    html += escapeHtml(state.text.slice(cursor, item.start));
    html += `<mark class="search-hit${index === state.search.index ? " current" : ""}">${escapeHtml(state.text.slice(item.start, item.end))}</mark>`;
    cursor = item.end;
  });
  html += escapeHtml(state.text.slice(cursor));
  elements.manualSearchPreview.innerHTML = html;
  wrapper.classList.add("search-active");
  const current = elements.manualSearchPreview.querySelector(".search-hit.current");
  if (current) {
    const scrollTop = Math.max(0, current.offsetTop - elements.manualSearchPreview.clientHeight / 2);
    elements.manualSearchPreview.scrollTop = scrollTop;
    // Matching scrollbars keep line wrapping and click coordinates identical
    // once the preview is dismissed for editing.
    elements.editor.scrollTop = scrollTop;
  }
}

function previewTextOffsetAtPoint(event) {
  const preview = elements.manualSearchPreview;
  const range = document.caretRangeFromPoint?.(event.clientX, event.clientY);
  if (!range || !preview.contains(range.startContainer)) return null;
  const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT);
  let node;
  let offset = 0;
  while ((node = walker.nextNode())) {
    if (node === range.startContainer) return offset + range.startOffset;
    offset += node.nodeValue.length;
  }
  return null;
}

function markSearchInContainer(container, match) {
  const start = positionInText(container, match.start);
  const end = positionInText(container, match.end);
  if (!start || !end) return;
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  try {
    const marker = document.createElement("mark");
    marker.className = "search-hit current";
    range.surroundContents(marker);
    marker.scrollIntoView({ block: "center", behavior: "smooth" });
  } catch {
    (range.commonAncestorContainer.parentElement || container).scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

function revealSearchResult(target) {
  const match = state.search.matches[state.search.index];
  if (!match) return;
  if (target === "manual") {
    renderManualSearchPreview();
    return;
  }
  const container = searchContainer(target);
  if (target === "sections") renderSectionText();
  if (target === "ner") renderHighlights();
  if (container) markSearchInContainer(container, match);
}

function renderSearchControls() {
  const total = state.search.matches.length;
  document.querySelectorAll("[data-search-input]").forEach((input) => { input.value = state.search.query; });
  document.querySelectorAll("[data-search-count]").forEach((counter) => {
    counter.textContent = state.search.query ? `${total ? state.search.index + 1 : 0}/${total}` : "0 Treffer";
  });
}

function searchText(target, direction = 0) {
  const input = document.querySelector(`[data-search-target="${target}"] [data-search-input]`);
  const query = input?.value.trim() || "";
  if (query !== state.search.query) {
    updateSearchMatches(query);
  } else if (state.search.matches.length && direction) {
    state.search.index = (state.search.index + direction + state.search.matches.length) % state.search.matches.length;
  }
  renderSearchControls();
  revealSearchResult(target);
}

async function apiText(url) {
  const segments = new URL(url, window.location.origin).pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (segments[1] !== "text") throw new Error(`Nicht unterstützte Textanfrage: ${url}`);
  const versionId = await currentTextVersionId(segments[2]);
  const row = unwrap(await requireClient().from("text_versions").select("content").eq("id", versionId).single());
  return row.content;
}

async function pdfUrl(document) {
  if (!document.source_storage_path) return document.source_url || "";
  const { data, error } = await requireClient().storage
    .from(config.storageBucket || "curriculum-assets")
    .createSignedUrl(document.source_storage_path, 60 * 30);
  if (error) {
    if (document.source_url) return document.source_url;
    throw error;
  }
  return data.signedUrl;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setSidebarCollapsed(collapsed) {
  document.body.classList.toggle("sidebar-collapsed", collapsed);
  elements.toggleSidebar.textContent = collapsed ? "›" : "‹";
  elements.toggleSidebar.title = collapsed ? "Dokumentenauswahl ausklappen" : "Dokumentenauswahl einklappen";
  elements.toggleSidebar.setAttribute("aria-label", elements.toggleSidebar.title);
  localStorage.setItem("sidebar-collapsed", String(collapsed));
}

function setPdfCollapsed(collapsed) {
  elements.textPanel.classList.toggle("pdf-collapsed", collapsed);
  elements.sectionsPanel.classList.toggle("pdf-collapsed", collapsed);
  elements.pdfToggles.forEach((button) => {
    const label = collapsed ? "PDF-Ansicht einblenden" : "PDF-Ansicht einklappen";
    button.textContent = collapsed ? "›" : "‹";
    button.title = label;
    button.setAttribute("aria-label", label);
  });
  localStorage.setItem("pdf-collapsed", String(collapsed));
}

function renderEntityTypeOptions() {
  const labels = {
    country: "country · heutiger Staat",
    region: "region · heutige Region",
    continent: "continent · Kontinent",
    substate: "substate · Bundesland/Provinz",
    historical_country: "historical_country · historisches Land/Reich",
    historical_region: "historical_region · historische Region",
    city: "city · Stadt/Ort",
    river: "river · Fluss",
    mountain_range: "mountain_range · Gebirge",
    sea: "sea · Meer/Gewässer",
    other_geographic: "other_geographic · sonstige geografische Entität",
  };
  for (const select of [elements.entityType, elements.newEntityType]) {
    select.innerHTML = "";
    state.entityTypes.forEach((type) => {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = labels[type] || type;
      select.append(option);
    });
  }
}

function splitValues(value) {
  return String(value || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

function joinValues(values) {
  return [...new Set(values.filter(Boolean))].join("; ");
}

function renderChoicePicker(element, options, selectedValues, multiple = true) {
  const selected = new Set(selectedValues);
  const allValues = [...new Set([...selectedValues, ...options].filter(Boolean))];
  element.innerHTML = "";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "choice-picker-button";
  const updateButton = () => {
    const values = pickerValues(element);
    button.textContent = values.length ? joinValues(values) : "auswählen";
    button.title = button.textContent;
  };
  const menu = document.createElement("div");
  menu.className = "choice-picker-menu hidden";
  allValues.forEach((value) => {
    menu.append(choiceOption(value, selected.has(value), multiple, menu, updateButton));
  });
  const custom = document.createElement("div");
  custom.className = "choice-custom";
  const customInput = document.createElement("input");
  customInput.type = "text";
  customInput.placeholder = "neuen Wert hinzufügen";
  const customButton = document.createElement("button");
  customButton.type = "button";
  customButton.textContent = "+";
  customButton.title = "Wert hinzufügen";
  const addCustomValue = () => {
    const value = customInput.value.trim();
    if (!value) return;
    if (!multiple) {
      menu.querySelectorAll("input[type='checkbox']").forEach((input) => {
        input.checked = false;
      });
    }
    const option = choiceOption(value, true, multiple, menu, updateButton);
    menu.insertBefore(option, custom);
    customInput.value = "";
    updateButton();
    if (!multiple) menu.classList.add("hidden");
  };
  customButton.addEventListener("click", addCustomValue);
  customInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addCustomValue();
    }
  });
  custom.append(customInput, customButton);
  menu.append(custom);
  button.addEventListener("click", () => menu.classList.toggle("hidden"));
  element.append(button, menu);
  updateButton();
}

function choiceOption(value, checked, multiple, menu, updateButton) {
  const row = document.createElement("label");
  row.className = "choice-option";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.value = value;
  input.checked = checked;
  input.addEventListener("change", () => {
    if (!multiple && input.checked) {
      menu.querySelectorAll("input[type='checkbox']").forEach((other) => {
        if (other !== input) other.checked = false;
      });
      menu.classList.add("hidden");
    }
    updateButton();
  });
  row.append(input, document.createTextNode(value));
  return row;
}

function pickerValues(element) {
  return [...element.querySelectorAll("input:checked")].map((input) => input.value);
}

function pickerValue(element) {
  return joinValues(pickerValues(element));
}

function setMetadataCollapsed(collapsed) {
  elements.metadataForm.classList.toggle("collapsed", collapsed);
  elements.toggleMetadata.textContent = collapsed ? "Bearbeiten" : "Reduzieren";
}

function metadataSummaryText(doc) {
  const parts = [
    doc.federal_state,
    doc.subjects,
    doc.subject_complexes ? `Komplex: ${doc.subject_complexes}` : "",
    doc.school_types,
    doc.grade_levels ? `Kl. ${doc.grade_levels}` : "",
    doc.performance_level ? `Niveau: ${doc.performance_level}` : "",
    doc.publication_year,
    doc.languages,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Keine Metadaten gesetzt.";
}

function renderSubjectLexicon() {
  if (!elements.subjectLexiconTable) return;
  const rows = state.subjectLexicon
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.subject_label)}</td>
        <td>${escapeHtml(row.subject_complex)}</td>
      </tr>
    `)
    .join("");
  elements.subjectLexiconTable.innerHTML = `
    <table>
      <thead>
        <tr><th>Fachname</th><th>Fachkomplex</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function setStep(step, refreshNer = true) {
  state.step = step;
  elements.stepText.classList.toggle("active", step === "text");
  elements.stepSections.classList.toggle("active", step === "sections");
  elements.stepNer.classList.toggle("active", step === "ner");
  elements.textPanel.classList.toggle("hidden", step !== "text");
  elements.sectionsPanel.classList.toggle("hidden", step !== "sections");
  elements.nerPanel.classList.toggle("hidden", step !== "ner");
  if (step === "sections") {
    renderSectionText();
    renderSectionList();
  }
  if (step === "ner") {
    // Opening Step 3 always compares the current manual text with the current
    // shared lexicon. This prevents stale offsets after text corrections.
    if (state.current && refreshNer) {
      await runNer(false);
    } else {
      renderHighlights();
      renderEntityList();
    }
  }
}

function renderDocuments() {
  elements.list.innerHTML = "";
  const documents = filteredDocuments();
  elements.documentSearchCount.textContent = state.documentQuery.trim()
    ? `${documents.length} von ${state.documents.length} Lehrplänen`
    : `${state.documents.length} Lehrpläne`;

  if (!documents.length) {
    const empty = document.createElement("p");
    empty.className = "document-search-empty";
    empty.textContent = "Keine passenden Lehrpläne gefunden.";
    elements.list.append(empty);
    return;
  }

  documents.forEach((doc) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `document-card${state.current?.id === doc.id ? " active" : ""}`;
    const metadata = [
      doc.federal_state,
      doc.subjects,
      doc.school_types,
      doc.grade_levels ? `Klassen ${doc.grade_levels}` : "",
      doc.publication_year,
    ].filter(Boolean).join(" · ");
    button.innerHTML = `
      <strong>${escapeHtml(doc.id)} · ${escapeHtml(doc.title)}</strong>
      ${metadata ? `<span class="document-metadata">${escapeHtml(metadata)}</span>` : ""}
      <span>${escapeHtml(doc.status)} · ${doc.section_count || 0} Abschnitte · ${doc.occurrence_count || 0} mentions · ${doc.pending_count || 0} offen</span>
    `;
    button.addEventListener("click", () => {
      loadDocument(doc.id).catch((error) => {
        console.error(error);
        elements.title.textContent = `Fehler beim Laden von ${doc.id}`;
        elements.textStatus.textContent = error.message || "Unbekannter Ladefehler";
        elements.nerSummary.textContent = "Die Details dieses Dokuments konnten nicht geladen werden.";
      });
    });
    elements.list.append(button);
  });
}

function normalizeDocumentSearch(value) {
  return String(value ?? "")
    .toLocaleLowerCase("de-DE")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function documentSearchText(doc) {
  return normalizeDocumentSearch([
    doc.id,
    doc.document_id,
    doc.source_file,
    doc.title,
    doc.federal_state,
    doc.subjects,
    doc.subject_complexes,
    doc.school_types,
    doc.grade_levels,
    doc.performance_level,
    doc.publication_year,
    doc.validity_start,
    doc.validity_end,
    doc.languages,
  ].filter(Boolean).join(" "));
}

function filteredDocuments() {
  const terms = normalizeDocumentSearch(state.documentQuery).split(/\s+/).filter(Boolean);
  if (!terms.length) return state.documents;
  return state.documents.filter((doc) => {
    const haystack = documentSearchText(doc);
    return terms.every((term) => haystack.includes(term));
  });
}

function fillMetadataForm() {
  if (!state.current) return;
  elements.metaTitle.value = state.current.title || "";
  renderChoicePicker(
    elements.metaFederalState,
    state.metadataOptions.federal_state || [],
    splitValues(state.current.federal_state),
    true,
  );
  renderChoicePicker(elements.metaSubjects, state.metadataOptions.subjects || [], splitValues(state.current.subjects), true);
  renderChoicePicker(
    elements.metaSubjectComplexes,
    state.metadataOptions.subject_complexes || [],
    splitValues(state.current.subject_complexes),
    true,
  );
  renderChoicePicker(
    elements.metaSchoolTypes,
    state.metadataOptions.school_types || [],
    splitValues(state.current.school_types),
    true,
  );
  renderChoicePicker(
    elements.metaGradeLevels,
    state.metadataOptions.grade_levels || [],
    splitValues(state.current.grade_levels),
    true,
  );
  renderChoicePicker(
    elements.metaPerformanceLevel,
    state.metadataOptions.performance_level || [],
    splitValues(state.current.performance_level),
    true,
  );
  renderChoicePicker(
    elements.metaPublicationYear,
    state.metadataOptions.publication_year || [],
    splitValues(state.current.publication_year),
    false,
  );
  renderChoicePicker(
    elements.metaValidityStart,
    state.metadataOptions.validity_start || [],
    splitValues(state.current.validity_start),
    false,
  );
  renderChoicePicker(
    elements.metaValidityEnd,
    state.metadataOptions.validity_end || [],
    splitValues(state.current.validity_end),
    false,
  );
  const languageSelection = splitValues(state.current.languages);
  renderChoicePicker(
    elements.metaLanguages,
    state.metadataOptions.languages || [],
    languageSelection.length ? languageSelection : ["Deutsch"],
    true,
  );
  elements.metaSourceUrl.value = state.current.source_url || "";
  elements.metadataSource.textContent = `Quelle: ${state.current.metadata_source || "nicht gesetzt"}`;
  elements.metadataSummary.textContent = metadataSummaryText(state.current);
  setMetadataCollapsed(state.current.metadata_source === "manual_review");
}

async function loadDocuments() {
  if (!state.entityTypes.length) {
    [state.entityTypes, state.metadataOptions, state.subjectLexicon] = await Promise.all([
      apiJson("/api/entity-types"),
      apiJson("/api/metadata-options"),
      apiJson("/api/subject-lexicon"),
    ]);
    renderEntityTypeOptions();
    renderSubjectLexicon();
  }
  state.documents = await apiJson("/api/documents");
  renderDocuments();
  if (!state.current && state.documents.length) {
    await loadDocument(state.documents[0].id);
  }
}

async function refreshMetadataOptions() {
  state.metadataOptions = await apiJson("/api/metadata-options");
}

async function loadDocument(id) {
  state.current = await apiJson(`/api/documents/${encodeURIComponent(id)}`);
  state.text = await apiText(`/api/text/${encodeURIComponent(id)}?version=manual`);
  state.entities = await apiJson(`/api/entities/${encodeURIComponent(id)}`);
  state.sections = await apiJson(`/api/sections/${encodeURIComponent(id)}`);
  state.selectedEntityId = state.entities[0]?.id ?? null;
  state.selectedSectionId = state.sections[0]?.id ?? null;
  state.pendingSelection = null;
  state.pendingSectionSelection = null;
  updateSearchMatches("");
  elements.title.textContent = `${state.current.id} · ${state.current.title}`;
  const source = await pdfUrl(state.current);
  elements.sourceLink.href = source;
  elements.pdf.src = source;
  elements.sectionSourceLink.href = source;
  elements.sectionPdf.src = source;
  elements.editor.value = state.text;
  renderManualSearchPreview();
  elements.textStatus.textContent = state.current.status;
  fillMetadataForm();
  resetNewEntityForm();
  renderDocuments();
  renderHighlights();
  renderEntityList();
  renderSectionText();
  renderSectionList();
  if (state.step === "ner") {
    await runNer(false);
  }
}

async function saveMetadata(event) {
  event.preventDefault();
  if (!state.current) return;
  const saved = await apiJson(`/api/documents/${encodeURIComponent(state.current.id)}/metadata`, {
    method: "POST",
    body: JSON.stringify({
      title: elements.metaTitle.value,
      federal_state: pickerValue(elements.metaFederalState),
      subjects: pickerValue(elements.metaSubjects),
      subject_complexes: pickerValue(elements.metaSubjectComplexes),
      school_types: pickerValue(elements.metaSchoolTypes),
      grade_levels: pickerValue(elements.metaGradeLevels),
      performance_level: pickerValue(elements.metaPerformanceLevel),
      publication_year: pickerValue(elements.metaPublicationYear),
      validity_start: pickerValue(elements.metaValidityStart),
      validity_end: pickerValue(elements.metaValidityEnd),
      languages: pickerValue(elements.metaLanguages),
      source_url: elements.metaSourceUrl.value,
    }),
  });
  state.current = saved;
  await refreshMetadataOptions();
  elements.title.textContent = `${state.current.id} · ${state.current.title}`;
  elements.textStatus.textContent = saved.status;
  fillMetadataForm();
  setMetadataCollapsed(true);
  await loadDocuments();
}

async function saveManualText() {
  if (!state.current) return;
  const text = elements.editor.value;
  const result = await apiJson(`/api/text/${encodeURIComponent(state.current.id)}/manual`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
  state.text = text;
  // Saving creates an immutable manual version in Supabase. Refresh the
  // in-memory document pointer before later section or NER operations.
  state.current = await currentDocument(state.current.id);
  const offsets = result.entity_offsets || {};
  if (offsets.invalidated) {
    elements.textStatus.textContent = `${result.status} · ${offsets.invalidated} NER-Fundstellen erneut prüfen`;
  } else if (offsets.moved) {
    elements.textStatus.textContent = `${result.status} · ${offsets.moved} NER-Fundstellen neu verankert`;
  } else {
    elements.textStatus.textContent = result.status;
  }
  state.entities = await apiJson(`/api/entities/${encodeURIComponent(state.current.id)}`);
  syncCurrentDocumentSummary();
}

async function runNer(switchToNer = true) {
  if (!state.current) return;
  if (state.nerRunning) return;
  state.nerRunning = true;
  elements.runNer.disabled = true;
  elements.rerunNer.disabled = true;
  try {
    await saveManualText();
    const result = await apiJson(`/api/ner/${encodeURIComponent(state.current.id)}/run`, { method: "POST" });
    state.entities = await apiJson(`/api/entities/${encodeURIComponent(state.current.id)}`);
    state.selectedEntityId = orderedDistinctEntities()[0]?.id ?? null;
    syncCurrentDocumentSummary();
    if (switchToNer) {
      await setStep("ner", false);
    } else {
      renderHighlights();
      renderEntityList();
    }
    elements.nerSummary.textContent = `${result.proposed || 0} Vorschläge aus dem gemeinsamen Geo-Lexikon erstellt${result.stale ? `; ${result.stale} frühere Vorschläge ersetzt` : ""}`;
  } finally {
    state.nerRunning = false;
    elements.runNer.disabled = false;
    elements.rerunNer.disabled = false;
  }
}

function filteredEntities() {
  const filter = elements.statusFilter.value;
  const entities = orderedDistinctEntities();
  if (filter === "all") return entities;
  return entities.filter((entity) => entity.status === filter);
}

function renderHighlights() {
  const entities = orderedDistinctEntities();
  let cursor = 0;
  let html = "";
  for (const entity of entities) {
    if (entity.char_start < cursor) continue;
    html += escapeHtml(state.text.slice(cursor, entity.char_start));
    const selected = entity.id === state.selectedEntityId ? " selected" : "";
    html += `<mark class="mention ${entity.status}${selected}" data-id="${entity.id}" title="${escapeHtml(entity.canonical_entity)}">${escapeHtml(state.text.slice(entity.char_start, entity.char_end))}</mark>`;
    cursor = entity.char_end;
  }
  html += escapeHtml(state.text.slice(cursor));
  elements.highlightedText.innerHTML = html || "Noch kein manueller Text geladen.";
  elements.highlightedText.querySelectorAll(".mention").forEach((node) => {
    node.addEventListener("click", () => selectEntity(Number(node.dataset.id)));
  });
  renderSearchControls();
}

function renderSectionText() {
  const ranges = state.sections.map((section) => ({
    ...section,
    selected: section.id === state.selectedSectionId,
    pending: false,
  }));
  if (state.pendingSectionSelection) {
    ranges.push({
      ...state.pendingSectionSelection,
      id: null,
      section_title: "Neue Textauswahl",
      selected: false,
      pending: true,
    });
  }
  const boundaries = [...new Set([0, state.text.length, ...ranges.flatMap((range) => [range.char_start, range.char_end])])]
    .filter((point) => point >= 0 && point <= state.text.length)
    .sort((a, b) => a - b);
  let html = "";
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    const content = escapeHtml(state.text.slice(start, end));
    const hits = ranges.filter((range) => range.char_start <= start && range.char_end >= end);
    if (!hits.length) {
      html += content;
      continue;
    }
    const pending = hits.some((range) => range.pending);
    const selected = hits.some((range) => range.selected);
    const stored = hits.find((range) => range.id !== null);
    const label = hits.map((range) => range.section_title || range.subjects || "Abschnitt").join(" · ");
    const classes = `text-section${selected ? " selected" : ""}${pending ? " pending-section" : ""}`;
    const dataId = stored ? ` data-id="${stored.id}"` : "";
    html += `<span class="${classes}"${dataId} title="${escapeHtml(label)}">${content}</span>`;
  }
  elements.sectionText.innerHTML = html || "Noch kein manueller Text geladen.";
  elements.sectionText.querySelectorAll(".text-section").forEach((node) => {
    node.addEventListener("click", () => selectSection(Number(node.dataset.id)));
  });
  elements.sectionsSummary.textContent = `${state.sections.length} markierte Abschnitte`;
  renderSearchControls();
}

function scrollToSectionEnd(sectionId) {
  const pieces = [...elements.sectionText.querySelectorAll(".text-section")]
    .filter((node) => String(node.dataset.id) === String(sectionId));
  pieces.at(-1)?.scrollIntoView({ block: "end", behavior: "smooth" });
}

function selectionOffsetsInNode(container) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (range.collapsed) return null;
  if (!container.contains(range.commonAncestorContainer)) return null;

  const beforeStart = document.createRange();
  beforeStart.selectNodeContents(container);
  beforeStart.setEnd(range.startContainer, range.startOffset);

  const beforeEnd = document.createRange();
  beforeEnd.selectNodeContents(container);
  beforeEnd.setEnd(range.endContainer, range.endOffset);

  let start = beforeStart.toString().length;
  let end = beforeEnd.toString().length;
  let surface = state.text.slice(start, end);
  const leading = surface.match(/^\s*/)?.[0].length ?? 0;
  const trailing = surface.match(/\s*$/)?.[0].length ?? 0;
  start += leading;
  end -= trailing;
  surface = state.text.slice(start, end);
  if (!surface) return null;
  return { char_start: start, char_end: end, surface };
}

function selectionOffsetsInHighlightedText() {
  return selectionOffsetsInNode(elements.highlightedText);
}

function resetNewEntityForm() {
  state.pendingSelection = null;
  elements.newEntityForm.classList.add("hidden");
  elements.newEntitySurface.value = "";
  elements.newEntityCanonical.value = "";
  elements.newEntityNote.value = "";
  if (state.entityTypes.length) {
    elements.newEntityType.value = "region";
  }
}

function captureSelectionAsNewEntity() {
  const offsets = selectionOffsetsInHighlightedText();
  if (!offsets) {
    alert("Bitte zuerst eine Textstelle im markierten Textbereich auswählen.");
    return;
  }
  state.pendingSelection = offsets;
  elements.newEntitySurface.value = offsets.surface;
  elements.newEntityCanonical.value = offsets.surface;
  elements.newEntityType.value = "region";
  elements.newEntityNote.value = "";
  elements.newEntityForm.classList.remove("hidden");
}

function renderEntityList() {
  const visible = filteredEntities();
  elements.entityList.innerHTML = "";
  visible.forEach((entity) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.id = entity.id;
    button.className = `entity-item${entity.id === state.selectedEntityId ? " selected" : ""}`;
    button.innerHTML = `
      ${escapeHtml(entity.surface_form)} → ${escapeHtml(entity.canonical_entity)}
      <small>${escapeHtml(entity.entity_type)} · ${escapeHtml(entity.status)} · ${escapeHtml(entity.source)}</small>
    `;
    button.addEventListener("click", () => selectEntity(entity.id));
    elements.entityList.append(button);
  });
  fillEntityForm();
}

function nextPendingEntityId(currentId) {
  const ordered = orderedDistinctEntities();
  const currentIndex = ordered.findIndex((entity) => entity.id === currentId);
  for (let offset = 1; offset <= ordered.length; offset += 1) {
    const candidate = ordered[(currentIndex + offset + ordered.length) % ordered.length];
    if (candidate?.status === "pending" && candidate.id !== currentId) return candidate.id;
  }
  return null;
}

function scrollSelectedEntityIntoView(behavior = "smooth") {
  if (state.selectedEntityId === null) return;
  scrollWithin(elements.highlightedText, document.querySelector(`.mention[data-id="${state.selectedEntityId}"]`), "center", behavior);
  scrollWithin(elements.entityList, elements.entityList.querySelector(`.entity-item[data-id="${state.selectedEntityId}"]`), "nearest", behavior);
}

function scrollWithin(container, target, alignment = "center", behavior = "smooth") {
  if (!container || !target) return;
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const offset = targetRect.top - containerRect.top;
  const desired = alignment === "center"
    ? offset - (container.clientHeight - targetRect.height) / 2
    : offset < 0 ? offset : Math.max(0, targetRect.bottom - containerRect.bottom);
  container.scrollTo({ top: Math.max(0, container.scrollTop + desired), behavior });
}

function selectEntity(id) {
  state.selectedEntityId = id;
  renderHighlights();
  renderEntityList();
  requestAnimationFrame(scrollSelectedEntityIntoView);
}

function selectedEntity() {
  return state.entities.find((entity) => entity.id === state.selectedEntityId);
}

function selectedSection() {
  return state.sections.find((section) => section.id === state.selectedSectionId);
}

function fillEntityForm() {
  const entity = selectedEntity();
  elements.entitySurface.value = entity?.surface_form ?? "";
  elements.entityCanonical.value = entity?.canonical_entity ?? "";
  elements.entityType.value = state.entityTypes.includes(entity?.entity_type) ? entity.entity_type : "other_geographic";
  elements.entityNote.value = entity?.note ?? "";
}

async function saveEntity(event) {
  event.preventDefault();
  const entity = selectedEntity();
  if (!entity) return;
  const submitter = event.submitter;
  const status = submitter?.dataset.status || "changed";
  const shouldAdvance = entity.status === "pending" && ["accepted", "rejected", "changed"].includes(status);
  const queuedNextId = shouldAdvance ? nextPendingEntityId(entity.id) : null;
  const saved = await apiJson(`/api/entities/${entity.id}/review`, {
    method: "POST",
    body: JSON.stringify({
      status,
      canonical_entity: elements.entityCanonical.value,
      entity_type: elements.entityType.value,
      note: elements.entityNote.value,
    }),
  });
  state.entities = state.entities.map((item) => item.id === saved.id ? saved : item);
  if (shouldAdvance) {
    const queuedNext = state.entities.find((item) => item.id === queuedNextId && item.status === "pending");
    const fallback = orderedDistinctEntities().find((item) => item.status === "pending");
    state.selectedEntityId = queuedNext?.id ?? fallback?.id ?? null;
    if (state.selectedEntityId !== null && !["all", "pending"].includes(elements.statusFilter.value)) {
      elements.statusFilter.value = "pending";
    }
  }
  renderHighlights();
  renderEntityList();
  if (shouldAdvance && state.selectedEntityId !== null) {
    requestAnimationFrame(() => scrollSelectedEntityIntoView("auto"));
  } else if (shouldAdvance) {
    elements.nerSummary.textContent = "Alle Vorschläge in diesem Dokument bearbeitet";
  }
  syncCurrentDocumentSummary();
}

async function acceptAllPendingEntities() {
  if (!state.current) return;
  const pending = state.entities.filter((entity) => entity.status === "pending").length;
  if (!pending) {
    elements.nerSummary.textContent = "Keine offenen Vorschläge vorhanden";
    return;
  }
  const ok = confirm(`${pending} offene Vorschläge in diesem Dokument akzeptieren?`);
  if (!ok) return;
  const result = await apiJson(`/api/entities/${encodeURIComponent(state.current.id)}/accept-all`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  state.entities = state.entities.map((entity) => entity.status === "pending" ? { ...entity, status: "accepted" } : entity);
  elements.nerSummary.textContent = `${result.accepted} Vorschläge akzeptiert`;
  renderHighlights();
  renderEntityList();
  syncCurrentDocumentSummary();
}

async function saveNewEntity(event) {
  event.preventDefault();
  if (!state.current || !state.pendingSelection) return;
  const created = await apiJson(`/api/entities/${encodeURIComponent(state.current.id)}/create`, {
    method: "POST",
    body: JSON.stringify({
      char_start: state.pendingSelection.char_start,
      char_end: state.pendingSelection.char_end,
      canonical_entity: elements.newEntityCanonical.value,
      entity_type: elements.newEntityType.value,
      note: elements.newEntityNote.value,
    }),
  });
  state.entities = await apiJson(`/api/entities/${encodeURIComponent(state.current.id)}`);
  state.selectedEntityId = created.id;
  resetNewEntityForm();
  renderHighlights();
  renderEntityList();
  await loadDocuments();
}

function renderSectionList() {
  elements.sectionList.innerHTML = "";
  state.sections.forEach((section, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `entity-item${section.id === state.selectedSectionId ? " selected" : ""}`;
    const title = section.section_title || `Abschnitt ${index + 1}`;
    button.innerHTML = `
      ${escapeHtml(title)}
      <small>${escapeHtml(section.subjects || "kein Fach")} · ${escapeHtml(section.grade_levels || "keine Klassen")} · ${section.char_start}-${section.char_end}</small>
    `;
    button.addEventListener("click", () => selectSection(section.id));
    elements.sectionList.append(button);
  });
  fillSectionForm();
}

function selectSection(id) {
  state.selectedSectionId = id;
  state.pendingSectionSelection = null;
  renderSectionText();
  renderSectionList();
  document.querySelector(`.text-section[data-id="${id}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
}

function fillSectionForm() {
  const section = selectedSection();
  const source = section || state.current || {};
  if (section) {
    elements.sectionTitle.value = section.section_title || "";
  } else if (!state.pendingSectionSelection) {
    elements.sectionTitle.value = "";
  }
  renderChoicePicker(elements.sectionSubjects, state.metadataOptions.subjects || [], splitValues(source.subjects), true);
  renderChoicePicker(
    elements.sectionSubjectComplexes,
    state.metadataOptions.subject_complexes || [],
    splitValues(source.subject_complexes),
    true,
  );
  renderChoicePicker(elements.sectionSchoolTypes, state.metadataOptions.school_types || [], splitValues(source.school_types), true);
  renderChoicePicker(elements.sectionGradeLevels, state.metadataOptions.grade_levels || [], splitValues(source.grade_levels), true);
  renderChoicePicker(
    elements.sectionPerformanceLevel,
    state.metadataOptions.performance_level || [],
    splitValues(source.performance_level),
    true,
  );
  elements.sectionNote.value = section?.note || "";
  if (section) {
    elements.sectionRange.textContent = `${section.char_start}-${section.char_end}`;
  } else if (state.pendingSectionSelection) {
    elements.sectionRange.textContent = `${state.pendingSectionSelection.char_start}-${state.pendingSectionSelection.char_end}`;
  } else {
    elements.sectionRange.textContent = "keine Auswahl";
  }
}

function captureSelectionAsSection() {
  const offsets = selectionOffsetsInNode(elements.sectionText);
  if (!offsets) {
    alert("Bitte zuerst eine Textstelle im Abschnitts-Textbereich markieren.");
    return;
  }
  state.pendingSectionSelection = offsets;
  state.selectedSectionId = null;
  elements.sectionTitle.value = offsets.surface.slice(0, 90).replace(/\s+/g, " ");
  fillSectionForm();
  renderSectionText();
  elements.sectionText.querySelector(".pending-section")?.scrollIntoView({ block: "end", behavior: "smooth" });
}

async function saveSection(event) {
  event.preventDefault();
  if (!state.current) return;
  const section = selectedSection();
  const range = section || state.pendingSectionSelection;
  if (!range) {
    alert("Bitte zuerst eine Textstelle markieren oder einen Abschnitt auswählen.");
    return;
  }
  const payload = {
    char_start: range.char_start,
    char_end: range.char_end,
    section_title: elements.sectionTitle.value,
    subjects: pickerValue(elements.sectionSubjects),
    subject_complexes: pickerValue(elements.sectionSubjectComplexes),
    school_types: pickerValue(elements.sectionSchoolTypes),
    grade_levels: pickerValue(elements.sectionGradeLevels),
    performance_level: pickerValue(elements.sectionPerformanceLevel),
    note: elements.sectionNote.value,
  };
  const url = section
    ? `/api/sections/${section.id}/update`
    : `/api/sections/${encodeURIComponent(state.current.id)}/create`;
  const saved = await apiJson(url, { method: "POST", body: JSON.stringify(payload) });
  await refreshMetadataOptions();
  state.sections = await apiJson(`/api/sections/${encodeURIComponent(state.current.id)}`);
  state.selectedSectionId = saved.id;
  state.pendingSectionSelection = null;
  renderSectionText();
  renderSectionList();
  if (!section) scrollToSectionEnd(saved.id);
  await loadDocuments();
}

async function createWholeDocumentSection() {
  if (!state.current) return;
  const saved = await apiJson(`/api/sections/${encodeURIComponent(state.current.id)}/whole-document`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  state.sections = await apiJson(`/api/sections/${encodeURIComponent(state.current.id)}`);
  state.selectedSectionId = saved.id;
  renderSectionText();
  renderSectionList();
  await loadDocuments();
}

async function deleteSelectedSection() {
  const section = selectedSection();
  if (!section) return;
  const ok = confirm(`Abschnitt "${section.section_title || section.id}" löschen?`);
  if (!ok) return;
  await apiJson(`/api/sections/${section.id}/delete`, { method: "POST", body: JSON.stringify({}) });
  state.sections = await apiJson(`/api/sections/${encodeURIComponent(state.current.id)}`);
  state.selectedSectionId = state.sections[0]?.id ?? null;
  renderSectionText();
  renderSectionList();
  await loadDocuments();
}

elements.refresh.addEventListener("click", loadDocuments);
elements.documentSearch.addEventListener("input", (event) => {
  state.documentQuery = event.target.value;
  renderDocuments();
});
elements.toggleSidebar.addEventListener("click", () => {
  setSidebarCollapsed(!document.body.classList.contains("sidebar-collapsed"));
});
elements.pdfToggles.forEach((button) => button.addEventListener("click", () => {
  setPdfCollapsed(!elements.textPanel.classList.contains("pdf-collapsed"));
}));
elements.metadataForm.addEventListener("submit", saveMetadata);
elements.toggleMetadata.addEventListener("click", () => {
  setMetadataCollapsed(!elements.metadataForm.classList.contains("collapsed"));
});
elements.stepText.addEventListener("click", () => setStep("text"));
elements.stepSections.addEventListener("click", () => setStep("sections"));
elements.stepNer.addEventListener("click", () => setStep("ner"));
elements.saveManual.addEventListener("click", saveManualText);
function showNerError(error) {
  console.error(error);
  elements.nerSummary.textContent = `Aktion nicht gespeichert: ${error.message || "Unbekannter Fehler"}`;
}

elements.runNer.addEventListener("click", () => runNer().catch(showNerError));
elements.rerunNer.addEventListener("click", () => runNer().catch(showNerError));
elements.acceptAll.addEventListener("click", () => acceptAllPendingEntities().catch(showNerError));
elements.statusFilter.addEventListener("change", renderEntityList);
elements.entityForm.addEventListener("submit", (event) => saveEntity(event).catch(showNerError));
elements.captureSelection.addEventListener("click", captureSelectionAsNewEntity);
elements.newEntityForm.addEventListener("submit", saveNewEntity);
elements.captureSection.addEventListener("click", captureSelectionAsSection);
elements.sectionForm.addEventListener("submit", saveSection);
elements.wholeDocumentSection.addEventListener("click", createWholeDocumentSection);
elements.deleteSection.addEventListener("click", deleteSelectedSection);
elements.editor.addEventListener("focus", () => {
  // A deliberate click in the text ends search-preview mode and restores
  // ordinary editing without altering the text itself.
  elements.editor.closest(".editor-search-wrap").classList.remove("search-active");
});
elements.manualSearchPreview.addEventListener("mousedown", (event) => {
  const offset = previewTextOffsetAtPoint(event);
  if (offset === null) return;
  event.preventDefault();
  elements.editor.closest(".editor-search-wrap").classList.remove("search-active");
  elements.editor.focus({ preventScroll: true });
  elements.editor.setSelectionRange(offset, offset);
});
document.querySelectorAll("[data-search-target]").forEach((box) => {
  const target = box.dataset.searchTarget;
  const input = box.querySelector("[data-search-input]");
  box.querySelector("[data-search-prev]").addEventListener("click", () => searchText(target, -1));
  box.querySelector("[data-search-next]").addEventListener("click", () => searchText(target, 1));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchText(target, event.shiftKey ? -1 : 1);
    }
  });
});

setSidebarCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
setPdfCollapsed(localStorage.getItem("pdf-collapsed") === "true");

async function showAuthenticatedApp(session) {
  elements.authGate.classList.add("hidden");
  elements.appShell.classList.remove("hidden");
  elements.signedInUser.textContent = session.user.email || "angemeldet";
  try {
    await loadDocuments();
  } catch (error) {
    elements.title.textContent = "Fehler beim Laden";
    console.error(error);
    alert(`Daten konnten nicht geladen werden: ${error.message}`);
  }
}

function showAuthGate(message = "") {
  elements.appShell.classList.add("hidden");
  elements.authGate.classList.remove("hidden");
  elements.authStatus.textContent = message;
}

elements.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const { error } = await requireClient().auth.signInWithPassword({
      email: elements.authEmail.value.trim(),
      password: elements.authPassword.value,
    });
    if (error) throw error;
    elements.authStatus.textContent = "Anmeldung erfolgreich.";
  } catch (error) {
    elements.authStatus.textContent = error.message;
  }
});

elements.signUp.addEventListener("click", async () => {
  try {
    const email = elements.authEmail.value.trim();
    const password = elements.authPassword.value;
    if (!email || !password) throw new Error("Bitte E-Mail und Passwort eingeben.");
    const { error } = await requireClient().auth.signUp({ email, password });
    if (error) throw error;
    elements.authStatus.textContent = "Konto angelegt. Bitte E-Mail-Bestätigung abwarten; im Pilotbetrieb können Admins Konten auch direkt einladen.";
  } catch (error) {
    elements.authStatus.textContent = error.message;
  }
});

elements.signOut.addEventListener("click", async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
});

if (!supabase) {
  showAuthGate("Bitte zuerst Supabase-URL und den öffentlichen Anon-Key in config.js eintragen.");
} else {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) showAuthenticatedApp(session);
  else showAuthGate();
  supabase.auth.onAuthStateChange((_event, nextSession) => {
    if (nextSession) showAuthenticatedApp(nextSession);
    else showAuthGate();
  });
}

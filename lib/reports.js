// Definitions for the HR report types added alongside the utility strike form.
// The utility strike form is untouched and still runs through
// netlify/functions/submit.js with its own hardcoded field list.

// Used when HR_EMAIL_TO is not configured so the HR forms still deliver.
const HR_FALLBACK_RECIPIENT = "new@geoconinc.com";

// Netlify sets URL to the site's address; SITE_URL overrides it if the site is
// ever served from somewhere else. Used to link a manager back to the form.
const SITE_URL = (
  process.env.SITE_URL ||
  process.env.URL ||
  "https://geoconutilitystrikeform.netlify.app"
).replace(/\/+$/, "");

// Everything the manager answers. On the paper form the first three sit
// directly above the SUPERVISOR signature on page one — the "you" in them is
// the supervisor verifying the employee's account, not the injured employee.
const INJURY_INVESTIGATION_FIELDS = [
  { name: "unsafeCondition", label: "Unsafe Condition or Act That Caused Accident" },
  { name: "preventiveAction", label: "Action Taken to Prevent Similar Accidents" },
  { name: "factsVerified", label: "Facts Verified? How?" },
  { name: "safePracticeViolated", label: "Code of Safe Practice Violated?" },
  { name: "safePracticeWhich", label: "Which Code Was Violated" },
  { name: "additionalCodeNeeded", label: "Additional Code of Safe Practice Needed?" },
  { name: "additionalCodeDetail", label: "Additional Code Needed" },
  { name: "correctedImmediately", label: "Corrected Immediately?" },
  { name: "correctedHow", label: "How It Was Corrected" },
  { name: "interimActions", label: "Interim Actions Until Correction Is Complete" },
  { name: "correctiveActionDate", label: "Date of Corrective Action" },
  { name: "checklistModification", label: "Workplace Inspection Checklist Needs Modification?" },
  { name: "checklistAdditions", label: "What Should Be Added to the Checklist" },
  { name: "managementApproval", label: "Management Approval (Name and Title)" },
];

// Completion is the manager's sign-off specifically, not "any investigation
// field has something in it". The investigation fields are visible to the
// employee and left optional, so treating any of them as the signal would let a
// helpful employee mark their own report complete and skip the manager.
function injuryInvestigationDone(data) {
  return Boolean(data.managementApproval);
}

const INJURY_FORM_PATH = "/injury.html";

// The manager's link carries the id of the saved first half, so their form opens
// with the employee's answers and photos already loaded. If the draft could not
// be saved the plain link still works — their form just starts blank.
function injuryFormLink(draftId) {
  return draftId
    ? `${SITE_URL}${INJURY_FORM_PATH}?draft=${encodeURIComponent(draftId)}`
    : `${SITE_URL}${INJURY_FORM_PATH}`;
}

function injuredEmployeeLabel(data) {
  return `${data.injuredEmployee || "Unnamed Employee"} (${data.injuryDate || "No Date"})`;
}

// Only the manager sees this one, so it is written to them as a task.
function injuryPendingStatus(data) {
  const employee = data.injuredEmployee || "An employee";
  const prefillNote = data.draftId
    ? "Your copy of the form opens with their answers already filled in, so you only need to add the investigation."
    : "The form opens blank, so you will need to re-enter the details shown below.";

  return {
    tone: "pending",
    text:
      `${employee} filed this injury report and named you as their manager. ` +
      `Complete the Supervisor / Investigation section and HR receives the finished report. ` +
      prefillNote,
    action: { label: "Complete this report", href: injuryFormLink(data.draftId) },
  };
}

const REPORTS = {
  injury: {
    title: "Injury / Accident and Illness Report",
    acceptsPhotos: true,
    recipientEnvKeys: ["HR_EMAIL_TO"],
    defaultRecipients: [HR_FALLBACK_RECIPIENT],
    // The reporting employee names their manager, who is copied so they can
    // complete the investigation section. Restricted to the company domain so
    // the form can't be used to mail arbitrary addresses.
    extraRecipientField: "managerEmail",
    extraRecipientDomain: "geoconinc.com",
    // HR only wants the finished report, so the initial filing goes to the
    // manager alone and HR hears about it once the investigation is attached.
    sendsToPrimary: injuryInvestigationDone,
    subject: (data) =>
      injuryInvestigationDone(data)
        ? `Injury Report – ${injuredEmployeeLabel(data)}`
        : `Action needed: complete the injury report for ${injuredEmployeeLabel(data)}`,
    statusLine: (data) =>
      injuryInvestigationDone(data)
        ? {
            tone: "done",
            text:
              "Complete report — the employee's account and the manager's investigation are both included below.",
          }
        : injuryPendingStatus(data),
    // Hold the employee's half until the manager completes it, so they are
    // never asked to retype the incident.
    savesDraft: (data) => !injuryInvestigationDone(data),
    sections: [
      {
        title: null,
        fields: [
          { name: "injuredEmployee", label: "Injured Employee" },
          { name: "injuryDate", label: "Date of Injury" },
          { name: "injuryTime", label: "Time" },
          { name: "location", label: "Location" },
          { name: "workEngagedIn", label: "Engaged In What Work When Injured" },
          { name: "bodyParts", label: "Parts of Body Affected" },
          { name: "lastDayWorked", label: "Last Day Worked" },
          { name: "witnesses", label: "Witnesses" },
          { name: "accidentDescription", label: "Description of Accident" },
          { name: "injuryNature", label: "Nature and Extent of Injury" },
          { name: "managerEmail", label: "Manager" },
        ],
      },
      {
        title: "Investigation",
        fields: INJURY_INVESTIGATION_FIELDS,
      },
    ],
  },

  offensive: {
    title: "Offensive Behavior Report",
    acceptsPhotos: false,
    recipientEnvKeys: ["HR_EMAIL_TO"],
    defaultRecipients: [HR_FALLBACK_RECIPIENT],
    subject: (data) =>
      `Offensive Behavior Report – ${data.reporterName || "Anonymous"} (${data.incidentDate || "No Date"})`,
    sections: [
      {
        title: null,
        fields: [
          { name: "reporterName", label: "Reported By" },
          { name: "affectedPersons", label: "Person(s) Experiencing the Behavior" },
          { name: "accusedPersons", label: "Person(s) Committing the Behavior" },
          { name: "incidentDate", label: "Date of Behavior" },
          { name: "incidentLocation", label: "Location(s)" },
          { name: "behaviorDescription", label: "Offensive Behavior" },
          { name: "witnesses", label: "Witness(es)" },
        ],
      },
    ],
  },
};

function getReport(reportType) {
  return Object.prototype.hasOwnProperty.call(REPORTS, reportType) ? REPORTS[reportType] : null;
}

function getFieldNames(report) {
  return report.sections.flatMap((section) => section.fields.map((field) => field.name));
}

module.exports = { REPORTS, getReport, getFieldNames };

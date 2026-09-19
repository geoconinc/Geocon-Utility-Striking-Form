// Definitions for the HR report types added alongside the utility strike form.
// The utility strike form is untouched and still runs through
// netlify/functions/submit.js with its own hardcoded field list.

// Used when HR_EMAIL_TO is not configured so the HR forms still deliver.
const HR_FALLBACK_RECIPIENT = "new@geoconinc.com";

const REPORTS = {
  injury: {
    title: "Injury / Accident and Illness Report",
    acceptsPhotos: true,
    recipientEnvKeys: ["HR_EMAIL_TO"],
    defaultRecipients: [HR_FALLBACK_RECIPIENT],
    subject: (data) =>
      `Injury Report – ${data.injuredEmployee || "Unnamed Employee"} (${data.injuryDate || "No Date"})`,
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
          { name: "unsafeCondition", label: "Unsafe Condition or Act That Caused Accident" },
          { name: "preventiveAction", label: "Action Taken to Prevent Similar Accidents" },
          { name: "factsVerified", label: "Facts Verified? How?" },
          { name: "supervisor", label: "Supervisor" },
          { name: "supervisorDate", label: "Date" },
        ],
      },
      {
        title: "Investigation",
        fields: [
          { name: "safePracticeViolated", label: "Code of Safe Practice Violated?" },
          { name: "safePracticeWhich", label: "Which Code Was Violated" },
          { name: "additionalCodeNeeded", label: "Additional Code of Safe Practice Needed?" },
          { name: "additionalCodeDetail", label: "Additional Code Needed" },
          { name: "correctedImmediately", label: "Corrected Immediately?" },
          { name: "interimActions", label: "Interim Actions Until Correction Is Complete" },
          { name: "correctiveActionDate", label: "Date of Corrective Action" },
          { name: "checklistModification", label: "Workplace Inspection Checklist Needs Modification?" },
          { name: "checklistAdditions", label: "What Should Be Added to the Checklist" },
          { name: "investigators", label: "Investigator Name(s) and Title(s)" },
          { name: "investigationDate", label: "Investigation Date" },
          { name: "correctiveActionOwner", label: "Person Responsible for Corrective Actions" },
          { name: "reportReceivedDate", label: "Copy of Report Received On" },
          { name: "managementApproval", label: "Management Approval (Name and Title)" },
        ],
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

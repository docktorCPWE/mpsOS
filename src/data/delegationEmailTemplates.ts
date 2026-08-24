export interface DelegationEmailTemplate {
  id: string;
  name: string;
  category: string;
  generateText: (params: {
    projectNumber: string;
    customerName: string;
    drafterName: string;
    attachedFiles?: string[];
    dateStr?: string;
    revisionCount?: number;
  }) => string;
}

export const DELEGATION_COMPLETION_TEMPLATES: DelegationEmailTemplate[] = [
  {
    id: 'preliminary_plan_completed',
    name: '1. Preliminary plan completed',
    category: 'Preliminary Plans',
    generateText: ({ projectNumber, customerName, drafterName, attachedFiles }) => {
      const filesList = attachedFiles && attachedFiles.length > 0
        ? attachedFiles.map(f => `• ${f}`).join('\n')
        : '[MAIN FLOOR PDF, FOUNDATION DWG, EXTERIOR RENDERS]';

      return `Kyle,

The preliminary plan for ${projectNumber} — ${customerName} is ready for review.

Completed:
[MAIN FLOOR / SECOND FLOOR / BASEMENT / OTHER]

Files:
${filesList}

Drafter notes:
[NOTES OR “No additional notes.”]

Please review and either approve it for customer review or return it with corrections.

${drafterName}`;
    }
  },
  {
    id: 'changes_to_preliminary_completed',
    name: '2. Changes to preliminary plan completed',
    category: 'Plan Revisions',
    generateText: ({ projectNumber, customerName, drafterName, attachedFiles }) => {
      const filesList = attachedFiles && attachedFiles.length > 0
        ? attachedFiles.map(f => `• ${f}`).join('\n')
        : '[UPDATED FILE LINKS OR ATTACHMENTS]';

      return `Kyle,

The requested preliminary changes for ${projectNumber} — ${customerName} have been completed.

Changes were based on:
[CUSTOMER NOTES / JASON’S NOTES / KYLE’S NOTES / MEETING DATE]

Files:
${filesList}

Drafter notes:
[NOTES, UNRESOLVED ITEMS, OR “All requested changes were completed.”]

Please review the updated plan before it is returned to the customer.

${drafterName}`;
    }
  },
  {
    id: 'elevations_completed',
    name: '3. Elevations completed',
    category: 'Elevations',
    generateText: ({ projectNumber, customerName, drafterName, attachedFiles }) => {
      const filesList = attachedFiles && attachedFiles.length > 0
        ? attachedFiles.map(f => `• ${f}`).join('\n')
        : '[FRONT ELEVATION PDF, REAR / SIDE ELEVATIONS DWG]';

      return `Kyle,

The elevations for ${projectNumber} — ${customerName} are ready for review.

Completed:
[FRONT / REAR / LEFT / RIGHT / ROOF PLAN]

Files:
${filesList}

Items needing confirmation:
[ROOF CONDITION, MATERIAL, WINDOW, HEIGHT, OR OTHER QUESTION]
[OR “No additional items need confirmation.”]

Please review the elevations and confirm whether the project can move forward to final review or finals.

${drafterName}`;
    }
  },
  {
    id: 'final_construction_docs_completed',
    name: '4. Final construction documents completed',
    category: 'Construction Documents',
    generateText: ({ projectNumber, customerName, drafterName, attachedFiles }) => {
      const filesList = attachedFiles && attachedFiles.length > 0
        ? attachedFiles.map(f => `• ${f}`).join('\n')
        : '[FINAL PDF LINKS OR ATTACHMENTS]';

      return `Kyle,

The final plan set for ${projectNumber} — ${customerName} is ready for review.

Included:
[FLOOR PLANS]
[FOUNDATION PLAN]
[ROOF PLAN]
[ELEVATIONS]
[ELECTRICAL PLAN]
[OTHER APPLICABLE SHEETS]

Files:
${filesList}

Drafter notes:
[INCOMPLETE ITEMS, QUESTIONS, OR “The complete final set is attached.”]

Please complete the final quality-control review before the plans are released.

${drafterName}`;
    }
  },
  {
    id: 'revisions_after_finals_completed',
    name: '5. Revisions after finals completed',
    category: 'Post-Final Revisions',
    generateText: ({ projectNumber, customerName, drafterName, attachedFiles, dateStr, revisionCount }) => {
      const filesList = attachedFiles && attachedFiles.length > 0
        ? attachedFiles.map(f => `• ${f}`).join('\n')
        : '[REVISED FILE LINKS OR ATTACHMENTS]';

      const revDisplay = revisionCount ? `Rev #${revisionCount}` : '[REVISION NUMBER OR LETTER]';
      const todayFormatted = dateStr || new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

      return `Kyle,

The post-final revisions for ${projectNumber} — ${customerName} have been completed.

Revision: ${revDisplay}
Revision date: ${todayFormatted}
Requested by: [CUSTOMER / BUILDER / JASON / KYLE]

Sheets revised:
[SHEET NUMBERS AND TITLES]

Summary of changes:
[BRIEF CHANGE SUMMARY]

Files:
${filesList}

Please review and approve the revised set before it replaces the previously issued finals.

${drafterName}`;
    }
  }
];

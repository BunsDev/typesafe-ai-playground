import type { Rule } from "../web/workflow";
import { defaults } from "../web/workflow";
export interface WorkflowExample {
  id: string;
  name: string;
  description: string;
  rules: Rule[];
  starters: { label: string; text: string }[];
  followup: string;
  expectedRule: string;
  question?: string;
}
export const WORKFLOW_EXAMPLES: WorkflowExample[] = [
  {
    id: "delivery",
    name: "Damaged delivery",
    description: "Establish the cause before applying the delivery process.",
    rules: defaults(),
    starters: [
      {
        label: "Customer received a broken item",
        text: "A customer reports that their item arrived broken. We have not investigated the cause yet.",
      },
      {
        label: "Delivery damage is confirmed",
        text: "The delivery report confirms the courier dropped the parcel. Photos show it was intact when the sender handed it over.",
      },
    ],
    followup: "The delivery report confirms the courier dropped the parcel.",
    expectedRule: "delivery",
  },
  {
    id: "access",
    name: "Account recovery",
    description:
      "Identity first. Route verified owners to the appropriate recovery process.",
    rules: [
      {
        id: "recover",
        name: "Verified owner · lost access",
        condition:
          "The requester passed the approved identity verification, cannot sign in, and no suspicious account activity was found.",
        action:
          "Send the verified owner through the approved account recovery process.",
      },
      {
        id: "security",
        name: "Suspicious account activity",
        condition: "The investigation confirms unauthorized account activity.",
        action: "Escalate to the security team for account investigation.",
      },
    ],
    starters: [
      {
        label: "I cannot sign in",
        text: "A customer cannot sign in. Identity verification and the activity check are still pending.",
      },
    ],
    question:
      "Has the requester passed identity verification, and did the activity check find unauthorized access?",
    followup:
      "The requester passed the approved identity verification. The activity check found no suspicious activity. They still cannot sign in.",
    expectedRule: "recover",
  },
  {
    id: "billing",
    name: "Duplicate payment",
    description:
      "Distinguish a settled duplicate charge from a pending authorization.",
    rules: [
      {
        id: "duplicate",
        name: "Two settled charges",
        condition:
          "Payment records confirm two settled charges for the same order and no previous refund.",
        action:
          "Recommend refunding the duplicate charge through the billing team.",
      },
      {
        id: "pending",
        name: "Authorization still pending",
        condition:
          "Payment records confirm one settled charge and one pending authorization for the same order.",
        action:
          "Explain the pending authorization and monitor it before considering a refund.",
      },
    ],
    starters: [
      {
        label: "I was charged twice",
        text: "A customer sees two payment entries for one order. We have not checked their settlement or refund status.",
      },
    ],
    question:
      "Do the payment records show two settled charges or a pending authorization, and has either charge already been refunded?",
    followup:
      "Payment records confirm two settled charges for the same order. Neither charge has been refunded.",
    expectedRule: "duplicate",
  },
  {
    id: "incident",
    name: "Service incident",
    description: "Use confirmed impact to choose the response priority.",
    rules: [
      {
        id: "outage",
        name: "Confirmed production outage",
        condition:
          "Monitoring confirms a production service outage affecting multiple customers.",
        action: "Page the on-call team and open a production incident.",
      },
      {
        id: "isolated",
        name: "Isolated client issue",
        condition:
          "Monitoring confirms production is healthy and investigation isolates the issue to one customer's local configuration.",
        action:
          "Route to support with the confirmed local configuration details.",
      },
    ],
    starters: [
      {
        label: "The app is not loading",
        text: "A customer reports that the app is not loading. Service health and the scope of impact are unknown.",
      },
    ],
    question:
      "What does production monitoring show, and is the issue affecting multiple customers or isolated to a local configuration?",
    followup:
      "Monitoring confirms a production service outage affecting multiple customers.",
    expectedRule: "outage",
  },
  {
    id: "expense",
    name: "Expense approval",
    description:
      "Check the receipt, amount, and policy eligibility before routing.",
    rules: [
      {
        id: "standard",
        name: "Standard expense",
        condition:
          "A valid receipt is present, the expense is policy-eligible, and the amount is at most $100.",
        action: "Recommend the standard reimbursement approval queue.",
      },
      {
        id: "manager",
        name: "Manager approval required",
        condition:
          "A valid receipt is present, the expense is policy-eligible, and the amount is greater than $100.",
        action: "Request manager approval before reimbursement.",
      },
    ],
    starters: [
      {
        label: "Can I expense this?",
        text: "An employee asks to reimburse a work purchase. The receipt, amount, and eligibility have not been checked.",
      },
    ],
    question:
      "Is there a valid receipt, what is the amount, and is this expense eligible under the policy?",
    followup:
      "A valid receipt is attached for $180. The expense is confirmed policy-eligible.",
    expectedRule: "manager",
  },
];

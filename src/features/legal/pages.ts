export type PolicyPage = {
  path: string;
  title: string;
  label: string;
  paragraphs: string[];
};

export const POLICY_PAGES: PolicyPage[] = [
  {
    path: "/privacy",
    title: "Privacy",
    label: "Privacy",
    paragraphs: [
      "Tharigopula Technologies runs Closer, an 18+ dating and friends service in Hyderabad. This notice is how we meet the Digital Personal Data Protection Act, 2023 (the DPDP Act).",
      "We collect your phone number to sign you in. We collect profile photos and short voice answers for your profile, and a live selfie so a person on our team can check that the profile is you. We store hashes of contacts you choose to hide from, not the names or numbers in your phone book. We collect a location only while you are using SOS, so a trusted contact can be pointed at where you are.",
      "The phone number is the login. Photos, the selfie, and voice answers are for verification and your profile. Contact hashes keep people you already know from being shown your profile. An SOS location is used for that alert and is not read for the Drop, rooms, or ads.",
      "We keep this while your account is open. Photos, the selfie, voice answers, and contact hashes are removed when you delete the account. Safety reports, messages, and payment records can stay as the record of a complaint or a charge. SOS locations stay with that alert.",
      "Delete the account from You > Delete account. Your profile, photos, selfie, voice answers, preferences and contact hashes are removed at once, and this cannot be undone. We keep a one-way hash of your phone number so that an account banned for safety reasons cannot simply sign up again.",
      "Some trusted companies process data for us only to run the service: Cloudflare (hosting and storage), Razorpay (deposits), MSG91 (login codes by SMS) and LiveKit (voice rooms). Chat messages are checked automatically for phone numbers and abuse before they are delivered.",
      "To raise a privacy grievance, write to the grievance officer. TODO: grievance officer name. TODO: grievance officer phone number. Until those are filled in, email support@closer.example and we will answer as the DPDP contact.",
    ],
  },
  {
    path: "/terms",
    title: "Terms",
    label: "Terms",
    paragraphs: [
      "Closer is for adults. You must be 18 or older. Tharigopula Technologies offers the service from Hyderabad.",
      "One account per person. The photos and the selfie must be of you. Sharing an account, or making one for someone else, is a reason to close it.",
      "Be decent. Do not harass, threaten, or send sexual content to someone who has not asked for it. Do not ask for money, share a payment handle, or move someone off Closer to sell them something. Do not post another person's private photos or chats.",
      "A confirmed report is a strike. Three strikes close the account. One severe report, including a threat or sexual harm, can close it immediately. Banned accounts are not given a new start on the same phone number.",
      "These terms are governed by the laws of India. The courts at Hyderabad have jurisdiction.",
    ],
  },
  {
    path: "/refunds",
    title: "Refunds",
    label: "Refunds",
    paragraphs: [
      "A plan holds a ₹99 deposit so both people have a reason to show up. Razorpay collects it. Closer does not store your card or UPI PIN.",
      "The ₹99 deposit is refunded when both people show up, or when the other person cancels. It is kept when you no-show.",
      "Refunds go back to the original payment method in 5–7 working days after we mark the plan.",
    ],
  },
  {
    path: "/contact",
    title: "Contact",
    label: "Contact",
    paragraphs: [
      "Email support@closer.example for an account, a date, or a payment. TODO: replace support@closer.example if this is not the inbox you will actually read.",
      "Tharigopula Technologies. TODO: registered office address in Hyderabad. TODO: CIN or GSTIN.",
    ],
  },
  {
    path: "/safety-policy",
    title: "Safety",
    label: "Safety policy",
    paragraphs: [
      "Closer is for meeting in public places in Hyderabad. Share your plan with a trusted contact, and use the date-day check-in.",
      "SOS calls 112 on your phone and can alert a trusted contact. We attach a location only for that SOS.",
      "Report someone from their profile or from chat. A person on the safety desk reads severe reports. Three confirmed strikes, or one severe report, can end the account.",
      "If you are in danger, leave for a lit public place and call 112. Closer is not an emergency service.",
    ],
  },
];

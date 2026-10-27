import { describe, expect, it } from "vitest";
import { POLICY_PAGES } from "./pages";

describe("policy pages", () => {
  it("covers the five public routes Razorpay asks for", () => {
    expect(POLICY_PAGES.map((page) => page.path)).toEqual(["/privacy", "/terms", "/refunds", "/contact", "/safety-policy"]);
  });

  it("states what Closer collects and how a member deletes it", () => {
    const privacy = POLICY_PAGES.find((page) => page.path === "/privacy")?.paragraphs.join(" ") ?? "";
    expect(privacy).toMatch(/DPDP Act/);
    expect(privacy).toMatch(/phone number/);
    expect(privacy).toMatch(/photos/i);
    expect(privacy).toMatch(/selfie/);
    expect(privacy).toMatch(/voice/);
    expect(privacy).toMatch(/hashes of contacts/);
    expect(privacy).toMatch(/location only while you are using SOS/);
    expect(privacy).toMatch(/You > Delete account/);
    expect(privacy).toMatch(/TODO: grievance officer name/);
  });

  it("keeps the terms, refund, and contact facts the desk has to stand behind", () => {
    const terms = POLICY_PAGES.find((page) => page.path === "/terms")?.paragraphs.join(" ") ?? "";
    expect(terms).toMatch(/18 or older/);
    expect(terms).toMatch(/One account per person/);
    expect(terms).toMatch(/Three strikes/);
    expect(terms).toMatch(/laws of India/);
    expect(terms).toMatch(/courts at Hyderabad/);
    const refunds = POLICY_PAGES.find((page) => page.path === "/refunds")?.paragraphs.join(" ") ?? "";
    expect(refunds).toMatch(/₹99/);
    expect(refunds).toMatch(/both people show up/);
    expect(refunds).toMatch(/other person cancels/);
    expect(refunds).toMatch(/no-show/);
    expect(refunds).toMatch(/5–7 working days/);
    expect(refunds).toMatch(/original payment method/);
    const contact = POLICY_PAGES.find((page) => page.path === "/contact")?.paragraphs.join(" ") ?? "";
    expect(contact).toMatch(/support@closer.example/);
    expect(contact).toMatch(/TODO: registered office address/);
  });
});

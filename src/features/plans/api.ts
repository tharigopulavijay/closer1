import type { Plan } from "../../lib/types";

export const DEPOSIT_INR = 99;
export const MAX_OPEN_PLANS = 3;
export const PLUS_OPEN_PLANS = 4;
const FORTY_EIGHT_H = 48 * 60 * 60 * 1000;

export function openPlanCount(plans: Plan[]) {
  return plans.filter((plan) => plan.status === "upcoming").length;
}

export function canCreatePlan(plans: Plan[], isPlus: boolean) {
  return openPlanCount(plans) < (isPlus ? PLUS_OPEN_PLANS : MAX_OPEN_PLANS);
}

export function chatIsOpen(plan: Plan, now: number) {
  if (plan.status === "closed") return false;
  if (plan.deposit !== "paid") return false;
  if (plan.keptByMe && plan.keptByThem) return true;
  if (!plan.bookedAt) return false;
  return now < Date.parse(plan.bookedAt) + FORTY_EIGHT_H;
}

export function closesAt(plan: Plan) {
  if (!plan.bookedAt || (plan.keptByMe && plan.keptByThem)) return null;
  return Date.parse(plan.bookedAt) + FORTY_EIGHT_H;
}

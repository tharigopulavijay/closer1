export const DEPOSIT_POLL_MS = 3_000;
export const DEPOSIT_WAIT_MS = 30_000;

export type DepositRow = { userId: string; status: string };
export type DepositPlan = { id: string; deposits: DepositRow[] };

/** Poll the server until this person's deposit is paid, or 30 seconds pass. The client never decides paid on its own. */
export async function watchDeposit(
  planId: string,
  userId: string,
  read: () => Promise<DepositPlan[]>,
  sleep: (ms: number) => Promise<void>,
  now: () => number = Date.now,
): Promise<"paid" | "unpaid"> {
  const start = now();
  for (;;) {
    const plans = await read();
    const mine = plans.find((plan) => plan.id === planId)?.deposits.find((deposit) => deposit.userId === userId);
    if (mine?.status === "paid") return "paid";
    if (now() - start >= DEPOSIT_WAIT_MS) return "unpaid";
    await sleep(DEPOSIT_POLL_MS);
  }
}

type Checkout = {
  open: () => void;
  on: (event: string, cb: () => void) => void;
};

type CheckoutOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  handler: () => void;
  modal: { ondismiss: () => void };
};

type RazorpayWindow = Window & { Razorpay?: new (options: CheckoutOptions) => Checkout };

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export function loadRazorpay(doc: Document = document) {
  const win = doc.defaultView as RazorpayWindow | null;
  if (win?.Razorpay) return Promise.resolve(win.Razorpay);
  return new Promise<NonNullable<RazorpayWindow["Razorpay"]>>((resolve, reject) => {
    const script = doc.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => {
      const Razorpay = (doc.defaultView as RazorpayWindow | null)?.Razorpay;
      if (Razorpay) resolve(Razorpay);
      else reject(new Error("Could not open the payment desk"));
    };
    script.onerror = () => reject(new Error("Could not open the payment desk"));
    doc.head.appendChild(script);
  });
}

export async function openRazorpayCheckout(order: { keyId: string; orderId: string; amount: number; currency: string }) {
  const Razorpay = await loadRazorpay();
  await new Promise<void>((resolve) => {
    const checkout = new Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      handler: () => resolve(),
      modal: { ondismiss: () => resolve() },
    });
    checkout.on("payment.failed", () => resolve());
    checkout.open();
  });
}

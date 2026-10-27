export interface SmsSender {
  send(phone: string, code: string): Promise<void>;
}

export const noopSms: SmsSender = {
  async send() {},
};

let sender: SmsSender = noopSms;

export function setSmsSender(next: SmsSender) {
  sender = next;
}

export function smsSender() {
  return sender;
}

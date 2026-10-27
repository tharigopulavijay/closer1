import { useEffect, useState } from "react";

type Status = { loading: boolean; error: string };

let status: Status = { loading: false, error: "" };
const listeners = new Set<(value: Status) => void>();

function emit() {
  const next = status;
  for (const listener of listeners) listener(next);
}

export function useStatus() {
  const [value, setValue] = useState(status);
  useEffect(() => {
    listeners.add(setValue);
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}

export function clearError() {
  status = { ...status, error: "" };
  emit();
}

export async function withStatus<T>(work: () => Promise<T>): Promise<T> {
  status = { loading: true, error: "" };
  emit();
  try {
    const result = await work();
    status = { loading: false, error: "" };
    emit();
    return result;
  } catch (error) {
    status = { loading: false, error: error instanceof Error ? error.message : "Something went wrong" };
    emit();
    throw error;
  }
}

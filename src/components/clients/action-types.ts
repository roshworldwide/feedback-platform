/**
 * The form-state shape `actions.ts` returns, and its idle value.
 *
 * Kept out of `actions.ts` deliberately: that file has `"use server"` at the
 * top, and Next.js requires every export from a "use server" file to be an
 * async function — a plain object export like `IDLE_CLIENT_FORM` compiles
 * but 500s the moment any action in that file actually runs ("A 'use server'
 * file can only export async functions, found object").
 */

export type ClientFormState = {
  status: "idle" | "saved" | "error";
  /** Names the state and the next action. Never blames the reader. */
  message: string;
};

export const IDLE_CLIENT_FORM: ClientFormState = { status: "idle", message: "" };

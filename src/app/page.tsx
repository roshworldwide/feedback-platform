import { redirect } from "next/navigation";

/**
 * There is no "home". The instrument opens on the numbers.
 * Anyone without a session is stopped at the proxy long before this runs.
 */
export default function RootPage(): never {
  redirect("/overview");
}

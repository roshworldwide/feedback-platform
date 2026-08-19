"use client";

/**
 * Just a styled link to `/audits/new` — pulled into its own Client Component
 * because `Button`'s `leadingIcon` prop takes a bare `lucide-react` component
 * reference, and a Server Component can't hand one of those across the RSC
 * boundary (only rendered elements or values from another Client Component
 * survive the crossing). Wrapping it here keeps the icon on the client side
 * of that line entirely.
 */

import { Plus } from "lucide-react";
import { Button } from "@/components/ui";

export function NewAuditButton() {
  return (
    <Button variant="metal" size="m" leadingIcon={Plus} href="/audits/new">
      New audit
    </Button>
  );
}

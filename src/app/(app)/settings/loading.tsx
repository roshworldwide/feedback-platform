/**
 * The Settings skeleton — the tab strip and the shape of the first panel, so
 * the tabs do not appear to move when the rows land under them.
 */

import { Card, CardBody, CardHeader, CardTitle, Skeleton } from "@/components/ui";

export default function SettingsLoading() {
  return (
    <Card>
      <CardHeader>
        <CardTitle
          as="h2"
          description="People, the sending identity, the finish, your data, and the record of who did what."
        >
          Settings
        </CardTitle>
      </CardHeader>
      <CardBody>
        <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
          <div
            className="flex items-end"
            style={{
              gap: "var(--space-5)",
              paddingBottom: "var(--space-2)",
              borderBottom: "1px solid var(--stroke-hairline)",
            }}
          >
            {["Team", "Sender", "Appearance", "Data", "Audit log"].map((label) => (
              <Skeleton key={label} width={`${label.length * 9}px`} height="var(--space-4)" />
            ))}
          </div>

          <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
            <Skeleton width="52%" height="var(--space-4)" />
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} height="44px" />
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

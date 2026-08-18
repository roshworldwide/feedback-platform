"use client";

/**
 * The five settings surfaces.
 *
 * The chosen tab lives in the URL, so a link to the audit log is a link to the
 * audit log — and the log's own filters survive a reload rather than resetting
 * to "everything" the moment the page comes back.
 */

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Tab, TabList, TabPanel, Tabs } from "@/components/ui";
import type { SettingsTab } from "./settings-tabs-shared";

export type SettingsTabsProps = {
  tab: SettingsTab;
  /** Counts beside a label are always the true total. */
  teamCount: number | null;
  auditCount: number | null;
  team: ReactNode;
  sender: ReactNode;
  appearance: ReactNode;
  data: ReactNode;
  audit: ReactNode;
};

export function SettingsTabs({
  tab,
  teamCount,
  auditCount,
  team,
  sender,
  appearance,
  data,
  audit,
}: SettingsTabsProps) {
  const router = useRouter();

  return (
    <Tabs
      value={tab}
      defaultValue="team"
      onValueChange={(value) =>
        router.replace(value === "team" ? "/settings" : `/settings?tab=${value}`, {
          scroll: false,
        })
      }
    >
      <TabList label="Settings sections">
        <Tab value="team" count={teamCount}>
          Team
        </Tab>
        <Tab value="sender">Sender</Tab>
        <Tab value="appearance">Appearance</Tab>
        <Tab value="data">Data</Tab>
        <Tab value="audit" count={auditCount}>
          Audit log
        </Tab>
      </TabList>

      <TabPanel value="team">{team}</TabPanel>
      <TabPanel value="sender">{sender}</TabPanel>
      <TabPanel value="appearance">{appearance}</TabPanel>
      <TabPanel value="data">{data}</TabPanel>
      <TabPanel value="audit">{audit}</TabPanel>
    </Tabs>
  );
}

"use client";

import { P2PProvider } from "react-p2p-host";
import { DemoContent } from "@/components/demo-content";

export function P2PDemoRoot() {
  return (
    <P2PProvider persist={{ key: "demo-chat" }}>
      <DemoContent />
    </P2PProvider>
  );
}

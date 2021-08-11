import React from "react";
import { PageHeader } from "antd";

export default function Header() {
  return (
    <a href="/" /*target="_blank" rel="noopener noreferrer"*/>
      <PageHeader
        title="Steaker"
        subTitle="stake you ETH and never get it back!"
        style={{ cursor: "pointer" }}
      />
    </a>
  );
}

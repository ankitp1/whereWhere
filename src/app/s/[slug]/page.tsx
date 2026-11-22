import React from "react";
import SessionView from "./SessionView";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <SessionView slug={slug} />;
}

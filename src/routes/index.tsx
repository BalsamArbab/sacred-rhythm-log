import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    const seen = typeof window !== "undefined" && sessionStorage.getItem("splash_seen");
    throw redirect({ to: seen ? "/today" : "/splash" });
  },
});

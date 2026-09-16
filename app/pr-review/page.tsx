import type { Metadata } from "next";
import { PullRequestReview } from "../../components/pr-review";
export const metadata: Metadata = { title: "PR review · TypeSafe Playground" };
export default function Page() {
  return <PullRequestReview />;
}

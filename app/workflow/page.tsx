import type { Metadata } from "next";
import { Workflow } from "../../components/workflow";
export default function Page() {
  return <Workflow />;
}

export const metadata: Metadata = {
  title: "Workflow chat · TypeSafe Playground",
};

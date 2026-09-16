import type { Metadata } from "next";
import { Extraction } from "../../components/extraction";
export default function Page() {
  return <Extraction />;
}

export const metadata: Metadata = {
  title: "Document extraction · TypeSafe Playground",
};

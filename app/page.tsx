import type { Metadata } from "next";
import { Examples } from "../components/examples";
export default function Page() {
  return <Examples />;
}

export const metadata: Metadata = { title: "Examples · TypeSafe Playground" };

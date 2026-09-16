import type { Metadata } from "next";
import { AskGateLab } from "../../components/AskGateLab";
export default function Page() {
  return <AskGateLab />;
}

export const metadata: Metadata = {
  title: "Ask gate · TypeSafe Playground",
};

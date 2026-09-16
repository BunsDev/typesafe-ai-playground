import type { Metadata } from "next";
import { Conversation } from "../../components/conversation";
export default function Page() {
  return <Conversation />;
}

export const metadata: Metadata = {
  title: "Conversation lab · TypeSafe Playground",
};

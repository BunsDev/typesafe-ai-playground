import type { Metadata } from "next";
import { Memes } from "../../components/memes";
export default function Page() {
  return <Memes />;
}

export const metadata: Metadata = { title: "Meme lab · TypeSafe Playground" };

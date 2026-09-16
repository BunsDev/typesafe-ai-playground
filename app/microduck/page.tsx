import type { Metadata } from "next";
import { MicroDuckLab } from "../../components/MicroDuckLab";
export default function Page() {
  return <MicroDuckLab />;
}

export const metadata: Metadata = {
  title: "MicroDuck arena · TypeSafe Playground",
};

import { pageMetadata } from "../lib/social";
import { PlaygroundHome } from "../components/PlaygroundHome";
export default function Page() {
  return <PlaygroundHome />;
}
export const metadata = pageMetadata("home");

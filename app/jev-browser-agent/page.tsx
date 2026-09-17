import { BrowserAgentLab } from "../../components/BrowserAgentLab";
import { BrowserAgentGuide } from "../../components/BrowserAgentGuide";
import { pageMetadata } from "../../lib/social";
export const metadata = pageMetadata("jev-browser-agent");
export default function Page() {
  return (
    <>
      <BrowserAgentLab />
      <div className="workspace compact-lab agent-guide-wrap">
        <BrowserAgentGuide />
      </div>
    </>
  );
}

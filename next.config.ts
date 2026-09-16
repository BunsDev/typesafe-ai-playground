import type { NextConfig } from 'next';
const config: NextConfig = {
  async redirects() {
    return [{source:'/conversation.html',destination:'/conversation',permanent:true},{source:'/workflow.html',destination:'/workflow',permanent:true},{source:'/extraction.html',destination:'/extraction',permanent:true}];
  },
};
export default config;

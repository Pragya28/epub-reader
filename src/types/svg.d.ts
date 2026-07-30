declare module "*.svg?react" {
  import * as React from "react";
  const component: React.FC<React.SVGProps<SVGSVGElement>>;
  export default component;
}

declare module "*.svg?raw" {
  const src: string;
  export default src;
}

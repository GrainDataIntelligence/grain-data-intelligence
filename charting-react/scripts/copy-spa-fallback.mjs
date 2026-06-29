import { copyFileSync } from "node:fs";
import { join } from "node:path";

const dist = join(process.cwd(), "dist");
copyFileSync(join(dist, "index.html"), join(dist, "404.html"));

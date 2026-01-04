import { Hono } from "hono";
import type { Env } from "../../types/env";
import slack from "./slack";

const integrations = new Hono<{ Bindings: Env }>();

integrations.route("/slack", slack);

export default integrations;

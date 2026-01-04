import { Hono } from "hono";
import type { Env } from "../../../types/env";
import events from "./events";

const slack = new Hono<{ Bindings: Env }>();

slack.route("/events", events);

export default slack;

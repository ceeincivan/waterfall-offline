import { createFileRoute } from "@tanstack/react-router";
import { WaterfallApp } from "@/components/waterfall/app";

export const Route = createFileRoute("/")({ component: WaterfallApp });

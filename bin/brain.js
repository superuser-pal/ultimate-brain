#!/usr/bin/env node
// Committed launcher, so the bin path exists before the build (npm checks bin paths before prepack).
import { runCli } from "../dist/cli.js";

process.exitCode = await runCli(process.argv.slice(2));

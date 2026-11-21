#!/usr/bin/env node
import { config as loadEnv } from "dotenv";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import WebSocket from "ws";

const argv = process.argv.slice(2);

if (argv.includes("--help") || argv.includes("-h")) {
    console.log("Usage: simplenotesscraper [--env-dir <folder containing .env>]");
    console.log("Exports all Simplenote notes as .txt files into ./output (relative to the current folder).");
    process.exit(0);
}

const envDirIndex = argv.indexOf("--env-dir");
const envDir = envDirIndex !== -1 ? argv[envDirIndex + 1] : undefined;

if (envDirIndex !== -1 && !envDir) {
    throw new Error("--env-dir requires a folder path");
}

loadEnv({ path: join(envDir ?? process.cwd(), ".env") });

const { TOKEN, GMAIL } = process.env;

if (!TOKEN || !GMAIL) {
    throw new Error("TOKEN and GMAIL must be set in .env");
}

const outputDirectory = join(process.cwd(), "output");

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });

const sanitizeFileName = (title: string) => {
    const sanitizedTitle = title
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
        .replace(/[. ]+$/g, "")
        .slice(0, 200);

    if (!sanitizedTitle) {
        return "Untitled";
    }

    return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(sanitizedTitle)
        ? `_${sanitizedTitle}`
        : sanitizedTitle;
};

const ws = new WebSocket(
    "wss://api.simperium.com/sock/1/chalk-bump-f49/websocket"
);

ws.on("open", () => {
    console.log("connected");

    const init = {
        name: "note",
        clientid: `node-${crypto.randomUUID()}`,
        api: "1.1",
        token: TOKEN,
        app_id: "chalk-bump-f49",
        library: "node-simperium",
        version: "0.0.1",
    };

    ws.send(`0:init:${JSON.stringify(init)}`);
});

ws.on("message", (raw) => {
    const msg = raw.toString();

    if (msg.startsWith("0:auth:")) {
        console.log("authenticated as", GMAIL);

        ws.send("0:i:1:::10000");
        return;
    }

    if (msg.startsWith("0:i:")) {
        const payload = JSON.parse(msg.slice(4));

        const notes = payload.index
            .filter((item: any) => !item.d?.deleted)
            .map((item: any) => {
                const content = item.d?.content ?? "";

                return {
                    id: item.id,
                    version: item.v,
                    title: content.split(/\r?\n/)[0] || "Untitled",
                    content,
                    tags: item.d?.tags ?? [],
                    systemTags: item.d?.systemTags ?? [],
                    creationDate: item.d?.creationDate
                        ? new Date(item.d.creationDate * 1000)
                        : null,
                    modificationDate: item.d?.modificationDate
                        ? new Date(item.d.modificationDate * 1000)
                        : null,
                };
            });

        notes.forEach((note: any) => {
            const fileName = `${sanitizeFileName(note.title)}.txt`;
            writeFileSync(join(outputDirectory, fileName), note.content, "utf8");
        });

        console.log("\nNOTES:");
        console.dir(notes, { depth: null });

        console.log("\nmark:", payload.mark);
        console.log("current:", payload.current);

        ws.close();
        return;
    }

    if (msg.startsWith("0:o:")) {
        console.log("received schema");
        return;
    }

    if (!msg.startsWith("h:")) {
        console.log("RECV:", msg);
    }
});

ws.on("close", (code, reason) => {
    console.log("closed:", code, reason.toString());
});

ws.on("error", (err) => {
    console.error("ws error:", err);
});

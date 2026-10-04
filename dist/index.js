"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const ws_1 = __importDefault(require("ws"));
const { TOKEN, GMAIL } = process.env;
if (!TOKEN || !GMAIL) {
    throw new Error("TOKEN and GMAIL must be set in .env");
}
const ws = new ws_1.default("wss://api.simperium.com/sock/1/chalk-bump-f49/websocket");
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
            .filter((item) => { var _a; return !((_a = item.d) === null || _a === void 0 ? void 0 : _a.deleted); })
            .map((item) => {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const content = (_b = (_a = item.d) === null || _a === void 0 ? void 0 : _a.content) !== null && _b !== void 0 ? _b : "";
            return {
                id: item.id,
                version: item.v,
                title: content.split(/\r?\n/)[0] || "Untitled",
                content,
                tags: (_d = (_c = item.d) === null || _c === void 0 ? void 0 : _c.tags) !== null && _d !== void 0 ? _d : [],
                systemTags: (_f = (_e = item.d) === null || _e === void 0 ? void 0 : _e.systemTags) !== null && _f !== void 0 ? _f : [],
                creationDate: ((_g = item.d) === null || _g === void 0 ? void 0 : _g.creationDate)
                    ? new Date(item.d.creationDate * 1000)
                    : null,
                modificationDate: ((_h = item.d) === null || _h === void 0 ? void 0 : _h.modificationDate)
                    ? new Date(item.d.modificationDate * 1000)
                    : null,
            };
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

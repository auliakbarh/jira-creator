"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readInputFile = readInputFile;
exports.validateItems = validateItems;
exports.normalizeItems = normalizeItems;
const promises_1 = require("fs/promises");
const sync_1 = require("csv-parse/sync");
const path_1 = __importDefault(require("path"));
async function readInputFile(filePath) {
    const ext = path_1.default.extname(filePath).toLowerCase();
    const raw = await (0, promises_1.readFile)(filePath, 'utf-8');
    if (ext === '.json') {
        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed) ? parsed : parsed.tickets ?? [parsed];
        return items;
    }
    if (ext === '.csv') {
        const rows = (0, sync_1.parse)(raw, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });
        return rows.map(row => ({
            ...row,
            labels: row.labels ? row.labels.split('|').map(s => s.trim()) : [],
            components: row.components ? row.components.split('|').map(s => s.trim()) : [],
            story_points: row.story_points ? Number(row.story_points) : undefined,
        }));
    }
    if (ext === '.txt' || ext === '') {
        return [{ summary: raw.trim().split('\n')[0], description: raw.trim() }];
    }
    throw new Error(`Unsupported file type: ${ext}. Use .json, .csv, or .txt`);
}
function validateItems(items) {
    return items.flatMap((item, i) => {
        if (!item.summary && !item.description) {
            return [`Row ${i + 1}: must have at least "summary" or "description"`];
        }
        return [];
    });
}
// If only description given, derive summary from first sentence
function normalizeItems(items) {
    return items.map(item => {
        if (!item.summary && item.description) {
            const firstLine = item.description.split(/[.\n]/)[0].trim();
            item.summary = firstLine.slice(0, 200);
        }
        return item;
    });
}

import * as fs from "fs";
import * as path from "path";

const srcDir = path.join(__dirname, "../../src/test/fixtures");
const outDir = path.join(__dirname, "../../out/test/fixtures");

// Create output directory if it doesn't exist
if (!fs.existsSync(outDir)) {
	fs.mkdirSync(outDir, { recursive: true });
}

// Copy all files from src/test/fixtures to out/test/fixtures
fs.readdirSync(srcDir).forEach(file => {
	fs.copyFileSync(path.join(srcDir, file), path.join(outDir, file));
});

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

class WikipediaIntegration {
    constructor(wikipediaDbPath = "./wikipedia.db") {
        this.wikipediaDbPath = wikipediaDbPath;
        this.searchEngine = null;
        this.contextExtractor = null;
        this.available = false;
        this.initializeWikipedia();
    }

    async initializeWikipedia() {
        try {
            // Check if Wikipedia database exists
            if (!fs.existsSync(this.wikipediaDbPath)) {
                console.log("⚠️ Wikipedia database not found. Use setup script to download.");
                console.log("⚠️ Expected path: " + this.wikipediaDbPath);
                return;
            }

            // Initialize Python search engine
            this.available = true;
            console.log("✅ Wikipedia integration available");
        } catch (error) {
            console.log("⚠️ Wikipedia integration failed:", error.message);
            this.available = false;
        }
    }

    async searchWikipedia(query, limit = 5) {
        if (!this.available) {
            return { results: [], error: "Wikipedia not available" };
        }

        try {
            const result = await this.runPythonScript("search", { query, limit });
            return JSON.parse(result);
        } catch (error) {
            console.error("Wikipedia search failed:", error);
            return { results: [], error: error.message };
        }
    }

    async getWikipediaContext(query, maxLength = 2000) {
        if (!this.available) {
            return { context: "", sources: [], confidence: 0 };
        }

        try {
            const result = await this.runPythonScript("context", { query, maxLength });
            return JSON.parse(result);
        } catch (error) {
            console.error("Wikipedia context extraction failed:", error);
            return { context: "", sources: [], confidence: 0 };
        }
    }

    async getWikipediaStats() {
        if (!this.available) {
            return { error: "Wikipedia not available" };
        }

        try {
            const result = await this.runPythonScript("stats", {});
            return JSON.parse(result);
        } catch (error) {
            console.error("Wikipedia stats failed:", error);
            return { error: error.message };
        }
    }

    runPythonScript(action, params) {
        return new Promise((resolve, reject) => {
            const pythonProcess = spawn("python3", [
                path.join(__dirname, "wikipedia_api.py"),
                action,
                JSON.stringify(params),
            ]);

            let output = "";
            let errorOutput = "";

            pythonProcess.stdout.on("data", (data) => {
                output += data.toString();
            });

            pythonProcess.stderr.on("data", (data) => {
                errorOutput += data.toString();
            });

            pythonProcess.on("close", (code) => {
                if (code === 0) {
                    resolve(output.trim());
                } else {
                    reject(new Error(`Python script failed: ${errorOutput}`));
                }
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                pythonProcess.kill();
                reject(new Error("Wikipedia search timeout"));
            }, 30000);
        });
    }

    async getArticle(title) {
        if (!this.available) {
            return null;
        }

        try {
            const result = await this.runPythonScript("get_article", { title });
            const parsed = JSON.parse(result);
            return parsed.article || null;
        } catch (error) {
            console.error("Wikipedia article retrieval failed:", error);
            return null;
        }
    }
}

module.exports = WikipediaIntegration;



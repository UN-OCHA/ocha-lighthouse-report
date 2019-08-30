const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require("fs");
const async = require("async");

const configJson = JSON.parse(fs.readFileSync("config.json"));

// Build destionation filename
const file = configJson.filename;
const today = new Date();
//const folder = configJson.sortByDate ? configJson.writeTo + today.getFullYear() + "/" + (today.getMonth() + 1) + "/" : configJson.writeTo + file.replace("." + configJson.lighthouseFlags.output, "") + "/" + today.getFullYear() + "/" + (today.getMonth() + 1) + "/";
const folder = "./";
const file_prefix = today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate() + "-";
const dest_file = folder + file_prefix + file;

const max_attempts = configJson.max_attempts;

if (configJson.url){
    console.log("Analyzing " + configJson.url.length + " urls")
    async.eachSeries(configJson.url, function (address, next) {

        console.log("Starting analysis on " + address);
        launchChromeAndRunLighthouse(address, configJson, 0)
            .then(results => {next();})
            .catch(err => { console.log(err)});
    });
} else {
    console.log ("ERROR: Config file config.json should be in the same route than the script and have the url, lighthouseFlags, chromeFlags, writeTo, filename, max_attempts fields");
}


function launchChromeAndRunLighthouse(url, configJson, n_attempts = 0) {
    let resultJson;
    return chromeLauncher.launch({chromeFlags: configJson.chromeFlags}).then(chrome => {
        console.log("Launching lighthouse for " + url);
        configJson.lighthouseFlags.port = chrome.port;
        return lighthouse(url, configJson.lighthouseFlags).then(res => {
            console.log("Parsing report for " + url);
            resultJson = JSON.parse(res.report);
            if ((!resultJson.categories.performance.score ) && (resultJson.runtimeError.code === "NO_ERROR") && ( n_attempts < max_attempts) )
            {
                console.log(url + " run successfully with 0 performance, rerunning lighthouse. Attempt: " + n_attempts + " of " + max_attempts );
                n_attempts++;
                launchChromeAndRunLighthouse(url, configJson, n_attempts)
                    .catch(err => {
                        console.log(err)
                    });
            } else {
                writeResults(folder, dest_file, url, resultJson);
            }
            chrome.kill().catch(err => { console.log(err) });
        });
    });
}

function writeResults (folder, dest_file, address, resultJson) {

    let resultString;

    console.log("Writing analysis to " + dest_file);
    fs.mkdir(folder, {recursive: true}, (err) => {
        if (!err) {
            resultString = resultJson.lighthouseVersion + ", " +
                resultJson.fetchTime + ", " +
                address + ", " +
                resultJson.finalUrl + ", " +
                resultJson.runtimeError.code + ", " +
                resultJson.categories.performance.score * 100 + ", " +
                resultJson.categories.accessibility.score * 100 + ", " +
                resultJson.categories["best-practices"].score * 100 + ", " +
                resultJson.categories.seo.score * 100 + ", " +
                resultJson.categories.pwa.score * 100 + "\n";
            // if file doesn't exist then write headers

            fs.appendFile(dest_file, resultString, (err) => {

                if (err) {
                    console.log(err);
                } else {
                    console.log("Analysis saved to " + dest_file);
                    console.log(resultString);
                }

            });
        } else {
            console.log(err);
        }
    });

}


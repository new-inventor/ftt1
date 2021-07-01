const path = require('path');
const fs = require('fs');
const jsYaml = require("js-yaml");
const dot = require('dot-object');
const http = require('http');
const https = require('https');

class YamlRecursiveLoader {
    loadedFileValues = {};

    async readHttps(path) {
        return await new Promise((resolve) => {
            https.get(path, (res) => {
                console.log('res', res);
                res.on('data', (d) => {
                    resolve(d);
                })
            }).on('error', (e) => {
                console.log('https error: ', e);
                resolve('')
            })
        })
    }

    async readHttp(path) {
        return await new Promise((resolve) => {
            http.request(path, (res) => {
                console.log('res', res);
                res.on('data', (d) => {
                    resolve(d)
                });
            }).on('error', (e) => {
                console.log('Http error: ', e);
                resolve('')
            });
        })
    }

    async readFile(path) {
        return fs.readFileSync(path);
    }

    async read(path) {
        if (path.startsWith('https')) {
            return this.readHttps(path);
        }
        if (path.startsWith('http')) {
            return this.readHttp(path);
        }
        return this.readFile(path);
    }

    clearCache() {
        this.loadedFileValues = {};
    }

    async loadYaml(fileName, rootPath) {
        const readFilePath = path.join(rootPath, fileName);
        let file = await this.read(readFilePath);
        const resArray = jsYaml.loadAll(file);
        const res = resArray[0];
        if (resArray.length > 1) {
            for (const dotKey of resArray[1]['importFileKeys']) {
                const localFilePath = dot.pick(dotKey, res);
                let absoluteFilePath = localFilePath;
                if (absoluteFilePath.startsWith('http')) {
                    this.loadedFileValues[absoluteFilePath] = await this.loadYaml('', absoluteFilePath);
                } else {
                    if (!path.isAbsolute(localFilePath)) {
                        absoluteFilePath = path.normalize(path.join(rootPath, path.dirname(localFilePath), path.basename(localFilePath)));
                    }
                    if (!this.loadedFileValues[absoluteFilePath]) {
                        this.loadedFileValues[absoluteFilePath] = await this.loadYaml(path.basename(absoluteFilePath), path.join(path.dirname(absoluteFilePath)));
                    }
                }
                let loadedFile = this.loadedFileValues[absoluteFilePath];
                dot.set(dotKey, loadedFile, res, false);
            }
        }
        return res;
    }
}

module.exports = YamlRecursiveLoader;

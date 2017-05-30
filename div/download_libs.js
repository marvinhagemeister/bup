'use strict';
// Download static libraries

const assert = require('assert');
const fs = require('fs');
const https = require('https');
const path = require('path');
const { mkdir, readJson, exists } = require('nicer-fs');

async function download_file_ifneeded(url, fn) {
	const res = await exists(fn);
	if (!res) {
		return await download_file(url, fn);
	}
}

function download_file(url, fn, cb) {
	console.log('Downloading ' + url);
	const tmp_fn = fn + '.download';
	const file = fs.createWriteStream(tmp_fn);

	return new Promise((resolve, reject) => {
		https.get(url, response => {
			if (response.statusCode !== 200) {
				return reject(new Error(url + ' failed with code ' + response.statusCode));
			}
			response.pipe(file);
			file.on('finish', () => {
				file.close((err) => {
					if (err) {
						fs.unlink(tmp_fn);
						return reject(err);
					}

					fs.rename(tmp_fn, fn, resolve);
				});
			});
		}).on('error', (err) => {
			fs.unlink(tmp_fn);
			if (cb) {
				reject(err);
			}
		});
	});
}

async function main() {
	const args = process.argv.slice(2);
	if (args.length !== 2) {
		console.log('Usage: ' + process.argv[1] + ' LIBCONFIG.json LIB_DIR');
		return process.exit(1);
	}
	const config_fn = args[0];
	const lib_dir = args[1];

	try {
		await mkdir(lib_dir);
		const libs = await readJson(config_fn);
		assert(Array.isArray(libs));

		await Promise.all(libs.map(lib => {
			return download_file_ifneeded(lib.url, path.join(lib_dir, lib.file));
		}));
	} catch (err) {
		throw err;
	}
}

main();
